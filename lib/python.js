'use strict';

/**
 * 分析用 Python 环境探测。
 *
 * 只探测，不安装。缺依赖时由 helper_catalog / helper_run 明确报告。
 */

const fs = require('node:fs');
const path = require('node:path');

const { runProcess } = require('./process');

const CACHE_TTL_MS = 60_000;
const cache = new Map();

const PROBE_CODE = [
  'import sys, json',
  'out = {"version": sys.version.split()[0], "packages": {}}',
  'for pip_name, module in [("opencv-python-headless","cv2"),("numpy","numpy"),("Pillow","PIL"),("scipy","scipy")]:',
  '    try:',
  '        __import__(module); out["packages"][pip_name] = True',
  '    except Exception:',
  '        out["packages"][pip_name] = False',
  'print(json.dumps(out))',
].join('\n');

function looksAbsolute(p) {
  return path.isAbsolute(p) || /^[A-Za-z]:[\\/]/.test(p);
}

function pathCandidates() {
  const out = [];
  const dirs = String(process.env.PATH || '').split(path.delimiter);
  const names =
    process.platform === 'win32' ? ['python.exe', 'python3.exe'] : ['python3', 'python'];
  for (const dir of dirs) {
    if (!dir) continue;
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) out.push(candidate);
    }
  }
  return out;
}

function windowsPythonCandidates() {
  if (process.platform !== 'win32') return [];
  const root = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Python')
    : '';
  if (!root || !fs.existsSync(root)) return [];
  const versions = fs
    .readdirSync(root)
    .filter((name) => /^Python3\d+$/.test(name))
    .sort((a, b) => {
      const na = Number(a.replace(/\D/g, ''));
      const nb = Number(b.replace(/\D/g, ''));
      return nb - na;
    });
  return versions
    .map((name) => path.join(root, name, 'python.exe'))
    .filter((candidate) => fs.existsSync(candidate));
}

function blenderPythonCandidates(blenderExecutable) {
  if (!blenderExecutable) return [];
  const root = path.dirname(blenderExecutable);
  if (!fs.existsSync(root)) return [];
  const out = [];
  try {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(
        root,
        entry.name,
        'python',
        'bin',
        process.platform === 'win32' ? 'python.exe' : 'python3',
      );
      if (fs.existsSync(candidate)) out.push(candidate);
    }
  } catch {
    /* ignore */
  }
  return out;
}

function candidateList(configured, blenderExecutable) {
  const list = [];
  const push = (executable, source) => {
    if (!executable) return;
    if (looksAbsolute(executable) && !fs.existsSync(executable)) return;
    if (list.some((item) => item.executable === executable)) return;
    list.push({ executable, source });
  };
  push(String(configured || '').trim(), 'config');
  for (const candidate of pathCandidates()) push(candidate, 'path');
  for (const candidate of windowsPythonCandidates()) push(candidate, 'localappdata');
  for (const candidate of blenderPythonCandidates(blenderExecutable)) push(candidate, 'blender');
  return list;
}

async function probe(executable, options = {}) {
  const key = executable;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.value;

  const result = await runProcess(executable, ['-X', 'utf8', '-c', PROBE_CODE], {
    timeoutMs: options.timeoutMs || 15000,
    maxOutputChars: 4000,
    signal: options.signal,
  });

  let value;
  if (result.code !== 0 || result.error) {
    value = {
      available: false,
      executable,
      version: '',
      packages: {},
      error: result.error || `${result.stdout}\n${result.stderr}`.trim() || `exit ${result.code}`,
    };
  } else {
    try {
      const line = result.stdout
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .pop();
      const data = JSON.parse(line);
      value = {
        available: true,
        executable,
        version: String(data.version || ''),
        packages: data.packages || {},
        error: '',
      };
    } catch (err) {
      value = {
        available: false,
        executable,
        version: '',
        packages: {},
        error: `invalid probe output: ${err.message}`,
      };
    }
  }
  cache.set(key, { at: now, value });
  return value;
}

/**
 * 依次尝试候选环境，返回第一个可用的探测结果。
 */
async function detectAndProbe(options = {}) {
  const candidates = candidateList(
    options.analysisPythonExecutable,
    options.blenderExecutable,
  );
  const failures = [];
  for (const candidate of candidates) {
    const result = await probe(candidate.executable, options);
    if (result.available) {
      return { ...result, source: candidate.source, candidates: candidates.length };
    }
    failures.push(result);
  }
  return {
    available: false,
    executable: candidates[0] ? candidates[0].executable : '',
    version: '',
    packages: {},
    error:
      failures.length > 0
        ? failures[failures.length - 1].error
        : 'no Python interpreter found (set analysisPythonExecutable in plugin settings)',
    source: '',
    candidates: candidates.length,
  };
}

function missingPackages(helper, python) {
  const deps = helper.dependencies || [];
  return deps.filter((dep) => python.packages && python.packages[dep] !== true);
}

module.exports = {
  detectAndProbe,
  probe,
  candidateList,
  missingPackages,
  PROBE_CODE,
};
