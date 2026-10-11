// foldAliasDedup（字符串别名去重）回归测试：
// memberByLocal（成员字段折叠产物）与 stringAliasByLocal（字面量内联产物）中
// 同值的字符串别名合并为单个别名：被删侧的读改写到保留侧，删除多余声明槽位。
// POS：同声明合并（memberField×stringLiterals 各产一个同名别名）、双向保留选择、多对同批；
// NEG：不同声明语句不合并、被赋值不合并、uses 先于声明不合并、长度不省不提交。
const lp = require('../node_modules/luaparse');
const f = require('fengari');
require('../core.js');
const L = globalThis.LuaMin.create(lp, f);

let pass = 0, fail = 0;
function run(label, input, assert){
  let r;
  try{ r = L.compress(input); }catch(e){ console.log('✗', label, 'threw:', e.message.slice(0,80)); fail++; return null; }
  const body = r.output.replace(/^l /, '');
  let parseOk = true; try{ lp.parse(body, { luaVersion: '5.3' }); }catch(e){ parseOk = false; }
  let eq = false;
  try{
    const ca = L._canonical(L._preprocess(input));
    const cb = r.aliasMapInfo ? L._canonical(body, r.aliasMapInfo) : L._canonical(body);
    eq = (ca === cb);
  }catch(e){}
  const ok = parseOk && eq && assert(body);
  if(ok){ pass++; console.log('✓', label, '->', body.length, '字'); }
  else { fail++; console.log('✗', label, '| parse', parseOk, '| eq', eq, '->', body); }
  return body;
}

// ---------- POS ----------
// 最小场景：t.Rotation×2 → memberField 别名；'Rotation' 字面量×2 → stringLiterals 别名；
// aliasDedup 合并后 'Rotation' 只应出现一次（别名声明值）。
run('POS 最小: memberField×字面量 同名别名合并',
  "l local t=Isaac t.Rotation=1 print(t.Rotation) print(t.Rotation) print('Rotation') print('Rotation')",
  function(body){
    return (body.match(/'Rotation'/g) || []).length === 1 && body.indexOf('.Rotation') < 0;
  });

// MakePixel 场景（用户报告的原始缺陷）：'Rotation' 只声明一次
const makePixel =
  'function MakePixel()\n' +
  '  local _sprite, _size, _scale, _color, pixel = Sprite(), Vector(1/784, 1/448), Vector(1, 1), Color(1,1,1), {}\n' +
  "  _sprite:Load('gfx/ui/stage/nightmare_bg.anm2', true)\n" +
  "  _sprite:SetFrame('Intro', 0)\n" +
  '  _sprite.Scale = _size\n' +
  '  _sprite.Color = Color(1,1,1,1,1,1,1)\n' +
  '  local function fix()\n' +
  '    _sprite.Offset = Vector(0, -15 * _sprite.Scale.Y):Rotated(_sprite.Rotation)\n' +
  '  end\n' +
  '  fix()\n' +
  '  setmetatable(pixel, {\n' +
  '    __index = function(self, key)\n' +
  "      if key == 'Scale' then return _scale\n" +
  "      elseif key == 'Color' then return _color\n" +
  "      elseif key == 'Rotation' then return _sprite.Rotation\n" +
  '      elseif key == \'Render\' then return function(_, position) _sprite:RenderLayer(0, position) end end\n' +
  '    end,\n' +
  '    __newindex = function(self, key, value)\n' +
  "      if key == 'Scale' then _scale = value; _sprite.Scale = value * _size\n" +
  '      elseif key == \'Color\' then _color = value; _sprite.Color = Color(1,1,1,value.A,value.R+value.RO,value.G+value.GO,value.B+value.BO)\n' +
  "      elseif key == 'Rotation' then _sprite.Rotation = value; fix() end\n" +
  '    end\n' +
  '  })\n' +
  '  return pixel\n' +
  'end';
run('POS MakePixel: Rotation 别名唯一（原 bug 复现）', makePixel,
  function(body){
    return (body.match(/'Rotation'/g) || []).length === 1;
  });

// 反向保留：stringAlias 侧 uses 更多时保留 stringAlias，member 侧被改写
run('POS 反向: 字面量别名 uses 更多则保留字面量别名',
  "l local t=Isaac t.Rotation=1 print(t.Rotation) print(t.Rotation) print('Rotation') print('Rotation') print('Rotation')",
  function(body){
    return (body.match(/'Rotation'/g) || []).length === 1 && body.indexOf('.Rotation') < 0;
  });

