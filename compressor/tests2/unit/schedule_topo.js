// tests2/unit/schedule_topo.js — 调度器拓扑序机器校验（计划 §5 验收）
// v1 的 FOLD_ORDER_RULES 等价物（locals/declHoist 必须在 fwdNilInline 之后）
// 在 v2 表达为 provides/requires；本套件校验推导出的拓扑序与手工表一致：
//   fwdNil < localsMerge, fwdNil < placeholderHoist, fwdNil < inlineValueToHeader；
//   族级序：alias.* < chain/factor < hoist < norm < encode（无跨族证据边时按注册序）。
'use strict';
const luaparse = require('../../node_modules/luaparse');
const fengari = require('fengari');
const SCHED = require('../../src2/schedule.js');
const ALIAS = require('../../src2/lenses/alias.js');
const CHAIN = require('../../src2/lenses/chain.js');
const FACTOR = require('../../src2/lenses/factor.js');
const HOIST = require('../../src2/lenses/hoist.js');
const NORM = require('../../src2/lenses/normalize.js');
const ENC = require('../../src2/lenses/encode.js');

const deps = { luaparse, fengari };

function run(){
  let pass = 0, fail = 0;
  const bad = [];
  function ok(cond, label){ if(cond) pass++; else { fail++; bad.push(label); } }

  const lenses = ALIAS.createAliasLenses(deps)
    .concat(CHAIN.createChainLenses(deps))
    .concat(FACTOR.createFactorLenses(deps))
    .concat(HOIST.createHoistLenses(deps))
    .concat(NORM.createNormalizeLenses(deps))
    .concat(ENC.createEncodeLenses(deps));
  const ordered = SCHED.topoOrder(lenses);
  const pos = {};
  ordered.forEach(function(l, i){ pos[l.name] = i; });

  // FOLD_ORDER_RULES 等价推导（v1 手工表的三条硬约束）
  ok(pos['hoist.fwdNil'] < pos['hoist.localsMerge'], 'fwdNil 应在 localsMerge 前');
  ok(pos['hoist.fwdNil'] < pos['hoist.placeholderHoist'], 'fwdNil 应在 placeholderHoist 前');
  ok(pos['hoist.fwdNil'] < pos['hoist.inlineValueToHeader'], 'fwdNil 应在 inlineValueToHeader 前');
  // 族级序（注册 tiebreak）
  ok(pos['alias.rename'] < pos['norm.constFold'], 'alias 族应在 norm 族前');
  ok(pos['chain.cse'] < pos['hoist.fwdNil'], 'chain 应在 hoist 前');
  ok(pos['factor.method'] < pos['hoist.fwdNil'], 'factor 应在 hoist 前');
  ok(pos['norm.splitMultiAssign'] < pos['encode.semicolon'], 'norm 应在 encode 前');

  // 成环检测：人为造环须抛错
  let threw = false;
  try{
    SCHED.topoOrder([
      { name:'a', kind:'rewrite', requires:['x'], provides:['y'], match(){},cost(){},extract(){},inject(){} },
      { name:'b', kind:'rewrite', requires:['y'], provides:['x'], match(){},cost(){},extract(){},inject(){} }
    ]);
  }catch(e){ threw = true; }
  ok(threw, '依赖成环须抛错');

  bad.forEach(function(b){ if(b) console.log('✗', b); });
  return { pass, fail };
}

module.exports = { name: 'schedule_topo', run };
