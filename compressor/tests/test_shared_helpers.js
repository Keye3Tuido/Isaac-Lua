// Unit tests for the shared helpers introduced by the refactor series:
//   analyze.js  createNameAllocator / collectTakenNames
//   folds.js    extendAliasMap / bumpDrop / clampDrop / canCommit
//   core.js     unquoteShort / canSingleQuote / needsSepAfter
//   plan.js     applyEdits（重叠抛错契约）
// 目标：未来有人改散这些共享实现时，测试变红，而不是压缩质量静默退化。
// 全部为纯单元判定（除 canCommit 走 canonical 外不触发 parse），不影响性能探针计数。
const lp = require('../node_modules/luaparse');
const f = require('fengari');
require('../core.js');
const L = globalThis.LuaMin.create(lp, f);
const KEYWORDS = globalThis.LuaMin.KEYWORDS;

let pass = 0, fail = 0;
function check(label, ok, detail){
  if(ok){ pass++; console.log('✓', label); }
  else { fail++; console.log('✗', label, detail === undefined ? '' : detail); }
}
function throws(label, fn, re){
  try{ fn(); check(label, false, '未抛错'); }
  catch(e){ check(label, re.test(e.message), e.message); }
}

// ---------- createNameAllocator / collectTakenNames（analyze.js） ----------
const alloc = L._createNameAllocator, collectTaken = L._collectTakenNames;

// 已占用名跳过 + 取中即标记
{
  const taken = new Set(['a', 'b', 'c']);
  const next = alloc(taken);
  check('分配器跳过已占用名', next() === 'd');
  check('取中即标记占用', taken.has('d'));
  check('后续不重复发同名', next() === 'e');
}
// 关键字入种：排空整个候选池也不发关键字，池尽返回 null
{
  const next = alloc(new Set());
  const seen = new Set();
  let n, kwHit = null, count = 0;
  while((n = next()) !== null){
    count++;
    if(KEYWORDS[n]){ kwHit = n; break; }
    seen.add(n);
  }
  // 池 = 52 单字 + 52×52 双字，其中 4 个双字是关键字（do/if/in/or）被保留不发
  const POOL_SIZE = 52 + 52 * 52 - 4;
  check('池尽返回 null', n === null);
  check('全程不发关键字', kwHit === null, kwHit);
  check('全程不发重复名（发出数==去重数==池大小）', count === POOL_SIZE && seen.size === POOL_SIZE, '实际发出 ' + count);
}
// collectTakenNames：收集子树全部 Identifier 名，跳过 range/loc 键（噪声不入集合）
{
  const fake = {
    type: 'Chunk',
    body: [{ type: 'Identifier', name: 'real', range: [0, 4], loc: { start: {} } }],
    range: [{ type: 'Identifier', name: 'ghostInRange' }],
    loc: { type: 'Identifier', name: 'ghostInLoc' }
  };
  const taken = collectTaken(fake);
  check('收集 Identifier 名', taken.has('real'));
  check('跳过 range/loc 键', !taken.has('ghostInRange') && !taken.has('ghostInLoc'));
}

// ---------- extendAliasMap / bumpDrop / clampDrop（folds.js） ----------
const extendAliasMap = L._extendAliasMap, bumpDrop = L._bumpDrop, clampDrop = L._clampDrop;

// 8 字段全量携带：按引用携带 5 个（含 chainAliasByLocal/transparentAliases 的身份保持——
// 旧的纯文档不变量），prefixFold/stringAlias/chainAlias 三图防御性浅拷贝（内容同、身份异）。
{
  const prior = {
    byName: { Isaac: 'A' }, memberByLocal: { B: 'AddCallback' }, factorLocals: ['C'],
    prefixFoldByLocal: { D: 'PREFIX_' }, stringAliasByLocal: { E: 'X' },
    chainAliasByLocal: { F: 't.a.b' }, transparentAliases: { G: 'Isaac' }, dropLeading: 2
  };
  const m = extendAliasMap(prior, null);
  check('按引用携带 byName/memberByLocal/factorLocals/transparentAliases',
    m.byName === prior.byName && m.memberByLocal === prior.memberByLocal
    && m.factorLocals === prior.factorLocals && m.transparentAliases === prior.transparentAliases);
  check('chainAliasByLocal 浅拷贝（内容同、身份异）',
    m.chainAliasByLocal !== prior.chainAliasByLocal && m.chainAliasByLocal.F === 't.a.b');
  check('prefixFold/stringAlias 浅拷贝',
    m.prefixFoldByLocal !== prior.prefixFoldByLocal && m.prefixFoldByLocal.D === 'PREFIX_'
    && m.stringAliasByLocal !== prior.stringAliasByLocal && m.stringAliasByLocal.E === 'X');
  check('dropLeading 携带', m.dropLeading === 2);
  const m2 = extendAliasMap(prior, { dropLeading: 3 });
  check('overrides 只替换指定字段', m2.dropLeading === 3 && m2.byName === prior.byName);
}
{
  const m = extendAliasMap(null, null);
  check('空 prior 给类型化空值', m.dropLeading === 0 && Object.keys(m.byName).length === 0
    && Array.isArray(m.factorLocals) && m.factorLocals.length === 0);
}
// dropLeading 校验：负/非整数/NaN/非数字一律抛（编程错误）
throws('dropLeading 负数抛错', function(){ extendAliasMap(null, { dropLeading: -1 }); }, /非负整数/);
throws('dropLeading 非整数抛错', function(){ extendAliasMap(null, { dropLeading: 1.5 }); }, /非负整数/);
throws('dropLeading NaN 抛错', function(){ extendAliasMap(null, { dropLeading: NaN }); }, /非负整数/);
throws('dropLeading 非数字抛错', function(){ extendAliasMap(null, { dropLeading: '2' }); }, /非负整数/);
check('dropLeading 合法值通过', extendAliasMap(null, { dropLeading: 2 }).dropLeading === 2);
// 记账助手
check('bumpDrop 增记', bumpDrop(null, 1) === 1 && bumpDrop({ dropLeading: 3 }, 0) === 3 && bumpDrop({ dropLeading: 3 }, 1) === 4);
check('clampDrop 删记且不下溢', clampDrop({ dropLeading: 5 }, 2) === 3 && clampDrop({ dropLeading: 2 }, 5) === 0 && clampDrop(null, 1) === 0);

