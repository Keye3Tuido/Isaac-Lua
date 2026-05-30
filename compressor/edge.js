const luaparse=require('./node_modules/luaparse');
const fengari=require('fengari');
require('./core.js');
const LuaMin=globalThis.LuaMin.create(luaparse, fengari);
let pass=0,fail=0;
function check(name, src){
  try{
    const r=LuaMin.compress(src);
    const body=r.output.replace(/^l /,'');
    luaparse.parse(body,{luaVersion:'5.3'});
    const cb=r.aliasMapInfo?LuaMin._canonical(body,r.aliasMapInfo):LuaMin._canonical(body);
    const eq=LuaMin._canonical(LuaMin._preprocess(src))===cb;
    if(eq){pass++;console.log('OK  ',name,'=>',JSON.stringify(body));}
    else {fail++;console.log('FAIL',name,'NOT EQUIV =>',JSON.stringify(body));}
  }catch(e){fail++;console.log('FAIL',name,'THREW',e.message);}
}
check('numconcat1', "local x = 1 .. 2 return x");
check('numconcat2', "local t={} return t .. 1");
check('returnneg', "return -1");
check('floatdot', "local a = 1. + .5 return a");
check('hexfloat', "local a = 0x1p4 return a");
check('goto', "do goto skip ::skip:: end");
check('semicolons', "local a=1; local b=2; return a+b");
check('concatchain', "local s = a..b..c..'x' return s");
check('notequal', "if a ~= b then return 1 end");
check('powop', "return 2^3^2");
check('lenop', "return #t + 1");
check('methodchain', "return a:b():c().d");
check('varargs', "local function f(...) return ... end");
check('longstr', "local s=[==[a]]b]==] return s");
check('mixedprefix', "lua local q = 1\nl q = q + 1\nreturn q");
// 数字↔关键字/名字边界（真·Lua 中 168do / 1and 是畸形数字，必须留空格）
check('numkw_do', "for i=0,168 do end");
check('numkw_and', "return 1 and 2");
check('numkw_or', "return 0 or 1");
check('numkw_then', "if 1>0 then return 5 end");
check('numkw_end', "while true do return 1 end");
check('numname', "local x=1 return x");
check('hexkw', "if 0xFF>0 then end");
console.log('\nedge: '+pass+' pass, '+fail+' fail');
process.exit(fail?1:0);
