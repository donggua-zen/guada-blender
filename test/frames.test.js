'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseFrames, MAX_FRAMES } = require('../lib/frames');

test('parses single frames and ranges', () => {
  assert.deepEqual(parseFrames('1,3,5-7'), [1, 3, 5, 6, 7]);
  assert.deepEqual(parseFrames('1-3'), [1, 2, 3]);
});

test('normalizes reversed ranges', () => {
  assert.deepEqual(parseFrames('10-8'), [8, 9, 10]);
});

test('dedupes and sorts', () => {
  assert.deepEqual(parseFrames('5,1-3,2'), [1, 2, 3, 5]);
});

test('ignores empty segments', () => {
  assert.deepEqual(parseFrames(' 1, ,3 '), [1, 3]);
});

test('rejects invalid tokens', () => {
  assert.throws(() => parseFrames('a'), /invalid frame token/);
  assert.throws(() => parseFrames('1-'), /invalid frame token/);
  assert.throws(() => parseFrames(''), /frames is required/);
  assert.throws(() => parseFrames('0'), /out of bounds/);
});

test('enforces the per-call limit', () => {
  assert.throws(() => parseFrames(`1-${MAX_FRAMES + 1}`), /too many frames/);
});
