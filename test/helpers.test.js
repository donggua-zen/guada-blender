'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { HELPERS, getHelper } = require('../lib/helpers');
const { buildHelperInvocation } = require('../lib/helper-runner');
const { missingPackages } = require('../lib/python');

function workspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guada-helper-ws-'));
  fs.writeFileSync(path.join(dir, 'a.png'), 'x');
  fs.writeFileSync(path.join(dir, 'b.png'), 'x');
  return dir;
}

const config = { restrictToWorkspace: true };

test('catalog has 6 unique helpers with scripts', () => {
  assert.equal(HELPERS.length, 6);
  const names = new Set(HELPERS.map((h) => h.name));
  assert.equal(names.size, HELPERS.length);
  for (const helper of HELPERS) {
    assert.ok(helper.script, `${helper.name} script`);
    assert.ok(Array.isArray(helper.arguments));
    assert.ok(helper.dependencies);
  }
});

test('builds argv for a path-array helper', async () => {
  const ws = workspace();
  try {
    const helper = getHelper('animation-contact-sheet');
    const { argv, outputs } = await buildHelperInvocation(
      helper,
      {
        frames: ['a.png', 'b.png'],
        out_image: 'contact.png',
        out_report: 'contact.json',
        cols: 3,
      },
      { session: { workspacePath: ws }, config, allowOverwrite: false },
    );
    assert.equal(argv[0], '--frames');
    assert.ok(argv.includes(path.join(ws, 'a.png')));
    assert.ok(argv.includes('--out-image'));
    assert.ok(argv.includes('--cols'));
    assert.ok(argv.includes('3'));
    assert.equal(outputs.length, 2);
    assert.ok(fs.existsSync(path.join(ws, 'contact.png')) === false);
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test('supports boolean flags and creates output dirs', async () => {
  const ws = workspace();
  try {
    const helper = getHelper('segment-source-parts');
    const { argv } = await buildHelperInvocation(
      helper,
      { image: 'a.png', out_dir: 'parts', watershed: true },
      { session: { workspacePath: ws }, config, allowOverwrite: false },
    );
    assert.ok(argv.includes('--watershed'));
    assert.ok(fs.existsSync(path.join(ws, 'parts')));
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test('rejects unknown args, missing required args and bad choices', async () => {
  const ws = workspace();
  try {
    const helper = getHelper('segment-source-parts');
    const options = { session: { workspacePath: ws }, config, allowOverwrite: false };

    await assert.rejects(() => buildHelperInvocation(helper, { nope: 1 }, options), /unknown/);
    await assert.rejects(() => buildHelperInvocation(helper, {}, options), /required/);
    await assert.rejects(
      () => buildHelperInvocation(helper, { image: 'a.png', out_dir: 'parts', mode: 'bad' }, options),
      /must be one of/,
    );
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});

test('reports missing Python packages', () => {
  const helper = getHelper('template-analyzer');
  assert.deepEqual(missingPackages(helper, { packages: {} }), [
    'opencv-python-headless',
    'numpy',
  ]);
  assert.deepEqual(
    missingPackages(helper, {
      packages: { 'opencv-python-headless': true, numpy: true },
    }),
    [],
  );
});
