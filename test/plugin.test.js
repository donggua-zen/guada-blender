'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const GuadaBlenderPlugin = require('../index');

function makeApi(options = {}) {
  const calls = { tools: [], skills: [], slots: [], nls: [], rpcs: {} };
  const values = options.values || {};
  const api = {
    calls,
    getPluginDir: () => path.join(__dirname, '..'),
    getDataDir: () => options.dataDir,
    registerNls: (locale) => calls.nls.push(locale),
    registerSlot: (reg) => calls.slots.push(reg),
    registerSkill: (def) => calls.skills.push(def),
    registerTool: (def) => calls.tools.push(def),
    registerRpc: (methods) => Object.assign(calls.rpcs, methods),
    getValue: async (key) => values[key],
    setValue: async () => undefined,
  };
  return api;
}

test('onLoad registers 13 tools, 1 skill, settings slot and rpc', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guada-blender-data-'));
  try {
    const plugin = new GuadaBlenderPlugin();
    const api = makeApi({ dataDir });
    await plugin.onLoad(api);

    assert.deepEqual(
      api.calls.tools.map((t) => t.name).sort(),
      [
        'blender_export',
        'blender_helper_catalog',
        'blender_helper_run',
        'blender_import',
        'blender_preview',
        'blender_python',
        'blender_render',
        'blender_render_frames',
        'blender_run_script',
        'blender_scene_info',
        'blender_status',
        'blender_validate_export',
        'blender_validate_scene',
      ],
    );
    assert.equal(api.calls.skills.length, 1);
    assert.equal(api.calls.skills[0].name, 'create-3d-model');
    assert.equal(api.calls.slots.length, 1);
    assert.equal(api.calls.slots[0].name, 'settings');
    for (const name of ['get_status', 'detect', 'save_config', 'test', 'test_python']) {
      assert.equal(typeof api.calls.rpcs[name], 'function', `rpc ${name}`);
    }
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('blender_status reports unavailable for a missing executable', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guada-blender-data-'));
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'guada-blender-ws-'));
  try {
    const plugin = new GuadaBlenderPlugin();
    const api = makeApi({
      dataDir,
      values: { blenderExecutable: 'C:/definitely/missing/blender.exe' },
    });
    await plugin.onLoad(api);
    const status = api.calls.tools.find((t) => t.name === 'blender_status');
    const result = await status.execute({}, { session: { workspacePath: workspace } });
    const data = JSON.parse(result.content);
    assert.equal(data.available, false);
    assert.match(data.error, /does not exist/);
    assert.equal(data.workspace, path.resolve(workspace));
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('path guard rejects paths outside the workspace', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guada-blender-data-'));
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'guada-blender-ws-'));
  try {
    const plugin = new GuadaBlenderPlugin();
    const api = makeApi({
      dataDir,
      values: { blenderExecutable: process.execPath },
    });
    await plugin.onLoad(api);
    const exportTool = api.calls.tools.find((t) => t.name === 'blender_export');
    await assert.rejects(
      () =>
        exportTool.execute(
          { blend_path: '../../etc/passwd', output_path: 'out.glb' },
          { session: { workspacePath: workspace } },
        ),
      /must stay inside/,
    );
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
