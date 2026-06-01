// Tests for transparent-alias elision (multi-callback optimization).
// Each case: compress, verify it parses (real Lua), verify canonical equivalence,
// and check it is no longer than the previous baseline.
const luaparse = require('../node_modules/luaparse');
const fengari = require('fengari');
require('../core.js');
const L = globalThis.LuaMin.create(luaparse, fengari);

let pass = 0, fail = 0;

function check(label, code, opts){
  opts = opts || {};
  let r;
  try {
    r = L.compress(code);
  } catch(e){
    console.log('✗', label, '-> compress threw:', e.message);
    fail++;
    return;
  }
  const body = r.output.replace(/^l /, '');
  // 1. parses as real Lua
  let parseOk = true;
  try { luaparse.parse(body); } catch(e){ parseOk = false; }
  // 2. equivalence: compare canonical(original) vs canonical(output, aliasMap)
  let equivOk = false;
  try {
    const orig = L._preprocess(code);
    const ca = L._canonical(orig);          // authoritative: no map on original side
    const cb = r.aliasMapInfo ? L._canonical(body, r.aliasMapInfo) : L._canonical(body);
    equivOk = (ca === cb);
  } catch(e){
    equivOk = false;
  }
  const ok = parseOk && (opts.skipEquiv || equivOk) && (opts.maxLen === undefined || r.output.length <= opts.maxLen);
  if(ok){
    pass++;
    console.log('✓', label, '-> len', r.output.length,
      opts.maxLen!==undefined ? ('(<= '+opts.maxLen+')') : '',
      'TA=' + JSON.stringify(r.aliasMapInfo && r.aliasMapInfo.transparentAliases));
  } else {
    fail++;
    console.log('✗', label,
      '| parse', parseOk, '| equiv', equivOk,
      '| len', r.output.length, opts.maxLen!==undefined?('want <= '+opts.maxLen):'');
    console.log('   out:', r.output);
  }
}

// Target case: multi-callback (input 265 chars). Current compressed result is 176.
check('multi_callback', [
  "l Isaac.AddCallback({},ModCallbacks.XXX,func,arg)",
  "l local A,M=Isaac.AddCallback,ModCallbacks;A({},M.XXX,func,arg)",
  "l local A,M,T=Isaac.AddCallback,ModCallbacks,{}A(T,M.XXX,func,arg)",
  "l local M,A=ModCallbacks,function(...)Isaac.AddCallback({},...)end;A(M.XXX,func,arg)"
].join('\n'), {maxLen: 204});

// Simple single transparent alias.
check('single_alias', [
  "l local M=ModCallbacks A({},M.MC_POST_UPDATE,func1)A({},M.MC_POST_RENDER,func2)A({},M.MC_POST_NEW_ROOM,func3)"
].join('\n'), {maxLen: 109});

// Three identical decls (callback_pattern). Stage-1.10 regex dedup handles this
// best (keeps the shared alias); elision must NOT make it worse. The 1.10 dedup
// output is intentionally not modeled by canonical (pre-existing behavior), so
// we only assert length here, not canonical equivalence.
check('three_identical', [
  "l local A,M=Isaac.AddCallback,ModCallbacks A({},M.MC_POST_UPDATE,func1)",
  "l local A,M=Isaac.AddCallback,ModCallbacks A({},M.MC_POST_RENDER,func2)",
  "l local A,M=Isaac.AddCallback,ModCallbacks A({},M.MC_POST_NEW_ROOM,func3)"
].join('\n'), {maxLen: 145, skipEquiv: true});

// Alias chain: local b=Global; local M=b.
check('alias_chain', [
  "l local g=ModCallbacks local h=g h.AddCallback({},h.MC_POST_UPDATE,func1)h.AddCallback({},h.MC_POST_RENDER,func2)h.AddCallback({},h.MC_POST_NEW_ROOM,func3)"
].join('\n'), {});

// A local that is NOT a pure alias must be untouched (reassigned).
check('reassigned_not_alias', [
  "l local M=ModCallbacks M=Isaac A({},M.X,f)A({},M.Y,g)A({},M.Z,h)"
].join('\n'), {});

console.log('\n=== transparent elision: ' + pass + ' pass, ' + fail + ' fail ===');
process.exit(fail ? 1 : 0);
