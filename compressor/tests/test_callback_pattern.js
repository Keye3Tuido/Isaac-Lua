const luaparse = require('../node_modules/luaparse');
const fengari = require('fengari');
require('../core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

// 测试回调模式的压缩
const code = `l local A,M=Isaac.AddCallback,ModCallbacks A({},M.MC_POST_UPDATE,func1)
l local A,M=Isaac.AddCallback,ModCallbacks A({},M.MC_POST_RENDER,func2)
l local A,M=Isaac.AddCallback,ModCallbacks A({},M.MC_POST_NEW_ROOM,func3)`;

console.log('输入:');
console.log(code);
console.log('\n压缩:');

try {
  const r = LuaMin.compress(code);
  console.log(r.output);
  console.log('\ntransparentAliases:', JSON.stringify(r.aliasMapInfo?.transparentAliases));
  console.log('byName:', JSON.stringify(r.aliasMapInfo?.byName));
  console.log('mergedDecls:', r.aliasMapInfo?.mergedDecls);

  const body = r.output.replace(/^l /, '');
  const orig = LuaMin._preprocess(code);
  const ca = LuaMin._canonical(orig);
  const cb = r.aliasMapInfo ? LuaMin._canonical(body, r.aliasMapInfo) : LuaMin._canonical(body);
  console.log('\n等价性:', ca === cb ? '✓' : '✗');

  if (ca !== cb) {
    console.log('原始长度:', ca.length, '压缩长度:', cb.length);
  }

  console.log('\n输入长度:', code.length);
  console.log('输出长度:', r.output.length);
  console.log('压缩率:', ((1 - r.output.length / code.length) * 100).toFixed(2) + '%');
} catch(e) {
  console.log('失败:', e.message);
}
