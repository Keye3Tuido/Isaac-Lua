// 三方基准：我们的压缩器 vs darklua（process + 规则），同一份真实开源 Lua 语料。
// 用法：node tests/benchmark_darklua.js [--limit N]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const luaparse = require('luaparse');
const fengari = require('fengari');
require('../core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

const DL = path.resolve(__dirname, '../../darklua_bin/darklua.exe');
const DL_CFG = path.resolve(__dirname, '.darklua.json');

const args = process.argv.slice(2);
let limit = Infinity;
for (let i = 0; i < args.length; i++) if (args[i] === '--limit' && args[i + 1]) { limit = parseInt(args[i + 1], 10); i++; }

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (['.git', 'node_modules', 'spec', 'test', 'tests'].includes(e.name)) continue; walk(p, out); }
    else if (e.name.endsWith('.lua')) out.push(p);
  }
  return out;
}

let files = [];
for (const f of fs.readdirSync('tests/_bulk_test_repos')) { const d = path.join('tests/_bulk_test_repos', f); if (fs.statSync(d).isDirectory()) walk(d, files); }
files = files.slice(0, limit);

let inT = 0, ourT = 0, dlT = 0, n = 0, dlFail = 0;
const tmp = 'tests/_dl_tmp.lua';
for (const p of files) {
  let s; try { s = fs.readFileSync(p, 'utf8'); } catch (e) { continue; }
  if (s.length < 10 || s.includes('\0') || s.startsWith('#!')) continue;
  inT += s.length;
  try { ourT += LuaMin.compress(s).bodyLength; } catch (e) { /* skip */ }
  try {
    execFileSync(DL, ['process', '-c', DL_CFG, '--format', 'dense', p, tmp], { stdio: 'ignore' });
    dlT += fs.statSync(tmp).size;
  } catch (e) { dlFail++; }
  n++;
}
console.log('files:', n, 'darklua fail:', dlFail);
console.log('input  :', inT);
console.log('我们    :', ourT, '(' + ((inT - ourT) / inT * 100).toFixed(1) + '%)');
console.log('darklua :', dlT, '(' + ((inT - dlT) / inT * 100).toFixed(1) + '%)');
console.log('我们相对 darklua 再省:', dlT - ourT, '(' + ((dlT - ourT) / dlT * 100).toFixed(1) + '%)');
try { fs.unlinkSync(tmp); } catch (e) {}
