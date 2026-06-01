const fs = require('fs');
const luaparse = require('../node_modules/luaparse');
const fengari = require('fengari');
require('../core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

// 测试-1.灵感.lua的合并压缩
const file = fs.readFileSync('../-1.灵感.lua', 'utf8');
const lines = file.split(/\r?\n/);
const segs = lines.filter(line => /^l\s/.test(line));
const merged = segs.join('\n');

console.log('找到', segs.length, '个l段');

try {
  const r = LuaMin.compress(merged);
  console.log('压缩成功');
  console.log('transparentAliases:', JSON.stringify(r.aliasMapInfo?.transparentAliases));
  console.log('别名数量:', Object.keys(r.aliasMapInfo?.transparentAliases || {}).length);
} catch(e) {
  console.log('压缩失败:', e.message);
}
