const luaparse = require('../node_modules/luaparse');
const fengari = require('fengari');
require('../core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

const code = `Isaac.AddCallback({},ModCallbacks.XXX,func,arg)
local A,M=Isaac.AddCallback,ModCallbacks;A({},M.XXX,func,arg)
local A,M,T=Isaac.AddCallback,ModCallbacks,{}A(T,M.XXX,func,arg)
local M,A=ModCallbacks,function(...)Isaac.AddCallback({},...)end;A(M.XXX,func,arg)`;

console.log('代码模板压缩测试');
console.log('='.repeat(50));
console.log('原始代码:');
console.log(code);
console.log('\n原始长度:', code.length);

try {
    const result = LuaMin.compress(code);
    console.log('\n✓ 压缩成功!');
    console.log('\n压缩结果:');
    console.log(result.output);
    console.log('\n压缩长度:', result.bodyLength);
    console.log('节省:', code.length - result.bodyLength, '字符');
    console.log('压缩率:', ((code.length - result.bodyLength) / code.length * 100).toFixed(2) + '%');
} catch(e) {
    console.log('\n✗ 错误:', e.message);
    process.exit(1);
}