// 多对同值批量：'Scale' 与 'Color' 两对同时合并（字面量放比较语境，避开 call-sugar 形态）
run('POS 多对同批: Scale/Color 两对别名同时合并',
  "l local t=Isaac t.Scale=1 print(t.Scale) print(t.Scale) if p=='Scale' then end if q=='Scale' then end t.Color=2 print(t.Color) print(t.Color) if r=='Color' then end if s=='Color' then end",
  function(body){
    return (body.match(/'Scale'/g) || []).length === 1 && (body.match(/'Color'/g) || []).length === 1
      && body.indexOf('.Scale') < 0 && body.indexOf('.Color') < 0;
  });

// 删除首槽（idx=0）路径：被删别名在声明表首位
run('POS 首槽删除: 合并对象声明在首位时连尾随逗号删除',
  "l local t=Isaac print('Rotation') print('Rotation') t.Rotation=1 print(t.Rotation) print(t.Rotation)",
  function(body){
    return (body.match(/'Rotation'/g) || []).length === 1 && !/,\s*,/.test(body);
  });

// ---------- NEG（直接单测 foldAliasDedup，构造 aliasMap 绕过前置 fold 的收益门槛） ----------
function unit(label, src, aliasMap, assert){
  let res = null, err = null;
  try{ res = L._foldAliasDedup(src, aliasMap, [], null, src); }catch(e){ err = e; }
  let ok;
  if(assert.nocommit){ ok = (err === null) && (res === null); }
  else {
    ok = (err === null) && res && (() => {
      try{ lp.parse(res.code, { luaVersion: '5.3' }); return assert.check(res); }catch(e){ return false; }
    })();
  }
  if(ok){ pass++; console.log('✓', label); }
  else { fail++; console.log('✗', label, err ? ('threw: ' + err.message.slice(0,60)) : (res ? res.code : 'null')); }
  return res;
}

// 同值但声明在两条语句 → 不合并
unit('NEG 不同声明语句不合并',
  "local a='Rotation' local b='Rotation' print(a) print(b)",
  { memberByLocal:{a:'Rotation'}, stringAliasByLocal:{b:'Rotation'}, dropLeading:0 },
  {nocommit:true});

// 被删别名被重新赋值 → 不合并
unit('NEG 被赋值别名不合并',
  "local a,b='Rotation','Rotation' print(a) print(b) b=1 print(b)",
  { memberByLocal:{a:'Rotation'}, stringAliasByLocal:{b:'Rotation'}, dropLeading:0 },
  {nocommit:true});

// 被删别名有声明之前的 use → 不合并
unit('NEG uses 先于声明不合并',
  "print(b) local a,b='Rotation','Rotation' print(a) print(b)",
  { memberByLocal:{a:'Rotation'}, stringAliasByLocal:{b:'Rotation'}, dropLeading:0 },
  {nocommit:true});

// 整句删光（同值别名即全部声明）→ 不合并
unit('NEG 不整句删除',
  "local a,b='Rotation','Rotation' print(a) print(b)",
  { memberByLocal:{a:'Rotation'}, stringAliasByLocal:{b:'Rotation'}, dropLeading:0 },
  {nocommit:true});

// init 与变量数不齐（多值赋 nil）→ 不合并
unit('NEG variables/init 不齐不合并',
  "local a,b,c='Rotation','Rotation' print(a) print(b) print(c)",
  { memberByLocal:{a:'Rotation'}, stringAliasByLocal:{b:'Rotation'}, dropLeading:0 },
  {nocommit:true});

// 正向直测：合并提交、被删侧读改写到保留侧、aliasMap 剔除被删名
(function(){
  const src = "local a,b,c='Rotation','Rotation',1 print(a) print(b) print(c)";
  const res = unit('POS 直测: 提交且 aliasMap 剔除被删名', src,
    { memberByLocal:{a:'Rotation'}, stringAliasByLocal:{b:'Rotation'}, dropLeading:1 },
    { check(r){
        return (r.code.match(/'Rotation'/g) || []).length === 1
          && r.aliasMap.memberByLocal && !r.aliasMap.memberByLocal.hasOwnProperty('b')
          && r.aliasMap.stringAliasByLocal && !r.aliasMap.stringAliasByLocal.hasOwnProperty('b')
          && r.code.length < src.length;
    }});
})();

console.log('\n=== alias-dedup: ' + pass + ' pass, ' + fail + ' fail ===');
process.exit(fail ? 1 : 0);
