'use strict';

/**
 * Helper 执行器：参数校验 → workspace 路径解析 → 构建 argv → 子进程 → 收集产物。
 */

const fs = require('node:fs');
const path = require('node:path');

const { runProcess, clip } = require('./process');
const {
  resolveWorkspacePath,
  assertRegularFile,
  assertDirectory,
  assertWritableTarget,
} = require('./paths');

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg']);

function isTruthy(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function assertValue(spec, value) {
  if (spec.type === 'path-array') {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error(`arguments.${spec.name} must be a non-empty array`);
    }
  }
  if (spec.type === 'integer') {
    const n = Number(value);
    if (!Number.isInteger(n)) throw new Error(`arguments.${spec.name} must be an integer`);
    return;
  }
  if (spec.type === 'number') {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`arguments.${spec.name} must be a number`);
    return;
  }
  if (spec.type === 'string' && spec.choices && !spec.choices.includes(String(value))) {
    throw new Error(
      `arguments.${spec.name} must be one of: ${spec.choices.join(', ')}`,
    );
  }
}

async function resolveHelperPath(rawPath, spec, session, config, allowOverwrite) {
  const kind = spec.pathKind || 'input-path';
  if (kind === 'input-file') {
    const resolved = await resolveWorkspacePath(rawPath, session, config, {
      mustExist: true,
      kind: spec.name,
    });
    await assertRegularFile(resolved, spec.name);
    return resolved;
  }
  if (kind === 'input-dir') {
    const resolved = await resolveWorkspacePath(rawPath, session, config, {
      mustExist: true,
      kind: spec.name,
    });
    await assertDirectory(resolved, spec.name);
    return resolved;
  }
  if (kind === 'input-path') {
    const resolved = await resolveWorkspacePath(rawPath, session, config, {
      mustExist: true,
      kind: spec.name,
    });
    await fs.promises.stat(resolved);
    return resolved;
  }
  if (kind === 'output-file') {
    const resolved = await resolveWorkspacePath(rawPath, session, config, {
      kind: spec.name,
    });
    await assertWritableTarget(resolved, allowOverwrite, spec.name);
    return resolved;
  }
  if (kind === 'output-dir') {
    const resolved = await resolveWorkspacePath(rawPath, session, config, {
      kind: spec.name,
    });
    await fs.promises.mkdir(resolved, { recursive: true });
    return resolved;
  }
  throw new Error(`unsupported pathKind for ${spec.name}: ${kind}`);
}

async function buildHelperInvocation(helper, rawArguments, options) {
  const args = rawArguments || {};
  if (typeof args !== 'object' || Array.isArray(args)) {
    throw new Error('arguments_json must decode to an object');
  }
  const known = new Set(helper.arguments.map((spec) => spec.name));
  const unknown = Object.keys(args).filter((key) => !known.has(key));
  if (unknown.length) throw new Error(`unknown helper arguments: ${unknown.join(', ')}`);

  const argv = [];
  const outputs = [];
  for (const spec of helper.arguments) {
    let value = args[spec.name];
    if (value === undefined || value === null || value === '') {
      if (spec.required) throw new Error(`arguments.${spec.name} is required`);
      continue;
    }
    assertValue(spec, value);

    if (spec.type === 'boolean') {
      if (isTruthy(value)) argv.push(spec.flag);
      continue;
    }

    if (spec.type === 'path') {
      value = await resolveHelperPath(
        value,
        spec,
        options.session,
        options.config,
        options.allowOverwrite,
      );
      if (String(spec.pathKind || '').startsWith('output-')) outputs.push(value);
    } else if (spec.type === 'path-array') {
      const resolved = [];
      for (const item of value) {
        resolved.push(
          await resolveHelperPath(
            item,
            spec,
            options.session,
            options.config,
            options.allowOverwrite,
          ),
        );
      }
      value = resolved;
    }

    const values = Array.isArray(value) ? value : [value];
    if (!spec.positional) argv.push(spec.flag);
    for (const item of values) argv.push(String(item));
  }

  return { argv, outputs };
}

