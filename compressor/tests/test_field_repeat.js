const luaparse = require('../node_modules/luaparse');
const fengari = require('fengari');
require('../core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

// 测试在函数调用中的重复字段访问
const code1 = `l local b=ModCallbacks f(b.XXX)f(b.XXX)f(b.XXX)f(b.XXX)`;
console.log('测试1: 函数调用中的重复字段访问');
console.log('输入:', code1);
const r1 = LuaMin.compress(code1);
console.log('输出:', r1.output);
console.log('长度:', code1.length, '->', r1.output.length);

// 测试赋值中的重复字段访问
const code2 = `l local b=ModCallbacks local x=b.XXX local y=b.XXX local z=b.XXX`;
console.log('\n测试2: 赋值中的重复字段访问');
console.log('输入:', code2);
const r2 = LuaMin.compress(code2);
console.log('输出:', r2.output);
console.log('长度:', code2.length, '->', r2.output.length);

// 测试原始多回调场景
const code3 = `l local a,b=Isaac,ModCallbacks a.AddCallback({},b.XXX,f)a.AddCallback({},b.XXX,g)a.AddCallback({},b.XXX,h)`;
console.log('\n测试3: 多回调场景中的重复字段');
console.log('输入:', code3);
const r3 = LuaMin.compress(code3);
console.log('输出:', r3.output);
console.log('长度:', code3.length, '->', r3.output.length);
