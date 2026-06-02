// Phase 0: 前置验证 — 搜索优化器 vs 规则系统 全量对比
// 对仓库所有 l 段 + 合并文件逐一跑 compress 和 searchOptimize，报告差值。

const fs = require('fs'), path = require('path');
const luaparse = require('../node_modules/luaparse');
const fengari = require('fengari');
require('../core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

function removeComments(src) {
  try {
    const tokens = LuaMin._lex(src);
    const ranges = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type === 'Comment') ranges.push({ s: tokens[i].start, e: tokens[i].end });
    }
    if (!ranges.length) return src;
    let out = src;
    for (let i = ranges.length - 1; i >= 0; i--) out = out.slice(0, ranges[i].s) + out.slice(ranges[i].e);
    return out;
  } catch (e) { return src; }
}

function canonicalEq(a, b, aliasMap) {
  try { return LuaMin._canonical(a) === (aliasMap ? LuaMin._canonical(b, aliasMap) : LuaMin._canonical(b)); }
  catch (e) { return false; }
}

const dir = path.join(__dirname, '../..');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.lua'));

let baselineTotal = 0, searchTotal = 0;
let wins = [], losses = [], equivalenceErrors = [];
let segCount = 0, mergeCount = 0;

for (const f of files) {
  let text;
  try { text = fs.readFileSync(path.join(dir, f), 'utf8'); } catch (e) { continue; }
  const lines = text.split(/\r?\n/);

  const segs = [];
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (!/^l\s/.test(line)) continue;
    segs.push(line);
    segCount++;

    const cleaned = removeComments(line);
    let baseline, search;

    try { baseline = LuaMin.compress(cleaned); } catch (e) { continue; }
    if (!baseline || !baseline.ok) continue;

    try { search = LuaMin.searchOptimize(cleaned, { budget: 600, maxIters: 50 }); } catch (e) { search = null; }
    if (!search || !search.ok) { baselineTotal += baseline.bodyLength; searchTotal += baseline.bodyLength; continue; }

    baselineTotal += baseline.bodyLength;
    searchTotal += search.bodyLength;

    if (search.bodyLength < baseline.bodyLength) {
      const body = search.output.replace(/^l /, '');
      const orig = LuaMin._preprocess(cleaned);
      if (!canonicalEq(orig, body, search.aliasMapInfo)) {
        equivalenceErrors.push({ file: f, line: li, msg: '等价验证失败' });
        continue;
      }
      wins.push({ file: f, line: li, inputLen: baseline.originalLength, baseline: baseline.bodyLength, search: search.bodyLength });
    } else if (search.bodyLength > baseline.bodyLength) {
      losses.push({ file: f, line: li, baseline: baseline.bodyLength, search: search.bodyLength });
    }
  }

  if (segs.length < 2) continue;
  mergeCount++;
  const merged = segs.join('\n');
  const cleaned = removeComments(merged);
  let baseline, search;

  try { baseline = LuaMin.compress(cleaned); } catch (e) { continue; }
  if (!baseline || !baseline.ok) continue;

  try { search = LuaMin.searchOptimize(cleaned, { budget: 800, maxIters: 80 }); } catch (e) { search = null; }
  if (!search || !search.ok) { baselineTotal += baseline.bodyLength; searchTotal += baseline.bodyLength; continue; }

  baselineTotal += baseline.bodyLength;
  searchTotal += search.bodyLength;

  if (search.bodyLength < baseline.bodyLength) {
    const body = search.output.replace(/^l /, '');
    const orig = LuaMin._preprocess(cleaned);
    if (!canonicalEq(orig, body, search.aliasMapInfo)) {
      equivalenceErrors.push({ file: f, type: 'merged', msg: '等价验证失败' });
      continue;
    }
    wins.push({ file: f, type: 'merged', inputLen: baseline.originalLength, baseline: baseline.bodyLength, search: search.bodyLength });
  } else if (search.bodyLength > baseline.bodyLength) {
    losses.push({ file: f, type: 'merged', baseline: baseline.bodyLength, search: search.bodyLength });
  }
}

console.log('==========================================');
console.log('Phase 0: 搜索优化器 vs 规则系统 — 全量对比');
console.log('==========================================\n');
console.log('测试范围: ' + files.length + ' 文件, ' + segCount + ' 段, ' + mergeCount + ' 合并\n');

const diff = baselineTotal - searchTotal;
const pct = baselineTotal > 0 ? (diff / baselineTotal * 100).toFixed(2) : '0.00';
console.log('规则系统总计: ' + baselineTotal + ' 字符');
console.log('搜索优化总计: ' + searchTotal + ' 字符');
console.log('差值: ' + diff + ' 字符 (' + pct + '%)');

if (wins.length > 0) {
  console.log('\n--- 搜索优化获胜 (' + wins.length + ' 处) ---');
  wins.forEach(w => {
    const loc = w.line !== undefined ? ('#' + w.line) : ('[' + (w.type || 'seg') + ']');
    console.log('  ' + w.file + loc + ': ' + w.baseline + ' -> ' + w.search + ' (省 ' + (w.baseline - w.search) + ' 字, 原输入 ' + w.inputLen + ')');
  });
  const totalWin = wins.reduce((s, w) => s + (w.baseline - w.search), 0);
  console.log('  合计节省: ' + totalWin + ' 字符');
} else {
  console.log('\n搜索优化获胜: 0 处');
}

if (losses.length > 0) {
  console.log('\n--- 搜索优化变长 (' + losses.length + ' 处) ---');
  losses.forEach(w => {
    const loc = w.line !== undefined ? ('#' + w.line) : ('[' + (w.type || 'seg') + ']');
    console.log('  ' + w.file + loc + ': ' + w.baseline + ' -> ' + w.search + ' (增 ' + (w.search - w.baseline) + ')');
  });
}

if (equivalenceErrors.length > 0) {
  console.log('\n!!! 等价验证失败 (' + equivalenceErrors.length + ' 处) !!!');
  equivalenceErrors.forEach(w => {
    console.log('  ' + w.file + ' #' + (w.line || w.type) + ': ' + w.msg);
  });
}

console.log('\n' + (wins.length > 0
  ? '结论: 搜索层有效，有 ' + wins.length + ' 处改进。'
  : '结论: 搜索层在当前语料上未找到优于规则系统的配置。'));
