// foldInlinePure（纯表达式单用代入）回归测试：
// "提取/内联互逆、按压缩率仲裁"原则的内联侧——单用纯表达式代入使用点并删除声明语句。
// POS：用户报告场景（拆分赋值形态 w=e.Position-p.Position）、声明即赋值形态、
//      闭包内使用（captured）、表达式含运算/字段链；
// NEG：多用不代入、调用 RHS 不代入（求值不可移动）、含全局 RHS 不代入、
//      使用先于赋值不代入、被重新赋值不代入、多目标赋值不代入。
const lp = require('../node_modules/luaparse');
const f = require('fengari');
require('../core.js');
const L = globalThis.LuaMin.create(lp, f);

let pass = 0, fail = 0;
function run(label, input, assert){
  let r;
  // inlinePure 为 opt-in：测试环境通过 foldOrder 显式启用（默认管线不含它）
  const _fo = L._DEFAULT_FOLD_ORDER.slice();
  _fo.splice(_fo.indexOf('tailSymbol'), 0, 'inlinePure');
  try{ r = L.compress(input, {foldOrder: _fo}); }catch(e){ console.log('✗', label, 'threw:', e.message.slice(0,80)); fail++; return null; }
  const body = r.output.replace(/^l /, '');
  let parseOk = true; try{ lp.parse(body, { luaVersion: '5.3' }); }catch(e){ parseOk = false; }
  let eq = false;
  try{
    const na = L._normPureCopyProp(L._preprocess(input)), nb = L._normPureCopyProp(body);
    const ca = L._canonical(na);
    const cb = r.aliasMapInfo ? L._canonical(nb, r.aliasMapInfo) : L._canonical(nb);
    eq = (ca === cb);
  }catch(e){}
  const ok = parseOk && eq && assert(body);
  if(ok){ pass++; console.log('✓', label, '->', body.length, '字'); }
  else { fail++; console.log('✗', label, '| parse', parseOk, '| eq', eq, '->', body); }
  return body;
}

// ---------- POS ----------
// 用户报告场景：拆分赋值 w=e.Position-p.Position 单用代入（成员访问 base 上下文加括号）。
// 直接单测 fold：整管线会被"负收益兜底"拦截（机压加别名头后反而比手写行长，按设计回退原文）。
(function(){
  const src = "Isaac.AddCallback({},ModCallbacks.MC_PRE_NPC_UPDATE,function(_,e)local p,w=Isaac.GetPlayer(0)w=e.Position-p.Position if a<=w:Normalized():Dot(v)then return true end end)";
  let res = null, err = null;
  try{ res = L._foldInlinePure(src, null, [], null, src); }catch(e){ err = e; }
  const ok = !err && res && res.code.indexOf('w=e.Position') < 0
    && res.code.indexOf('local p=Isaac.GetPlayer(0)') >= 0
    && res.code.indexOf('(e.Position-p.Position):Normalized()') >= 0
    && res.code.length < src.length;
  if(ok){ pass++; console.log('✓ POS 拆分赋值代入（原 w 场景） ->', res.code.length, '字'); }
  else { fail++; console.log('✗ POS 拆分赋值代入（原 w 场景）', err ? err.message.slice(0,80) : (res ? res.code : 'null')); }
})();

// 声明即赋值形态：local w = 纯表达式，单用代入
run('POS 声明即赋值代入',
  "l Isaac.AddCallback({},1,function(e)local p=e.Position local w=e.Position-p.Position if a<=w:Normalized():Dot(v)then return true end end)",
  function(body){
    return body.indexOf('local w=') < 0;
  });

// 闭包内使用（captured）也代入：w 被内层函数使用，纯 RHS 无求值顺序问题
run('POS 闭包内使用代入',
  "l Isaac.AddCallback({},1,function(e,p)local w=e.Position-p.Position Isaac.AddCallback({},2,function()if a<=w:Normalized():Dot(v)then return true end end)end)",
  function(body){
    return body.indexOf('w=') < 0 && body.indexOf('(e.Position-p.Position)') >= 0;
  });

// 运算表达式代入：local s=x*2 单用
run('POS 运算表达式代入',
  "l local x=1 local s=x*2 print(s+1)",
  function(body){
    return body.indexOf('local s=') < 0;
  });

// ---------- NEG ----------
// 多用不代入（代入会重复求值文本且更长）
run('NEG 多用不代入',
  "l local w=e.Position-p.Position print(w:Normalized()) print(w:Length())",
  function(body){ return body.indexOf('w=e.Position-p.Position') >= 0; });

// 调用 RHS 不代入（不可跨语句移动求值）
run('NEG 调用 RHS 不代入',
  "l local p=Isaac.GetPlayer(0) print(p)",
  function(body){ return body.indexOf('local p=Isaac.GetPlayer(0)') >= 0; });

