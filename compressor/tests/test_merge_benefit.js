const luaparse = require('../node_modules/luaparse');
const fengari = require('fengari');
require('../core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

// 测试合并的收益
const original = `l local a,b=ModCallbacks,'AddCallback'local A,M=Isaac[b],a A({},M.MC_POST_UPDATE,func1)local A,M=Isaac[b],a A({},M.MC_POST_RENDER,func2)local A,M=Isaac[b],a A({},M.MC_POST_NEW_ROOM,func3)`;

const merged = `l local a,b=ModCallbacks,'AddCallback'local A,M=Isaac[b],a A(,M.MC_POST_UPDATE,func1)A({},M.MC_POST_RENDER,func2)A({},M.MC_POST_NEW_ROOM,func3)`;

console.log('原始长度:', original.length);
console.log('合并后长度:', merged.length);
console.log('节省:', original.length - merged.length, '字符');
console.log('压缩率:', ((original.length - merged.length) / original.length * 100).toFixed(2) + '%');

// 测试等价性
console.log('\n测试等价性:');
try {
  const origBody = original.replace(/^l /, '');
  const mergedBody = merged.replace(/^l /, '');

  const ca = LuaMin._canonical(LuaMin._preprocess(origBody));
  const cb = LuaMin._canonical(LuaMin._preprocess(mergedBody));

  console.log('等价性:', ca === cb ? '✓' : '✗');

  if (ca !== cb) {
    console.log('原始canonical长度:', ca.length);
    console.log('合并canonical长度:', cb.length);
  }
} catch(e) {
  console.log('错误:', e.message);
}
