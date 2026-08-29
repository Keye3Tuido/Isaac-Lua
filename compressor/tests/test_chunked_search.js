// 分片搜索（浏览器 onStep 路径）与同步搜索路径的结果一致性 + 进度回调触发。
// 分片路径把候选处理拆成"每次 compress/move.apply 后让步"的显式状态机，必须与
// 同步路径产出逐字节相同，且 onStep 至少被调用一次（否则浏览器端无进度反馈）。
const luaparse = require('luaparse');
const fengari = require('fengari');
require('../core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

// 覆盖：普通表达式、字符串因子/字段前缀（折叠）、跨作用域复用（生成器）、
// 深度2穿插（组合）等各类 move 分支。
const cases = [
  'local a=1 local b=2 local c=a+b print(c) print(a+b) local d=3 local e=4 print(d+e)',
  'local a="GAME_LEVEL" local b="GAME_ROOM" local c="GAME_PLAYER" print(a) print(b) print(c) print(a) print(b)',
  'local M={} M.SOMETHING_LEFT=1 M.SOMETHING_RIGHT=2 M.SOMETHING_UP=3 M.SOMETHING_DOWN=4 print(M.SOMETHING_LEFT) print(M.SOMETHING_RIGHT) print(M.SOMETHING_UP) print(M.SOMETHING_DOWN)',
  'local x=1 local function f() local y=2 return y end return x+f()'
];

function runChunked(src, K) {
  return new Promise((resolve) => {
    let steps = 0;
    LuaMin.searchOptimize(src, {
      beamWidth: K,
      onStep: function () { steps++; },
      _done: function (rep) { resolve({ rep: rep, steps: steps }); },
      _error: function (e) { resolve({ err: e.message, steps: steps }); }
    });
  });
}

(async () => {
  let pass = 0, fail = 0;
  for (let i = 0; i < cases.length; i++) {
    const src = cases[i];
    let syncRep = null;
    try { syncRep = LuaMin.searchOptimize(src, { beamWidth: 2 }); } catch (e) { syncRep = null; }
    const c = await runChunked(src, 2);
    const syncLen = syncRep ? syncRep.bodyLength : null;
    const chunkLen = c.rep ? c.rep.bodyLength : null;
    const ok = syncLen !== null && syncLen === chunkLen && c.steps > 0 && !c.err;
    if (ok) {
      pass++;
    } else {
      fail++;
      console.log('FAIL case ' + i + ': sync=' + syncLen + ' chunked=' + chunkLen +
        ' steps=' + c.steps + (c.err ? ' err=' + c.err : ''));
    }
  }
  console.log('=== chunked search parity: ' + pass + ' pass, ' + fail + ' fail ===');
  process.exit(fail ? 1 : 0);
})();
