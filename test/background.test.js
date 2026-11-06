'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const GuadaBlenderPlugin = require('../index');

function makeApi(dataDir, options = {}) {
  const calls = { tools: [], jobs: [] };
  const values = {
    blenderExecutable: process.execPath,
    analysisPythonExecutable: process.execPath,
    ...(options.values || {}),
  };
  const api = {
    calls,
    getPluginDir: () => path.join(__dirname, '..'),
    getDataDir: () => dataDir,
    registerNls: () => {},
    registerSlot: () => {},
    registerSkill: () => {},
    registerTool: (def) => calls.tools.push(def),
    registerRpc: () => {},
    getValue: async (key) => values[key],
    setValue: async () => {},
    startJob: (def, sessionId) => {
      calls.jobs.push({ def, sessionId });
      return `job-test-${calls.jobs.length}`;
    },
  };
  return api;
}

function setup() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guada-blender-bg-'));
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'guada-blender-ws-'));
  fs.writeFileSync(path.join(workspace, 'model.blend'), 'x');
  return { dataDir, workspace };
}

function teardown(ctx) {
  // Windows 下后台子进程可能仍持有工作目录，删除会 EPERM；失败不影响断言
  try {
    fs.rmSync(ctx.dataDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  try {
    fs.rmSync(ctx.workspace, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

test('render_frames registers a background job when run_in_background is set', async () => {
  const ctx = setup();
  try {
    const plugin = new GuadaBlenderPlugin();
    const api = makeApi(ctx.dataDir);
    await plugin.onLoad(api);
    const tool = api.calls.tools.find((t) => t.name === 'blender_render_frames');

    const result = await tool.execute(
      {
        blend_path: 'model.blend',
        output_dir: 'out',
        frames: '1',
        width: 64,
        height: 64,
        samples: 1,
        run_in_background: true,
      },
      { session: { workspacePath: ctx.workspace, sessionId: 's-1' } },
      undefined,
    );

    const data = JSON.parse(result.content);
    assert.match(data.jobId, /^job-test-/);
    assert.ok(data.logFilePath);
    assert.equal(api.calls.jobs.length, 1);
    assert.equal(api.calls.jobs[0].sessionId, 's-1');
    assert.equal(api.calls.jobs[0].def.notify, true);
    assert.equal(typeof api.calls.jobs[0].def.read, 'function');
    assert.equal(typeof api.calls.jobs[0].def.cancel, 'function');

    // 清理后台进程，并等它真正结束（否则临时目录被删会导致日志写入报错）
    api.calls.jobs[0].def.cancel();
    await api.calls.jobs[0].def.done;
  } finally {
    teardown(ctx);
  }
});

test('background mode requires a session id', async () => {
  const ctx = setup();
  try {
    const plugin = new GuadaBlenderPlugin();
    const api = makeApi(ctx.dataDir);
    await plugin.onLoad(api);
    const tool = api.calls.tools.find((t) => t.name === 'blender_render_frames');

    await assert.rejects(
      () =>
        tool.execute(
          {
            blend_path: 'model.blend',
            output_dir: 'out',
            frames: '1',
            run_in_background: true,
          },
          { session: { workspacePath: ctx.workspace } },
          undefined,
        ),
      /session context/,
    );
  } finally {
    teardown(ctx);
  }
});