// ---------- canCommit（folds.js；经 canonical + luaValidate 端到端小场景） ----------
{
  const canCommit = L._canCommit;
  check('canCommit 等价通过', canCommit('print(1)', 'print(1)', null) === true);
  check('canCommit 不等价拒绝', canCommit('print(1)', 'print(2)', null) === false);
  check('canCommit 语法错误拒绝', canCommit('print(1)', 'print(', null) === false);
}

// ---------- unquoteShort / canSingleQuote / needsSepAfter（core.js） ----------
const unquoteShort = L._unquoteShort, canSingleQuote = L._canSingleQuote, needsSepAfter = L._needsSepAfter;
check('unquoteShort 单引号', unquoteShort("'abc'") === 'abc');
check('unquoteShort 双引号保留内单引号', unquoteShort('"a\'b"') === "a'b");
check('unquoteShort 长字符串 → null', unquoteShort('[[abc]]') === null && unquoteShort('[==[x]==]') === null);
check('unquoteShort 缺 raw/过短 → null', unquoteShort(undefined) === null && unquoteShort("'") === null);
check('canSingleQuote 干净内容通过', canSingleQuote('abc ABC_1') === true && canSingleQuote('') === true);
check('canSingleQuote 拒单引号/反斜杠/换行',
  canSingleQuote("a'b") === false && canSingleQuote('a\\b') === false
  && canSingleQuote('a\nb') === false && canSingleQuote('a\rb') === false);
// 粘连守卫：名字字符边界粘连；数字+'.' 特例；缺 nextCh 不粘
check('needsSepAfter 名字字符粘连', needsSepAfter('a', 'b') === true && needsSepAfter('a', '1') === true);
check('needsSepAfter 数字+点特例（1..x 畸形数字）', needsSepAfter('1', '.') === true && needsSepAfter('x', '.') === false);
check('needsSepAfter 无相邻字符不粘', needsSepAfter('a', undefined) === false);
check('needsSepAfter 引号前名字字符保守判粘（文档化近似）', needsSepAfter("'", 'a') === true);
check('needsSepAfter 符号边界不粘', needsSepAfter('a', '(') === false && needsSepAfter(')', ')') === false);

// ---------- applyEdits（plan.js 编辑契约） ----------
const applyEdits = L._applyEdits;
check('applyEdits 基本替换', applyEdits('abcdef', [{ start: 1, end: 3, name: 'X' }]) === 'aXdef');
check('applyEdits 乱序输入自动排序',
  applyEdits('abcdef', [{ start: 4, end: 5, name: 'Y' }, { start: 0, end: 1, name: 'X' }]) === 'XbcdYf');
check('applyEdits 相邻编辑合法', applyEdits('cdef', [{ start: 0, end: 2, name: 'a' }, { start: 2, end: 4, name: 'b' }]) === 'ab');
check('applyEdits 零长插入', applyEdits('ab', [{ start: 1, end: 1, name: 'X' }]) === 'aXb');
check('applyEdits 同偏移多个零长插入按 push 序全部生效',
  applyEdits('ab', [{ start: 1, end: 1, name: 'X' }, { start: 1, end: 1, name: 'Y' }]) === 'aXYb');
throws('applyEdits 重叠编辑抛错',
  function(){ applyEdits('abcdef', [{ start: 0, end: 3, name: 'x' }, { start: 2, end: 4, name: 'y' }]); },
  /重叠/);

console.log('\n=== shared helpers: ' + pass + ' pass, ' + fail + ' fail ===');
process.exit(fail ? 1 : 0);
