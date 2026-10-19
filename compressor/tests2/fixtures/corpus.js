'use strict';

// 压缩器固定语料：只描述语言/优化形态，不读取项目根目录 lua/ 业务代码。
// 新发现的回归应最小化后固化到这里或 regression/，避免业务内容变动重锚测试。
const CORPUS = Object.freeze({
  'local-demote-boundary': "local j,A,x,q={},{}local m,t,s,r=j.IsActionPressed,j.IsActionTriggered,j.GetActionValue,'ControllerIndex'x,q=1,2 print(A,m,t,s,r,x,q)",
  'local-implicit-nil-callback': "local F Isaac.AddCallback({},ModCallbacks.A,function()F=nil end)Isaac.AddCallback({},ModCallbacks.B,function()if not F then print(F)end end)",
  'local-multi-return': "local function f()return 1,2,3 end local a,b,c=f()b='x'print(a,b,c)",
  'local-function-capture': "local a=1 local function f()return a end local b=f()print(a,b)",
  'local-shadowing': "local a='outer'do local a=a..' inner'print(a)end print(a)",
  'loop-reuse': "for _,k in pairs(t)do local m=g(k)for _,v in pairs(m)do h(v)end end",
  'table-fields': "local M={}M.FOO=function()return 1 end M.BAR=function()return 2 end return M.FOO()+M.BAR()",
  'member-chain': "local t={a={b={c=1}}}print(t.a.b.c)print(t.a.b.c)print(t.a.b.c)",
  'method-repeat': "local t={}t:GetName()t:GetName()t:GetName()t:GetName()t:GetName()t:GetName()",
  'string-repeat': "print('ACTION_SHOOT_UP','ACTION_SHOOT_DOWN','ACTION_SHOOT_LEFT','ACTION_SHOOT_RIGHT')",
  'string-multilevel': "print('DATABASE_TABLE_X_COLUMN_NAME_1','DATABASE_TABLE_X_COLUMN_NAME_2','DATABASE_TABLE_Y_COLUMN_AGE_1','DATABASE_TABLE_Y_COLUMN_AGE_2')",
  'callback-series': "Isaac.AddCallback({},v1,f1)Isaac.AddCallback({},v2,f2)Isaac.AddCallback({},v3,f3)Isaac.AddCallback({},v4,f4)Isaac.AddCallback({},v5,f5)Isaac.AddCallback({},v6,f6)",
  'block-repeat': "func(AAA,x1,BB,CCC())DD()EE()g1()func(AAA,x2,BB,CCC())DD()EE()g2()func(AAA,x3,BB,CCC())DD()EE()g3()",
  'constant-conditions': "local x=1 while false do print(1)end if true then x=x+1 else x=0 end return x",
  'guard-return': "local function f(a,b)if a then return end if b then return end print(1)print(2)end return f",
  'demorgan': "return not a or not b,not c and not d",
  'parentheses': "local a,b,c=1,2,3 return(a+b)*c,a+(b+c),a..(b..c)",
  'semicolon-boundary': "local h=function(x)return x end local a=1;(h)(a)",
  'multi-assign': "local function f()return 1,2 end a=0 b=0 a,b=({})[1],f()print(a,b)",
  'transparent-alias': "local M=Isaac M.GetPlayer(0)M.GetPlayer(1)M.GetPlayer(2)",
  'member-prefix': "local a={}a.SOMETHING_RIGHT=1 a.SOMETHING_LEFT=2 a.SOMETHING_UP=3 a.SOMETHING_DOWN=4",
  'nested-scopes': "local top=Game()print(top)do local nested=f()print(nested)end do local x=g()print(x)end",
  'repeat-loops': "repeat print(1)until true repeat print(2)until false",
  'literal-tail': "local A,B,C,D,E='MoveSpeed','Luck',ipairs A()B()C()D()E()"
});

function repeatCalls(name, count){
  let out = '';
  for(let i=1; i<=count; i++) out += name + '(' + i + ',' + (i % 4) + ')';
  return out;
}

const PERFORMANCE = Object.freeze([
  { name:'callbacks-24', code:repeatCalls('Isaac.AddCallback', 24) },
  { name:'member-access-80', code:repeatCalls('Namespace.LongMember.Action', 80) },
  { name:'string-prefix-48', code:Array.from({length:48}, (_, i) => "print('DATABASE_TABLE_GROUP_COLUMN_" + i + "')").join('') },
  { name:'locals-40', code:Array.from({length:40}, (_, i) => 'local value' + i + '=Source.Member' + i + ' print(value' + i + ')').join(' ') },
  { name:'blocks-20', code:Array.from({length:20}, (_, i) => 'prepare(COMMON,' + i + ')render(' + i + ')update(' + i + ')').join('') }
]);

function loadFixtureSegments(){
  const out = {};
  for(const name of Object.keys(CORPUS)) out['fixtures/' + name + '.lua'] = [CORPUS[name]];
  return out;
}

module.exports = { CORPUS, PERFORMANCE, loadFixtureSegments };
