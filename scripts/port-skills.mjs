#!/usr/bin/env node

/**
 * 一次性移植脚本：把 dsh-blender 的 29 个模块技能 + references 复制进
 * skills/create-3d-model，并为每个模块 SKILL.md 注入「GuaDa 工具映射前言」。
 *
 * 只读源、只写本仓库；运行一次即可（结果入库，CI 不跑）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = 'D:/AI/ai_chat/tmp/ref/dsh-blender/skills/create-3d-model';
const DST = path.join(root, 'skills', 'create-3d-model');

const PREAMBLE = `> **本技能运行在 GuaDa Blender 插件上。**
>
> 工具名映射：\`blender_python\` → \`blender_python\`；\`blender_scene_info\` → \`blender_scene_info\`；
> \`blender_object_info\` → \`blender_scene_info({ object_name })\`；\`read_image\` → \`image_view\`；
> 确定性脚本一律通过 \`blender_helper_catalog\` / \`blender_helper_run\` 调用。
>
> 原文中的 **BlenderMCP、固定 MCP 工具名、外部控制端口、Codex/Claude 专属指令**一律作废。
> 所有 \`*_path\` 必须在当前会话 workspace 内；输出默认不覆盖（需要时显式 \`allow_overwrite=true\`）。
> 渲染/预览成功后必须用 \`image_view\` 真的看图，再判断是否完成。

`;

const KEEP_REFERENCES = [
  'capability-map.md',
  'visual-validation.md',
  'modeling-patterns.md',
  'blender-5-compat.md',
  'upstream.md',
];

const CORE_FILES = ['assembly-order.md', 'common-object-dimensions.md', 'blender-version-compat.md'];

function copyFile(src, dst, transform) {
  // 统一 LF：源仓库是 CRLF，宿主/CI 与测试都按 LF 读取
  let text = fs.readFileSync(src, 'utf8').replace(/\r\n/g, '\n');
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, transform ? transform(text) : text, 'utf8');
}

function injectPreamble(text) {
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(text);
  if (!match) return PREAMBLE + text;
  const head = match[0];
  const body = text.slice(head.length);
  return head + '\n' + PREAMBLE + body.replace(/^\n+/, '');
}

function main() {
  // 1. references（顶层文档）
  for (const file of KEEP_REFERENCES) {
    const src = path.join(SRC, 'references', file);
    if (!fs.existsSync(src)) {
      console.warn(`skip missing reference: ${file}`);
      continue;
    }
    copyFile(src, path.join(DST, 'references', file));
  }
  for (const file of CORE_FILES) {
    const src = path.join(SRC, 'references', 'core', file);
    if (!fs.existsSync(src)) continue;
    copyFile(src, path.join(DST, 'references', 'core', file));
  }

  // 2. 29 个模块技能
  const modulesDir = path.join(SRC, 'references', 'modules');
  const modules = fs
    .readdirSync(modulesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  let copied = 0;
  for (const name of modules) {
    const src = path.join(modulesDir, name, 'SKILL.md');
    if (!fs.existsSync(src)) continue;
    copyFile(
      src,
      path.join(DST, 'references', 'modules', name, 'SKILL.md'),
      injectPreamble,
    );
    copied++;
  }

  // 3. 模块的 scripts/ 只保留可用的（scipy 依赖不收录，见 lib/helpers.js）
  const SKIP_SCRIPTS = new Set([
    'wireframe_analyzer.py',
    'mask_to_mesh_recipe.py',
    'source_locked_skin_recipe.py',
    'release_readiness_check.py',
    'sanitize_skill_contributions.py',
    'skill_graph_audit.py',
  ]);
  let scriptsCopied = 0;
  for (const name of modules) {
    const scriptsDir = path.join(modulesDir, name, 'scripts');
    if (!fs.existsSync(scriptsDir)) continue;
    for (const file of fs.readdirSync(scriptsDir)) {
      if (SKIP_SCRIPTS.has(file)) continue;
      copyFile(
        path.join(scriptsDir, file),
        path.join(DST, 'references', 'modules', name, 'scripts', file),
      );
      scriptsCopied++;
    }
  }

  console.log(
    JSON.stringify({ modules: copied, references: KEEP_REFERENCES.length + CORE_FILES.length, scripts: scriptsCopied }, null, 2),
  );
}

main();
