// 批量下载开源 Lua 项目并全量压缩测试，验证语法通过
const { execSync } = require('child_process');
const fs = require('fs'), path = require('path');
const luaparse = require('./node_modules/luaparse');
const fengari = require('fengari');
require('./core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

const TEST_DIR = path.join(__dirname, '_bulk_test_repos');

// 知名纯 Lua 项目列表
const REPOS = [
  { url: 'https://github.com/lunarmodules/penlight.git',       name: 'penlight',       branch: 'master' },
  { url: 'https://github.com/lunarmodules/busted.git',         name: 'busted',         branch: 'master' },
  { url: 'https://github.com/stevedonovan/Microlight.git',     name: 'microlight',     branch: 'master' },
  { url: 'https://github.com/Yonaba/Moses.git',                name: 'moses',          branch: 'master' },
  { url: 'https://github.com/Yonaba/30log.git',                name: '30log',          branch: 'master' },
  { url: 'https://github.com/rxi/json.lua.git',                name: 'json-lua',       branch: 'master' },
  { url: 'https://github.com/kikito/middleclass.git',          name: 'middleclass',    branch: 'master' },
  { url: 'https://github.com/pkulchenko/ZeroBraneStudio.git',  name: 'zerobrane',      branch: 'master', depth: 1, luaDir: 'lualibs' },
];

function clone(repo) {
  const dir = path.join(TEST_DIR, repo.name);
  if (fs.existsSync(dir)) {
    console.log('  已存在，跳过克隆: ' + repo.name);
    return dir;
  }
  console.log('  克隆: ' + repo.name + ' ...');
  const depth = repo.depth || 20;
  try {
    execSync(`git clone --depth ${depth} --single-branch --branch "${repo.branch}" "${repo.url}" "${repo.name}"`, { cwd: TEST_DIR, stdio: 'pipe', timeout: 60000 });
  } catch (e) {
    // shallow clone 失败时尝试完整克隆
    console.log('    浅克隆失败，尝试完整克隆...');
    execSync(`git clone "${repo.url}" "${repo.name}"`, { cwd: TEST_DIR, stdio: 'pipe', timeout: 120000 });
  }
  return dir;
}

function collectLuaFiles(dir, relBase) {
  relBase = relBase || dir;
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    // 跳过 .git、node_modules、spec（测试文件通常依赖 busted 框架，无法独立 load）
    if (e.isDirectory()) {
      if (e.name === '.git' || e.name === 'node_modules' || e.name === 'spec' || e.name === 'test' || e.name === 'tests') continue;
      results.push(...collectLuaFiles(full, relBase));
    } else if (e.name.endsWith('.lua')) {
      results.push({ fullPath: full, relPath: path.relative(relBase, full) });
    }
  }
  return results;
}

function main() {
  if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });

  let totalFiles = 0, totalBytes = 0, passFiles = 0, failFiles = 0;
  const failures = [];

  for (const repo of REPOS) {
    console.log('\n[' + repo.name + ']');
    let dir;
    try {
      dir = clone(repo);
    } catch (e) {
      console.log('  克隆失败: ' + e.message.slice(0, 100));
      continue;
    }

    const luaDir = repo.luaDir ? path.join(dir, repo.luaDir) : dir;
    if (!fs.existsSync(luaDir)) {
      console.log('  目录不存在: ' + luaDir);
      continue;
    }

    const files = collectLuaFiles(luaDir, dir);
    console.log('  Lua 文件: ' + files.length);

    for (const f of files) {
      totalFiles++;
      let src;
      try {
        src = fs.readFileSync(f.fullPath, 'utf8');
      } catch (e) { continue; }

      // 跳过空文件、二进制文件、过小文件（<10B 通常是 shebang 或空模块）
      if (src.length === 0 || src.includes('\0') || src.length < 10) continue;
      totalBytes += src.length;

      try {
        const r = LuaMin.compress(src);
        // 验证输出语法（剥离 l 控制台前缀后）
        const body = r.output.replace(/^l /, '');
        luaparse.parse(body, { luaVersion: '5.3' });
        passFiles++;
      } catch (e) {
        failFiles++;
        const errMsg = e.message.slice(0, 120);
        failures.push({ repo: repo.name, file: f.relPath, err: errMsg, size: src.length });
        if (failures.length <= 30) {
          console.log('  FAIL: ' + f.relPath + ' (' + src.length + 'B)');
          console.log('        ' + errMsg);
        }
      }
    }
    console.log('  完成');
  }

  console.log('\n========================================');
  console.log('总计: ' + totalFiles + ' 文件, ' + totalBytes + ' bytes');
  console.log('通过: ' + passFiles + '  失败: ' + failFiles);
  console.log('通过率: ' + (totalFiles > 0 ? (passFiles / totalFiles * 100).toFixed(1) + '%' : 'N/A'));

  if (failures.length > 0) {
    console.log('\n--- 失败明细 (' + failures.length + ' 条) ---');
    failures.forEach(f => {
      console.log('  [' + f.repo + '] ' + f.file + ' (' + f.size + 'B): ' + f.err);
    });
  }

  // 清理
  // fs.rmSync(TEST_DIR, { recursive: true, force: true });
}

main();
