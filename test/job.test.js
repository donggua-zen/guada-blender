'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { spawnToLog, readLogSlice } = require('../lib/process');

function tempLog() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guada-job-'));
  return { dir, log: path.join(dir, 'job.log') };
}

test('spawnToLog writes output and resolves completed', async () => {
  const { dir, log } = tempLog();
  try {
    const handle = spawnToLog(process.execPath, ['-e', 'console.log("hello job")'], {
      logFilePath: log,
    });
    const outcome = await handle.done;
    assert.equal(outcome.status, 'completed');
    const slice = await readLogSlice(log, { maxBytes: 1024 });
    assert.match(slice.text, /hello job/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('spawnToLog reports failure on non-zero exit', async () => {
  const { dir, log } = tempLog();
  try {
    const handle = spawnToLog(process.execPath, ['-e', 'process.exit(3)'], {
      logFilePath: log,
    });
    const outcome = await handle.done;
    assert.equal(outcome.status, 'failed');
    assert.equal(outcome.exitCode, 3);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('kill marks the job as killed', async () => {
  const { dir, log } = tempLog();
  try {
    const handle = spawnToLog(
      process.execPath,
      ['-e', 'setTimeout(() => {}, 30000)'],
      { logFilePath: log },
    );
    handle.kill();
    const outcome = await handle.done;
    assert.equal(outcome.status, 'killed');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readLogSlice supports incremental offsets', async () => {
  const { dir, log } = tempLog();
  try {
    fs.writeFileSync(log, 'abcdef', 'utf8');
    const first = await readLogSlice(log, { offset: 0, maxBytes: 3 });
    assert.equal(first.text, 'abc');
    assert.equal(first.nextOffset, 3);
    const second = await readLogSlice(log, { offset: first.nextOffset, maxBytes: 3 });
    assert.equal(second.text, 'def');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readLogSlice handles a missing file', async () => {
  const slice = await readLogSlice('/definitely/missing/job.log', {});
  assert.equal(slice.text, '');
  assert.equal(slice.size, 0);
});
