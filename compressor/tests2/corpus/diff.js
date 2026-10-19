// tests2/corpus/diff.js — tests2 固定语料的成功性、等价性与幂等门禁
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
  let total = 0, totalIn = 0, totalOut = 0;
  for(const file of Object.keys(segments).sort()){
    segments[file].forEach(function(code, idx){
      const label = file + '#' + idx;
      const body = removeComments(L1, code);
      if(!body || !body.trim()) return;
      total++;
      totalIn += body.length;
      let r1;
      try{
        r1 = L2.compress('l ' + body);
        luaparse.parse(r1.body, { luaVersion:'5.3' });
        totalOut += r1.bodyLength;
        ok(true, label);
      }catch(e){
        ok(false, label, '首次压缩/解析失败: ' + String(e.message || e).slice(0, 90));
        return;
      }

      try{
        const r2 = L2.compress(r1.output);
        const eq = C2.equivalent(r1.body, r2.body, { luaparse, fengari, base:L1 },
          L2._buildIR(r1.body), L2._buildIR(r2.body), { pureInline:true },
          r1.report.aliasMap || undefined, r2.report.aliasMap || undefined);
        ok(eq, label, '二次压缩 canonical 不等价');
        ok(r2.bodyLength <= r1.bodyLength, label,
          '二次压缩变长 ' + r1.bodyLength + ' -> ' + r2.bodyLength);
      }catch(e){
        ok(false, label, '二次压缩失败: ' + String(e.message || e).slice(0, 90));
      }
    });
  }

  console.log('[fixture_diff] 固定语料:', total, '| 输入:', totalIn, '| 输出:', totalOut);
  if(bad.length){
    console.log('--- 失败明细（前 ' + bad.length + ' 条）---');
    bad.forEach(function(b){ console.log('✗', b); });
  }
  return { pass, fail };
}

module.exports = { name:'fixture_diff', run };
