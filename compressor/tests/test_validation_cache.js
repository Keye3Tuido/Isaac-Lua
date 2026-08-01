const baseParser = require('luaparse');
const fengari = require('fengari');

let parseCount = 0;
const countedParser = Object.assign({}, baseParser, {
  parse(...args) {
    parseCount++;
    return baseParser.parse(...args);
  }
});

require('../core.js');
const LuaMin = globalThis.LuaMin.create(countedParser, fengari);
let pass = 0;
let fail = 0;
function ok(name, condition, detail) {
  if (condition) pass++;
  else { fail++; console.error('FAIL:', name, detail || ''); }
}

const source = 'local value=1 return value+value';
const first = LuaMin._canonical(source);
const afterFirst = parseCount;
const second = LuaMin._canonical(source);
ok('alias-free/result-stable', first === second);
ok('alias-free/cache-hit', parseCount === afterFirst, `${afterFirst} -> ${parseCount}`);

const aliasedSource = 'local a=Isaac return a';
const aliasMap = {
  byName: { Isaac: 'a' },
  memberByLocal: {},
  factorLocals: [],
  transparentAliases: {},
  prefixFoldByLocal: {},
  stringAliasByLocal: {},
  dropLeading: 1
};
const beforeAlias = parseCount;
const aliasFirst = LuaMin._canonical(aliasedSource, aliasMap);
const afterAliasFirst = parseCount;
const aliasSecond = LuaMin._canonical(aliasedSource, aliasMap);
ok('alias-aware/result-stable', aliasFirst === aliasSecond);
ok('alias-aware/not-shared-with-unkeyed-cache', afterAliasFirst > beforeAlias && parseCount > afterAliasFirst);

const compressed = LuaMin.compress('local longName=1 local otherName=2 return longName+otherName');
const body = compressed.output.replace(/^l /, '');
const canonicalBody = compressed.aliasMapInfo
  ? LuaMin._canonical(body, compressed.aliasMapInfo)
  : LuaMin._canonical(body);
ok('compress/output-equivalent', LuaMin._canonical(LuaMin._preprocess('local longName=1 local otherName=2 return longName+otherName')) === canonicalBody);

console.log(`${pass} pass, ${fail} fail`);
if (fail) process.exitCode = 1;