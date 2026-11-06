'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  workspaceOf,
  isWithin,
  resolveWorkspacePath,
  assertWritableTarget,
  nextAvailablePath,
} = require('../lib/paths');

function tempWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guada-blender-ws-'));
}

const config = { restrictToWorkspace: true };

test('workspaceOf uses session.workspacePath', () => {
  const ws = tempWorkspace();
  assert.equal(workspaceOf({ workspacePath: ws }), path.resolve(ws));
  fs.rmSync(ws, { recursive: true, force: true });
});

test('relative paths resolve inside the workspace', async () => {
  const ws = tempWorkspace();
  const file = path.join(ws, 'model.blend');
  fs.writeFileSync(file, 'x');
  const resolved = await resolveWorkspacePath('model.blend', { workspacePath: ws }, config, {
    mustExist: true,
    kind: 'blend_path',
  });
  assert.equal(resolved, fs.realpathSync(file));
  fs.rmSync(ws, { recursive: true, force: true });
});

test('paths outside the workspace are rejected', async () => {
  const ws = tempWorkspace();
  await assert.rejects(
    () => resolveWorkspacePath('../../etc/passwd', { workspacePath: ws }, config, { kind: 'x' }),
    /must stay inside/,
  );
  fs.rmSync(ws, { recursive: true, force: true });
});

test('overwrite protection and nextAvailablePath', async () => {
  const ws = tempWorkspace();
  const out = path.join(ws, 'preview.png');
  fs.writeFileSync(out, 'x');
  await assert.rejects(() => assertWritableTarget(out, false, 'output'), /already exists/);
  await assertWritableTarget(out, true, 'output');
  const next = await nextAvailablePath(out);
  assert.match(path.basename(next), /-v2\.png$/);
  fs.rmSync(ws, { recursive: true, force: true });
});

test('isWithin handles siblings', () => {
  assert.equal(isWithin('C:/a/b', 'C:/a/b/c'), true);
  assert.equal(isWithin('C:/a/b', 'C:/a/bc'), false);
});
