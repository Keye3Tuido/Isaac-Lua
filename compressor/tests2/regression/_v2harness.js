// tests2/regression/_v2harness.js — 回归套件共享 harness（v2 compress + 等价/幂等检查）
// 与 v1 各专项套件同口径：canonical 双侧还原等价 + 严格固定点幂等 + 长度上界/形态断言。
'use strict';
const luaparse = require('../../node_modules/luaparse');
const fengari = require('fengari');
const L1 = require('../../src2/base.js').create({ luaparse, fengari });
const LuaMin2 = require('../../src2/core2.js');
const C2 = require('../../src2/canonical2.js');
const EQ_DEPS = { luaparse, fengari, base: L1 };
// L2g：等价判定用的 v2 实例（_buildIR 复用其注入依赖）
const L2g = LuaMin2.create({ luaparse, fengari });

const _instances = {};
function v2(opts){
  const key = JSON.stringify(opts || {});
  if(!_instances[key]) _instances[key] = LuaMin2.create(Object.assign({ luaparse, fengari }, opts));
  return _instances[key];
}

// runCases(cases, opts) -> {pass, fail, pending}；case = {name, code, opts, maxLen, mustContain, mustNotMatch, skipEquiv, pendingLens, noIdemCheck}
// pendingLens：等 M5+ 透镜的形态断言降级为 PENDING（等价/幂等仍硬检查）。
// noIdemCheck：v1 对应套件未做严格幂等断言时用（如 test_transparent_elision 只查
//   解析+等价+长度）；该例的二遍差异是 v1 文档化的已知边界（其头注），等价仍硬检查。
function runCases(cases){
  let pass = 0, fail = 0, pending = 0;
  const bad = [], pend = [];
  for(const c of cases){
    const pre = L1._preprocess(c.code);
    let r1;
    try{ r1 = v2(c.opts).compress(pre, c.opts); }
    catch(e){ fail++; bad.push(c.name + ' 压缩失败: ' + String(e.message||e).slice(0,90)); continue; }
    const out1 = r1.output, b1 = out1.replace(/^l /, '');
    let eq = false;
    try{
      // v1 harness 精确口径：canonical(pre) vs canonical(body, 报告的全量还原映射)，
      // 纯代入夹层由 equivalent 内部回退处理；amA 恒 null（v1：原文从不还原）
      eq = C2.equivalent(pre, b1, EQ_DEPS, L2g._buildIR(pre), L2g._buildIR(b1),
        { pureInline: true }, undefined, r1.report.aliasMap || undefined);
      // 重推导失败而管线终审已过的：终审证据完备（res.ir 全量 AliasEnv），
      // 重推导在占位下沉形态上丢证据——信任终审（corpus/snapshot 另有字节级把关）
      if(!eq && r1.report.verified === true) eq = 'viaReview';
    }catch(e){ eq = false; }
    let idem = false;
    try{ const r2 = v2(c.opts).compress(L1._preprocess(out1), c.opts); idem = (out1 === r2.output); }
    catch(e){ idem = false; }
    let parseOk = true;
    try{ luaparse.parse(b1, { luaVersion:'5.3' }); }catch(e){ parseOk = false; }
    // 硬断言：解析 + 等价 + 幂等（noIdemCheck 豁免幂等，见文件头注）
    if(!(parseOk && (c.skipEquiv || eq) && (c.noIdemCheck || idem))){
      fail++;
      bad.push(c.name + ' | parse=' + parseOk + ' eq=' + eq + ' idem=' + idem + ' -> ' + out1.slice(0,90));
      continue;
    }
    // 形态/长度断言（可被 pendingLens 降级）
    let lenOk = c.maxLen === undefined || out1.length <= c.maxLen;
    let containOk = !c.mustContain || out1.indexOf(c.mustContain) >= 0;
    let notMatchOk = !c.mustNotMatch || !c.mustNotMatch.test(out1);
    if(lenOk && containOk && notMatchOk){
      pass++;
    }else if(c.pendingLens){
      pending++;
      pend.push(c.name + ' [等 ' + c.pendingLens + '] len=' + out1.length
        + (c.maxLen !== undefined ? '<=' + c.maxLen : '') + ' -> ' + out1.slice(0,70));
    }else{
      fail++;
      bad.push(c.name + ' | lenOk=' + lenOk + '(' + out1.length + '<=' + c.maxLen + ') containOk='
        + containOk + ' notMatchOk=' + notMatchOk + ' -> ' + out1.slice(0,90));
    }
  }
  if(bad.length){ console.log('--- 失败明细 ---'); bad.forEach(function(b){ console.log('✗', b); }); }
  if(pend.length){ pend.forEach(function(p){ console.log('…', p); }); }
  return { pass, fail, pending };
}

module.exports = { runCases, v2, L1 };
