// K 基准：对不同搜索级数 K，在仓库全部 `l`/`lua` 段上逐段跑 searchOptimize，
// 记录总用时（墙钟）与总输出字节。用于验证"用时随 K 递增、效果随 K 递增"。
// 用法：
//   node tests/benchmark_k.js                 # 全量
//   node tests/benchmark_k.js --limit N       # 只跑前 N 段（快速探针）
//   node tests/benchmark_k.js --ks 0,1,2      # 指定 K 列表
const fs = require('fs');
const { performance } = require('perf_hooks');
const luaparse = require('luaparse');
const fengari = require('fengari');
require('../core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);
const { listRepoLuaFiles } = require('./repo-lua-files');

// ---- 参数解析 ----
const args = process.argv.slice(2);
let limit = Infinity;
let ks = [0, 1, 2, 4, 8, 16, 32];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit' && args[i + 1]) { limit = parseInt(args[i + 1], 10); i++; }
  else if (args[i] === '--ks' && args[i + 1]) { ks = args[i + 1].split(',').map(Number); i++; }
}

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

// 收集全部段（去注释）
const segs = [];
for (const file of listRepoLuaFiles()) {
  let text;
  try { text = fs.readFileSync(file.abs, 'utf8'); } catch (e) { continue; }
  const lines = text.split(/\r?\n/);
  for (let li = 0; li < lines.length; li++) {
    if (!/^\s*(?:lua|l)\s+\S/.test(lines[li])) continue;
    segs.push({ key: file.rel.replace(/\\/g, '/') + '#' + li, src: removeComments(lines[li]) });
  }
}
const runSegs = segs.slice(0, limit);

// JIT 预热：先跑一遍搜索路径，避免首个 K 计时偏高
if (runSegs.length) {
  try { LuaMin.searchOptimize(runSegs[0].src, { beamWidth: 8 }); } catch (e) {}
}

console.log('==============================================');
console.log('K 基准：搜索级数 vs 用时/效果');
console.log('==============================================');
console.log('段总数: ' + segs.length + (limit < segs.length ? ('（本跑仅前 ' + limit + ' 段）') : ''));
console.log('K 列表: ' + ks.join(', '));
console.log('');

const results = [];
for (const K of ks) {
  let totalBytes = 0;
  let okCount = 0;
  let skipCount = 0;
  let improved = 0;      // 相对 K=0 更短的段数
  const started = performance.now();

  for (const seg of runSegs) {
    let rep;
    try {
      rep = LuaMin.searchOptimize(seg.src, { beamWidth: K });
    } catch (e) {
      skipCount++;
      continue;
    }
    if (!rep || !rep.ok) { skipCount++; continue; }
    okCount++;
    totalBytes += rep.bodyLength;
  }

  const elapsedMs = performance.now() - started;
  results.push({ K, okCount, skipCount, totalBytes, elapsedMs });
  console.log(
    'K=' + String(K).padStart(2) +
    '  段: ' + okCount + '/' + runSegs.length +
    '  输出: ' + totalBytes + ' 字节' +
    '  用时: ' + (elapsedMs / 1000).toFixed(2) + ' s'
  );
}

// 汇总：用时/效果随 K 的单调性
console.log('');
console.log('K\t输出字节\t用时(s)\t相对K=0省字节\t相对K=0省%');
const base = results[0] ? results[0].totalBytes : 0;
const baseMs = results[0] ? results[0].elapsedMs : 0;
for (const r of results) {
  const saved = base - r.totalBytes;
  const savedPct = base > 0 ? (saved / base * 100).toFixed(2) : '0.00';
  console.log(
    r.K + '\t' + r.totalBytes + '\t' + (r.elapsedMs / 1000).toFixed(2) +
    '\t' + saved + '\t' + savedPct + '%'
  );
}

// 单调性判定
let timeMono = true, effectMono = true;
for (let i = 1; i < results.length; i++) {
  if (results[i].elapsedMs < results[i - 1].elapsedMs) timeMono = false;
  if (results[i].totalBytes > results[i - 1].totalBytes) effectMono = false;
}
console.log('');
console.log('用时随 K 单调递增: ' + (timeMono ? '是' : '否'));
console.log('效果(输出字节)随 K 单调不增: ' + (effectMono ? '是' : '否'));

console.log('\nBENCH_JSON ' + JSON.stringify({
  limit: limit === Infinity ? null : limit,
  totalSegments: segs.length,
  ks,
  results: results.map(r => ({ K: r.K, okCount: r.okCount, totalBytes: r.totalBytes, elapsedMs: Math.round(r.elapsedMs) }))
}));
