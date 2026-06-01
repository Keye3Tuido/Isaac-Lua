const luaparse = require('../node_modules/luaparse');
const fengari = require('fengari');
require('../core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

const code = `l Isaac.AddCallback({},ModCallbacks.XXX,func,arg)
l local A,M=Isaac.AddCallback,ModCallbacks;A({},M.XXX,func,arg)
l local A,M,T=Isaac.AddCallback,ModCallbacks,{}A(T,M.XXX,func,arg)
l local M,A=ModCallbacks,function(...)Isaac.AddCallback({},...)end;A(M.XXX,func,arg)`;

console.log('原始代码:');
console.log(code);
console.log('长度:', code.length);

const r = LuaMin.compress(code);
console.log('\n压缩后:');
console.log(r.output);
console.log('长度:', r.output.length);
console.log('压缩率:', ((1 - r.output.length / code.length) * 100).toFixed(2) + '%');

// 用户建议的优化
const suggested = `l local a,b,c,T,A=Isaac,ModCallbacks,'AddCallback',{}A=a[c]a[c]({},b.XXX,func,arg)A({},b.XXX,func,arg)A(T,b.XXX,func,arg)A=function(...)a[c]({},...)end;A(b.XXX,func,arg)`;
console.log('\n用户建议的代码:');
console.log(suggested);
console.log('长度:', suggested.length);
console.log('相比压缩后节省:', r.output.length - suggested.length, '字符');
