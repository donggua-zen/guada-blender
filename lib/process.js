'use strict';

/**
 * 子进程执行：spawn + 超时 + abort + 输出截断。
 *
 * 不在 shell 里执行（避免引号/空格/注入问题）；Windows 下用
 * `taskkill /T /F` 结束整棵进程树，防止 Blender 子进程残留。
 */

const { spawn } = require('node:child_process');

function clip(text, max = 20000) {
  const value = String(text || '');
  if (value.length <= max) return value;
  const head = Math.floor(max * 0.6);
  const tail = Math.max(0, max - head);
  return `${value.slice(0, head)}\n…[truncated ${value.length - max} chars]…\n${value.slice(-tail)}`;
}

function killTree(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32' && child.pid) {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
    } catch {
      /* fall through to child.kill */
    }
  }
  try {
    child.kill('SIGKILL');
  } catch {
    /* ignore */
  }
}

/**
 * @returns {Promise<{code:number,stdout:string,stderr:string,timedOut:boolean,aborted:boolean,error?:string,durationMs:number}>}
 */
function runProcess(command, args, options = {}) {
  const {
    cwd,
    env,
    timeoutMs = 180000,
    maxOutputChars = 20000,
    signal,
  } = options;

  return new Promise((resolve) => {
    const started = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let aborted = false;
    let settled = false;
    let spawnError = null;

    let child;
    try {
      child = spawn(command, args, {
        cwd,
        env: env || process.env,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      resolve({
        code: -1,
        stdout: '',
        stderr: '',
        timedOut: false,
        aborted: false,
        error: err && err.message ? err.message : String(err),
        durationMs: Date.now() - started,
      });
      return;
    }

    const cap = Math.max(1024, maxOutputChars * 3);
    child.stdout.on('data', (chunk) => {
      if (stdout.length < cap) stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      if (stderr.length < cap) stderr += chunk.toString('utf8');
    });

    const finish = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve({
        code,
        stdout: clip(stdout, maxOutputChars),
        stderr: clip(stderr, maxOutputChars),
        timedOut,
        aborted,
        error: spawnError || undefined,
        durationMs: Date.now() - started,
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, Math.max(100, Number(timeoutMs) || 180000));

    const onAbort = () => {
      aborted = true;
      killTree(child);
    };
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }

    child.on('error', (err) => {
      spawnError = err && err.message ? err.message : String(err);
    });
    child.on('close', (code) => finish(typeof code === 'number' ? code : -1));
  });
}

/**
 * 后台执行：把 stdout/stderr 追加写入日志文件，返回句柄供 JobRegistry 使用。
 *
 * 与 runProcess 的区别：不 await、不缓存输出，只落盘；调用方通过
 * 按字节偏移读取日志文件实现 job_read 的增量语义。
 *
 * @returns {{ child, done: Promise<{status,exitCode,detail}>, kill: () => void, logFilePath }}
 */
function spawnToLog(command, args, options = {}) {
  const {
    cwd,
    env,
    logFilePath,
    timeoutMs = 0,
    signal,
  } = options;

  const fs = require('node:fs');
  const path = require('node:path');
  fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
  const stream = fs.createWriteStream(logFilePath, { flags: 'a' });

  let settled = false;
  let killed = false;
  let timer = null;
  let child;
  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });

  const finish = (status, exitCode, detail) => {
    if (settled) return;
    settled = true;
    if (timer) clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
    try {
      stream.end();
    } catch {
      /* ignore */
    }
    resolveDone({ status, exitCode, detail });
  };

  const kill = () => {
    if (!child) return;
    killed = true;
    killTree(child);
  };

  const onAbort = () => kill();

  try {
    child = spawn(command, args, {
      cwd,
      env: env || process.env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    stream.write(`[spawn error] ${err && err.message ? err.message : String(err)}\n`);
    finish('failed', -1, err && err.message ? err.message : String(err));
    return { child: null, done, kill, logFilePath };
  }

  child.stdout.on('data', (chunk) => stream.write(chunk));
  child.stderr.on('data', (chunk) => stream.write(chunk));
  child.on('error', (err) => {
    stream.write(`[spawn error] ${err && err.message ? err.message : String(err)}\n`);
  });
  child.on('close', (code) => {
    if (killed) finish('killed', code, 'cancelled');
    else if (typeof code === 'number' && code !== 0) finish('failed', code, `exit ${code}`);
    else finish('completed', code, undefined);
  });

  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  if (Number(timeoutMs) > 0) {
    timer = setTimeout(() => {
      stream.write(`\n[timeout] killed after ${timeoutMs}ms\n`);
      kill();
    }, Number(timeoutMs));
  }

  return { child, done, kill, logFilePath };
}

/**
 * 按字节偏移读取日志文件（job_read 语义）。
 */
async function readLogSlice(logFilePath, options = {}) {
  const fs = require('node:fs');
  const maxBytes = Math.max(1, Number(options.maxBytes) || 64 * 1024);
  let stat;
  try {
    stat = await fs.promises.stat(logFilePath);
  } catch {
    return { text: '', offset: 0, nextOffset: 0, size: 0, truncated: false, logFilePath };
  }
  const size = stat.size;
  let offset = Number.isFinite(options.offset) ? Number(options.offset) : Math.max(0, size - maxBytes);
  if (offset > size) offset = 0;
  const length = Math.min(maxBytes, size - offset);
  if (length <= 0) {
    return { text: '', offset, nextOffset: size, size, truncated: false, logFilePath };
  }
  const handle = await fs.promises.open(logFilePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, offset);
    return {
      text: buffer.toString('utf8'),
      offset,
      nextOffset: offset + length,
      size,
      truncated: length < size,
      logFilePath,
    };
  } finally {
    await handle.close();
  }
}

module.exports = {
  runProcess,
  spawnToLog,
  readLogSlice,
  clip,
  killTree,
};
