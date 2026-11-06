'use strict';

/**
 * 插件侧的 workspace 路径守卫（宿主未开放路径 API，这里自行实现）。
 *
 * 规则：
 * - 相对路径基于会话 workspace；
 * - restrictToWorkspace=true 时，解析后的路径必须仍在 workspace 内；
 * - 用 realpath 防符号链接逃逸；
 * - 输出文件默认不允许覆盖。
 */

const fs = require('node:fs');
const path = require('node:path');

function workspaceOf(session) {
  const raw = session && typeof session.workspacePath === 'string' ? session.workspacePath : '';
  return path.resolve(raw && raw.trim() ? raw : process.cwd());
}

function isWithin(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}

async function nearestExistingAncestor(target) {
  let candidate = target;
  // 最多向上找 64 层，避免异常路径导致长时间循环
  for (let i = 0; i < 64; i++) {
    try {
      await fs.promises.stat(candidate);
      return candidate;
    } catch (err) {
      if (err && err.code !== 'ENOENT') throw err;
      const parent = path.dirname(candidate);
      if (parent === candidate) return candidate;
      candidate = parent;
    }
  }
  return candidate;
}

async function resolveWorkspacePath(rawPath, session, config, options = {}) {
  const { mustExist = false, kind = 'path' } = options;
  if (typeof rawPath !== 'string' || rawPath.trim() === '') {
    throw new Error(`${kind} must be a non-empty string`);
  }
  const workspace = workspaceOf(session);
  const target = path.resolve(
    path.isAbsolute(rawPath) ? rawPath : path.join(workspace, rawPath),
  );

  if (!config.restrictToWorkspace) return target;

  if (!isWithin(workspace, target)) {
    throw new Error(`${kind} must stay inside the session workspace: ${workspace}`);
  }

  const workspaceReal = await fs.promises.realpath(workspace).catch(() => workspace);

  if (mustExist) {
    let targetReal;
    try {
      targetReal = await fs.promises.realpath(target);
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        throw new Error(`${kind} does not exist: ${target}`);
      }
      throw err;
    }
    if (!isWithin(workspaceReal, targetReal)) {
      throw new Error(`${kind} resolves outside the session workspace: ${target}`);
    }
    return targetReal;
  }

  const ancestor = await nearestExistingAncestor(target);
  const ancestorReal = await fs.promises.realpath(ancestor).catch(() => ancestor);
  if (!isWithin(workspaceReal, ancestorReal)) {
    throw new Error(`${kind} resolves through a path outside the session workspace: ${target}`);
  }
  return target;
}

async function assertRegularFile(target, label) {
  const info = await fs.promises.stat(target);
  if (!info.isFile()) throw new Error(`${label} is not a regular file: ${target}`);
  return info;
}

async function assertDirectory(target, label) {
  const info = await fs.promises.stat(target);
  if (!info.isDirectory()) throw new Error(`${label} is not a directory: ${target}`);
  return info;
}

async function assertWritableTarget(target, allowOverwrite, label = 'output') {
  if (!allowOverwrite) {
    const exists = await fs.promises
      .stat(target)
      .then(() => true)
      .catch(() => false);
    if (exists) {
      throw new Error(
        `${label} already exists (set allow_overwrite=true to replace): ${target}`,
      );
    }
  }
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
}

/** 生成不覆盖的版本化路径：foo.png → foo-v2.png */
async function nextAvailablePath(target) {
  const parsed = path.parse(target);
  for (let i = 2; i < 1000; i++) {
    const candidate = path.join(parsed.dir, `${parsed.name}-v${i}${parsed.ext}`);
    const exists = await fs.promises
      .stat(candidate)
      .then(() => true)
      .catch(() => false);
    if (!exists) return candidate;
  }
  throw new Error(`could not find an available output path for ${target}`);
}

module.exports = {
  workspaceOf,
  isWithin,
  nearestExistingAncestor,
  resolveWorkspacePath,
  assertRegularFile,
  assertDirectory,
  assertWritableTarget,
  nextAvailablePath,
};
