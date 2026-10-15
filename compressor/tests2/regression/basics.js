// tests2/regression/basics.js — v1 tests/test.js + tests/edge.js 的 v2 移植
// 口径与 v1 harness 一致：先除注释 → compress → 前缀/单行/等价（canonical 双侧还原）检查。
// 依赖 M4+ 透镜（callSugar / locals 合并 / globalViaG / search2 等）的输出形态断言
// 标记 PENDING（不计入 fail，打印透镜名），等价性断言一律硬检查。
'use strict';
const luaparse = require('../../node_modules/luaparse');
const fengari = require('fengari');
const L1 = require('../../src2/base.js').create({ luaparse, fengari });
const LuaMin2 = require('../../src2/core2.js');
const L2 = LuaMin2.create({ luaparse, fengari });

const { removeComments } = require('../_helpers');

function run(){
  let pass = 0, fail = 0, pending = 0;
  const bad = [], pend = [];
  function ok(name, cond, extra){
    if(cond){ pass++; } else { fail++; bad.push(name + (extra ? ' | ' + extra : '')); }
  }
  // pending(name, lens, cond, extra)：M4+ 透镜就绪前的形态断言——满足则直接转 PASS，
  // 不满足记 PENDING（不算失败），透镜落地后自动转绿。
  function pendingOk(name, lens, cond, extra){
    if(cond){ pass++; }
    else { pending++; pend.push(name + ' [等 ' + lens + ']' + (extra ? ' | ' + String(extra).slice(0,60) : '')); }
  }

  // 等价性：双侧 canonical 还原（canonical2.equivalent，与终审同实现）
  function semEq(orig, body, aliasMap){
    try{
      const C2 = require('../../src2/canonical2.js');
      return C2.equivalent(orig, body, { luaparse, fengari, base: L1 },
        L2._buildIR(orig), L2._buildIR(body), {pureInline:true}, undefined, aliasMap || undefined);
    }catch(e){ return 'ERR ' + e.message; }
  }

  function tryCompress(name, src){
    src = removeComments(L1, src);
    let r;
    try{ r = L2.compress(src); }
    catch(e){ ok(name + '/no-throw', false, e.message); return null; }
    ok(name + '/prefix', r.output.slice(0,2) === 'l ', r.output.slice(0,10));
    // 单行：换行只允许出现在字符串字面量内部
    const body = r.output.replace(/^l /,'');
    let cleaned = body;
    L1._lex(body).forEach(function(t){ if(t.type === 'String') cleaned = cleaned.replace(t.value, ''); });
    ok(name + '/oneline', cleaned.indexOf('\n') < 0, 'newline outside string');
    const orig = L1._preprocess(src);
    ok(name + '/equiv', semEq(orig, body, r.report.aliasMap) === true, semEq(orig, body, r.report.aliasMap));
    return r;
  }

  /* ---- v1 test.js 基础用例（12） ---- */
  const cases = {
    simple: "local apple = 1\nlocal banana = 2\nreturn apple + banana",
    forloop: "for index = 1, 10 do\n  print(index)\nend",
    generic: "for key, value in pairs(someTable) do\n  print(key, value)\nend",
    nested: "local function outer(x)\n  local function inner(y) return x + y end\n  return inner(1)\nend",
    shadow: "local v = 1\ndo local v = 2 print(v) end\nreturn v",
    globalsafe: "local Game = 1\nreturn Isaac",
    method: "local p = obj\np:Method(1, 2)\nx['Get' .. suffix](x)",
    table: "local t = { keyName = 1, [exprKey] = 2, valOnly }\nreturn t",
    strings: "local s = 'hello'\nlocal m = [[multi\nline]]\nreturn s",
    numbers: "local a = 1e3\nlocal b = 0xFF\nlocal c = 1 << 37 & ~4\nreturn a+b+c",
    spaces: "if a and b() then return 0 end",
    concatkw: "local x = a .. b return x",
    comment: "-- this is a comment\nlocal value = 1 -- trailing\nreturn value",
  };
  Object.keys(cases).forEach(function(k){ tryCompress(k, cases[k]); });

  /* ---- call sugar（M4 起由 factor.callSugar 透镜承担，硬断言） ---- */
  (function(){
    const a = tryCompress('call-sugar-string', 'print("hello")');
    if(a) ok('call-sugar-string/output', a.output === 'l print"hello"', a.output);
    const b = tryCompress('call-sugar-table', 'f({1,2,3,})');
    if(b) ok('call-sugar-table/output', b.output === 'l f{1,2,3}', b.output);
  })();

  /* ---- 相邻 local 合并（M4 起由 hoist.localsMerge 承担，硬断言） ---- */
  (function(){
    const r = tryCompress('local-merge-call', 'local a=f()\nlocal b=g()\nreturn a,b');
    if(r) ok('local-merge-call/output',
      /local [A-Za-z],[A-Za-z]=f\(\),g\(\)/.test(r.output), r.output);
  })();

  /* ---- 前缀处理 ---- */
  (function(){
    const r = tryCompress('prefix-l', "l local x = 1\nl return x");
    if(r) ok('prefix-l/stripped', r.output === 'l return 1', JSON.stringify(r.output));
    const r2 = tryCompress('prefix-lua', "lua local y = 2\nlua return y");
    if(r2) ok('prefix-lua/stripped', r2.output === 'l return 2', r2.output);
  })();

  /* ---- 全局保护：局部不应被改名为被引用的全局名 ---- */
  (function(){
    const src = "local longName=1\nlocal another=2\nreturn longName+another+Isaac+Game";
    const r = tryCompress('globalclash', src);
    if(r){
      const body = r.output.replace(/^l /,'');
      ok('globalclash/Isaac', /\bIsaac\b/.test(body), body);
      ok('globalclash/Game', /\bGame\b/.test(body), body);
    }
  })();

  /* ---- 200 局部上限：别名预算证据 ---- */
  (function(){
    const locals = Array.from({length:195}, function(_,i){ return 'v'+i; }).join(',');
    const globals = Array.from({length:10}, function(_,i){ return 'VeryLongGlobalName'+i; });
    const src = 'local ' + locals + '\nreturn ' + globals.flatMap(function(x){ return [x,x,x]; }).join('+');
    const r = tryCompress('local-limit-alias-budget', src);
    if(r) ok('local-limit-alias-budget/capped', r.report.aliases <= 5, 'aliases=' + r.report.aliases);
  })();

  /* ---- 搜索层跨作用域复用（等 M6 search2） ---- */
  (function(){
    const src = 'local a=f()\nprint(a)\ndo local b=g()print(b)end';
    const r = tryCompress('search-cross-scope', src);
    if(r) pendingOk('search-cross-scope/shorter', 'search2', false, 'v2 搜索层未实现（M6）');
  })();

  /* ---- 语法错误必须被拒绝 ---- */
  function expectReject(name, src){
    try{ L2.compress(src); ok(name, false, '应当报错却通过'); }
    catch(e){ ok(name, true); }
  }
  expectReject('bad1', "local x = ");
  expectReject('bad2', "if then end");
  expectReject('bad3', "return )(");
  expectReject('empty', "   \n  ");

  /* ---- 真实片段 ---- */
  tryCompress('real-diaolei', "local I,Z,F,P=Isaac,Vector.Zero,Isaac.AddCallback,'Position'F({},2,function()for i=0,Game():GetNumPlayers()-1 do local p,d,b=I.GetPlayer(i)d=p.ControllerIndex if Input.IsActionTriggered(8,d)and not p:IsHoldingItem()then if p:GetNumGigaBombs()>0 then b=I.Spawn(4,17,0,p[P],Z,p):ToBomb()p:AddGigaBombs(-1)else b=p:FireBomb(p[P],Z)end b.Flags=p:GetBombFlags()p:TryHoldEntity(b)end end end)F({},13,function(_,e,_,a)if e and e:ToPlayer()and a==8 then return false end end,1)");
  tryCompress('real-lanzui', "local A=Isaac.AddCallback A({},8,function(_,p)p.TearFlags=p.TearFlags|7 end,32)A({},18,function()Isaac.ExecuteCommand('spawn 5.100.628')end)");
  tryCompress('real-item', "Isaac.AddCallback({},31,function(c,p,n)if 40~=p:GetPlayerType()and not p:HasCurseMistEffect()then for _,i in pairs({590,{649,3}})do c,n=table.unpack(type(i)=='table'and i or{i,1})while n>p:GetCollectibleNum(c)do p:AddCollectible(c,Isaac.GetItemConfig():GetCollectible(c).InitCharge)end Game():GetItemPool():RemoveCollectible(c)end end end)");

  /* ---- 多返回值括号语义保护 ---- */
  (function(){
    const r = tryCompress('multiret', "local x=f(g())");
    if(r){
      const body = r.output.replace(/^l /,'');
      ok('multiret/keepsParens', body.indexOf('g()') >= 0, body);
    }
  })();

  /* ---- 全局表访问折叠（_G[alias] 形态等 M4 globalViaG 透镜） ---- */
  (function(){
    const r = tryCompress('global-via-g', "local a=t.SomeGlobalName local b=t.SomeGlobalName local c=SomeGlobalName.Field return a,b,c");
    if(r) ok('global-via-g/rewrite', r.output.replace(/^l /,'').indexOf('_G[') >= 0, r.output);
    const r2 = tryCompress('global-via-g-reassign', "_G=x local a=t.SomeGlobalName local b=t.SomeGlobalName local c=SomeGlobalName.Field return a,b,c");
    if(r2) ok('global-via-g-reassign/no-rewrite', r2.output.replace(/^l /,'').indexOf('_G[') < 0, r2.output);
    const r3 = tryCompress('global-via-g-noalias', "local c=SomeGlobalName.Field return c");
    if(r3) ok('global-via-g-noalias/no-rewrite', r3.output.replace(/^l /,'').indexOf('_G[') < 0, r3.output);
  })();

  /* ---- v1 edge.js（40 例，只查解析+等价） ---- */
  const edgeCases = {
    numconcat1: "local x = 1 .. 2 return x",
    numconcat2: "local t={} return t .. 1",
    returnneg: "return -1",
    floatdot: "local a = 1. + .5 return a",
    hexfloat: "local a = 0x1p4 return a",
    goto: "do goto skip ::skip:: end",
    semicolons: "local a=1; local b=2; return a+b",
    concatchain: "local s = a..b..c..'x' return s",
    notequal: "if a ~= b then return 1 end",
    powop: "return 2^3^2",
    lenop: "return #t + 1",
    methodchain: "return a:b():c().d",
    varargs: "local function f(...) return ... end",
    longstr: "local s=[==[a]]b]==] return s",
    mixedprefix: "lua local q = 1\nl q = q + 1\nreturn q",
    numkw_do: "for i=0,168 do end",
    numkw_and: "return 1 and 2",
    numkw_or: "return 0 or 1",
    numkw_then: "if 1>0 then return 5 end",
    numkw_end: "while true do return 1 end",
    numname: "local x=1 return x",
    hexkw: "if 0xFF>0 then end",
    prefix_fundecl_name: "local M={}\nfunction M.SOMETHING_LEFT(a) return a end\nfunction M.SOMETHING_RIGHT(a) return a end\nfunction M.SOMETHING_UP(a) return a end\nfunction M.SOMETHING_DOWN(a) return a end\nlocal x=M.SOMETHING_LEFT(M)\nlocal y=M.SOMETHING_RIGHT(M)\nlocal z=M.SOMETHING_UP(M)\nlocal w=M.SOMETHING_DOWN(M)\nreturn x,y,z,w",
    prefix_colonmethod: "local M={}\nfunction M:PREFIX_LEFT() end\nfunction M:PREFIX_RIGHT() end\nfunction M:PREFIX_UP() end\nfunction M:PREFIX_DOWN() end\nlocal x=M.PREFIX_LEFT\nreturn x",
    prefix_mixed_bases: "local A={}\nlocal B={}\nA.STAGE_BOSS=1; B.STAGE_BOSS=2\nA.STAGE_SHOP=3; B.STAGE_SHOP=4\nA.STAGE_LIBRARY=5; B.STAGE_LIBRARY=6\nreturn A.STAGE_BOSS+B.STAGE_BOSS+A.STAGE_SHOP+B.STAGE_SHOP+A.STAGE_LIBRARY+B.STAGE_LIBRARY",
    prefix_in_methodchain: "local M={}\nM.GAME_LEVEL=function(s) return s end\nM.GAME_ROOM=function(s) return s end\nM.GAME_PLAYER=function(s) return s end\nM.GAME_ITEM=function(s) return s end\nreturn M.GAME_LEVEL(M):x(),M.GAME_ROOM(M):y(),M.GAME_PLAYER(M):z(),M.GAME_ITEM(M):w()",
    prefix_strict_subfield: "local M={}\nM.PREFIX=0; M.PREFIX_BOSS=1; M.PREFIX_SHOP=2; M.PREFIX_DEVIL=3; M.PREFIX_ANGEL=4\nreturn M.PREFIX+M.PREFIX_BOSS+M.PREFIX_SHOP+M.PREFIX_DEVIL+M.PREFIX_ANGEL+M.PREFIX+M.PREFIX_BOSS",
    strlit_basic_dup: "local M={}\nreturn M['SomeIdent']+M['SomeIdent']+M['SomeIdent']",
    strlit_quote_mix: "print('SomeIdent'); print(\"SomeIdent\"); print('SomeIdent')",
    strlit_as_local_init: "local x=2\nlocal P='SomeIdent'\nreturn x..'SomeIdent'..P",
    strlit_skip_strcall: "local a=require'SomeIdent'\nlocal b=require'SomeIdent'\nlocal c=require'SomeIdent'\nreturn a,b,c",
    strlit_with_strcall_mixed: "local a=require'json'\nlocal b='SomeIdent'\nlocal c='SomeIdent'\nlocal d='SomeIdent'\nreturn a,b,c,d",
    strlit_in_method: "local M={}\nfunction M:Save() return 'SomeIdent'..'SomeIdent'..'SomeIdent' end\nreturn M:Save()",
    strlit_in_nested_func: "local f=function() return 'SomeIdent' end\nlocal g=function() return 'SomeIdent' end\nlocal h=function() return 'SomeIdent' end\nreturn f(),g(),h()",
    strlit_table_key: "local t={['SomeIdent']=1}\nlocal v=t['SomeIdent']\nlocal w=t['SomeIdent']\nreturn v+w",
    strlit_longstr_mix: "local s=[[SomeIdent]]\nlocal t='SomeIdent'\nlocal u='SomeIdent'\nreturn s,t,u",
    multiassign_split_basic: "local x={} a=0 b=0 c=0\na,b,c=x[1],x[2],x[3]\nreturn a+b+c",
    multiassign_split_coupled: "local x={} a=0 b=0\na,b=b,a\nreturn a+b",
    multiassign_split_call_at_end: "local function f() return 1,2 end\na=0 b=0\na,b=({})[1],f()\nreturn a,b",
    multiassign_split_index: "local t={1,2} a=0\nt[1],t[2]=t[2],t[1]\nreturn t[1]+t[2]",
  };
  Object.keys(edgeCases).forEach(function(k){ tryCompress('edge:' + k, edgeCases[k]); });

  if(bad.length){
    console.log('--- 失败明细 ---');
    bad.forEach(function(b){ console.log('✗', b); });
  }
  if(pend.length){
    console.log('--- PENDING（等 M4+ 透镜，不计失败）---');
    pend.forEach(function(p){ console.log('…', p); });
  }
  console.log('[basics] pass', pass, ' fail', fail, ' pending', pending);
  return { pass, fail };
}

module.exports = { name: 'basics', run };
