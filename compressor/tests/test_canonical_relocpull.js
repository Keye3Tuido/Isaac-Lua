// Guard tests for "relocation-safe write-once dead-local float" normalization in canonical.
//
// A local v is "float-normalizable" when:
//   - declared once with a RELOCATION-SAFE init (nil/number/string/bool literal or EMPTY {}),
//   - never reassigned (write-once via its declaration),
//   - not read between block start and its first read (dead until first use),
//   - declaration and first read are in the same block, and the block has no labels (goto safety),
//   - not captured by a closure.
// canonical floats such a decl to "just before the statement containing its first use".
// Since the float target is identical regardless of the decl's original position, two programs
// differing only in WHERE such a decl sits (e.g. batched header vs just-before-use) converge.
//
// POSITIVE cases must be judged equivalent; NEGATIVE cases must NOT (false "equal" = unsound).

const lp = require('../node_modules/luaparse');
const f = require('fengari');
require('../core.js');
const L = globalThis.LuaMin.create(lp, f);

let pass = 0, fail = 0;
function eq(a,b){ return L._canonical(a)===L._canonical(b); }
function pos(label,a,b){ const ok=eq(a,b); if(ok){pass++;console.log('✓ POS',label);}else{fail++;console.log('✗ POS',label,'\n  A:',a,'\n  B:',b);} }
function neg(label,a,b){ const ok=eq(a,b); if(!ok){pass++;console.log('✓ NEG',label);}else{fail++;console.log('✗ NEG',label,'(WRONGLY equal — UNSOUND!)','\n  A:',a,'\n  B:',b);} }

// ---------- POSITIVE: decl position of a relocsafe dead local is irrelevant ----------
pos('empty table early vs late', "local T={} f() g() use(T)", "f() g() local T={} use(T)");
pos('number early vs late', "local n=5 a() b() use(n)", "a() b() local n=5 use(n)");
pos('string early vs late', "local s='z' a() use(s)", "a() local s='z' use(s)");
pos('batched header vs just-before-use', "local x,T=1,{} f(x) use(T)", "local x=1 f(x) local T={} use(T)");

// ---------- NEGATIVE: must stay distinct ----------
// non-empty table {x}: field reference, moving changes captured value if x mutates.
neg('table with ref moved', "local T={x} x=9 use(T)", "x=9 local T={x} use(T)");
// value is a call: side effects / order matters.
neg('call value moved', "local T=make() f() use(T)", "f() local T=make() use(T)");
// index read value.
neg('index value moved', "local T=o.k f() use(T)", "f() local T=o.k use(T)");
// the variable is READ before the later decl position (so positions aren't interchangeable).
neg('read before late decl', "local T={} use(T) f()", "use(T) local T={} f()");  // 2nd: T global in use(T)
// reassigned (not write-once) — floating the decl changes versions.
neg('reassigned', "local T={} f() T=g() use(T)", "f() local T={} T=g() use(T)");

console.log('\n=== relocation float guard: ' + pass + ' pass, ' + fail + ' fail ===');
process.exit(fail ? 1 : 0);
