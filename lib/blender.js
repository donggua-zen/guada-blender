'use strict';

/**
 * Blender 调用封装：
 * - runBlender(operation,payload)：通过 scripts/blender_driver.py 在 Blender 内执行并返回 JSON；
 * - runScript(scriptPath)：直接以 `--python` 运行 workspace 脚本；
 * - getVersion()：探测版本。
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runProcess, clip } = require('./process');

const DRIVER_PATH = path.join(__dirname, '..', 'scripts', 'blender_driver.py');

function assertDriver() {
  if (!fs.existsSync(DRIVER_PATH)) {
    throw new Error(`bundled driver is missing: ${DRIVER_PATH}`);
  }
}

async function getVersion(executable, options = {}) {
  const result = await runProcess(executable, ['--version'], {
    timeoutMs: options.timeoutMs || 15000,
    maxOutputChars: 4000,
    signal: options.signal,
  });
  const text = `${result.stdout}\n${result.stderr}`.trim();
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || '';
  const available = result.code === 0 && !result.error;
  return {
    available,
    version: available ? firstLine.trim() : '',
    code: result.code,
    error: result.error || (available ? '' : clip(text, 1000)),
  };
}

async function runBlender(options) {
  const {
    executable,
    operation,
    payload,
    blendPath,
    config,
    cwd,
    signal,
  } = options;
  assertDriver();

  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'guada-blender-'));
  try {
    const payloadPath = path.join(tempDir, 'payload.json');
    const resultPath = path.join(tempDir, 'result.json');
    await fs.promises.writeFile(payloadPath, JSON.stringify(payload || {}), 'utf8');

    const args = blendPath
      ? [blendPath, '--background']
      : ['--background', '--factory-startup'];
    args.push(
      '--disable-autoexec',
      '--python-exit-code',
      '1',
      '--python',
      DRIVER_PATH,
      '--',
      '--operation',
      operation,
      '--payload',
      payloadPath,
      '--result',
      resultPath,
    );

    const proc = await runProcess(executable, args, {
      cwd,
      signal,
      timeoutMs: config.timeoutMs,
      maxOutputChars: config.maxOutputChars,
    });

    let driver = null;
    try {
      driver = JSON.parse(await fs.promises.readFile(resultPath, 'utf8'));
    } catch {
      driver = null;
    }

    const log = clip(
      `${(driver && driver.traceback) || ''}\n${proc.stdout}\n${proc.stderr}`.trim(),
      config.maxOutputChars,
    );

    if (!driver) {
      throw new Error(
        `Blender produced no valid driver result (exit ${proc.code})${
          proc.timedOut ? ' [timed out]' : ''
        }${proc.aborted ? ' [aborted]' : ''}\n${log}`,
      );
    }
    if (proc.code !== 0 || driver.ok !== true) {
      const message = driver.error || `Blender exited with code ${proc.code}`;
      throw new Error(`${message}${log ? `\n${log}` : ''}`);
    }

    return { ...driver, log };
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

async function runScript(options) {
  const {
    executable,
    scriptPath,
    scriptArgs = [],
    config,
    cwd,
    signal,
  } = options;

  const args = [
    '--background',
    '--disable-autoexec',
    '--python-exit-code',
    '1',
    '--python',
    scriptPath,
  ];
  if (scriptArgs.length > 0) args.push('--', ...scriptArgs);

  const proc = await runProcess(executable, args, {
    cwd,
    signal,
    timeoutMs: config.timeoutMs,
    maxOutputChars: config.maxOutputChars,
  });

  return {
    code: proc.code,
    stdout: proc.stdout,
    stderr: proc.stderr,
    timedOut: proc.timedOut,
    aborted: proc.aborted,
    durationMs: proc.durationMs,
    error: proc.error,
  };
}

module.exports = { DRIVER_PATH, getVersion, runBlender, runScript };
