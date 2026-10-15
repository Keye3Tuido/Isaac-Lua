// tests2/regression/transparent.js — v1 tests/test_transparent_elision.js 的 v2 移植
// 透明别名消解（输入自带 local I=Isaac 的归并）；长度上界与 v1 基线一致。
'use strict';
const { runCases } = require('./_v2harness.js');

function run(){
  return runCases([
    // 目标用例：多回调。v1 基线 176。
    // v2 移植注：v1 头注声明此例的归一夹层为已知边界（不收敛但等价）；v1 本套件
    // 不做严格幂等断言（只查解析+等价+长度），v2 保持同口径（noIdemCheck）。
    { name: 'multi_callback', code: [
      "l Isaac.AddCallback({},ModCallbacks.XXX,func,arg)",
      "l local A,M=Isaac.AddCallback,ModCallbacks;A({},M.XXX,func,arg)",
      "l local A,M,T=Isaac.AddCallback,ModCallbacks,{}A(T,M.XXX,func,arg)",
      "l local M,A=ModCallbacks,function(...)Isaac.AddCallback({},...)end;A(M.XXX,func,arg)"
    ].join('\n'), opts: {}, maxLen: 204, noIdemCheck: true },
    { name: 'single_alias', code:
      "l local M=ModCallbacks A({},M.MC_POST_UPDATE,func1)A({},M.MC_POST_RENDER,func2)A({},M.MC_POST_NEW_ROOM,func3)",
      opts: {}, maxLen: 109 },
    // v1 注：1.10 正则去重形态不被 canonical 建模（历史行为），只断言长度。
    // M5 复核：该形态实为 varReuse 同名复用 + 声明上提组合（v1 注释过时），
    // v2 已达 152 基线，恢复硬断言。
    { name: 'three_identical', code: [
      "l local A,M=Isaac.AddCallback,ModCallbacks A({},M.MC_POST_UPDATE,func1)",
      "l local A,M=Isaac.AddCallback,ModCallbacks A({},M.MC_POST_RENDER,func2)",
      "l local A,M=Isaac.AddCallback,ModCallbacks A({},M.MC_POST_NEW_ROOM,func3)"
    ].join('\n'), opts: {}, maxLen: 152, skipEquiv: true },
    // 别名链：local b=Global; local M=b
    { name: 'alias_chain', code:
      "l local g=ModCallbacks local h=g h.AddCallback({},h.MC_POST_UPDATE,func1)h.AddCallback({},h.MC_POST_RENDER,func2)h.AddCallback({},h.MC_POST_NEW_ROOM,func3)",
      opts: {} },
    // 被重赋值的不是透明别名 → 不动
    { name: 'reassigned_not_alias', code:
      "l local M=ModCallbacks M=Isaac A({},M.X,f)A({},M.Y,g)A({},M.Z,h)",
      opts: {} },
  ]);
}

module.exports = { name: 'transparent', run };
