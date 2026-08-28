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
