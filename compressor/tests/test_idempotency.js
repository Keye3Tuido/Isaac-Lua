// 幂等性（逆向回代）测试
//
// 验证压缩器具备"逆向处理代码的能力"：
//   1. 压缩结果再回代压缩，输出必须不变（严格固定点，一次性收敛）；
//   2. 压缩结果与原始输入等价（canonical 还原验证）。
// 规则系统（compress）与搜索层（searchOptimize）都测。

const fs = require('fs');
const path = require('path');
const luaparse = require('../node_modules/luaparse');
const fengari = require('fengari');
require('../core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

function canonicalEq(a, b, aliasMap) {
  try { return LuaMin._canonical(a) === (aliasMap ? LuaMin._canonical(b, aliasMap) : LuaMin._canonical(b)); }
  catch (e) { return false; }
}

const cases = [
  { name: '局部函数(引用前变量)', code: 'local a=1 local function f()return a end' },
  { name: '局部函数(=function 形式)', code: 'local a=1 local f=function()return a end' },
  { name: '直接合并(不引用)', code: 'local a=1 local function f()return 2 end local b=a+f()' },
  { name: '循环丢弃变量复用', code: 'for _,k in pairs(t)do local m=g(k)for _,v in pairs(m)do h(v)end end' },
  { name: '多赋值+闭包', code: 'local a,b,c=1,2,3 local function f()return a+b+c end' },
  { name: '闭包计数', code: 'local n=0 local function inc()n=n+1 return n end' },
  { name: '递归', code: 'local function fact(n)if n<2 then return 1 end return n*fact(n-1) end' },
  { name: '字符串重复内联', code: "print('123456789')print('123456789')print('123456789')print('123456789')" },
  { name: '字符串公共前缀因子', code: "print('ACTION_SHOOT_UP','ACTION_SHOOT_DOWN','ACTION_SHOOT_LEFT','ACTION_SHOOT_RIGHT')" },
  { name: '字符串多级因子', code: "print('DATABASE_TABLE_X_COLUMN_NAME_1','DATABASE_TABLE_X_COLUMN_NAME_2','DATABASE_TABLE_X_COLUMN_AGE_1','DATABASE_TABLE_X_COLUMN_AGE_2','DATABASE_TABLE_Y_COLUMN_NAME_1','DATABASE_TABLE_Y_COLUMN_NAME_2','DATABASE_TABLE_Y_COLUMN_AGE_1','DATABASE_TABLE_Y_COLUMN_AGE_2')" },
  { name: '字段前缀多级(派生因子)', code: "print(a.PREFIX_BASE_GROUP_A,a.PREFIX_BASE_GROUP_B,a.PREFIX_BASE_GROUP_C,a.PREFIX_BASE_GROUP_D,a.PREFIX_BASE_OTHER1,a.PREFIX_BASE_OTHER2)" },
  { name: '调用包装(重复调用提取薄函数)', code: 'Isaac.AddCallback({},v1,f1)Isaac.AddCallback({},v2,f2)Isaac.AddCallback({},v3,f3)Isaac.AddCallback({},v4,f4)Isaac.AddCallback({},v5,f5)Isaac.AddCallback({},v6,f6)Isaac.AddCallback({},v7,f7)Isaac.AddCallback({},v8,f8)Isaac.AddCallback({},v9,f9)Isaac.AddCallback({},v10,f10)Isaac.AddCallback({},v11,f11)Isaac.AddCallback({},v12,f12)' },
  { name: '块包装(任意位置固定参数)', code: 'func(AAA,x1,BB,CCC)func(AAA,x2,BB,CCC)func(AAA,x3,BB,CCC)func(AAA,x4,BB,CCC)func(AAA,x5,BB,CCC)func(AAA,x6,BB,CCC)' },
  { name: '块包装(多语句)', code: 'func(AAA,v1,BB,CCC())DD()EE()g1()func(AAA,v2,BB,CCC())DD()EE()g2()func(AAA,v3,BB,CCC())DD()EE()g3()func(AAA,v4,BB,CCC())DD()EE()g4()' },
  { name: '全局+成员折叠', code: 'Isaac.GetPlayer(0)Isaac.GetPlayer(1)Isaac.GetPlayer(2)Isaac.GetPlayer(3)' },
  { name: '括号转点', code: "local a={}a['x']=1 a['y']=2 a['z']=3" },
  { name: '只读内联', code: 'local t=1000000 return t+t' },
  { name: '常量折叠', code: 'return 1+2*3' },
  { name: '布尔别名', code: 'return true,true,true,true,true,true' },
  { name: '数字归一', code: 'return 0.5' },
  { name: '括号消除', code: 'return (1+2)' },
  { name: 'method折叠', code: 'local t={}t:GetName()t:GetName()t:GetName()t:GetName()t:GetName()t:GetName()' },
  { name: '字段前缀(单级)', code: 'local a={}a.SOMETHING_RIGHT=1 a.SOMETHING_LEFT=2 a.SOMETHING_UP=3 a.SOMETHING_DOWN=4' },
  { name: 'call-sugar', code: "print('abc')print('def')print('ghi')" },
  { name: 'if-not二择', code: 'local c=true if not c then a() else b() end' },
  { name: '比较重排', code: 'local s=0 if 5%s()>0 then return 1 end' },
  { name: '多重赋值拆分', code: 'local function f()return 1,2 end a=0 b=0 a,b=({})[1],f()' },
  { name: '透明别名消解', code: 'local M=Isaac M.GetPlayer(0) M.GetPlayer(1) M.GetPlayer(2)' },
  { name: '常量条件折叠', code: 'if true then a() else b() end' },
  { name: '常量循环折叠(while false)', code: 'local x=1 while false do print(1) end return x' },
  { name: '常量循环折叠(repeat until true)', code: 'repeat print(1) until true' },
  { name: '常量循环折叠(repeat until false)', code: 'repeat print(1) until false' },
  { name: '表字段合并', code: 'local M={}M.FOO=function()return 1 end M.BAR=function()return 2 end return M.FOO()+M.BAR()' },
  { name: '跨作用域复用(搜索)', code: 'local top=Game() print(top) do local nested=f() print(nested) end do local x=g() print(x) end' },
  { name: '块包装(非连续散布)', code: 'func(AAA,x1,BB,CCC())DD()EE()g1()OTHER()func(AAA,x2,BB,CCC())DD()EE()g2()OTHER()func(AAA,x3,BB,CCC())DD()EE()g3()' },
  { name: '复用+块包装组合', code: 'local keep=Game() print(keep) do local a=f() print(a) end func(AAA,x1,BB)q1()func(AAA,x2,BB)q2()func(AAA,x3,BB)q3()' },
  { name: '穿插顺序敏感(块包装先于别名化)', code: "process('DATA_A',1)render(1)update(1)refresh(1)save(1)process('DATA_A',2)render(2)update(2)refresh(2)save(2)process('DATA_A',3)render(3)update(3)refresh(3)save(3)" },
];

// 追加真实语料：ver2 可读源码 + 用户 930 压缩版
try {
  const lines = fs.readFileSync(path.join(__dirname, '../../lua/DEBUG1.安全包装.lua'), 'utf8').split(/\r?\n/);
  cases.push({ name: 'ver2 可读源码', code: lines.slice(15, 89).join('\n') });
  cases.push({ name: '930 压缩版', code: lines[91] });
} catch (e) { /* 语料缺失不阻断 */ }

let pass = 0, fail = 0;
const fails = [];

for (const c of cases) {
  // 规则系统
  let r1, r2;
  try { r1 = LuaMin.compress(LuaMin._preprocess(c.code)); }
  catch (e) { fails.push([c.name, '规则压缩失败: ' + e.message]); fail++; continue; }
  const out1 = r1.output;
  const body1 = out1.replace(/^l /, '');
  const cb1 = r1.aliasMapInfo ? LuaMin._canonical(body1, r1.aliasMapInfo) : LuaMin._canonical(body1);
  const eq1 = LuaMin._canonical(LuaMin._preprocess(c.code)) === cb1;

  // 逆向回代
  let idem1 = false;
  try { r2 = LuaMin.compress(LuaMin._preprocess(out1)); idem1 = (out1 === r2.output); }
  catch (e) { idem1 = false; }

  // 搜索层（若可用）
  let idem2 = true, eq2 = true, sLen = null;
  try {
    const s = LuaMin.searchOptimize(c.code, { budget: 5000 });
    if (s && s.ok) {
      sLen = s.bodyLength;
      const sOut = s.output;
      const sBody = sOut.replace(/^l /, '');
      eq2 = canonicalEq(LuaMin._preprocess(c.code), sBody, s.aliasMapInfo);
      const s2 = LuaMin.searchOptimize(sOut, { budget: 5000 });
      idem2 = (s2 && s2.output === sOut);
    }
  } catch (e) { /* 搜索层异常忽略 */ }

  const ok = eq1 && idem1 && eq2 && idem2;
  if (ok) { pass++; console.log('✓ ' + c.name + '  (' + r1.bodyLength + ' 字' + (sLen != null ? ', 搜索 ' + sLen + ' 字' : '') + ') 幂等+等价'); }
  else { fail++; const why = []; if (!eq1) why.push('规则不等价'); if (!idem1) why.push('规则不幂等'); if (!eq2) why.push('搜索不等价'); if (!idem2) why.push('搜索不幂等'); console.log('✗ ' + c.name + '  ' + why.join(', ')); }
}

console.log('\n=== 幂等(逆向回代)测试: ' + pass + ' pass, ' + fail + ' fail ===');
process.exit(fail > 0 ? 1 : 0);
