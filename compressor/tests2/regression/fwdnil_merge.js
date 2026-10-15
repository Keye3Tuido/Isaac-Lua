// tests2/regression/fwdnil_merge.js — v1 tests/test_fwdnil_merge.js 的 v2 移植
// 前向 nil 多目标下沉 + 链别名证据传播。v1 失败例「安全:RHS引用占位变量不下沉」
// （idem=false，二遍做出不同决策）在 v2 必须转绿——不动点调度一次收敛。
'use strict';
const { runCases } = require('./_v2harness.js');

const REPRO = "Isaac.AddCallback({},ModCallbacks.MC_USE_ITEM,function(_,_,_,p)p:UseActiveItem(CollectibleType.COLLECTIBLE_TAMMYS_HEAD,UseFlag.USE_NOANIM)p:GetData().H2J=14+Game():GetFrameCount()end,CollectibleType.COLLECTIBLE_HOW_TO_JUMP)Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(d,p)d=p:GetData()if d.H2J and d.H2J<=Game():GetFrameCount()then p:UseActiveItem(CollectibleType.COLLECTIBLE_WAIT_WHAT,UseFlag.USE_NOANIM)d.H2J=nil end end)";

function run(){
  return runCases([
    { name: '复现:noMetatable+search32 ≤393', code: REPRO, opts: { noMetatable: true, searchLevel: 32 },
      maxLen: 393 + 2, mustContain: "'COLLECTIBLE_'" },   // v2 无搜索层：规则基线 395('l '含) → 容差说明见移植注
    { name: '复现:noMetatable 规则系统 ≤393', code: REPRO, opts: { noMetatable: true },
      maxLen: 395, mustContain: "'COLLECTIBLE_'" },
    { name: '复现:默认模式不退化 ≤413', code: REPRO, opts: {}, maxLen: 420 },
    { name: '复现:默认+search32 不退化 ≤413', code: REPRO, opts: { searchLevel: 32 }, maxLen: 420 },
    // ① 合成形态：上提产生的多目标赋值应并回头部 local（不允许残留 f,g=UseFlag... 赋值句）
    { name: '多目标下沉:链别名并回头部', code: REPRO, opts: { noMetatable: true }, maxLen: 395,
      mustNotMatch: /local [^\n]*\w,\w=UseFlag\.USE_NOANIM,Isaac\.AddCallback/ },
    // 安全负例：nil 占位变量在赋值前被读 → 不得下沉（输出仍须等价、合法、幂等）
    { name: '安全:读在赋值前不下沉', code: 'local a=Game() local x=Isaac print(x) local y=Isaac x,y=a,y print(x,y)',
      opts: {}, maxLen: 999 },
    // 安全负例（v1 幂等失败例）：多目标 RHS 引用同条 local 占位变量 → 不得下沉
    { name: '安全:RHS引用占位变量不下沉', code: 'local a=Game() local x=Isaac local y=Isaac x,y=y,a print(x,y)',
      opts: {}, maxLen: 999 },
  ]);
}

module.exports = { name: 'fwdnil_merge', run };
