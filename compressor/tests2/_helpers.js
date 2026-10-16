// 公共测试辅助函数（tests2/ 下各套件共享）
// removeComments: 词法级去除 Lua 源码中的注释；任何失败都原样返回源码。
function removeComments(LuaMin, src){
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

// luaPrint(src)：用 fengari 真·Lua 5.3 跑 src，返回 print 输出的拼接（每行 '\t' 连参、'|' 连行）。
// 供「AST 不可见的语义差异」类断言使用：多值截断/展开、结合性、元方法——两侧 AST 完全相同，
// canonical 与 luaparse 都发现不了，只有真求值才查得出。fengari 惰性 require（各套件按需加载）。
function luaPrint(src){
  const fengari = require('fengari');
  const { lua, lauxlib, lualib, to_luastring } = fengari;
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);
  const out = [];
  lua.lua_pushjsfunction(L, function(L){
    const n = lua.lua_gettop(L), parts = [];
    for(let i=1; i<=n; i++){
      const v = lua.lua_tojsstring(L, i);
      parts.push(v === null ? 'nil' : String(v));
    }
    out.push(parts.join('\t'));
    return 0;
  });
  lua.lua_setglobal(L, to_luastring('print'));
  const st = lauxlib.luaL_dostring(L, to_luastring(src));
  if(st !== lua.LUA_OK) throw new Error(String(lua.lua_tojsstring(L, -1)));
  return out.join('|');
}

module.exports = { removeComments, luaPrint };
