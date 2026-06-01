const fs = require('fs');
const luaparse = require('../node_modules/luaparse');
const fengari = require('fengari');
require('../core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

// 测试1.御灵术.lua的合并压缩
const file = fs.readFileSync('../1.御灵术.lua', 'utf8');
const lines = file.split(/\r?\n/);
const segs = lines.filter(line => /^l\s/.test(line));
const merged = segs.join('\n');

console.log('找到', segs.length, '个l段');
console.log('前3段:');
segs.slice(0, 3).forEach((seg, i) => {
  console.log(`段${i+1}:`, seg.slice(0, 100));
});

try {
  const r = LuaMin.compress(merged);
  console.log('\n压缩成功');
  console.log('transparentAliases:', JSON.stringify(r.aliasMapInfo?.transparentAliases));

  const body = r.output.replace(/^l /, '');
  const orig = LuaMin._preprocess(merged);
  const ca = LuaMin._canonical(orig);
  const cb = r.aliasMapInfo ? LuaMin._canonical(body, r.aliasMapInfo) : LuaMin._canonical(body);
  console.log('等价性:', ca === cb ? '✓' : '✗');

  if (ca !== cb) {
    console.log('长度: 原始', ca.length, '压缩', cb.length);

    // 找出第一个不同的位置
    for (let i = 0; i < Math.min(ca.length, cb.length); i++) {
      if (ca[i] !== cb[i]) {
        console.log('第一个差异在位置', i);
        console.log('原始:', ca.slice(Math.max(0, i-100), i+100));
        console.log('压缩:', cb.slice(Math.max(0, i-100), i+100));
        break;
      }
    }
  }
} catch(e) {
  console.log('压缩失败:', e.message);
}
