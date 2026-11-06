'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runProcess, clip } = require('../lib/process');

test('runs a process and captures stdout', async () => {
  const result = await runProcess(process.execPath, ['-e', 'console.log("hello")'], {
    timeoutMs: 10000,
    maxOutputChars: 1000,
  });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /hello/);
  assert.equal(result.timedOut, false);
});

test('times out long processes', async () => {
  const result = await runProcess(
    process.execPath,
    ['-e', 'setTimeout(() => console.log("late"), 5000)'],
    { timeoutMs: 200, maxOutputChars: 1000 },
  );
  assert.equal(result.timedOut, true);
});

test('abort signal kills the process', async () => {
  const controller = new AbortController();
  const promise = runProcess(
    process.execPath,
    ['-e', 'setTimeout(() => console.log("late"), 5000)'],
    { timeoutMs: 10000, maxOutputChars: 1000, signal: controller.signal },
  );
  setTimeout(() => controller.abort(), 100);
  const result = await promise;
  assert.equal(result.aborted, true);
});

test('clip keeps head and tail', () => {
  const text = 'a'.repeat(100) + 'b'.repeat(100);
  const out = clip(text, 50);
  assert.ok(out.length < text.length);
  assert.match(out, /truncated/);
});
