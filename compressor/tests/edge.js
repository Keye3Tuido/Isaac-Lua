const luaparse=require('../node_modules/luaparse');
const fengari=require('fengari');
require('../core.js');
const LuaMin=globalThis.LuaMin.create(luaparse, fengari);
let pass=0,fail=0;

// 去除注释的辅助函数
function removeComments(src){
  try{
    const tokens = LuaMin._lex(src);
    const commentRanges = [];
    for(let i=0; i<tokens.length; i++){
      if(tokens[i].type==='Comment'){
        commentRanges.push({start:tokens[i].start, end:tokens[i].end});
      }
    }
    if(commentRanges.length===0) return src;
    let out = src;
    for(let i=commentRanges.length-1; i>=0; i--){
      const r = commentRanges[i];
      out = out.slice(0, r.start) + out.slice(r.end);
    }
    return out;
  }catch(e){
    return src;
  }
}

function check(name, src){
  src = removeComments(src); // 测试前先去除注释
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
// 字段前缀折叠：function decl 名字链不能改写为 [alias]
check('prefix_fundecl_name', "local M={}\nfunction M.SOMETHING_LEFT(a) return a end\nfunction M.SOMETHING_RIGHT(a) return a end\nfunction M.SOMETHING_UP(a) return a end\nfunction M.SOMETHING_DOWN(a) return a end\nlocal x=M.SOMETHING_LEFT(M)\nlocal y=M.SOMETHING_RIGHT(M)\nlocal z=M.SOMETHING_UP(M)\nlocal w=M.SOMETHING_DOWN(M)\nreturn x,y,z,w");
// 字段前缀折叠：function decl 是冒号方法
check('prefix_colonmethod', "local M={}\nfunction M:PREFIX_LEFT() end\nfunction M:PREFIX_RIGHT() end\nfunction M:PREFIX_UP() end\nfunction M:PREFIX_DOWN() end\nlocal x=M.PREFIX_LEFT\nreturn x");
// 字段前缀折叠：不同 base 共享同字段名
check('prefix_mixed_bases', "local A={}\nlocal B={}\nA.STAGE_BOSS=1; B.STAGE_BOSS=2\nA.STAGE_SHOP=3; B.STAGE_SHOP=4\nA.STAGE_LIBRARY=5; B.STAGE_LIBRARY=6\nreturn A.STAGE_BOSS+B.STAGE_BOSS+A.STAGE_SHOP+B.STAGE_SHOP+A.STAGE_LIBRARY+B.STAGE_LIBRARY");
// 字段前缀折叠：同字段族在 :method 调用链 base 上
check('prefix_in_methodchain', "local M={}\nM.GAME_LEVEL=function(s) return s end\nM.GAME_ROOM=function(s) return s end\nM.GAME_PLAYER=function(s) return s end\nM.GAME_ITEM=function(s) return s end\nreturn M.GAME_LEVEL(M):x(),M.GAME_ROOM(M):y(),M.GAME_PLAYER(M):z(),M.GAME_ITEM(M):w()");
// 字段前缀折叠：字段是另一字段的严格前缀
check('prefix_strict_subfield', "local M={}\nM.PREFIX=0; M.PREFIX_BOSS=1; M.PREFIX_SHOP=2; M.PREFIX_DEVIL=3; M.PREFIX_ANGEL=4\nreturn M.PREFIX+M.PREFIX_BOSS+M.PREFIX_SHOP+M.PREFIX_DEVIL+M.PREFIX_ANGEL+M.PREFIX+M.PREFIX_BOSS");
// 字符串字面量内联：同字面量重复出现 ≥2 次（基础场景）
check('strlit_basic_dup', "local M={}\nreturn M['SomeIdent']+M['SomeIdent']+M['SomeIdent']");
// 字符串字面量内联：单/双引号混用（'X' 与 "X" 内容相同应等价归一）
check('strlit_quote_mix', "print('SomeIdent'); print(\"SomeIdent\"); print('SomeIdent')");
// 字符串字面量内联：作为 LocalStatement init 的字面量，被同名替换后仍等价
check('strlit_as_local_init', "local x=2\nlocal P='SomeIdent'\nreturn x..'SomeIdent'..P");
// 字符串字面量内联：require'X' 这种 StringCallExpression 的 argument 不能被改写
//   （否则 requireu 会合并 token，语义破坏；等价校验也会拒绝）
check('strlit_skip_strcall', "local a=require'SomeIdent'\nlocal b=require'SomeIdent'\nlocal c=require'SomeIdent'\nreturn a,b,c");
// 字符串字面量内联：f{X} 这种 TableCallExpression 的 arguments 是 table 不是 string，不影响
check('strlit_with_strcall_mixed', "local a=require'json'\nlocal b='SomeIdent'\nlocal c='SomeIdent'\nlocal d='SomeIdent'\nreturn a,b,c,d");
// 字符串字面量内联：方法体内的字面量
check('strlit_in_method', "local M={}\nfunction M:Save() return 'SomeIdent'..'SomeIdent'..'SomeIdent' end\nreturn M:Save()");
// 字符串字面量内联：嵌套函数内
check('strlit_in_nested_func', "local f=function() return 'SomeIdent' end\nlocal g=function() return 'SomeIdent' end\nlocal h=function() return 'SomeIdent' end\nreturn f(),g(),h()");
// 字符串字面量内联：表 key（[\"X\"]=v）
check('strlit_table_key', "local t={['SomeIdent']=1}\nlocal v=t['SomeIdent']\nlocal w=t['SomeIdent']\nreturn v+w");
// 字符串字面量内联：长字符串 [[X]] 与 'X' 不归一（Lua 转义规则不同），混用时仍能正确处理
check('strlit_longstr_mix', "local s=[[SomeIdent]]\nlocal t='SomeIdent'\nlocal u='SomeIdent'\nreturn s,t,u");
// 多重赋值拆分：非 local，符号结尾值 → 拆分省间隔符
check('multiassign_split_basic', "local x={} a=0 b=0 c=0\na,b,c=x[1],x[2],x[3]\nreturn a+b+c");
// 多重赋值拆分：耦合（RHS 读目标）→ 不能拆，保持原状（不变）
check('multiassign_split_coupled', "local x={} a=0 b=0\na,b=b,a\nreturn a+b");
// 多重赋值拆分：末值是 call 多返回值，但 #init==#vars 时仍可安全拆（Lua 多值适配只在末值且
//   #init<#vars 时扩展；#init==#vars 时每个 init 都被截为 1 值，与 split 等价）
check('multiassign_split_call_at_end', "local function f() return 1,2 end\na=0 b=0\na,b=({})[1],f()\nreturn a,b");
// 多重赋值拆分：目标是索引（t[i]）→ 不能拆（求值序敏感）
check('multiassign_split_index', "local t={1,2} a=0\nt[1],t[2]=t[2],t[1]\nreturn t[1]+t[2]");
console.log('\nedge: '+pass+' pass, '+fail+' fail');
process.exit(fail?1:0);
