'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { DEFAULTS, detectBlender, resolveExecutable } = require('../lib/config');

test('defaults are present', () => {
  assert.equal(DEFAULTS.restrictToWorkspace, true);
  assert.equal(DEFAULTS.enablePython, true);
  assert.ok(DEFAULTS.timeoutMs >= 1000);
});

test('detectBlender returns a string', () => {
  assert.equal(typeof detectBlender(), 'string');
});

test('configured non-existent absolute path is rejected', () => {
  assert.throws(
    () => resolveExecutable({ blenderExecutable: 'C:/definitely/missing/blender.exe' }),
    /does not exist/,
  );
});

test('command names are passed through', () => {
  const resolved = resolveExecutable({ blenderExecutable: 'blender' });
  assert.equal(resolved.executable, 'blender');
  assert.equal(resolved.source, 'config');
});