async function listGeneratedFiles(target, limit = 200) {
  const info = await fs.promises.stat(target);
  if (info.isFile()) return [{ path: target, bytes: info.size, kind: 'file' }];
  const files = [{ path: target, bytes: 0, kind: 'directory' }];
  const queue = [target];
  while (queue.length && files.length < limit) {
    const dir = queue.shift();
    for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
      const child = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        queue.push(child);
      } else if (entry.isFile()) {
        const childInfo = await fs.promises.stat(child);
        files.push({ path: child, bytes: childInfo.size, kind: 'file' });
        if (files.length >= limit) break;
      }
    }
  }
  return files;
}

async function readHelperReport(outputs, stdout) {
  for (const output of outputs) {
    if (path.extname(output).toLowerCase() !== '.json') continue;
    try {
      const info = await fs.promises.stat(output);
      if (info.isFile() && info.size <= 5_000_000) {
        return JSON.parse(await fs.promises.readFile(output, 'utf8'));
      }
    } catch {
      /* fall through to stdout */
    }
  }
  try {
    return JSON.parse(String(stdout || '').trim());
  } catch {
    return null;
  }
}

/**
 * 构建 helper 的执行命令（同步路径与后台路径共用）。
 * @returns {{command:string, args:string[], outputs:string[], env?:Record<string,string>}}
 */
async function prepareHelperCommand(options) {
  const { helper, helpersRoot, python, blenderExecutable, inputBlend, arguments: rawArguments, session, config, allowOverwrite } = options;

  const { argv, outputs } = await buildHelperInvocation(helper, rawArguments, {
    session,
    config,
    allowOverwrite,
  });

  const scriptPath = path.join(helpersRoot, helper.script);
  await assertRegularFile(scriptPath, `helper ${helper.name} script`);

  if (helper.runtime === 'python') {
    if (!python || !python.available || !python.executable) {
      throw new Error(
        'analysis Python is not available; set analysisPythonExecutable in plugin settings',
      );
    }
    return {
      command: python.executable,
      args: ['-X', 'utf8', scriptPath, ...argv],
      outputs,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    };
  }

  if (helper.runtime === 'blender') {
    if (!inputBlend) throw new Error(`${helper.name} requires blend_path`);
    const driver = path.join(__dirname, '..', 'scripts', 'helper_driver.py');
    return {
      command: blenderExecutable,
      args: [
        inputBlend,
        '--background',
        '--disable-autoexec',
        '--python-exit-code',
        '1',
        '--python',
        driver,
        '--',
        '--script',
        scriptPath,
        '--arguments-json',
        JSON.stringify(argv),
      ],
      outputs,
    };
  }

  throw new Error(`unsupported helper runtime: ${helper.runtime}`);
}

async function runHelper(options) {
  const { helper, config, cwd, signal } = options;

  const prepared = await prepareHelperCommand(options);

  const proc = await runProcess(prepared.command, prepared.args, {
    cwd,
    signal,
    timeoutMs: config.helperTimeoutMs,
    maxOutputChars: config.maxOutputChars,
    env: prepared.env,
  });

  const log = clip(`${proc.stdout}\n${proc.stderr}`.trim(), config.maxOutputChars);
  if (proc.code !== 0 || proc.timedOut || proc.aborted) {
    const reason = proc.timedOut ? 'timed out' : proc.aborted ? 'aborted' : `exit ${proc.code}`;
    throw new Error(`helper ${helper.name} failed (${reason})\n${log}`);
  }

  const artifacts = [];
  for (const output of prepared.outputs) {
    try {
      artifacts.push(...(await listGeneratedFiles(output)));
    } catch {
      /* output may be optional and not created */
    }
  }
  const report = await readHelperReport(prepared.outputs, proc.stdout);
  const images = artifacts
    .filter((item) => item.kind === 'file' && IMAGE_EXTS.has(path.extname(item.path).toLowerCase()))
    .map((item) => item.path);

  return {
    helper: helper.name,
    module: helper.module,
    runtime: helper.runtime,
    exitCode: proc.code,
    durationMs: proc.durationMs,
    outputs: artifacts,
    images,
    report,
    log,
  };
}

module.exports = {
  buildHelperInvocation,
  prepareHelperCommand,
  resolveHelperPath,
  runHelper,
  listGeneratedFiles,
  readHelperReport,
};
