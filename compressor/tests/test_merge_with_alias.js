const luaparse = require('../node_modules/luaparse');
const fengari = require('fengari');
require('../core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

// 测试：如果标记A和M为透明别名，是否能通过等价性检查
const original = `local a,b=ModCallbacks,'AddCallback'local A,M=Isaac[b],a A({},M.MC_POST_UPDATE,func1)local A,M=Isaac[b],a A({},M.MC_POST_RENDER,func2)local A,M=Isaac[b],a A({},M.MC_POST_NEW_ROOM,func3)`;

const merged = `local a,b=ModCallbacks,'AddCallback'local A,M=Isaac[b],a A({},M.MC_POST_UPDATE,func1)A({},M.MC_POST_RENDER,func2)A({},M.MC_POST_NEW_ROOM,func3)`;

console.log('测试1: 不使用aliasMapInfo');
const ca1 = LuaMin._canonical(LuaMin._preprocess(original));
const cb1 = LuaMin._canonical(LuaMin._preprocess(merged));
console.log('等价性:', ca1 === cb1 ? '✓' : '✗');

console.log('\n测试2: 使用aliasMapInfo标记M为透明别名');
const aliasMapInfo = {
  transparentAliases: { M: 'ModCallbacks' },
  byName: { ModCallbacks: 'a' }
};
const ca2 = LuaMin._canonical(LuaMin._preprocess(original), aliasMapInfo);
const cb2 = LuaMin._canonical(LuaMin._preprocess(merged), aliasMapInfo);
console.log('等价性:', ca2 === cb2 ? '✓' : '✗');

if (ca2 !== cb2) {
  console.log('原始长度:', ca2.length, '合并长度:', cb2.length);
  // 找出第一个差异
  for (let i = 0; i < Math.min(ca2.length, cb2.length); i++) {
    if (ca2[i] !== cb2[i]) {
      console.log('第一个差异在位置', i);
      console.log('原始:', ca2.slice(Math.max(0, i-50), i+50));
      console.log('合并:', cb2.slice(Math.max(0, i-50), i+50));
      break;
    }
  }
}
