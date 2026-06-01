const luaparse = require('../node_modules/luaparse');
const fengari = require('fengari');
require('../core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

// 测试：多变量声明中的透明别名 + 全局折叠
const code = "l local A,M,B=1,ModCallbacks,2 M.AddCallback({},M.MC_POST_UPDATE,function()end) ModCallbacks.MC_POST_RENDER=1 ModCallbacks.MC_POST_NEW_ROOM=2";

console.log('输入:', code);
try {
  const r = LuaMin.compress(code);
  console.log('输出:', r.output);
  console.log('别名:', r.aliasMapInfo?.transparentAliases);

  const body = r.output.replace(/^l /, '');
  const orig = LuaMin._preprocess(code);
  const ca = LuaMin._canonical(orig);
  const cb = r.aliasMapInfo ? LuaMin._canonical(body, r.aliasMapInfo) : LuaMin._canonical(body);
  console.log('等价:', ca === cb ? '✓' : '✗');

  if (ca !== cb) {
    console.log('\nbyName:', r.aliasMapInfo?.byName);

    // 找出第一个不同的位置
    for (let i = 0; i < Math.min(ca.length, cb.length); i++) {
      if (ca[i] !== cb[i]) {
        console.log('第一个差异在位置', i);
        console.log('原始:', ca.slice(Math.max(0, i-50), i+100));
        console.log('压缩:', cb.slice(Math.max(0, i-50), i+100));
        break;
      }
    }

    if (ca.length !== cb.length) {
      console.log('长度不同: 原始', ca.length, '压缩', cb.length);
    }
  }
} catch(e) {
  console.log('失败:', e.message);
}
