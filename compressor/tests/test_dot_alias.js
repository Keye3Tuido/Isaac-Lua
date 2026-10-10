// foldDotAlias（点访问别名复用）回归测试：字段名已有字符串别名（stringAliasByLocal）时，
// obj.Field → obj[alias]（纯语法改写，obj.F ≡ obj['F']，写目标同样安全）。
// POS：MakePixel 场景（比较串提取别名后，成员访问改写成 [别名]）+ 最小场景；均校验等价+更短。
// NEG：':' 方法调用不改写；无别名字段保持点形式；dotAlias 自身绝不新建别名。
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
// 最小场景：'Rotation' 作为比较串出现 3 次被提取别名，成员读/写随之改写为 [别名]
run('POS 最小: 点读+点写改写为 [别名]',
  "l local t={} if a=='Rotation' then t.Rotation=1 end if b=='Rotation' then print(t.Rotation) end if c=='Rotation' then print(2) end",
  function(body){
    return body.indexOf('.Rotation') < 0           // 点访问全部改写
      && /'\w+'/.test(body) && (body.match(/\[d\]/g) || []).length === 2;  // 读写两处都走别名
  });

// MakePixel 场景（原 bug 复现输入的核心结构）：三个字段的读写都改写为 [k]/[l]/[m]
const makePixel =
  'function MakePixel()\n' +
  '  local _sprite, _size, _scale, _color, pixel = Sprite(), Vector(1/784, 1/448), Vector(1, 1), Color(1,1,1), {}\n' +
  "  _sprite:SetFrame('Intro', 0)\n" +
  '  _sprite.Offset = Vector(0, -15/448)\n' +
  '  _sprite.Scale = _size\n' +
  '  setmetatable(pixel, {\n' +
  '    __index = function(self, key)\n' +
  "      if key == 'Scale' then return _scale\n" +
  "      elseif key == 'Color' then return _color\n" +
  "      elseif key == 'Rotation' then return _sprite.Rotation\n" +
  '      end\n' +
  '    end,\n' +
  '    __newindex = function(self, key, value)\n' +
  "      if key == 'Scale' then _scale = value _sprite.Scale = value * _size\n" +
  "      elseif key == 'Color' then _color = value _sprite.Color = Color(1, 1, 1, value.A)\n" +
  "      elseif key == 'Rotation' then _sprite.Rotation = value\n" +
  '      end\n' +
  '    end\n' +
  '  })\n' +
  '  return pixel\n' +
  'end';
const mpBody = run('POS MakePixel: Scale/Color/Rotation 读写全部改写', makePixel,
  function(body){
    return body.indexOf('.Scale') < 0 && body.indexOf('.Color') < 0 && body.indexOf('.Rotation') < 0;
  });
if(mpBody){
  // 无别名字段 Offset 保持点形式（dotAlias 不为它新建别名）
  const keepDot = mpBody.indexOf('.Offset') >= 0;
  if(keepDot){ pass++; console.log('✓ NEG 无别名字段保持点形式 (.Offset 保留)'); }
  else { fail++; console.log('✗ NEG 无别名字段保持点形式 ->', mpBody); }
}

// ---------- NEG ----------
// ':' 方法调用是 indexer':'，即使有同名字符串别名也不改写
run('NEG :方法调用不改写',
  "l local obj=g if k=='Render' then obj:Render(1) end if k2=='Render' then obj2.Render=2 end print('Render')",
  function(body){ return body.indexOf(':Render(') >= 0 && body.indexOf('.Render') < 0; });

// 单次出现的字段不会因本 pass 而新建别名（本 pass 不新增任何声明）
run('NEG 无字符串别名时点访问不动',
  'l local t={} t.Solo=1 print(t.Solo) return t.Solo',
  function(body){ return body.indexOf('.Solo') >= 0 && body.indexOf('[') < 0; });

// 长度闸门：改写不缩短时（字段名仅比别名长 1）不提交
run('NEG 不缩短不改写（字段名太短）',
  "l local t={} if a=='Ab' then t.Ab=1 end if b=='Ab' then print(t.Ab) end",
  function(body){ return body.indexOf('.Ab') >= 0; });

// ---------- 对称方向：字符串字面量 → 已有别名 ----------
// POS 正常语境：foldMemberField 建的 memberByLocal 别名，同名字面量 'Rotation' → (b)
// （同时覆盖：别名声明里的头部字面量保持原样不改写）
run('POS 字面量替换（memberByLocal 来源 + 头部字面量不动）',
  "l local t=Isaac t.Rotation=1 print(t.Rotation) print(t.Rotation) print('Rotation')",
  function(body){
    return body.indexOf('(b)') >= 0 && body.indexOf("a'Rotation'") < 0
      && (body.match(/'Rotation'/g) || []).length === 1;   // 仅剩别名声明值（头部，不改写）
  });

// POS callArg 语境：f'X' → f(u)（括号形态）；本例同时是 ':' 方法别名（foldMethods 来源）
run('POS 字面量替换（callArg 糖 → (别名)，foldMethods 来源）',
  "l obj:Calculate() obj:Calculate() obj:Calculate() print('Calculate')",
  function(body){ return body.indexOf('print(b)') >= 0; });

// POS 粘连守卫：关键字紧邻字面量 and'X' → and u（前置空格，不得并成 andu）
run('POS 前导粘连守卫（and 后前置空格）',
  "l local t=Isaac t.Rotation=1 print(t.Rotation) print(t.Rotation) local x=a and'Rotation' return x",
  function(body){ return body.indexOf('and b') >= 0 && body.indexOf('andb') < 0; });

// NEG 长字符串 [[...]] 不替换（canonical 不归一长字符串，替换会破等价）
run('NEG 长字符串字面量不替换',
  "l local t=Isaac t.Rotation=1 print(t.Rotation) print(t.Rotation) print([[Rotation]])",
  function(body){ return body.indexOf('[[Rotation]]') >= 0; });

// NEG 无别名的字面量保持原样
run('NEG 无别名字面量不动',
  "l print('SomeUnique')",
  function(body){ return body.indexOf('SomeUnique') >= 0 && body.indexOf('[') < 0; });

// NEG 别名声明值本身不替换：foldMethods 可把别名注入【普通 local】尾部（dropLeading 不覆盖
// 该语句），其 init 字面量就是别名定义——替换成别名会变成自引用 local r,a=Game(),a
run('NEG 别名声明值不替换（防自引用 a=a）',
  'local r=Game() r:GetGridPosition(0) r:GetGridPosition(1)',
  function(body){ return body.indexOf("'GetGridPosition'") >= 0 && body.indexOf(',a=a') < 0; });

// 注：字面量方向的「太短不替换」闸门（|X|+2 ≤ |u|(+2)）实践中不可达——别名总比其内容短，
// 单字符内容又无法获得别名（memberField/stringLiterals 的收益门槛都不建），闸门仅作防御。

console.log('\n=== dot-alias reuse: ' + pass + ' pass, ' + fail + ' fail ===');
process.exit(fail ? 1 : 0);
