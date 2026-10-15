// tests2/regression/semicolon.js — v1 tests/test_semicolon_elision.js 的 v2 移植
// v1 当前 3/7 失败（表内 ';' 等价校验不过）；v2 的 encode.semicolon 透镜在
// AST 语句边界上判定（字段间隙查 TableConstructorExpression.fields），7 例须全绿。
'use strict';
const luaparse = require('../../node_modules/luaparse');
const fengari = require('fengari');
const L1 = require('../../src2/base.js').create({ luaparse, fengari });
const LuaMin2 = require('../../src2/core2.js');
const L2 = LuaMin2.create({ luaparse, fengari });

function run(){
  let pass = 0, fail = 0;
  const bad = [];

  function runCase(label, input, opts){
    opts = opts || {};
    let r;
    try{ r = L2.compress(input); }
    catch(e){ fail++; bad.push(label + ' threw: ' + e.message.slice(0,70)); return; }
    const body = r.output.replace(/^l /,'');
    let parseOk = true;
    try{ luaparse.parse(body, { luaVersion:'5.3' }); }catch(e){ parseOk = false; }
    let eq = false;
    try{
      const C2 = require('../../src2/canonical2.js');
      eq = C2.equivalent(L1._preprocess(input), body, { luaparse, fengari, base: L1 },
        L2._buildIR(L1._preprocess(input)), L2._buildIR(body), {pureInline:true}, undefined, r.report.aliasMap || undefined);
    }catch(e){}
    const semiOk = opts.expectSemi === undefined ? true : (body.indexOf(';') >= 0) === opts.expectSemi;
    if(parseOk && eq && semiOk){ pass++; }
    else { fail++; bad.push(label + ' | parse ' + parseOk + ' | eq ' + eq + ' | semiOk ' + semiOk + ' -> ' + body); }
  }

  // 可删的语句分隔符（产物无 ';'）
  runCase('trailing ; removed', "l local a=1;local b=2;print(a,b)", { expectSemi:false });
  runCase('; before name', "l local a=1;a=a+1;return a", { expectSemi:false });
  runCase('end; before call', "l local f=g f(1);f(2)", { expectSemi:false });

  // 载荷分号 ;( 必须保留
  runCase('load-bearing ;(', "l local g,h=A,B local x=g x=h;(x)()", { expectSemi:true });

  // 表构造器字段分隔符 ';' 必须保留（AST 字段间隙判定，v1 的 3 个失败例）
  runCase('table ; sep array', "l local t={1;2;3}return t", { expectSemi:true });
  runCase('table ; sep keyed', "l local t={a=1;b=2}return t", { expectSemi:true });
  runCase('nested table ;', "l local t={x={1;2};y=3}return t", { expectSemi:true });

  if(bad.length){
    bad.forEach(function(b){ console.log('✗', b); });
  }
  return { pass, fail };
}

module.exports = { name: 'semicolon', run };
