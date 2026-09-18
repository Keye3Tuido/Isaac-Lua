'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '../..');
const luaRoot = path.join(projectRoot, 'lua');
const SEGMENTS_FILE = path.join(__dirname, '_repo_segments.json');
const EXPORT_SCRIPT = path.join(projectRoot, 'scripts', 'export_segments.py');

function walkLuaFiles(dir, base, out) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkLuaFiles(abs, base, out);
    } else if (entry.isFile() && entry.name.endsWith('.lua')) {
      out.push({ abs, rel: path.relative(base, abs) });
    }
  }
  return out;
}

function listRepoLuaFiles() {
  return walkLuaFiles(luaRoot, luaRoot, []).sort((a, b) => a.rel.localeCompare(b.rel));
}

// 压缩测试的语料 = 构建期「默认参数替换后」的最终代码（每块一条），不是仓库里的原始 l 行。
// 由 scripts/export_segments.py 生成；缺失时按需调用 python 生成一次。
// 用 stdio:'inherit' 而非管道，避免受限环境禁止管道 stdio 的问题。
function exportSegments() {
  const candidates = [process.env.PYTHON, 'python3', 'python'].filter(Boolean);
  for (const py of candidates) {
    const r = spawnSync(py, [EXPORT_SCRIPT], { cwd: projectRoot, stdio: 'inherit' });
    if (!r.error && r.status === 0) return true;
  }
  return false;
}

function loadRepoSegments() {
  if (!fs.existsSync(SEGMENTS_FILE)) {
    if (!exportSegments()) {
      throw new Error(
        '缺少 compressor/tests/_repo_segments.json，且无法运行 python scripts/export_segments.py；' +
        '请先在本机执行：python scripts/export_segments.py'
      );
    }
  }
  return JSON.parse(fs.readFileSync(SEGMENTS_FILE, 'utf8'));
}

module.exports = { projectRoot, luaRoot, listRepoLuaFiles, loadRepoSegments, SEGMENTS_FILE };
