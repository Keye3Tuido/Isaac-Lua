// tests2/corpus/perf.js — 确定性性能探针：v2 对【录制基线】的性能报告（M6）
// 语料 = 仓库段中源文本最长的 5 段（与 v1 tests/performance_probe.js 同口径、确定性排序）。
// 硬断言：
//   (a) 产出质量：每段 v2 输出 <= 录制的 v1 搜索输出（同等工作量口径）；
//   (b) parse 防线：v2 parse 总数 <= v1 搜索录制基线 × 1.5（回归绊线；如实报告比值）。
// 报告项：v1 规则系统（无搜索）基线 860 parses——v2 默认管线含双向 beam 搜索，与无
//   搜索基线不可同比；「parse 降 50%」在全量重建 IR 下不可达（设计风险 §9.1 备案：
//   先正确后优化，增量重建属 M7）。v1 数字为录制基线（2026-10-15 复测，语料变更须重锚），
//   门禁不再现测 v1（省 ~30s 门禁时间）。
'use strict';
const { performance } = require('perf_hooks');
const baseParser = require('../../node_modules/luaparse');
const fengari = require('fengari');

let parseCount = 0;
const countedParser = Object.assign({}, baseParser, {
  parse: function(){ parseCount++; return baseParser.parse.apply(baseParser, arguments); }
});

const L1 = require('../../src2/base.js').create({ luaparse: countedParser, fengari });
const LuaMin2 = require('../../src2/core2.js');
const L2 = LuaMin2.create({ luaparse: countedParser, fengari });

const { removeComments } = require('../_helpers');
const { loadRepoSegments } = require('../repo-lua-files');

// 录制基线（2026-10-15 复测，本语料 top-5 段：util5.编解码#2 / 御灵术#12 / 灵感#22 /
// 勇往直前#21 / 自选双子#11）：v1 搜索（searchOptimize maxCandidates:10）输出字节与
// parse 数；v1 规则（compress）输出与 parse 作对照打印。此前 2026-10-14 基线 20740/11024。
const V1_SEARCH = { out: 20746, parses: 11033 };
const V1_GREEDY = { out: 20764, parses: 851 };
const TRIPWIRE = 1.5;   // v2 parse 总数 / v1 搜索基线 的回归绊线

function run(){
  let pass = 0, fail = 0;
  const bad = [];
  function ok(cond, label, detail){
    if(cond){ pass++; }
    else { fail++; if(bad.length < 10) bad.push(label + (detail ? ' | ' + detail : '')); }
  }

  const segments = loadRepoSegments();
  const samples = [];
  for(const rel of Object.keys(segments)){
    segments[rel].forEach(function(code, i){
      samples.push({ key: rel + '#' + i, source: removeComments(L1, 'l ' + code) });
    });
  }
  samples.sort(function(a, b){ return b.source.length - a.source.length || (a.key < b.key ? -1 : 1); });
  const top = samples.slice(0, 5);

  const rows = [];
  let sumV2 = 0, outV2 = 0;
  for(const s of top){
    parseCount = 0;
    const t0 = performance.now();
    let r2 = null, e2 = null;
    try{ r2 = L2.compress(s.source); }catch(e){ e2 = e; }
    const ms = +(performance.now() - t0).toFixed(0);
    if(!r2){
      ok(false, s.key, 'v2 压缩失败: ' + String(e2 && e2.message || '').slice(0, 60));
      continue;
    }
    rows.push({ key: s.key, in: s.source.length, out: r2.bodyLength, parses: parseCount, ms: ms });
    sumV2 += parseCount; outV2 += r2.bodyLength;
  }

  // (a) 产出质量门（总量口径：5 段合计）
  ok(outV2 <= V1_SEARCH.out, 'v2 产出总量 <= v1 搜索基线',
     'v2=' + outV2 + ' v1-search=' + V1_SEARCH.out);
  // (b) parse 绊线
  const ratio = sumV2 / V1_SEARCH.parses;
  ok(ratio <= TRIPWIRE, 'v2 parse 总数 <= v1 搜索基线 ×' + TRIPWIRE,
     'v2=' + sumV2 + ' v1-search=' + V1_SEARCH.parses + '（' + (ratio * 100).toFixed(1) + '%）');

  console.log('[perf] 段 | 输入 | v2 输出/parse/ms');
  rows.forEach(function(r){
    console.log('[perf]', r.key, '|', r.in, '|', r.out + ' / ' + r.parses + ' / ' + r.ms + 'ms');
  });
  console.log('[perf] 合计: v2 输出', outV2, '（v1搜索', V1_SEARCH.out, '/ v1规则', V1_GREEDY.out, '）',
              '| v2 parse', sumV2, '（v1搜索', V1_SEARCH.parses, '= ' + (ratio * 100).toFixed(1) + '%；',
              'v1规则', V1_GREEDY.parses, '无搜索基线不可同比）');
  if(bad.length){
    console.log('--- 失败明细 ---');
    bad.forEach(function(b){ console.log('✗', b); });
  }
  return { pass, fail };
}

module.exports = { name: 'perf', run };
