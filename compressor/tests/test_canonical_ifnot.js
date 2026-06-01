// Guard tests for the "if not C then A else B  ≡  if C then B else A" normalization.
// This swap removes a `not` and is provably equivalent: `not C` is true exactly when C
// is false/nil, so swapping the two branch bodies and dropping the negation preserves
// behavior (C is evaluated once either way, same side effects).
//
// canonical must judge the two forms EQUAL (positive). Cases that are NOT this pattern
// must stay distinct (negative) — otherwise the optimizer would wrongly transform them.

const lp = require('../node_modules/luaparse');
const f = require('fengari');
require('../core.js');
const L = globalThis.LuaMin.create(lp, f);

let pass = 0, fail = 0;
function eq(a,b){ return L._canonical(a)===L._canonical(b); }
function pos(label,a,b){ const ok=eq(a,b); if(ok){pass++;console.log('✓ POS',label);}else{fail++;console.log('✗ POS',label,'\n  A:',a,'\n  B:',b);} }
function neg(label,a,b){ const ok=eq(a,b); if(!ok){pass++;console.log('✓ NEG',label);}else{fail++;console.log('✗ NEG',label,'(WRONGLY equal!)','\n  A:',a,'\n  B:',b);} }

// ---------- POSITIVE: the swap is equivalent ----------
pos('basic', "if not c then f() else g() end", "if c then g() else f() end");
pos('parenthesized cond', "if not(x>0) then a() else b() end", "if x>0 then b() else a() end");
pos('multi-stmt bodies', "if not c then a() a2() else b() end", "if c then b() else a() a2() end");
pos('cond with call', "if not has(x) then a() else b() end", "if has(x) then b() else a() end");
pos('idempotent (already swapped form unchanged)', "if c then g() else f() end", "if c then g() else f() end");
// even number of `not` cancels in an if-condition (boolean context): no branch swap.
pos('double not (even, no swap)', "if not not c then f() else g() end", "if c then f() else g() end");
pos('double not with call', "if not not c() then a() else b() end", "if c() then a() else b() end");
pos('triple not (odd, one swap)', "if not not not c then f() else g() end", "if c then g() else f() end");

// ---------- NEGATIVE: must stay distinct ----------
// no else branch: cannot swap (there is no body to swap with).
neg('no else', "if not c then f() end", "if c then f() end");
// genuinely different programs (bodies not swapped).
neg('bodies not swapped', "if not c then f() else g() end", "if c then f() else g() end");
// three clauses (elseif): not the simple 2-branch pattern.
neg('has elseif', "if not c then a() elseif d then b() else e() end", "if c then b() elseif d then a() else e() end");
// condition is `not a and b` (top-level is `and`, not `not`): stripping `not` is wrong.
neg('not-and compound', "if not a and b then f() else g() end", "if a and b then g() else f() end");
// VALUE-context not not: coerces to boolean, NOT collapsible (only if-conditions are).
neg('value-context not not', "local y=not not c", "local y=c");

console.log('\n=== if-not swap guard: ' + pass + ' pass, ' + fail + ' fail ===');
process.exit(fail ? 1 : 0);
