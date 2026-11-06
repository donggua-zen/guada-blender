'use strict';

/**
 * GuaDa Blender — 三方插件入口（Phase 1）
 *
 * 8 个工具 + 1 个编排技能：
 *   blender_status / blender_scene_info / blender_run_script / blender_import
 *   blender_python / blender_preview / blender_render / blender_export
 *
 * 约束：
 * - 零依赖 CommonJS；只使用 onLoad(api) 的公开 PluginApi；
 * - 不修改宿主源码；所有路径在插件侧做 workspace 守卫；
 * - 每次调用启动独立 Blender 后台进程，不开放控制端口。
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  DEFAULTS,
  detectBlender,
  resolveExecutable,
  getConfig,
  saveConfig,
} = require('./lib/config');
const {
  workspaceOf,
  resolveWorkspacePath,
  assertRegularFile,
  assertWritableTarget,
} = require('./lib/paths');
const { getVersion, runBlender, runScript } = require('./lib/blender');
const { parseFrames } = require('./lib/frames');
const { HELPERS, getHelper } = require('./lib/helpers');
const { detectAndProbe, missingPackages } = require('./lib/python');
const { runHelper } = require('./lib/helper-runner');
const { clip } = require('./lib/process');

const PLUGIN_ID = 'guada-blender';
const PLUGIN_NAME = 'GuaDa Blender';
const VERSION = '0.3.0';

const SUPPORTED_IMPORTS = new Set([
  '.glb', '.gltf', '.fbx', '.obj', '.stl', '.usd', '.usda', '.usdc', '.ply', '.dae',
]);
const SUPPORTED_EXPORTS = new Set(['.glb', '.gltf', '.fbx', '.obj', '.stl', '.usd', '.usda', '.usdc', '.ply']);
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg']);
const PREVIEW_VIEWS = ['isometric', 'front', 'back', 'left', 'right', 'top', 'bottom'];
const VALIDATION_PROFILES = ['general', 'web', '3d-print', 'animation'];

const NLS_ZH = {
  'settings.title': 'GuaDa Blender',
  'settings.desc': 'Blender 3D 建模、检查、预览、渲染与导出',
};
const NLS_EN = {
  'settings.title': 'GuaDa Blender',
  'settings.desc': 'Blender 3D modeling, inspection, preview, render and export',
};

function json(value) {
  return JSON.stringify(value, null, 2);
}

function mediaTypeOf(file) {
  const ext = path.extname(file).toLowerCase();
  return ext === '.png' ? 'image/png' : 'image/jpeg';
}

function imageRefFor(file) {
  return {
    url: file,
    refType: 'local',
    media_type: mediaTypeOf(file),
    name: path.basename(file),
  };
}

function imageRefsFor(files, max = 8) {
  return (files || []).slice(0, max).map(imageRefFor);
}

function imageResult(file, summary) {
  return {
    content: json(summary),
    imageRefs: [imageRefFor(file)],
  };
}

function asNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function asBool(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function ensureExt(target, allowed, label) {
  const ext = path.extname(target).toLowerCase();
  if (!allowed.has(ext)) {
    throw new Error(`${label} has unsupported extension: ${ext || '(none)'}`);
  }
  return ext;
}

class GuadaBlenderPlugin {
  constructor() {
    this.manifest = {
      id: PLUGIN_ID,
      name: PLUGIN_NAME,
      version: VERSION,
      description: 'Blender 3D 建模、场景检查、预览、渲染与导出工具',
      author: 'donggua-zen',
      category: 'user',
      icon: 'assets/icon.svg',
    };
    this.api = null;
    this.dataDir = null;
    this.pluginDir = null;
    this.cachedVersion = null;
  }

  async onLoad(api) {
    this.api = api;
    this.pluginDir = typeof api.getPluginDir === 'function' ? api.getPluginDir() : path.dirname(__filename);
    try {
      this.dataDir = typeof api.getDataDir === 'function' ? api.getDataDir() : path.join(os.tmpdir(), PLUGIN_ID);
    } catch {
      this.dataDir = path.join(os.tmpdir(), PLUGIN_ID);
    }
    fs.mkdirSync(this.dataDir, { recursive: true });

    this.registerNls(api);
    this.registerSlot(api);
    this.registerSkill(api);
    this.registerTools(api);
    this.registerRpc(api);
  }

  async onStart() {
    // 预热版本探测（失败不阻塞启用）
    try {
      const config = await getConfig(this.api);
      const { executable } = resolveExecutable(config);
      this.cachedVersion = await getVersion(executable, { timeoutMs: 15000 });
    } catch {
      this.cachedVersion = null;
    }
  }

  async onStop() {}

  async onUnload() {}

  // ── 注册 ──

  registerNls(api) {
    if (typeof api.registerNls !== 'function') return;
    api.registerNls('zh', NLS_ZH);
    api.registerNls('en', NLS_EN);
  }

  registerSlot(api) {
    if (typeof api.registerSlot !== 'function') return;
    api.registerSlot({
      name: 'settings',
      component: 'SettingsPage',
      mode: 'list',
      order: 70,
      meta: { label: '%settings.title%', group: 'plugin' },
    });
  }

  registerSkill(api) {
    if (typeof api.registerSkill !== 'function') return;
    const dir = path.join(this.pluginDir, 'skills', 'create-3d-model');
    const file = path.join(dir, 'SKILL.md');
    if (!fs.existsSync(file)) return;
    const raw = fs.readFileSync(file, 'utf8');
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/u.exec(raw);
    if (!match) return;
    const name = (/^name:\s*(.+)$/mu.exec(match[1]) || [])[1];
    const description = (/^description:\s*(.+)$/mu.exec(match[1]) || [])[1];
    if (!name || !description) return;
    api.registerSkill({
      name: name.trim(),
      description: description.trim(),
      content: match[2].trim(),
      version: VERSION,
      author: 'donggua-zen',
      tags: ['blender', '3d', 'modeling', 'render'],
      resourceBase: { kind: 'directory', path: dir },
    });
  }

  // ── 工具 ──

  registerTools(api) {
    api.registerTool(this.toolStatus());
    api.registerTool(this.toolSceneInfo());
    api.registerTool(this.toolRunScript());
    api.registerTool(this.toolImport());
    api.registerTool(this.toolPython());
    api.registerTool(this.toolPreview());
    api.registerTool(this.toolRender());
    api.registerTool(this.toolRenderFrames());
    api.registerTool(this.toolExport());
    api.registerTool(this.toolValidateScene());
    api.registerTool(this.toolValidateExport());
    api.registerTool(this.toolHelperCatalog());
    api.registerTool(this.toolHelperRun());
  }

  async prepare(ctx) {
    const config = await getConfig(this.api);
    const { executable, source } = resolveExecutable(config);
    return { config, executable, source, workspace: workspaceOf(ctx && ctx.session) };
  }

  toolStatus() {
    return {
      name: 'blender_status',
      description:
        '检查 Blender 是否可用、版本、当前 workspace 与插件配置。首次建模前先调用。',
      parameters: {},
      readOnly: true,
      dangerLevel: 'safe',
      display: { icon: 'info', text: { executing: '检查 Blender', completed: 'Blender 检查完成' } },
      execute: async (_args, ctx, signal) => {
        const workspace = workspaceOf(ctx && ctx.session);
        let config;
        let executable = '';
        let source = '';
        try {
          config = await getConfig(this.api);
          const resolved = resolveExecutable(config);
          executable = resolved.executable;
          source = resolved.source;
        } catch (err) {
          return {
            content: json({
              available: false,
              workspace,
              error: err.message,
              hint: '在 设置 → GuaDa Blender 中填写 blender 可执行文件路径',
            }),
          };
        }

        const version = await getVersion(executable, {
          timeoutMs: Math.min(config.timeoutMs, 15000),
          signal,
        });
        const analysis = await detectAndProbe({
          analysisPythonExecutable: config.analysisPythonExecutable,
          blenderExecutable: executable,
          timeoutMs: Math.min(config.timeoutMs, 15000),
          signal,
        });
        return {
          content: json({
            available: version.available,
            executable,
            executableSource: source,
            version: version.version,
            error: version.error || undefined,
            workspace,
            pythonEnabled: config.enablePython !== false,
            analysis: {
              available: analysis.available,
              executable: analysis.executable,
              source: analysis.source,
              version: analysis.version,
              packages: analysis.packages,
              error: analysis.error || undefined,
            },
            helpers: {
              enabled: config.enableHelpers !== false,
              count: HELPERS.length,
            },
            skills: 1,
            config,
          }),
        };
      },
    };
  }

  toolSceneInfo() {
    return {
      name: 'blender_scene_info',
      description:
        '只读检查 .blend 场景；传 object_name 时返回该对象的详细几何/材质/UV/修改器/动画信息。',
      parameters: {
        blend_path: { type: 'string', required: true, description: 'workspace 内的 .blend 路径' },
        object_name: { type: 'string', required: false, description: '可选：只看某个对象' },
        max_objects: { type: 'number', required: false, description: '场景对象上限，默认 200' },
      },
      readOnly: true,
      dangerLevel: 'safe',
      display: { icon: 'scene', argsKey: 'blend_path' },
      execute: async (args, ctx, signal) => {
        const { config, executable, workspace } = await this.prepare(ctx);
        const blend = await resolveWorkspacePath(args.blend_path, ctx && ctx.session, config, {
          mustExist: true,
          kind: 'blend_path',
        });
        await assertRegularFile(blend, 'blend_path');
        ensureExt(blend, new Set(['.blend']), 'blend_path');

        const operation = args.object_name ? 'inspect_object' : 'inspect';
        const payload = args.object_name
          ? { object_names: [String(args.object_name)], evaluated: true }
          : { max_objects: asNumber(args.max_objects, 200) };

        const result = await runBlender({
          executable,
          operation,
          payload,
          blendPath: blend,
          config,
          cwd: workspace,
          signal,
        });
        return { content: json(result) };
      },
    };
  }

  toolRunScript() {
    return {
      name: 'blender_run_script',
      description:
        '在 Blender 后台运行 workspace 内的 .py 脚本（等价 blender --background --python）。脚本内部的文件读写不受工具参数守卫限制。',
      parameters: {
        script_path: { type: 'string', required: true, description: 'workspace 内的 .py 脚本路径' },
        script_args: { type: 'string', required: false, description: '可选：传给脚本的参数，空格分隔' },
      },
      dangerLevel: 'high',
      display: { icon: 'code', argsKey: 'script_path' },
      execute: async (args, ctx, signal) => {
        const { config, executable, workspace } = await this.prepare(ctx);
        if (config.enablePython === false) {
          throw new Error('blender_run_script is disabled by plugin config (enablePython=false)');
        }
        const script = await resolveWorkspacePath(args.script_path, ctx && ctx.session, config, {
          mustExist: true,
          kind: 'script_path',
        });
        await assertRegularFile(script, 'script_path');
        ensureExt(script, new Set(['.py']), 'script_path');

        const scriptArgs = String(args.script_args || '')
          .split(/\s+/)
          .map((s) => s.trim())
          .filter(Boolean);

        const result = await runScript({
          executable,
          scriptPath: script,
          scriptArgs,
          config,
          cwd: workspace,
          signal,
        });

        if (result.code !== 0 || result.timedOut || result.aborted) {
          const reason = result.timedOut
            ? 'timed out'
            : result.aborted
              ? 'aborted'
              : `exit ${result.code}`;
          throw new Error(
            `blender_run_script failed (${reason})\n${clip(
              `${result.stdout}\n${result.stderr}`.trim(),
              config.maxOutputChars,
            )}`,
          );
        }

        return {
          content: json({
            scriptPath: script,
            code: result.code,
            durationMs: result.durationMs,
            stdout: result.stdout,
            stderr: result.stderr,
          }),
        };
      },
    };
  }

  toolImport() {
    return {
      name: 'blender_import',
      description:
        '把 GLB/glTF、FBX、OBJ、STL、USD、PLY、DAE 导入干净场景并保存为新的 .blend。',
      parameters: {
        source_path: { type: 'string', required: true, description: 'workspace 内的模型文件' },
        save_path: { type: 'string', required: true, description: '新的 .blend 输出路径' },
        allow_overwrite: { type: 'boolean', required: false, description: '允许覆盖已有输出，默认 false' },
      },
      dangerLevel: 'normal',
      display: { icon: 'import', argsKey: 'source_path' },
      execute: async (args, ctx, signal) => {
        const { config, executable, workspace } = await this.prepare(ctx);
        const source = await resolveWorkspacePath(args.source_path, ctx && ctx.session, config, {
          mustExist: true,
          kind: 'source_path',
        });
        await assertRegularFile(source, 'source_path');
        ensureExt(source, SUPPORTED_IMPORTS, 'source_path');

        const save = await resolveWorkspacePath(args.save_path, ctx && ctx.session, config, {
          kind: 'save_path',
        });
        ensureExt(save, new Set(['.blend']), 'save_path');
        await assertWritableTarget(save, asBool(args.allow_overwrite), 'save_path');

        const result = await runBlender({
          executable,
          operation: 'import',
          payload: { source_path: source, output_path: save },
          config,
          cwd: workspace,
          signal,
        });
        const info = await assertRegularFile(save, 'import output');
        return {
          content: json({
            sourcePath: source,
            blendPath: save,
            bytes: info.size,
            importedObjects: result.imported_objects || [],
            scene: result.scene,
            log: result.log,
          }),
        };
      },
    };
  }

  toolPython() {
    return {
      name: 'blender_python',
      description:
        '执行一小段 bpy/bmesh Python 并保存为新的 .blend。脚本可使用 bpy/bmesh/mathutils/workspace/input_path/output_path，并可设置 dsh_result 返回证据。',
      parameters: {
        script: { type: 'string', required: true, description: '要执行的 Python 代码' },
        save_path: { type: 'string', required: true, description: '新的 .blend 输出路径' },
        blend_path: { type: 'string', required: false, description: '可选：基于已有 .blend 修改' },
        allow_overwrite: { type: 'boolean', required: false, description: '允许覆盖已有输出，默认 false' },
      },
      dangerLevel: 'high',
      display: { icon: 'code', argsKey: 'save_path' },
      execute: async (args, ctx, signal) => {
        const { config, executable, workspace } = await this.prepare(ctx);
        if (config.enablePython === false) {
          throw new Error('blender_python is disabled by plugin config (enablePython=false)');
        }
        let blend;
        if (args.blend_path) {
          blend = await resolveWorkspacePath(args.blend_path, ctx && ctx.session, config, {
            mustExist: true,
            kind: 'blend_path',
          });
          await assertRegularFile(blend, 'blend_path');
          ensureExt(blend, new Set(['.blend']), 'blend_path');
        }
        const save = await resolveWorkspacePath(args.save_path, ctx && ctx.session, config, {
          kind: 'save_path',
        });
        ensureExt(save, new Set(['.blend']), 'save_path');
        await assertWritableTarget(save, asBool(args.allow_overwrite), 'save_path');

        const result = await runBlender({
          executable,
          operation: 'execute',
          payload: {
            workspace,
            input_path: blend || '',
            output_path: save,
            script: String(args.script || ''),
          },
          blendPath: blend,
          config,
          cwd: workspace,
          signal,
        });
        const info = await assertRegularFile(save, 'python output');
        return {
          content: json({
            blendPath: save,
            bytes: info.size,
            scene: result.scene,
            scriptResult: result.script_result,
            log: result.log,
          }),
        };
      },
    };
  }

  toolPreview() {
    return {
      name: 'blender_preview',
      description:
        '为 .blend 生成临时相机+灯光的预览图（不修改源文件）；成功后用 image_view 看图再判断。',
      parameters: {
        blend_path: { type: 'string', required: true, description: 'workspace 内的 .blend' },
        output_path: { type: 'string', required: true, description: '新的 .png/.jpg 输出路径' },
        view: {
          type: 'string',
          required: false,
          enum: PREVIEW_VIEWS,
          description: '视角，默认 isometric',
        },
        width: { type: 'number', required: false, description: '宽度，默认 512' },
        height: { type: 'number', required: false, description: '高度，默认 512' },
        samples: { type: 'number', required: false, description: '渲染采样数，默认 32' },
        transparent: { type: 'boolean', required: false, description: '透明背景' },
        object_names: { type: 'string', required: false, description: '可选：只框选这些对象，逗号分隔' },
        allow_overwrite: { type: 'boolean', required: false, description: '允许覆盖已有输出' },
      },
      dangerLevel: 'normal',
      display: { icon: 'image', argsKey: 'output_path' },
      execute: async (args, ctx, signal) => {
        const { config, executable, workspace } = await this.prepare(ctx);
        const blend = await resolveWorkspacePath(args.blend_path, ctx && ctx.session, config, {
          mustExist: true,
          kind: 'blend_path',
        });
        await assertRegularFile(blend, 'blend_path');
        const output = await resolveWorkspacePath(args.output_path, ctx && ctx.session, config, {
          kind: 'output_path',
        });
        ensureExt(output, IMAGE_EXTS, 'output_path');
        await assertWritableTarget(output, asBool(args.allow_overwrite), 'output_path');

        const objects = String(args.object_names || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        const result = await runBlender({
          executable,
          operation: 'preview',
          payload: {
            output_path: output,
            view: PREVIEW_VIEWS.includes(args.view) ? args.view : 'isometric',
            width: asNumber(args.width, 512),
            height: asNumber(args.height, 512),
            samples: asNumber(args.samples, 32),
            transparent: asBool(args.transparent),
            object_names: objects.length ? objects : undefined,
          },
          blendPath: blend,
          config,
          cwd: workspace,
          signal,
        });
        const info = await assertRegularFile(output, 'preview output');
        return imageResult(output, {
          imagePath: output,
          bytes: info.size,
          view: result.view,
          bounds: result.bounds,
          log: result.log,
        });
      },
    };
  }

  toolRender() {
    return {
      name: 'blender_render',
      description:
        '用场景当前相机渲染一帧 PNG/JPEG；成功后用 image_view 看图再判断。',
      parameters: {
        blend_path: { type: 'string', required: true, description: 'workspace 内的 .blend' },
        output_path: { type: 'string', required: true, description: '新的 .png/.jpg 输出路径' },
        frame: { type: 'number', required: false, description: '可选：帧号' },
        width: { type: 'number', required: false, description: '宽度，默认 960' },
        height: { type: 'number', required: false, description: '高度，默认 960' },
        samples: { type: 'number', required: false, description: '渲染采样数，默认 64' },
        transparent: { type: 'boolean', required: false, description: '透明背景' },
        camera: { type: 'string', required: false, description: '可选：相机对象名' },
        allow_overwrite: { type: 'boolean', required: false, description: '允许覆盖已有输出' },
      },
      dangerLevel: 'normal',
      display: { icon: 'image', argsKey: 'output_path' },
      execute: async (args, ctx, signal) => {
        const { config, executable, workspace } = await this.prepare(ctx);
        const blend = await resolveWorkspacePath(args.blend_path, ctx && ctx.session, config, {
          mustExist: true,
          kind: 'blend_path',
        });
        await assertRegularFile(blend, 'blend_path');
        const output = await resolveWorkspacePath(args.output_path, ctx && ctx.session, config, {
          kind: 'output_path',
        });
        ensureExt(output, IMAGE_EXTS, 'output_path');
        await assertWritableTarget(output, asBool(args.allow_overwrite), 'output_path');

        const result = await runBlender({
          executable,
          operation: 'render',
          payload: {
            output_path: output,
            frame: args.frame === undefined ? undefined : asNumber(args.frame, 1),
            width: asNumber(args.width, 960),
            height: asNumber(args.height, 960),
            samples: asNumber(args.samples, 64),
            transparent: asBool(args.transparent),
            camera: args.camera ? String(args.camera) : undefined,
          },
          blendPath: blend,
          config,
          cwd: workspace,
          signal,
        });
        const info = await assertRegularFile(output, 'render output');
        return imageResult(output, {
          imagePath: output,
          bytes: info.size,
          frame: result.frame,
          log: result.log,
        });
      },
    };
  }

  toolRenderFrames() {
    return {
      name: 'blender_render_frames',
      description:
        '按帧号批量渲染 PNG/JPEG（动画代表帧/序列帧）。frames 支持 "1,3,5-7"，单次最多 120 帧。',
      parameters: {
        blend_path: { type: 'string', required: true, description: 'workspace 内的 .blend' },
        output_dir: { type: 'string', required: true, description: 'workspace 内的输出目录（自动创建）' },
        frames: { type: 'string', required: true, description: '帧号表达式，如 "1,3,5-7"' },
        format: { type: 'string', required: false, description: 'png（默认）或 jpg' },
        prefix: { type: 'string', required: false, description: '文件名前缀，默认 frame' },
        width: { type: 'number', required: false, description: '宽度，默认 640' },
        height: { type: 'number', required: false, description: '高度，默认 640' },
        samples: { type: 'number', required: false, description: '采样数，默认 32' },
        camera: { type: 'string', required: false, description: '可选：相机对象名' },
        allow_overwrite: { type: 'boolean', required: false, description: '允许覆盖已有帧文件' },
      },
      dangerLevel: 'normal',
      display: { icon: 'image', argsKey: 'frames' },
      execute: async (args, ctx, signal) => {
        const { config, executable, workspace } = await this.prepare(ctx);
        const blend = await resolveWorkspacePath(args.blend_path, ctx && ctx.session, config, {
          mustExist: true,
          kind: 'blend_path',
        });
        await assertRegularFile(blend, 'blend_path');
        ensureExt(blend, new Set(['.blend']), 'blend_path');

        const outDir = await resolveWorkspacePath(args.output_dir, ctx && ctx.session, config, {
          kind: 'output_dir',
        });

        const frames = parseFrames(args.frames);
        await fs.promises.mkdir(outDir, { recursive: true });
        const format = String(args.format || 'png').toLowerCase() === 'jpg' ? 'jpg' : 'png';
        const prefix =
          String(args.prefix || 'frame').replace(/[^A-Za-z0-9._-]/g, '_') || 'frame';
        const files = frames.map((frame) =>
          path.join(outDir, `${prefix}-${String(frame).padStart(6, '0')}.${format}`),
        );

        if (!asBool(args.allow_overwrite)) {
          const conflicts = files.filter((file) => fs.existsSync(file));
          if (conflicts.length > 0) {
            throw new Error(
              `render frames would overwrite ${conflicts.length} file(s): ${conflicts
                .slice(0, 3)
                .join(', ')} (set allow_overwrite=true to replace)`,
            );
          }
        }

        const result = await runBlender({
          executable,
          operation: 'render_frames',
          payload: {
            frames,
            output_dir: outDir,
            format,
            prefix,
            width: asNumber(args.width, 640),
            height: asNumber(args.height, 640),
            samples: asNumber(args.samples, 32),
            camera: args.camera ? String(args.camera) : undefined,
          },
          blendPath: blend,
          config,
          cwd: workspace,
          signal,
        });

        const imagePaths =
          Array.isArray(result.image_paths) && result.image_paths.length > 0
            ? result.image_paths
            : files;
        return {
          content: json({
            outputDir: outDir,
            frames,
            imagePaths,
            imageCount: imagePaths.length,
            log: result.log,
          }),
          imageRefs: imageRefsFor(imagePaths, 8),
        };
      },
    };
  }

  toolExport() {
    return {
      name: 'blender_export',
      description:
        '把 .blend 导出为 GLB/glTF、FBX、OBJ、STL、USD 或 PLY；扩展名决定格式。',
      parameters: {
        blend_path: { type: 'string', required: true, description: 'workspace 内的 .blend' },
        output_path: { type: 'string', required: true, description: '导出路径（扩展名决定格式）' },
        selection_only: { type: 'boolean', required: false, description: '只导出选中对象' },
        allow_overwrite: { type: 'boolean', required: false, description: '允许覆盖已有输出' },
      },
      dangerLevel: 'normal',
      display: { icon: 'export', argsKey: 'output_path' },
      execute: async (args, ctx, signal) => {
        const { config, executable, workspace } = await this.prepare(ctx);
        const blend = await resolveWorkspacePath(args.blend_path, ctx && ctx.session, config, {
          mustExist: true,
          kind: 'blend_path',
        });
        await assertRegularFile(blend, 'blend_path');
        const output = await resolveWorkspacePath(args.output_path, ctx && ctx.session, config, {
          kind: 'output_path',
        });
        ensureExt(output, SUPPORTED_EXPORTS, 'output_path');
        await assertWritableTarget(output, asBool(args.allow_overwrite), 'output_path');

        const result = await runBlender({
          executable,
          operation: 'export',
          payload: {
            output_path: output,
            selection_only: asBool(args.selection_only),
          },
          blendPath: blend,
          config,
          cwd: workspace,
          signal,
        });
        const info = await assertRegularFile(output, 'export output');
        return {
          content: json({
            modelPath: output,
            format: result.format,
            bytes: info.size,
            log: result.log,
          }),
        };
      },
    };
  }

  toolValidateScene() {
    return {
      name: 'blender_validate_scene',
      description:
        '对 .blend 做非破坏性结构审计（拓扑/非流形/松散点/UV/材质/变换/动画）。profile: general、web、3d-print、animation。errors 非空时工具结果标记为失败。',
      parameters: {
        blend_path: { type: 'string', required: true, description: 'workspace 内的 .blend' },
        profile: {
          type: 'string',
          required: false,
          enum: VALIDATION_PROFILES,
          description: '审计目标，默认 general',
        },
        object_names: {
          type: 'string',
          required: false,
          description: '可选：只审这些对象，逗号分隔；缺省全场景',
        },
      },
      readOnly: true,
      dangerLevel: 'safe',
      display: { icon: 'check', argsKey: 'blend_path' },
      execute: async (args, ctx, signal) => {
        const { config, executable, workspace } = await this.prepare(ctx);
        const blend = await resolveWorkspacePath(args.blend_path, ctx && ctx.session, config, {
          mustExist: true,
          kind: 'blend_path',
        });
        await assertRegularFile(blend, 'blend_path');
        ensureExt(blend, new Set(['.blend']), 'blend_path');

        const profile = args.profile ? String(args.profile) : 'general';
        if (!VALIDATION_PROFILES.includes(profile)) {
          throw new Error(`profile must be one of: ${VALIDATION_PROFILES.join(', ')}`);
        }
        const objectNames = String(args.object_names || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        const result = await runBlender({
          executable,
          operation: 'validate_scene',
          payload: { profile, object_names: objectNames },
          blendPath: blend,
          config,
          cwd: workspace,
          signal,
        });

        return {
          content: json({
            blendPath: blend,
            profile,
            passed: result.passed,
            errors: result.errors || [],
            warnings: result.warnings || [],
            objects: result.objects || [],
            scene: result.scene,
            log: result.log,
          }),
          isError: result.passed !== true,
        };
      },
    };
  }

  toolValidateExport() {
    return {
      name: 'blender_validate_export',
      description:
        '在干净 Blender 进程中回读导出物（GLB/GLTF/FBX/OBJ/STL/USD/PLY/DAE）并做结构审计。profile 缺省按扩展名推断（.stl → 3d-print，其余 web）。',
      parameters: {
        model_path: { type: 'string', required: true, description: 'workspace 内的导出物' },
        profile: {
          type: 'string',
          required: false,
          enum: VALIDATION_PROFILES,
          description: '审计目标；缺省按扩展名推断',
        },
        object_names: {
          type: 'string',
          required: false,
          description: '可选：只审这些导入对象，逗号分隔',
        },
      },
      readOnly: true,
      dangerLevel: 'safe',
      display: { icon: 'check', argsKey: 'model_path' },
      execute: async (args, ctx, signal) => {
        const { config, executable, workspace } = await this.prepare(ctx);
        const model = await resolveWorkspacePath(args.model_path, ctx && ctx.session, config, {
          mustExist: true,
          kind: 'model_path',
        });
        await assertRegularFile(model, 'model_path');
        const ext = ensureExt(model, SUPPORTED_IMPORTS, 'model_path');
        if (ext === '.blend') {
          throw new Error('model_path must be a portable model (GLB/GLTF/FBX/OBJ/STL/USD/PLY/DAE)');
        }

        const profile = args.profile
          ? String(args.profile)
          : ext === '.stl'
            ? '3d-print'
            : 'web';
        if (!VALIDATION_PROFILES.includes(profile)) {
          throw new Error(`profile must be one of: ${VALIDATION_PROFILES.join(', ')}`);
        }
        const objectNames = String(args.object_names || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        const result = await runBlender({
          executable,
          operation: 'validate_asset',
          payload: { source_path: model, profile, object_names: objectNames },
          config,
          cwd: workspace,
          signal,
        });

        const validation = result.validation || {};
        return {
          content: json({
            modelPath: model,
            format: ext.replace(/^\./, ''),
            importedObjects: result.imported_objects || [],
            scene: result.scene,
            validation,
            log: result.log,
          }),
          isError: validation.passed !== true,
        };
      },
    };
  }

  toolHelperCatalog() {
    return {
      name: 'blender_helper_catalog',
      description:
        '列出内置确定性 helper（参考图分析、渲染对比、动画 QA）及其依赖与可用性。用 blender_helper_run 执行。',
      parameters: {
        module: { type: 'string', required: false, description: '可选：只看某个 module' },
        include_unavailable: {
          type: 'boolean',
          required: false,
          description: '包含缺依赖的 helper，默认 false',
        },
      },
      readOnly: true,
      dangerLevel: 'safe',
      display: { icon: 'list', argsKey: 'module' },
      execute: async (args, ctx, signal) => {
        const { config, executable } = await this.prepare(ctx);
        if (config.enableHelpers === false) {
          throw new Error('helpers are disabled by plugin config (enableHelpers=false)');
        }
        const python = await detectAndProbe({
          analysisPythonExecutable: config.analysisPythonExecutable,
          blenderExecutable: executable,
          timeoutMs: Math.min(config.timeoutMs, 15000),
          signal,
        });
        const includeUnavailable = asBool(args.include_unavailable);
        const helpers = HELPERS.filter(
          (helper) => !args.module || helper.module === String(args.module),
        )
          .map((helper) => {
            const missing = missingPackages(helper, python);
            return {
              name: helper.name,
              module: helper.module,
              description: helper.description,
              runtime: helper.runtime,
              dependencies: helper.dependencies,
              missing,
              available: python.available && missing.length === 0,
              arguments: helper.arguments.map((spec) => ({
                name: spec.name,
                required: Boolean(spec.required),
                type: spec.type,
                pathKind: spec.pathKind,
                choices: spec.choices,
                positional: Boolean(spec.positional),
              })),
            };
          })
          .filter((helper) => includeUnavailable || helper.available);

        return {
          content: json({
            python: {
              available: python.available,
              executable: python.executable,
              source: python.source,
              version: python.version,
              packages: python.packages,
              error: python.error || undefined,
            },
            helpers,
            total: helpers.length,
          }),
        };
      },
    };
  }

  toolHelperRun() {
    return {
      name: 'blender_helper_run',
      description:
        '执行一个白名单 helper。arguments_json 是 JSON 对象（键见 catalog）；路径参数限制在 workspace 内，输出默认不覆盖。',
      parameters: {
        name: { type: 'string', required: true, description: 'helper 名（见 blender_helper_catalog）' },
        arguments_json: {
          type: 'string',
          required: false,
          description: 'JSON 对象字符串，如 {"image":"ref.png","out":"out.json"}',
        },
        allow_overwrite: { type: 'boolean', required: false, description: '允许覆盖已有输出' },
      },
      dangerLevel: 'normal',
      display: { icon: 'helper', argsKey: 'name' },
      execute: async (args, ctx, signal) => {
        const { config, executable, workspace } = await this.prepare(ctx);
        if (config.enableHelpers === false) {
          throw new Error('helpers are disabled by plugin config (enableHelpers=false)');
        }
        const helper = getHelper(args.name);
        if (!helper) {
          throw new Error(`unknown helper: ${args.name} (call blender_helper_catalog)`);
        }
        if (helper.maintenance && config.enableMaintenanceHelpers !== true) {
          throw new Error(
            `helper ${helper.name} is a maintenance helper; enable enableMaintenanceHelpers to run it`,
          );
        }

        const python = await detectAndProbe({
          analysisPythonExecutable: config.analysisPythonExecutable,
          blenderExecutable: executable,
          timeoutMs: Math.min(config.timeoutMs, 15000),
          signal,
        });
        if (helper.runtime === 'python') {
          if (!python.available) {
            throw new Error(
              `analysis Python is not available: ${python.error || 'not found'} (set analysisPythonExecutable)`,
            );
          }
          const missing = missingPackages(helper, python);
          if (missing.length > 0) {
            throw new Error(
              `helper ${helper.name} requires missing Python packages: ${missing.join(', ')}`,
            );
          }
        }

        let parsedArguments = {};
        if (args.arguments_json) {
          try {
            parsedArguments =
              typeof args.arguments_json === 'string'
                ? JSON.parse(args.arguments_json)
                : args.arguments_json;
          } catch (err) {
            throw new Error(`arguments_json is not valid JSON: ${err.message}`);
          }
        }

        const result = await runHelper({
          helper,
          helpersRoot: path.join(this.pluginDir, 'helpers'),
          python,
          blenderExecutable: executable,
          arguments: parsedArguments,
          session: ctx && ctx.session,
          config,
          cwd: workspace,
          signal,
          allowOverwrite: asBool(args.allow_overwrite),
        });

        return {
          content: json({
            helper: result.helper,
            module: result.module,
            exitCode: result.exitCode,
            durationMs: result.durationMs,
            outputs: result.outputs,
            report: result.report,
            log: result.log,
          }),
          imageRefs: imageRefsFor(result.images, 8),
        };
      },
    };
  }

  // ── 设置页 RPC ──

  registerRpc(api) {
    if (typeof api.registerRpc !== 'function') return;
    api.registerRpc({
      get_status: async () => {
        const config = await getConfig(api);
        let executable = '';
        let source = '';
        let error = '';
        try {
          const resolved = resolveExecutable(config);
          executable = resolved.executable;
          source = resolved.source;
        } catch (err) {
          error = err.message;
        }
        const version = executable
          ? await getVersion(executable, { timeoutMs: 15000 })
          : { available: false, version: '', error };
        const analysis = await detectAndProbe({
          analysisPythonExecutable: config.analysisPythonExecutable,
          blenderExecutable: executable,
          timeoutMs: 15000,
        });
        return {
          version: VERSION,
          config,
          executable,
          executableSource: source,
          detected: detectBlender(),
          blender: version,
          analysis,
          helpers: {
            count: HELPERS.length,
            enabled: config.enableHelpers !== false,
          },
          dataDir: this.dataDir,
          pythonEnabled: config.enablePython !== false,
        };
      },
      detect: () => ({ detected: detectBlender(), platform: process.platform }),
      save_config: async (args) => {
        await saveConfig(api, args || {});
        return { ok: true, config: await getConfig(api) };
      },
      test: async (args) => {
        const config = { ...(await getConfig(api)), ...(args || {}) };
        try {
          const { executable, source } = resolveExecutable(config);
          const version = await getVersion(executable, { timeoutMs: 15000 });
          return { ok: version.available, executable, source, ...version };
        } catch (err) {
          return { ok: false, error: err.message };
        }
      },
      test_python: async (args) => {
        const config = { ...(await getConfig(api)), ...(args || {}) };
        try {
          const { executable } = resolveExecutable(config);
          const analysis = await detectAndProbe({
            analysisPythonExecutable: config.analysisPythonExecutable,
            blenderExecutable: executable,
            timeoutMs: 15000,
          });
          return { ok: analysis.available, ...analysis };
        } catch (err) {
          return { ok: false, error: err.message };
        }
      },
    });
  }
}

module.exports = GuadaBlenderPlugin;
module.exports.default = GuadaBlenderPlugin;
