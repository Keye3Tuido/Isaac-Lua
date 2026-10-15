// tests2/regression/mutable_globals.js — 全局变量黑白名单（别名快照安全闸门）回归套件
// 背景：alias.global 对「代码内未赋值」的全局做 local 别名（local a=AAA），把运行时
// 动态读取固化为声明时快照——控制台手改/其他代码重赋值后行为不等价。
// 防线：opts.mutableGlobals（可变全局黑名单）→ buildIR 并入 assignedGlobals →
// 各「新建快照」透镜（alias.global / chain.cse）的 assignedGlobals 闸门拦截。
// 形态约定：已有 local d=G.F（用户自写快照）不受名单约束（用户语义自选）；
// 仅「没有时新建快照」受闸。等价/幂等由 harness 硬检查。
'use strict';
const { runCases } = require('./_v2harness.js');

const NM = { noMetatable: true, search: false };

const cases = [
  // ---- alias.global：裸全局快照闸 ----
  { name: 'blacklist_alias_global_blocks_snapshot',
    code: 'l local c=0 local function inc() c=c+1 return AAA+c end local function dec() c=c-1 return AAA-c end local function get() return AAA*2 end local function get2() return AAA*3 end return inc,dec,get,get2',
    opts: Object.assign({ mutableGlobals: ['AAA'] }, NM),
    mustContain: 'AAA+c', mustNotMatch: /=AAA(?=[, ])/ },
  { name: 'whitelist_default_still_folds',
    code: 'l local c=0 local function inc() c=c+1 return AAA+c end local function dec() c=c-1 return AAA-c end local function get() return AAA*2 end local function get2() return AAA*3 end return inc,dec,get,get2',
    opts: NM,
    mustContain: '=AAA,' },
  { name: 'blacklist_empty_same_as_default',
    code: 'l local c=0 local function inc() c=c+1 return AAA+c end local function dec() c=c-1 return AAA-c end local function get() return AAA*2 end local function get2() return AAA*3 end return inc,dec,get,get2',
    opts: Object.assign({ mutableGlobals: [] }, NM),
    mustContain: '=AAA,' },
  { name: 'blacklist_multiple_vars',
    code: 'l local function f() return AAA+BBB+AAA+BBB+AAA+BBB+AAA+BBB end local function g() return AAA*BBB*AAA*BBB end local function h() return AAA-BBB-AAA-BBB end local function i() return AAA/BBB/AAA/BBB end',
    opts: Object.assign({ mutableGlobals: ['AAA', 'BBB'] }, NM),
    mustContain: 'AAA+BBB', mustNotMatch: /=(AAA|BBB)(?=[, ])/ },

  // ---- chain.cse：成员链新建快照闸（noMetatable 全局根纯度） ----
  { name: 'blacklist_chain_cse_blocks_new_snapshot',
    code: 'l local function f() Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,g) Isaac.AddCallback({},ModCallbacks.MC_POST_RENDER,g) Isaac.AddCallback({},ModCallbacks.MC_POST_NEW_ROOM,g) end',
    opts: Object.assign({ mutableGlobals: ['Isaac', 'ModCallbacks'] }, NM),
    mustContain: 'Isaac[', mustNotMatch: /Isaac\.AddCallback(?=[\s,(]*\))/ },
  { name: 'chain_cse_assigned_in_code_blocks_snapshot',
    code: 'l Isaac=Isaac local function f() Isaac.AddCallback({},1,g) Isaac.AddCallback({},2,g) Isaac.AddCallback({},3,g) end',
    opts: NM,
    mustContain: 'Isaac[', mustNotMatch: /Isaac\.AddCallback(?=[\s,(]*\))/ },
  { name: 'blacklist_blocks_alias_global_in_safe_mode',
    code: 'l local function f() Isaac.AddCallback({},1,g) Isaac.AddCallback({},2,g) Isaac.AddCallback({},3,g) end',
    opts: { noMetatable: false, search: false, mutableGlobals: ['Isaac'] },
    mustNotMatch: /, *[A-Za-z_][A-Za-z_0-9]* *= *Isaac(?=[, .[\]])/ },
  { name: 'chain_cse_whitelist_still_folds',
    code: 'l local function f() Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,g) Isaac.AddCallback({},ModCallbacks.MC_POST_RENDER,g) Isaac.AddCallback({},ModCallbacks.MC_POST_NEW_ROOM,g) end',
    opts: NM,
    mustContain: ',Isaac.AddCallback ' },

  // ---- 已有 local d=G.F（用户自写快照）：不受名单约束 ----
  { name: 'existing_user_snapshot_unconstrained',
    code: 'l local d=Isaac.AddCallback local function f() d({},1,g) d({},2,g) d({},3,g) end',
    opts: Object.assign({ mutableGlobals: ['Isaac'] }, NM),
    mustContain: 'Isaac.AddCallback' },

  // ---- alias.member / factor.method（字符串别名，每次动态读）：名单无需拦截 ----
  { name: 'member_field_string_alias_still_ok',
    code: 'l local function f() Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,g) Isaac.AddCallback({},ModCallbacks.MC_POST_RENDER,g) Isaac.AddCallback({},ModCallbacks.MC_POST_NEW_ROOM,g) end',
    opts: Object.assign({ mutableGlobals: ['Isaac'] }, NM),
    mustContain: "'AddCallback'" },

  // ---- dotAliasLit 自引用守卫：别名声明 init（local u='X'）不得被替换为 u ----
  { name: 'dotaliaslit_no_self_reference_in_decl_init',
    code: 'l local function f() Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,g) Isaac.AddCallback({},ModCallbacks.MC_POST_RENDER,g) Isaac.AddCallback({},ModCallbacks.MC_POST_NEW_ROOM,g) end',
    opts: Object.assign({ mutableGlobals: ['Isaac', 'ModCallbacks'] }, NM),
    mustContain: "'AddCallback'", mustNotMatch: /local [A-Za-z_][A-Za-z_0-9]*=[A-Za-z_][A-Za-z_0-9]* / },
];

module.exports = { name: 'mutable_globals', run: function(){ return runCases(cases); } };
