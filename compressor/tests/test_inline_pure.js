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

console.log('\n=== inline-pure: ' + pass + ' pass, ' + fail + ' fail ===');
process.exit(fail ? 1 : 0);
