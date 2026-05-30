const luaparse = require('./node_modules/luaparse');
const fengari = require('fengari');
require('./core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

let pass=0, fail=0;
function ok(name, cond, extra){ if(cond){pass++; /*console.log('  ok',name)*/} else {fail++; console.log('FAIL:',name, extra||'');} }

// 等价性：用编译器返回的真实别名映射（aliasMapInfo）做还原比较，避免从文本猜测
function semEq(orig, body, aliasMapInfo){
  try{
    const ca=LuaMin._canonical(orig);
    const cb=aliasMapInfo ? LuaMin._canonical(body, aliasMapInfo) : LuaMin._canonical(body);
    return ca===cb;
  }catch(e){ return 'ERR '+e.message; }
}

function tryCompress(name, src){
  try{
    const r=LuaMin.compress(src);
    // 输出必须以 'l ' 开头
    ok(name+'/prefix', r.output.slice(0,2)==='l ', r.output.slice(0,10));
    // 单行：换行只允许出现在字符串字面量内部（长字符串语义换行不可删）
    var nlOutsideString=false;
    (function(){
      var tks=LuaMin._lex(r.output.replace(/^l /,''));
      var bodyStr=r.output.replace(/^l /,'');
      // 重建：检查非 String token 之间的拼接是否含换行——核心只 join token 值，
      // 故任何换行必来自 String token 内部。直接断言：去掉所有 String token 文本后无换行。
      var cleaned=bodyStr;
      tks.forEach(function(t){ if(t.type==='String'){cleaned=cleaned.replace(t.value,'');} });
      nlOutsideString = cleaned.indexOf('\n')>=0;
    })();
    ok(name+'/oneline', !nlOutsideString, 'newline outside string');
    // 输出去掉 l 前缀后应与原(去前缀)等价（用编译器返回的真实别名映射做还原）
    const body=r.output.replace(/^l /,'');
    const orig=LuaMin._preprocess(src);
    ok(name+'/equiv', semEq(orig, body, r.aliasMapInfo)===true, semEq(orig,body,r.aliasMapInfo));
    return r;
  }catch(e){
    ok(name+'/no-throw', false, e.message);
    return null;
  }
}

// ---- 基础用例 ----
const cases = {
  simple: "local apple = 1\nlocal banana = 2\nreturn apple + banana",
  forloop: "for index = 1, 10 do\n  print(index)\nend",
  generic: "for key, value in pairs(someTable) do\n  print(key, value)\nend",
  nested: "local function outer(x)\n  local function inner(y) return x + y end\n  return inner(1)\nend",
  shadow: "local v = 1\ndo local v = 2 print(v) end\nreturn v",
  globalsafe: "local Game = 1\nreturn Isaac",  // 不能把局部改成 Isaac
  method: "local p = obj\np:Method(1, 2)\nx['Get' .. suffix](x)",
  table: "local t = { keyName = 1, [exprKey] = 2, valOnly }\nreturn t",
  strings: "local s = 'hello'\nlocal m = [[multi\nline]]\nreturn s",
  numbers: "local a = 1e3\nlocal b = 0xFF\nlocal c = 1 << 37 & ~4\nreturn a+b+c",
  spaces: "if a and b() then return 0 end",
  concatkw: "local x = a .. b return x",   // ..b 与 return 边界
  comment: "-- this is a comment\nlocal value = 1 -- trailing\nreturn value",
};

Object.keys(cases).forEach(k=>tryCompress(k, cases[k]));

// ---- 前缀处理 ----
(function(){
  const r=tryCompress('prefix-l', "l local x = 1\nl return x");
  if(r) ok('prefix-l/stripped', r.output==='l local x=1 return x', JSON.stringify(r.output));
  const r2=tryCompress('prefix-lua', "lua local y = 2\nlua return y");
  if(r2) ok('prefix-lua/stripped', /^l local y=2 return y$/.test(r2.output), r2.output);
})();

// ---- 全局保护：局部不应被改名为某个被引用的全局名 ----
(function(){
  const src="local longName=1\nlocal another=2\nreturn longName+another+Isaac+Game";
  const r=tryCompress('globalclash', src);
  if(r){
    const body=r.output.replace(/^l /,'');
    // 全局 Isaac, Game 必须原样存在
    ok('globalclash/Isaac', /\bIsaac\b/.test(body), body);
    ok('globalclash/Game', /\bGame\b/.test(body), body);
  }
})();

// ---- 语法错误必须被拒绝 ----
function expectReject(name, src){
  try{ LuaMin.compress(src); ok(name, false, '应当报错却通过'); }
  catch(e){ ok(name, true); }
}
expectReject('bad1', "local x = ");
expectReject('bad2', "if then end");
expectReject('bad3', "return )(");
expectReject('empty', "   \n  ");

// ---- 真实片段（来自仓库，去 l 前缀后的单段）----
const real1 = "local I,Z,F,P=Isaac,Vector.Zero,Isaac.AddCallback,'Position'F({},2,function()for i=0,Game():GetNumPlayers()-1 do local p,d,b=I.GetPlayer(i)d=p.ControllerIndex if Input.IsActionTriggered(8,d)and not p:IsHoldingItem()then if p:GetNumGigaBombs()>0 then b=I.Spawn(4,17,0,p[P],Z,p):ToBomb()p:AddGigaBombs(-1)else b=p:FireBomb(p[P],Z)end b.Flags=p:GetBombFlags()p:TryHoldEntity(b)end end end)F({},13,function(_,e,_,a)if e and e:ToPlayer()and a==8 then return false end end,1)";
tryCompress('real-diaolei', real1);

const real2 = "local A=Isaac.AddCallback A({},8,function(_,p)p.TearFlags=p.TearFlags|7 end,32)A({},18,function()Isaac.ExecuteCommand('spawn 5.100.628')end)";
tryCompress('real-lanzui', real2);

const real3 = "Isaac.AddCallback({},31,function(c,p,n)if 40~=p:GetPlayerType()and not p:HasCurseMistEffect()then for _,i in pairs({590,{649,3}})do c,n=table.unpack(type(i)=='table'and i or{i,1})while n>p:GetCollectibleNum(c)do p:AddCollectible(c,Isaac.GetItemConfig():GetCollectible(c).InitCharge)end Game():GetItemPool():RemoveCollectible(c)end end end)";
tryCompress('real-item', real3);

// ---- 多返回值括号语义保护：f(g()) vs f((g())) 必须区分 ----
(function(){
  // 等价校验是否会错误地认为这两者相同？它们语义不同，canonical 也应不同
  const a="local x=f(g())";
  const b="local x=f((g()))";
  // 注意 luaparse 不保留括号，所以 canonical 会认为相同 —— 这是已知限制
  // 我们只需保证“压缩器不会主动制造这种差异”。压缩 a 应仍等于 a。
  const r=tryCompress('multiret', a);
  if(r){ const body=r.output.replace(/^l /,''); ok('multiret/keepsParens', body.indexOf('g()')>=0, body); }
})();

console.log('\n=== 测试结果: '+pass+' 通过, '+fail+' 失败 ===');
process.exit(fail?1:0);
