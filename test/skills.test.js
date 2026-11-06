'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const GuadaBlenderPlugin = require('../index');

const PLUGIN_DIR = path.join(__dirname, '..');
const MODULES_DIR = path.join(PLUGIN_DIR, 'skills', 'create-3d-model', 'references', 'modules');

function makeApi(dataDir) {
  const calls = { skills: [] };
  return {
    calls,
    getPluginDir: () => PLUGIN_DIR,
    getDataDir: () => dataDir,
    registerNls: () => {},
    registerSlot: () => {},
    registerSkill: (def) => calls.skills.push(def),
    registerTool: () => {},
    registerRpc: () => {},
    getValue: async () => undefined,
    setValue: async () => {},
  };
}

test('registers orchestration + 29 module skills', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guada-blender-skills-'));
  try {
    const plugin = new GuadaBlenderPlugin();
    const api = makeApi(dataDir);
    await plugin.onLoad(api);

    assert.equal(api.calls.skills.length, 30);
    const names = api.calls.skills.map((s) => s.name).sort();
    assert.equal(names[0], 'animation-quality-gate');
    assert.ok(names.includes('create-3d-model'));
    assert.ok(names.includes('blender-modeling'));
    assert.ok(names.includes('blender-materials'));
    assert.ok(names.includes('wireframe-to-3d'));
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('every module skill has frontmatter, preamble and resourceBase', async () => {
  const dirs = fs
    .readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  assert.equal(dirs.length, 29);

  for (const name of dirs) {
    const file = path.join(MODULES_DIR, name, 'SKILL.md');
    const text = fs.readFileSync(file, 'utf8');
    assert.match(text, /^---\n/, `${name}: frontmatter`);
    assert.match(text, /name:\s*\S+/, `${name}: name`);
    assert.match(text, /description:\s*\S+/, `${name}: description`);
    assert.match(text, /本技能运行在 GuaDa Blender 插件上/, `${name}: preamble`);
    assert.match(text, /image_view/, `${name}: tool mapping`);
  }
});

test('preamble replaces legacy MCP wording', () => {
  const file = path.join(MODULES_DIR, 'blender-modeling', 'SKILL.md');
  const text = fs.readFileSync(file, 'utf8');
  const mentions = text.match(/BlenderMCP/g) || [];
  // 只允许出现在前言里的"作废声明"
  assert.ok(mentions.length <= 1, 'legacy MCP wording should only appear in the preamble');
});
