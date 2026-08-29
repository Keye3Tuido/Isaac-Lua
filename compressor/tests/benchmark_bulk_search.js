// 真实开源 Lua 库（bulk 语料）上对比：规则系统 vs 搜索层（穿插压缩）。
// 用法：node tests/benchmark_bulk_search.js [--limit N] [--k K] [--budget MS]
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const luaparse = require('luaparse');
const fengari = require('fengari');
require('../core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

const args = process.argv.slice(2);
let limit = Infinity, K = 4, budget = 5000;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit' && args[i + 1]) { limit = parseInt(args[i + 1], 10); i++; }
  else if (args[i] === '--k' && args[i + 1]) { K = parseInt(args[i + 1], 10); i++; }
  else if (args[i] === '--budget' && args[i + 1]) { budget = parseInt(args[i + 1], 10); i++; }
}

function removeComments(src) {
  try {
    const t = LuaMin._lex(src);
    const r = [];
    for (let i = 0; i < t.length; i++) if (t[i].type === 'Comment') r.push({ s: t[i].start, e: t[i].end });
    if (!r.length) return src;
    let o = src;
    for (let i = r.length - 1; i >= 0; i--) o = o.slice(0, r[i].s) + o.slice(r[i].e);
    return o;
  } catch (e) { return src; }
}

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (['.git', 'node_modules', 'spec', 'test', 'tests'].includes(e.name)) continue; walk(p, out); }
    else if (e.name.endsWith('.lua')) out.push(p);
  }
  return out;
}

let files = [];
const bulkDir = 'tests/_bulk_test_repos';
for (const f of fs.readdirSync(bulkDir)) { const d = path.join(bulkDir, f); if (fs.statSync(d).isDirectory()) walk(d, files); }
files = files.slice(0, limit);

let inTotal = 0, ruleTotal = 0, searchTotal = 0, ok = 0, skip = 0;
const wins = [];
const started = performance.now();
for (const p of files) {
  let src;
  try { src = fs.readFileSync(p, 'utf8'); } catch (e) { continue; }
  if (src.length < 10 || src.includes('\0') || src.startsWith('#!')) continue;
  const c = removeComments(src);
  let rule, search;
  try { rule = LuaMin.compress(c); } catch (e) { skip++; continue; }
  try { search = LuaMin.searchOptimize(c, { beamWidth: K, budget }); } catch (e) { search = null; }
  inTotal += c.length;
  ruleTotal += rule.bodyLength;
  const sLen = (search && search.ok) ? search.bodyLength : rule.bodyLength;
  searchTotal += sLen;
  ok++;
  if (sLen < rule.bodyLength) wins.push({ file: path.basename(p), rule: rule.bodyLength, search: sLen, save: rule.bodyLength - sLen });
}

const elapsed = (performance.now() - started) / 1000;
console.log('文件:', ok, '跳过:', skip, 'K=' + K, 'budget=' + budget + 'ms', '用时 ' + elapsed.toFixed(1) + 's');
console.log('输入字节:', inTotal);
console.log('规则系统:', ruleTotal);
console.log('搜索层  :', searchTotal);
console.log('搜索额外省:', ruleTotal - searchTotal, '(' + ((ruleTotal - searchTotal) / ruleTotal * 100).toFixed(3) + '%)');
wins.sort((a, b) => b.save - a.save);
console.log('搜索获胜文件数:', wins.length);
wins.slice(0, 20).forEach(w => console.log('  ' + w.file + ': ' + w.rule + ' -> ' + w.search + ' (-' + w.save + ')'));
console.log('BULK_SEARCH_JSON ' + JSON.stringify({ inTotal, ruleTotal, searchTotal, saved: ruleTotal - searchTotal, wins: wins.length, ok, skip, elapsedMs: Math.round(elapsed * 1000) }));