// 含全局标识符的 RHS 不代入（保守：全局可读但可能有副作用/非确定性）
run('NEG 含全局不代入',
  "l local q=Game().screenprint(q)",
  function(body){ return body.indexOf('local q=') >= 0; });

// 使用先于赋值不代入
run('NEG 使用先于赋值不代入',
  "l print(w) local w=e.Position-p.Position return w",
  function(body){ return body.indexOf('local w=') >= 0 || body.indexOf('w=e.Position-p.Position') >= 0; });

// 被重新赋值不代入
run('NEG 被重新赋值不代入',
  "l local w=e.Position-p.Position print(w:Normalized()) w=Vector.Zero return w",
  function(body){ return body.indexOf('w=e.Position-p.Position') >= 0; });

// 多目标赋值（局部 p,w=f()）中的单用变量不代入（整句无法干净删除）
run('NEG 多目标赋值不代入',
  "l local p,w=Isaac.GetPlayer(0),e.Position-p.Position print(w:Normalized())",
  function(body){ return body.indexOf('w=Isaac.GetPlayer(0),e.Position-p.Position') >= 0; });


// ---------- NEG 支配/作用域（2026-10-13 事故回归）----------
// 赋值句在 if/for 体内、使用点在外部：赋值可能未执行（控制流跳过），且 RHS 局部在
// 块外不可见。旧实现只做"文本在后"检查，代入后产出运行期即炸的代码（global 'P'/'t'）。
// 修复：赋值形态要求赋值句与使用点在同一块语句列中且赋值在前（sameBlkBefore）。
function execLua(body){
  const L2 = f.lauxlib.luaL_newstate();
  f.lualib.luaL_openlibs(L2);
  const st = f.lauxlib.luaL_dostring(L2, f.to_luastring(body.replace(/\.0/g, '0.0')));
  return st === f.lua.LUA_OK ? String(f.lua.lua_tonumber(L2, -1)) : 'ERR:' + f.lua.lua_tojsstring(L2, -1).slice(0, 60);
}
(function(){
  const src = "local function f(k,g) local ls=0 for a=1,k do local P=a*2 if g<=P then break end ls=P+1 end return ls end return f(5,7)+f(0,1)";
  const r = L.compress(src, { noMetatable: false, beamWidth: 4 });
  const body = r.output.replace(/^l /, '');
  const got = execLua(body);
  const ok = got === '7';
  if (ok) { pass++; console.log('✓ NEG 循环支配不代入 ->', body.length, '字, 执行=', got); }
  else { fail++; console.log('✗ NEG 循环支配不代入 -> 执行=', got, '|', body); }
})();
(function(){
  const src = "local function f(p,pal) local r=0 if p>0 then local t=pal[p] r=t[1] end return r end return f(1,{{42}})+f(0,{{7}})";
  const r = L.compress(src, { noMetatable: false, beamWidth: 4 });
  const body = r.output.replace(/^l /, '');
  const got = execLua(body);
  const ok = got === '42';
  if (ok) { pass++; console.log('✓ NEG if支配不代入 ->', body.length, '字, 执行=', got); }
  else { fail++; console.log('✗ NEG if支配不代入 -> 执行=', got, '|', body); }
})();


// NEG 跨重赋值内联（2026-10-14 字节解包误编译回归）：
// al=a%256 的读被跨过 a=a//256 重赋值内联到使用点，四通道全部失真。
(function(){
  const src = "local function f(r) local a=r[5] local al=a%256 a=a//256 local bl=a%256 a=a//256 local gl=a%256 return a//256,gl,bl,al end return f({0,0,0,0,((100*256+20)*256+30)*256+255})";
  const r = L.compress(src, { noMetatable: false, beamWidth: 4 });
  const body = r.output.replace(/^l /, '');
  const L2 = f.lauxlib.luaL_newstate();
  f.lualib.luaL_openlibs(L2);
  const st = f.lauxlib.luaL_dostring(L2, f.to_luastring(body.replace(/[.]0/g, '0.0')));
  const r_ = st === f.lua.LUA_OK ? f.lua.lua_tonumber(L2, -4) : null;
  const g_ = st === f.lua.LUA_OK ? f.lua.lua_tonumber(L2, -3) : null;
  const b_ = st === f.lua.LUA_OK ? f.lua.lua_tonumber(L2, -2) : null;
  const a_ = st === f.lua.LUA_OK ? f.lua.lua_tonumber(L2, -1) : null;
  const ok = r_ === 100 && g_ === 20 && b_ === 30 && a_ === 255;
  if (ok) { pass++; console.log('✓ NEG 跨重赋值不代入 ->', body.length, '字, 通道', r_, g_, b_, a_); }
  else { fail++; console.log('✗ NEG 跨重赋值不代入 ->', r_, g_, b_, a_, '|', body); }
})();

console.log('\n=== inline-pure: ' + pass + ' pass, ' + fail + ' fail ===');
process.exit(fail ? 1 : 0);
