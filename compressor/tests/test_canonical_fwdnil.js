// Guard tests for the "dead forward-nil declaration elimination" normalization
// in canonical. This normalization asserts:
//
//   local v=nil; <S not referencing v>; v=expr; <T>   ≡   <S>; local v=expr; <T>
//
// SOUNDNESS PRECONDITION: v must not be referenced anywhere in <S> (the span
// between the nil-decl and its first assignment), including inside nested
// function literals (capture counts as a reference).
//
// This suite has POSITIVE cases (must be judged equivalent) and — critically —
// NEGATIVE cases (must NOT be judged equivalent; a false "equal" here means the
// normalization is UNSOUND and would let the compressor emit wrong code).

const lp = require('../node_modules/luaparse');
const f = require('fengari');
require('../core.js');
const L = globalThis.LuaMin.create(lp, f);

let pass = 0, fail = 0;
function eq(a, b){ return L._canonical(a) === L._canonical(b); }

// Positive: should be equivalent (forward-nil of a dead var == in-place decl).
function pos(label, a, b){
  const ok = eq(a, b);
  if(ok){ pass++; console.log('✓ POS', label); }
  else { fail++; console.log('✗ POS', label, '\n   A:', a, '\n   B:', b); }
}
// Negative: must NOT be equivalent (different observable behavior).
function neg(label, a, b){
  const ok = eq(a, b);
  if(!ok){ pass++; console.log('✓ NEG', label); }
  else { fail++; console.log('✗ NEG', label, '(WRONGLY judged equivalent — UNSOUND!)', '\n   A:', a, '\n   B:', b); }
}

// ---------- POSITIVE cases ----------
// Basic: y dead between forward-nil and assignment.
pos('basic single', "local x,y=1 f(x) y=2 g(y)", "local x=1 f(x) local y=2 g(y)");
// Forward-nil riding a batched local, intervening stmt doesn't touch y.
pos('batched ride', "local a,b,y=1,2 use(a,b) y=3 use(y)", "local a,b=1,2 use(a,b) local y=3 use(y)");
// Multiple forward-nil vars.
pos('two fwd', "local p,q,r=1 g(p) q=2 r=3 h(q,r)", "local p=1 g(p) local q=2 local r=3 h(q,r)");
// Forward-nil var used only after assignment, with unrelated reads between.
pos('unrelated between', "local x,z=1 print(x) print(x) z=9 print(z)", "local x=1 print(x) print(x) local z=9 print(z)");
// Reassigned multiple times after first assignment (still equivalent).
pos('reassign after', "local x,y=0 f(x) y=1 y=2 g(y)", "local x=0 f(x) local y=1 y=2 g(y)");

// ---------- NEGATIVE cases (must stay distinct) ----------
// y IS read between forward-nil-decl and assignment → reads nil, not equivalent.
neg('read between', "local x,y=1 f(y) y=2 g(y)", "local x=1 f(y) local y=2 g(y)");
// y captured by a closure created before assignment → different binding identity.
neg('captured before', "local x,y=1 local fn=function() return y end y=2 fn()", "local x=1 local fn=function() return y end local y=2 fn()");
// y read in the assignment's own RHS (self-reference reads nil).
neg('self in rhs', "local x,y=1 y=(y or 5) g(y)", "local x=1 local y=(y or 5) g(y)");
// Genuinely different: one stays nil, the other declares a value (no assignment).
neg('no assignment', "local x,y=1 g(x)", "local x=1 g(x) local y=2");
// Different value.
neg('different value', "local x,y=1 f(x) y=2 g(y)", "local x=1 f(x) local y=3 g(y)");
// y read between via nested block.
neg('read in nested if', "local x,y=1 if cond then h(y) end y=2 g(y)", "local x=1 if cond then h(y) end local y=2 g(y)");

console.log('\n=== canonical forward-nil guard: ' + pass + ' pass, ' + fail + ' fail ===');
process.exit(fail ? 1 : 0);
