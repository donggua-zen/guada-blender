'use strict';

/**
 * 插件配置：默认值、Blender 可执行文件探测、持久化。
 *
 * 宿主暂无 configSchema 运行时，因此配置存在插件 KV（api.getValue/setValue），
 * 设置页通过 RPC 读写。
 */

const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = {
  /** 留空 = 自动探测；可填绝对路径或 PATH 上的命令名 */
  blenderExecutable: '',
  /** 单次 Blender 调用超时（毫秒） */
  timeoutMs: 180000,
  /** 返回给模型的日志上限（字符） */
  maxOutputChars: 20000,
  /** 限制所有工具参数在会话 workspace 内 */
  restrictToWorkspace: true,
  /** 允许 blender_python / blender_run_script（等价 dsh 的 enablePython） */
  enablePython: true,
  /** 分析用 Python（helper）；留空 = 自动探测 */
  analysisPythonExecutable: '',
  /** 允许 helper catalog/run */
  enableHelpers: true,
  /** 单次 helper 超时（毫秒） */
  helperTimeoutMs: 120000,
  /** 允许 maintenance helper（默认关闭） */
  enableMaintenanceHelpers: false,
};

const CONFIG_KEYS = Object.keys(DEFAULTS);

function compareVersionDesc(a, b) {
  const parse = (s) => (String(s).match(/\d+/g) || []).map(Number);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] || 0) - (pa[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function detectWindows() {
  const roots = [
    'C:\\Program Files\\Blender Foundation',
    'C:\\Program Files (x86)\\Blender Foundation',
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Blender Foundation')
      : '',
  ].filter(Boolean);

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(root).filter((name) => name.startsWith('Blender '));
    } catch {
      continue;
    }
    entries.sort(compareVersionDesc);
    for (const name of entries) {
      const exe = path.join(root, name, 'blender.exe');
      if (fs.existsSync(exe)) return exe;
    }
  }
  return '';
}

function detectMac() {
  const candidates = [
    '/Applications/Blender.app/Contents/MacOS/Blender',
    path.join(process.env.HOME || '', 'Applications', 'Blender.app', 'Contents', 'MacOS', 'Blender'),
  ];
  return candidates.find((p) => p && fs.existsSync(p)) || '';
}

function detectLinux() {
  const dirs = String(process.env.PATH || '').split(path.delimiter);
  for (const dir of dirs) {
    if (!dir) continue;
    const candidate = path.join(dir, 'blender');
    if (fs.existsSync(candidate)) return candidate;
  }
  return '';
}

function detectBlender() {
  const env = String(
    process.env.GUADA_BLENDER_EXECUTABLE || process.env.BLENDER_EXECUTABLE || '',
  ).trim();
  if (env) {
    if (!looksAbsolute(env) || fs.existsSync(env)) return env;
  }
  if (process.platform === 'win32') return detectWindows();
  if (process.platform === 'darwin') return detectMac();
  return detectLinux();
}

function looksAbsolute(p) {
  return path.isAbsolute(p) || /^[A-Za-z]:[\\/]/.test(p);
}

/**
 * 解析最终可执行文件：
 * - 配置了绝对路径 → 必须存在；
 * - 配置了命令名（如 blender）→ 交给 PATH；
 * - 未配置 → 自动探测，失败时回退 'blender'（由 spawn 报错并给指引）。
 */
function resolveExecutable(config) {
  const configured = String(config.blenderExecutable || '').trim();
  if (configured) {
    if (looksAbsolute(configured) && !fs.existsSync(configured)) {
      throw new Error(
        `blenderExecutable does not exist: ${configured}（可在插件设置页修改）`,
      );
    }
    return { executable: configured, source: 'config' };
  }
  const detected = detectBlender();
  if (detected) return { executable: detected, source: 'auto' };
  return { executable: 'blender', source: 'path' };
}

async function getConfig(api) {
  const config = { ...DEFAULTS };
  if (!api || typeof api.getValue !== 'function') return config;
  for (const key of CONFIG_KEYS) {
    try {
      const value = await api.getValue(key, undefined);
      if (value !== undefined && value !== null) config[key] = value;
    } catch {
      /* ignore */
    }
  }
  return config;
}

async function saveConfig(api, patch) {
  const next = {};
  for (const key of CONFIG_KEYS) {
    if (patch && Object.prototype.hasOwnProperty.call(patch, key)) {
      next[key] = patch[key];
    }
  }
  for (const [key, value] of Object.entries(next)) {
    await api.setValue(key, value);
  }
  return getConfig(api);
}

module.exports = {
  DEFAULTS,
  CONFIG_KEYS,
  detectBlender,
  resolveExecutable,
  getConfig,
  saveConfig,
};
