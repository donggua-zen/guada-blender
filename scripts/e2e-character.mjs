#!/usr/bin/env node

/**
 * 端到端角色用例（脚本化 E2E）。
 *
 * 按 `create-3d-model` 技能里写的顺序跑完整链路，产出可视化证据。
 * 需要本机 Blender 与分析 Python；CI 不跑。
 *
 * 用法：
 *   node scripts/e2e-character.mjs
 *   E2E_BLEND=... E2E_REF=... E2E_OUT=... node scripts/e2e-character.mjs
 *
 * 输出：$E2E_OUT/e2e-report.json + 图片（preview/render/frames/overlay）。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const Plugin = require(path.join(root, 'index.js'));

const WORKSPACE = process.env.E2E_WORKSPACE || 'D:/AI/ai_chat';
const BLEND = process.env.E2E_BLEND || 'tmp/taila/taila-retarget.blend';
const REF = process.env.E2E_REF || 'tmp/taila/preview-front.png';
const OUT = process.env.E2E_OUT || 'tmp/e2e-character';
const BLENDER = process.env.E2E_BLENDER ||
  'D:/AI/ai_embedded/tools/blender/blender-4.5.15-windows-x64/blender.exe';
const PYTHON = process.env.E2E_PYTHON ||
  'C:/Users/22071/AppData/Local/Programs/Python/Python313/python.exe';

function makeApi(dataDir) {
  const tools = {};
  return {
    tools,
    getPluginDir: () => root,
    getDataDir: () => dataDir,
    registerNls: () => {},
    registerSlot: () => {},
    registerSkill: () => {},
    registerTool: (def) => { tools[def.name] = def; },
    registerRpc: () => {},
    getValue: async (key) =>
      ({
        blenderExecutable: BLENDER,
        analysisPythonExecutable: PYTHON,
      })[key],
    setValue: async () => {},
  };
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guada-e2e-'));
  const api = makeApi(dataDir);
  const plugin = new Plugin();
  await plugin.onLoad(api);
  const ctx = { session: { workspacePath: WORKSPACE, sessionId: 'e2e-session' } };
  const run = (name, args) => api.tools[name].execute(args, ctx, undefined);

  const steps = [];
  const record = async (step, fn) => {
    const started = Date.now();
    try {
      const value = await fn();
      steps.push({ step, ok: true, ms: Date.now() - started, value });
      return value;
    } catch (error) {
      steps.push({ step, ok: false, ms: Date.now() - started, error: String(error.message || error).slice(0, 800) });
      return null;
    }
  };

  // 1. 环境
  const status = await record('blender_status', async () => {
    const res = await run('blender_status', {});
    const data = JSON.parse(res.content);
    return {
      available: data.available,
      version: data.version,
      analysis: data.analysis && data.analysis.version,
      helpers: data.helpers && data.helpers.count,
      skills: data.skills,
    };
  });
  if (!status || !status.available) {
    console.error('Blender is not available; aborting E2E');
    writeReport(steps, dataDir);
    process.exitCode = 1;
    return;
  }

  // 2. 参考图度量
  await record('reference-manifest-compiler', async () => {
    const res = await run('blender_helper_run', {
      name: 'reference-manifest-compiler',
      arguments_json: JSON.stringify({ inputs: [REF], out: `${OUT}/manifest.json`, mode: 'auto' }),
    });
    const data = JSON.parse(res.content);
    return { report: data.report && data.report.schema, outputs: data.outputs.map((o) => path.basename(o.path)) };
  });

  // 3. 部件分割
  await record('segment-source-parts', async () => {
    const res = await run('blender_helper_run', {
      name: 'segment-source-parts',
      arguments_json: JSON.stringify({ image: REF, out_dir: `${OUT}/parts`, mode: 'auto' }),
    });
    const data = JSON.parse(res.content);
    return { components: data.report && data.report.components, images: (res.imageRefs || []).length };
  });

  // 4. 场景检查
  await record('blender_scene_info', async () => {
    const res = await run('blender_scene_info', { blend_path: BLEND, max_objects: 30 });
    const data = JSON.parse(res.content);
    return {
      scene: data.scene && data.scene.sceneName,
      objects: data.scene && data.scene.objectCount,
      materials: (data.scene && data.scene.materials || []).length,
    };
  });

  // 5. blockout 预览
  await record('blender_preview', async () => {
    const res = await run('blender_preview', {
      blend_path: BLEND,
      output_path: `${OUT}/preview.png`,
      view: 'isometric',
      width: 512,
      height: 512,
      samples: 32,
      allow_overwrite: true,
    });
    const data = JSON.parse(res.content);
    return { imagePath: data.imagePath, bytes: data.bytes, imageRefs: (res.imageRefs || []).length };
  });

  // 6. 正式渲染
  await record('blender_render', async () => {
    const res = await run('blender_render', {
      blend_path: BLEND,
      output_path: `${OUT}/render.png`,
      width: 640,
      height: 640,
      samples: 64,
      allow_overwrite: true,
    });
    const data = JSON.parse(res.content);
    return { imagePath: data.imagePath, bytes: data.bytes, imageRefs: (res.imageRefs || []).length };
  });

  // 7. 轮廓对比
  await record('silhouette-validator', async () => {
    const res = await run('blender_helper_run', {
      name: 'silhouette-validator',
      arguments_json: JSON.stringify({
        reference: REF,
        render: `${OUT}/render.png`,
        out: `${OUT}/silhouette.json`,
      }),
      allow_overwrite: true,
    });
    const data = JSON.parse(res.content);
    const report = data.report || {};
    return { iou: report.iou, centroidDistancePx: report.centroid_distance_px };
  });

  // 8. 结构审计
  await record('blender_validate_scene', async () => {
    const res = await run('blender_validate_scene', { blend_path: BLEND, profile: 'web' });
    const data = JSON.parse(res.content);
    return {
      passed: data.passed,
      errors: data.errors.length,
      warnings: data.warnings.length,
      isError: res.isError === true,
    };
  });

  // 9. 导出
  await record('blender_export', async () => {
    const res = await run('blender_export', {
      blend_path: BLEND,
      output_path: `${OUT}/model.glb`,
      allow_overwrite: true,
    });
    const data = JSON.parse(res.content);
    return { modelPath: data.modelPath, format: data.format, bytes: data.bytes };
  });

  // 10. 导出回读审计
  await record('blender_validate_export', async () => {
    const res = await run('blender_validate_export', {
      model_path: `${OUT}/model.glb`,
      profile: 'web',
    });
    const data = JSON.parse(res.content);
    return {
      passed: data.validation && data.validation.passed,
      importedObjects: (data.importedObjects || []).length,
      isError: res.isError === true,
    };
  });

  // 11. 动画抽帧（3 帧）
  await record('blender_render_frames', async () => {
    const res = await run('blender_render_frames', {
      blend_path: BLEND,
      output_dir: `${OUT}/frames`,
      frames: '1,5,10',
      width: 320,
      height: 320,
      samples: 16,
      allow_overwrite: true,
    });
    const data = JSON.parse(res.content);
    return { imageCount: data.imageCount, imageRefs: (res.imageRefs || []).length };
  });

  const report = writeReport(steps, dataDir);
  const failed = steps.filter((step) => !step.ok);
  console.log(
    JSON.stringify(
      {
        out: OUT,
        report: report.path,
        steps: steps.map((step) => `${step.ok ? 'OK  ' : 'FAIL'} ${step.step} (${step.ms}ms)`),
        failed: failed.length,
      },
      null,
      2,
    ),
  );
  if (failed.length > 0) process.exitCode = 1;
}

function writeReport(steps, dataDir) {
  fs.mkdirSync(path.join(WORKSPACE, OUT), { recursive: true });
  const payload = {
    schema: 'guada_blender_e2e.v1',
    generatedAt: new Date().toISOString(),
    workspace: WORKSPACE,
    blend: BLEND,
    reference: REF,
    out: OUT,
    platform: process.platform,
    node: process.version,
    steps,
  };
  const reportPath = path.join(WORKSPACE, OUT, 'e2e-report.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  try {
    fs.rmSync(dataDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  return { path: reportPath, payload };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
