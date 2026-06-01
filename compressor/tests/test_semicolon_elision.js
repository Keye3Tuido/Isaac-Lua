// Guard tests for statement-separator ';' elision in minimizeSpacing.
// Removable: trailing/statement-boundary ';' not before '(' and not inside tables.
// Must KEEP: load-bearing ';(' and table-constructor field-separator ';'.
const lp = require('../node_modules/luaparse');
const f = require('fengari');
require('../core.js');
const L = globalThis.LuaMin.create(lp, f);

let pass = 0, fail = 0;
function run(label, input, opts){
  opts = opts || {};
  let r;
  try{ r = L.compress(input); }catch(e){ console.log('✗', label, 'threw:', e.message.slice(0,70)); fail++; return; }
  const body = r.output.replace(/^l /,'');
  let parseOk=true; try{ lp.parse(body,{luaVersion:'5.3'}); }catch(e){ parseOk=false; }
  let eq=false;
  try{ const ca=L._canonical(L._preprocess(input)); const cb=r.aliasMapInfo?L._canonical(body,r.aliasMapInfo):L._canonical(body); eq=(ca===cb); }catch(e){}
  let semiOk = opts.expectSemi===undefined ? true : (body.includes(';')===opts.expectSemi);
  const ok = parseOk && eq && semiOk;
  if(ok){ pass++; console.log('✓', label, '->', body); }
  else { fail++; console.log('✗', label, '| parse',parseOk,'| eq',eq,'| semiOk',semiOk,'->', body); }
}

// Removable statement separators (no ; in output).
run('trailing ; removed', "l local a=1;local b=2;print(a,b)", {expectSemi:false});
run('; before name', "l local a=1;a=a+1;return a", {expectSemi:false});
run('end; before call', "l local f=g f(1);f(2)", {expectSemi:false});

// Load-bearing ';(' must stay.
run('load-bearing ;(', "l local g,h=A,B local x=g x=h;(x)()", {expectSemi:true});

// Table-constructor ';' field separators must stay (else broken).
run('table ; sep array', "l local t={1;2;3}return t", {expectSemi:true});
run('table ; sep keyed', "l local t={a=1;b=2}return t", {expectSemi:true});
run('nested table ;', "l local t={x={1;2};y=3}return t", {expectSemi:true});

console.log('\n=== semicolon elision: ' + pass + ' pass, ' + fail + ' fail ===');
process.exit(fail ? 1 : 0);
