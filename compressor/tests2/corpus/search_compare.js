// tests2/corpus/search_compare.js — 固定语料上搜索结果不得劣于纯规则结果
'use strict';
const luaparse = require('../../node_modules/luaparse');
const fengari = require('fengari');
const L1 = require('../../src2/base.js').create({ luaparse, fengari });
const LuaMin2 = require('../../src2/core2.js');
const C2 = require('../../src2/canonical2.js');
const L2 = LuaMin2.create({ luaparse, fengari });
const { removeComments } = require('../_helpers');
const { loadFixtureSegments } = require('../fixtures/corpus');

function run(){
  let pass = 0, fail = 0;
  const bad = [];
  function ok(cond, label, detail){
    if(cond) pass++;
    else{ fail++; if(bad.length < 20) bad.push(label + (detail ? ' | ' + detail : '')); }
  }

  const segments = loadFixtureSegments();
  let total = 0, greedyTotal = 0, searchTotal = 0;
  const t0 = Date.now();
  for(const file of Object.keys(segments).sort()){
    segments[file].forEach(function(code, idx){
      const label = file + '#' + idx;
      const body = removeComments(L1, code);
      if(!body || !body.trim()) return;
      total++;
      let greedy, searched;
      try{
        greedy = L2.compress('l ' + body, { search:false });
        searched = L2.compress('l ' + body);
      }catch(e){
        ok(false, label, '压缩失败: ' + String(e.message || e).slice(0, 90));
        return;
      }
      greedyTotal += greedy.bodyLength;
      searchTotal += searched.bodyLength;
      ok(searched.bodyLength <= greedy.bodyLength, label,
        '搜索劣于规则结果 ' + searched.bodyLength + ' > ' + greedy.bodyLength);
      let eq = false;
      try{
        eq = C2.equivalent(body, searched.body, { luaparse, fengari, base:L1 },
          L2._buildIR(body), L2._buildIR(searched.body), { pureInline:true },
          undefined, searched.report.aliasMap || undefined);
        if(!eq && searched.report.verified === true) eq = 'viaReview';
      }catch(e){ eq = false; }
      ok(!!eq, label, '搜索产物 canonical 不等价');
    });
  }

  console.log('[search_compare] 固定语料:', total, '| 规则总量:', greedyTotal,
    '| 搜索总量:', searchTotal, '| 差值:', searchTotal - greedyTotal,
    '| 用时:', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  if(bad.length){
    console.log('--- 失败明细（前 ' + bad.length + ' 条）---');
    bad.forEach(function(b){ console.log('✗', b); });
  }
  return { pass, fail };
}

module.exports = { name:'search_compare', run };
