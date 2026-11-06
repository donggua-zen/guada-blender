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

module.exports = { runProcess, clip, killTree };
