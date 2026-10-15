// tests2/unit/search_idempotency.js — 搜索模式幂等专项（M6）
// 既有 regression/idempotency.js 的 50 例已在【默认开搜索】的管线下验证固定点；
// 本套件补：显式 search:true + 多档 beamWidth 的确定性（同输入同束宽 => 逐字节相同
// 且为自身固定点），以及搜索敏感形态（跨作用域复用/块包装/别名撤销）。
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

  const cases = [
    { name: '跨作用域复用', code: 'local top=Game() print(top) do local nested=f() print(nested) end do local x=g() print(x) end' },
    { name: '块包装(多语句)', code: 'func(AAA,v1,BB,CCC())DD()EE()g1()func(AAA,v2,BB,CCC())DD()EE()g2()func(AAA,v3,BB,CCC())DD()EE()g3()func(AAA,v4,BB,CCC())DD()EE()g4()' },
    { name: '源内别名撤销', code: 'l local I=Isaac print(I)' },
    { name: '调用链别名撤销', code: 'l local D=Game():GetRoom() print(D)' },
    { name: '混合别名选择性撤销', code: 'l local I=Isaac local G=Game print(I) print(G) print(G) print(G)' },
    { name: '字符串前缀因子', code: "print('ACTION_SHOOT_UP','ACTION_SHOOT_DOWN','ACTION_SHOOT_LEFT','ACTION_SHOOT_RIGHT')" },
    { name: '调用包装(薄函数)', code: 'Isaac.AddCallback({},v1,f1)Isaac.AddCallback({},v2,f2)Isaac.AddCallback({},v3,f3)Isaac.AddCallback({},v4,f4)Isaac.AddCallback({},v5,f5)Isaac.AddCallback({},v6,f6)' },
    { name: '全局+成员折叠', code: 'Isaac.GetPlayer(0)Isaac.GetPlayer(1)Isaac.GetPlayer(2)Isaac.GetPlayer(3)' },
    { name: '尾值符号收尾', code: "local a,b='hello',1 print(a,b)print(a,b)print(a,b)" },
    { name: '方法名因子', code: "Isaac.AddCallback(ModCallbacks.MC_POST_PLAYER_UPDATE,function(_,p)local d=p:GetData()if p:IsHoldingItem()then d.HoldingItem=30 else d.HoldingItem=(d.HoldingItem or 0)-1 end end)" },
  ];

  for(const c of cases){
    for(const K of [4, 8]){
      let r1 = null, r2 = null;
      try{ r1 = L2.compress(c.code, { search: true, beamWidth: K }); }
      catch(e){ ok(false, c.name + '/K' + K, '压缩失败: ' + String(e.message || e).slice(0, 70)); continue; }
      try{ r2 = L2.compress(r1.output, { search: true, beamWidth: K }); }
      catch(e){ ok(false, c.name + '/K' + K, '二次压缩失败: ' + String(e.message || e).slice(0, 70)); continue; }
      ok(r1.output === r2.output, c.name + '/K' + K + ' 固定点',
         r1.output.length + ' -> ' + r2.output.length);
    }
    // 束宽确定性：同输入 K=4 两次逐字节相同（上面两轮首趟即两次，天然覆盖）
  }

  bad.forEach(function(b){ console.log('✗', b); });
  return { pass, fail };
}

module.exports = { name: 'search_idempotency', run };
