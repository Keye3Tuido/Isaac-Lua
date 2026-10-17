// tests2/unit/search_inverse.js — 双向搜索的 inv 步专项（M6）
// 构造用例证明逆方向步真实工作：输入自带别名/贪心过度提取的形态，
// 搜索找到更短形态，且 trace 含 direction:'inv' 的 Step。
'use strict';
const luaparse = require('../../node_modules/luaparse');
const fengari = require('fengari');
const L1 = require('../../src2/base.js').create({ luaparse, fengari });
const LuaMin2 = require('../../src2/core2.js');
const L2 = LuaMin2.create({ luaparse, fengari });

function run(){
  let pass = 0, fail = 0;
  const bad = [];
  function ok(cond, label, detail){
    if(cond){ pass++; } else { fail++; bad.push(label + (detail ? ' | ' + detail : '')); }
  }

  // 每个用例：{name, code, wantInv, wantShorterThanGreedy}
  const cases = [
    // ① 输入自带别名，纯撤销更短。【norm.inlineValue 上线后】贪心阶段已直接单用内联，
      //    搜索无需 inv（优化前移）；只查等价与不差。
    { name: 'inv:源内单用全局别名撤销',
      code: 'l local I=Isaac print(I)',
      wantInv: false, wantShorterThanGreedy: false },
    // ② 撤销后重提取的对照形态：贪心透明消解（transparent:I 重定向到已折叠全局）
    //    已直达最优，搜索无需 inv 也不得变差（原 inv 用例，贪心进化后转为无退化门）
    { name: 'inv:撤销后重折叠',
      code: 'l local I=Isaac print(I) print(Isaac.GetPlayer) print(Isaac.GetPlayer) print(Isaac.GetPlayer)',
      wantInv: false, wantShorterThanGreedy: false },
    // ③ 手写调用链别名撤销（init 含调用，readonlyInline 不动它）。【norm.inlineValue 上线后】
      //    贪心阶段已直接单用内联，搜索无需 inv（优化前移）；只查等价与不差。
    { name: 'inv:源内调用链别名撤销',
      code: 'l local D=Game():GetRoom() print(D)',
      wantInv: false, wantShorterThanGreedy: false },
    // ④ 两条源内别名，其一值得撤销其一保留
    { name: 'inv:混合别名选择性撤销',
      code: "l local I=Isaac local G=Game print(I) print(G) print(G) print(G)",
      wantInv: true, wantShorterThanGreedy: false },
    // ⑤ 撤销成员链别名（单用，内联回整链更短）
    { name: 'inv:链别名撤销',
      code: 'l local D=Isaac.GetPlayer print(D)',
      wantInv: true, wantShorterThanGreedy: true },
    // ⑥ 贪心不过度提取的对照组：无 inv 需求时搜索不得变长
    { name: 'inv:无过度提取不变差',
      code: 'l print(Isaac) print(Isaac) print(Isaac) print(Isaac)',
      wantInv: false, wantShorterThanGreedy: false },
    // ⑦ 源内成员别名撤销（单用，内联整链更短；inlinePure 不动全局 base 的链）
    { name: 'inv:源内成员别名撤销',
      code: 'l local A=Isaac.AddCallback A({},1,f)',
      wantInv: true, wantShorterThanGreedy: true },
    // ⑧ 源内薄包装撤销（单调用点，内联回函数体更短）
    { name: 'inv:源内薄包装撤销',
      code: 'l local function f(x) print(x) end f(1)',
      wantInv: true, wantShorterThanGreedy: true },
  ];

  for(const c of cases){
    let g, s;
    try{ g = L2.compress(c.code, { search:false }); }catch(e){ ok(false, c.name, 'greedy threw: ' + e.message.slice(0,60)); continue; }
    try{ s = L2.compress(c.code, { search:true }); }catch(e){ ok(false, c.name, 'search threw: ' + e.message.slice(0,60)); continue; }
    // 等价性（canonical2.equivalent 差量口径——inv 全撤销后产物侧已无别名可还原，
    // 须由原文侧差量还原；与终审/basics semEq 同一实现）
    const C2 = require('../../src2/canonical2.js');
    const body = s.output.replace(/^l /, '');
    let eq = false;
    try{
      eq = C2.equivalent(L1._preprocess(c.code), body, { luaparse, fengari, base: L1 },
        L2._buildIR(L1._preprocess(c.code)), L2._buildIR(body), { pureInline: true },
        undefined, s.report.aliasMap || undefined);
    }catch(e){ eq = 'ERR ' + e.message; }
    ok(eq === true, c.name + '/equiv', String(eq).slice(0,60) + ' -> ' + s.output.slice(0,50));
    const invSteps = s.trace.filter(function(t){ return t.direction === 'inv'; }).length;
    if(c.wantInv) ok(invSteps > 0, c.name + '/inv-fired', 'trace 无 inv 步');
    if(c.wantShorterThanGreedy) ok(s.bodyLength < g.bodyLength, c.name + '/shorter', g.bodyLength + ' -> ' + s.bodyLength);
    ok(s.bodyLength <= g.bodyLength, c.name + '/no-worse', g.bodyLength + ' -> ' + s.bodyLength);
  }

  bad.forEach(function(b){ console.log('✗', b); });
  return { pass, fail };
}

module.exports = { name: 'search_inverse', run };
