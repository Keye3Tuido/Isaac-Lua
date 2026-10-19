// tests2/corpus/perf.js — tests2 固定性能语料的确定性 parse 绊线
'use strict';
const { performance } = require('perf_hooks');
const baseParser = require('../../node_modules/luaparse');
const fengari = require('fengari');
const { PERFORMANCE } = require('../fixtures/corpus');

let parseCount = 0;
const countedParser = Object.assign({}, baseParser, {
  parse:function(){ parseCount++; return baseParser.parse.apply(baseParser, arguments); }
});
const base = require('../../src2/base.js').create({ luaparse:countedParser, fengari });
const LuaMin2 = require('../../src2/core2.js');
const L2 = LuaMin2.create({ luaparse:countedParser, fengari });
const MAX_TOTAL_PARSES = 50000;

function run(){
  let pass = 0, fail = 0;
  const bad = [], rows = [];
  function ok(cond, label, detail){
    if(cond) pass++;
    else{ fail++; if(bad.length < 10) bad.push(label + (detail ? ' | ' + detail : '')); }
  }

  ok(PERFORMANCE.length === 5, '固定性能语料数量', '实际 ' + PERFORMANCE.length);
  let totalParses = 0, totalOut = 0;
  for(const sample of PERFORMANCE){
    parseCount = 0;
    const input = base._preprocess(sample.code);
    const t0 = performance.now();
    let result;
    try{ result = L2.compress(input); }
    catch(e){ ok(false, sample.name, '压缩失败: ' + String(e.message || e).slice(0, 80)); continue; }
    const ms = Math.round(performance.now() - t0);
    let parseOk = true;
    try{ baseParser.parse(result.body, { luaVersion:'5.3' }); }catch(e){ parseOk = false; }
    ok(parseOk, sample.name, '输出无法解析');
    ok(result.bodyLength <= base.applyEncoding(base.removeComments(input)).length,
      sample.name, '输出长于单行化输入');
    totalParses += parseCount;
    totalOut += result.bodyLength;
    rows.push({ name:sample.name, input:input.length, output:result.bodyLength, parses:parseCount, ms });
  }
  ok(totalParses > 0 && totalParses <= MAX_TOTAL_PARSES, 'parse 总数绊线',
    totalParses + '（上限 ' + MAX_TOTAL_PARSES + '）');

  console.log('[perf] 固定语料 | 输入 | 输出/parse/ms');
  rows.forEach(function(r){ console.log('[perf]', r.name, '|', r.input, '|', r.output + ' / ' + r.parses + ' / ' + r.ms + 'ms'); });
  console.log('[perf] 合计: 输出', totalOut, '| parse', totalParses, '/', MAX_TOTAL_PARSES);
  if(bad.length){
    console.log('--- 失败明细 ---');
    bad.forEach(function(b){ console.log('✗', b); });
  }
  return { pass, fail };
}

module.exports = { name:'perf', run };
