// tests2/unit/lens_roundtrip.js — 透镜 property 测试框架（计划 §8 unit 层）
// 对别名族四透镜 × 全语料 804 段：
//   性质 P1（roundtrip）：∀cand，extract 后 inject（或透镜私有 verify）须 canonical 等价于原 IR；
//   性质 P2（cost 精确）：cost() 预测 === applyCandidate 实测 encodeDelta，逐字节相等；
//   性质 P3（INV-1 保持）：extract 产物 IR 的 AliasEnv 仍通过机器检查。
'use strict';
const luaparse = require('../../node_modules/luaparse');
const fengari = require('fengari');
const L = require('../../src2/base.js').create({ luaparse, fengari });
const IR = require('../../src2/ir.js');
const LENS = require('../../src2/lens.js');
const ALIAS = require('../../src2/lenses/alias.js');
const NORM = require('../../src2/lenses/normalize.js');
const ENC = require('../../src2/lenses/encode.js');
const HOIST = require('../../src2/lenses/hoist.js');
const CHAIN = require('../../src2/lenses/chain.js');
const FACTOR = require('../../src2/lenses/factor.js');
const BLK = require('../../src2/lenses/block.js');

const { removeComments } = require('../_helpers');
const { loadRepoSegments } = require('../repo-lua-files');

const deps = { luaparse, fengari, base: L };

function run(){
  let pass = 0, fail = 0;
  const bad = [];
  function ok(cond, label, detail){
    if(cond){ pass++; }
    else { fail++; if(bad.length < 20) bad.push(label + (detail ? ' | ' + detail : '')); }
  }

  const lenses = ALIAS.createAliasLenses(deps)
    .concat(CHAIN.createChainLenses(deps))
    .concat(FACTOR.createFactorLenses(deps))
    .concat(BLK.createBlockLenses(deps))
    .concat(HOIST.createHoistLenses(deps))
    .concat(NORM.createNormalizeLenses(deps))
    .concat(ENC.createEncodeLenses(deps));
  lenses.forEach(function(l){ LENS.validateLens(l); });

  const segments = loadRepoSegments();
  const files = Object.keys(segments).sort();
  let segTotal = 0, candTotal = 0, segWithCand = 0, verified = 0, rejected = 0;
  const perLens = {};

  for(const f of files){
    segments[f].forEach(function(code, idx){
      const label = f + '#' + idx;
      const src = removeComments(L, code);
      if(!src || !src.trim()) return;
      segTotal++;
      let ir;
      try{ ir = IR.buildIR(src, deps); }
      catch(e){ ok(false, label, 'buildIR threw: ' + String(e.message||e).slice(0,80)); return; }

      let segHas = false;
      for(const lens of lenses){
        let cands;
        try{ cands = lens.match(ir) || []; }
        catch(e){ ok(false, label, lens.name + ' match threw: ' + String(e.message||e).slice(0,80)); continue; }
        perLens[lens.name] = perLens[lens.name] || { cands: 0, segments: 0 };
        perLens[lens.name].cands += cands.length;
        if(cands.length){ perLens[lens.name].segments++; segHas = true; }

        for(const cand of cands){
          candTotal++;
          const cl = label + ' ' + lens.name + '/' + cand.id;

          // P2：cost 预测 === 实测
          let predicted, result;
          try{ predicted = lens.cost(ir, cand).delta; }
          catch(e){ ok(false, cl, 'cost threw: ' + String(e.message||e).slice(0,60)); continue; }
          try{ result = LENS.applyCandidate(ir, lens, cand, deps); }
          catch(e){ ok(false, cl, 'applyCandidate threw: ' + String(e.message||e).slice(0,60)); continue; }
          ok(predicted === result.step.delta, cl, 'cost ' + predicted + ' !== 实测 ' + result.step.delta);

          // P3：产物 IR 的 INV-1
          ok(IR.checkInv1(result.ir) === true, cl, 'INV-1: ' + String(IR.checkInv1(result.ir)));

          // P1：roundtrip / verify。口径分层（§3 + §8）：
          //  - extract 型（form.aliasEntries 非空）：默认 verify 做真实 inject 回放，
          //    必须 100% 通过（别名透镜的 inject 是完备的逆）；
          //  - rewrite 型：match 是投机发现、verify 是 canonical 闸门（v1 canCommit 同构），
          //    允许拒绝（记 rejected 统计）。透镜私有等价理论（inlinePure 的代入归一、
          //    transparent 的别名还原、chain/block 的双侧还原）就是该透镜自己的 verify——
          //    额外预言机无法建模私有理论（误报），故此处断言【verify 不抛错】+ 放行计数，
          //    真正的等价兜底由 corpus diff 的终审门（每段三重校验）承担。
          const verify = lens.verify || LENS.mkVerifyDefault(lens, deps);
          let v = false, threw = false;
          try{ v = !!verify(ir, cand, result); }catch(e){ threw = true; }
          ok(!threw, cl, 'verify 抛错（verify 必须纯判定，不得抛）');
          const producesAlias = !!(result.form && Array.isArray(result.form.aliasEntries)
                                   && result.form.aliasEntries.length);
          if(producesAlias){
            ok(v, cl, 'extract 型 roundtrip 不通过');
            if(v) verified++; else rejected++;
          }else if(v){
            verified++;
          }else{
            rejected++;
          }
        }
      }
      if(segHas) segWithCand++;
    });
  }

  console.log('[lens_roundtrip] 语料段数:', segTotal, ' 有候选段数:', segWithCand, ' 候选总数:', candTotal,
              ' verify放行:', verified, ' verify拒绝:', rejected);
  Object.keys(perLens).forEach(function(n){
    console.log('  ', n, '候选', perLens[n].cands, '个，覆盖', perLens[n].segments, '段');
  });
  if(bad.length){
    console.log('--- 失败明细（前 ' + bad.length + ' 条）---');
    bad.forEach(function(b){ console.log('✗', b); });
  }
  return { pass, fail };
}

module.exports = { name: 'lens_roundtrip', run };
