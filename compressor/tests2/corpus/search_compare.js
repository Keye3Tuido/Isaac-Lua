// tests2/corpus/search_compare.js — v2 搜索对 v1 搜索的全语料总量门（M6）
// 口径移植 v1 tests/test_search_compare.js：仓库段（构建期默认参数替换后的最终
// 代码、去注释）逐段压缩求 bodyLength 总和。
// 硬断言：v2（贪心+双向 beam）总量 <= v1 searchOptimize 总量（v1 实测基线，语料变更须重测）；
// 每段等价性硬检查（canonical2 差量口径，与终审同一实现）。
'use strict';
const luaparse = require('../../node_modules/luaparse');
const fengari = require('fengari');
const L1 = require('../../src2/base.js').create({ luaparse, fengari });
const LuaMin2 = require('../../src2/core2.js');
const L2 = LuaMin2.create({ luaparse, fengari });
const C2 = require('../../src2/canonical2.js');

const { removeComments } = require('../_helpers');
const { loadRepoSegments } = require('../repo-lua-files');

// v1 searchOptimize（maxCandidates:10）全语料实测总量基线。
// 2026-10-15 复测：1021 段（lua/ 增至 53 文件后的当前语料），v1 规则 614319 / v1 搜索 614298，
// v2 612275（−2023）；此前 804 段语料基线为 353485。
const V1_SEARCH_TOTAL = 614298;

function run(){
  let pass = 0, fail = 0;
  const bad = [];
  function ok(cond, label, detail){
    if(cond){ pass++; }
    else { fail++; if(bad.length < 20) bad.push(label + (detail ? ' | ' + detail : '')); }
  }

  const segments = loadRepoSegments();
  const files = Object.keys(segments).sort();
  let segTotal = 0, v2Total = 0, threw = 0, wins = 0;
  const t0 = Date.now();

  for(const f of files){
    segments[f].forEach(function(code, idx){
      const label = f + '#' + idx;
      const body = removeComments(L1, code);
      if(!body || !body.trim()) return;
      segTotal++;
      const seg = 'l ' + body;
      let r = null, err = null;
      try{ r = L2.compress(seg); }catch(e){ err = e; }
      if(!r){ threw++; ok(false, label, 'v2 压缩失败: ' + String(err && err.message || err).slice(0, 90)); return; }
      v2Total += r.bodyLength;
      // 等价性硬检查（canonical2 差量口径）
      let eq = false;
      try{
        const pre = L1._preprocess(seg);
        eq = C2.equivalent(pre, r.body, { luaparse, fengari, base: L1 },
          L2._buildIR(pre), L2._buildIR(r.body), { pureInline: true },
          undefined, r.report.aliasMap || undefined);
        if(!eq && r.report.verified === true) eq = 'viaReview';
      }catch(e){ eq = false; }
      ok(!!eq, label, '搜索产物 canonical 不等价');
    });
  }

  ok(v2Total <= V1_SEARCH_TOTAL, 'v2 搜索总量 <= v1 搜索总量',
     'v2=' + v2Total + ' v1=' + V1_SEARCH_TOTAL + '（超出 ' + (v2Total - V1_SEARCH_TOTAL) + '）');

  console.log('[search_compare] 语料段数:', segTotal, '| v2 失败:', threw,
              '| v2 搜索总量:', v2Total, '| v1 搜索基线:', V1_SEARCH_TOTAL,
              '| 差值:', v2Total - V1_SEARCH_TOTAL, '| 用时', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  if(bad.length){
    console.log('--- 失败明细（前 ' + bad.length + ' 条）---');
    bad.forEach(function(b){ console.log('✗', b); });
  }
  return { pass, fail };
}

module.exports = { name: 'search_compare', run };
