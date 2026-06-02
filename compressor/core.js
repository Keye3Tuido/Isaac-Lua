/* ===================================================================
 * LuaMin - 以撒控制台代码压缩器 核心库 (Lua 5.3)
 * 纯静态语义/语法分析驱动；不改变语义；浏览器与 Node 通用。
 *
 * 设计要点：
 *  - luaparse 不在 AST 保留括号，故【绝不】从 AST 反向生成代码，
 *    一切改写都在 token 流上做，仅依据 AST 的作用域信息。
 *  - 多阶段流水线，每阶段后都做 (a) 重新 parse 语法校验 (b) 规范化 AST 等价校验。
 *    任意校验失败 => 抛错（视为脚本 bug，拒绝输出）。
 *  - 多阈值策略：尝试 [2..9] 不同全局折叠预筛选阈值，取最短结果。
 *  - 搜索层（search.js）：在规则系统输出之上做候选探索（表达式提取、激进变量复用），
 *    canonical 等价验证兜底。无改善则回退 baseline。
 *
 * 结构（便于维护，按职责拆成 src/ 下的"安装器"模块）：
 *  - core.js（本文件）：词法器 + create() 工厂；create() 构造共享上下文 C，
 *    依序运行各模块安装器（把函数挂到 C 上），最后导出 API。
 *  - src/analyze.js   : parse / analyze（作用域解析）/ 全局名收集 / 候选名 / 成员访问收集
 *  - src/plan.js      : planAll（统一规划：重命名+全局/成员折叠+仿射因子+透明别名消解）/ buildDeclParts / affixCandidate / applyEdits
 *  - src/encode.js    : removeComments / minimizeSpacing（间隔符最小化+分号消除）/ applyEncoding
 *  - src/canonical.js : canonical（SSA 版本化归一 + 各等价归一）/ assert* 校验
 *  - src/folds.js     : preprocess + 各"只缩短才提交"折叠/复用/上提 pass
 *  - src/compress.js  : compress（流水线编排 + 多阈值取短）
 *  - src/search.js    : searchOptimize（搜索层：表达式提取 + 激进变量复用 + canonical 验证）
 *
 * 加载方式（无需构建步骤）：
 *  - 浏览器：index.html 依序 <script> 引入 src/analyze.js ... src/compress.js 再引入 core.js。
 *    各 part 自注册到 window.__LuaMinParts。
 *  - Node：core.js 在 create() 内 require 各 part（同样注册到 globalThis.__LuaMinParts）。
 * =================================================================== */
(function (root) {
  'use strict';

  var KEYWORDS = {
    'and':1,'break':1,'do':1,'else':1,'elseif':1,'end':1,'false':1,'for':1,
    'function':1,'goto':1,'if':1,'in':1,'local':1,'nil':1,'not':1,'or':1,
    'repeat':1,'return':1,'then':1,'true':1,'until':1,'while':1
  };

  // ---------- 1. 词法分析器（Lua 5.3） ----------
  // 产出 token: {type, value, start, end}
  // type: Name | Keyword | Number | String | Comment | Punct | Vararg | EOF
  function isDigit(c){return c>='0'&&c<='9';}
  function isHex(c){return isDigit(c)||(c>='a'&&c<='f')||(c>='A'&&c<='F');}
  function isNameStart(c){return c==='_'||(c>='a'&&c<='z')||(c>='A'&&c<='Z');}
  function isNamePart(c){return isNameStart(c)||isDigit(c);}
  function isSpace(c){return c===' '||c==='\t'||c==='\r'||c==='\n'||c==='\f'||c==='\v';}

  function LexError(msg, pos){var e=new Error(msg);e.luaminLex=true;e.pos=pos;return e;}

  // 读取长括号 [[ ]] / [==[ ]==] 内容，返回结束位置或 -1（非长括号）
  function longBracketLevel(src, i){
    // src[i] === '['
    var j=i+1, lvl=0;
    while(src[j]==='='){lvl++;j++;}
    if(src[j]==='[') return {level:lvl, contentStart:j+1};
    return null;
  }

  function lex(src){
    var tokens=[], i=0, n=src.length;
    while(i<n){
      var c=src[i];
      if(isSpace(c)){i++;continue;}
      var start=i;
      // 注释
      if(c==='-'&&src[i+1]==='-'){
        var k=i+2;
        if(src[k]==='['){
          var lb=longBracketLevel(src,k);
          if(lb){
            var close=']'+Array(lb.level+1).join('=')+']';
            var end=src.indexOf(close, lb.contentStart);
            if(end<0) throw LexError('未闭合的长注释', start);
            i=end+close.length;
            tokens.push({type:'Comment',value:src.slice(start,i),start:start,end:i});
            continue;
          }
        }
        // 行注释
        while(i<n&&src[i]!=='\n')i++;
        tokens.push({type:'Comment',value:src.slice(start,i),start:start,end:i});
        continue;
      }
      // 长字符串
      if(c==='['){
        var lb2=longBracketLevel(src,i);
        if(lb2){
          var close2=']'+Array(lb2.level+1).join('=')+']';
          var end2=src.indexOf(close2, lb2.contentStart);
          if(end2<0) throw LexError('未闭合的长字符串', start);
          i=end2+close2.length;
          tokens.push({type:'String',value:src.slice(start,i),start:start,end:i});
          continue;
        }
      }
      // 短字符串
      if(c==='"'||c==="'"){
        var q=c; i++;
        var closed=false;
        while(i<n){
          var ch=src[i];
          if(ch==='\\'){i+=2;continue;}
          if(ch==='\n') throw LexError('字符串内未转义换行', start);
          if(ch===q){i++;closed=true;break;}
          i++;
        }
        if(!closed) throw LexError('未闭合的字符串', start);
        tokens.push({type:'String',value:src.slice(start,i),start:start,end:i});
        continue;
      }
      // 数字
      if(isDigit(c)||(c==='.'&&isDigit(src[i+1]))){
        if(c==='0'&&(src[i+1]==='x'||src[i+1]==='X')){
          i+=2;
          while(i<n&&(isHex(src[i])||src[i]==='.'))i++;
          if(src[i]==='p'||src[i]==='P'){i++;if(src[i]==='+'||src[i]==='-')i++;while(i<n&&isDigit(src[i]))i++;}
        }else{
          while(i<n&&(isDigit(src[i])||src[i]==='.'))i++;
          if(src[i]==='e'||src[i]==='E'){i++;if(src[i]==='+'||src[i]==='-')i++;while(i<n&&isDigit(src[i]))i++;}
        }
        // Lua 词法：数字后若紧跟字母/下划线属"畸形数字"。这里把它们一并吞入，
        // 使诸如 168do 成为单一 token，从而 needSpace 能正确判定"数字↔标识符/关键字"必须留空格。
        while(i<n&&isNamePart(src[i]))i++;
        tokens.push({type:'Number',value:src.slice(start,i),start:start,end:i});
        continue;
      }
      // 名字/关键字
      if(isNameStart(c)){
        i++;
        while(i<n&&isNamePart(src[i]))i++;
        var w=src.slice(start,i);
        tokens.push({type:KEYWORDS[w]?'Keyword':'Name',value:w,start:start,end:i});
        continue;
      }
      // 运算符 / 标点（先长后短）
      var three=src.substr(i,3);
      if(three==='...'){tokens.push({type:'Vararg',value:'...',start:start,end:i+3});i+=3;continue;}
      var two=src.substr(i,2);
      if(two==='=='||two==='~='||two==='<='||two==='>='||two==='..'||two==='::'||two==='<<'||two==='>>'||two==='//'){
        tokens.push({type:'Punct',value:two,start:start,end:i+2});i+=2;continue;
      }
      if('+-*/%^#&~|<>=(){}[];:,.'.indexOf(c)>=0){
        tokens.push({type:'Punct',value:c,start:start,end:i+1});i+=1;continue;
      }
      throw LexError('无法识别的字符: '+JSON.stringify(c), start);
    }
    tokens.push({type:'EOF',value:'',start:n,end:n});
    return tokens;
  }

  // 判断 token a 与 b 直接相邻拼接是否会被重新词法化为不同结果（需要插入空格）
  function needSpace(aVal, bVal){
    if(aVal===''||bVal==='') return false;
    var merged=aVal+bVal;
    var toks;
    try{toks=lex(merged);}catch(e){return true;}
    // 期望恰好切出 aVal 然后 bVal（忽略 EOF）
    if(toks.length<2) return true;
    return !(toks[0].value===aVal && toks[0].end===aVal.length);
  }

  // ---------- 模块安装器加载 ----------
  // 各 src/*.js part 会把 {name, install} 推入 root.__LuaMinParts。
  // 浏览器侧由 index.html 的 <script> 预先加载；Node 侧在此 require。
  var PART_ORDER = ['analyze','plan','encode','canonical','folds','compress','search'];
  if(typeof module !== 'undefined' && module.exports){
    // Node：显式 require 各 part（它们自注册到 globalThis.__LuaMinParts）
    PART_ORDER.forEach(function(name){ require('./src/'+name+'.js'); });
  }

  /* ============================================================
   * 工厂：传入 luaparse 实例（必需）与 fengari 实例（可选，用于真·Lua 语法校验）
   * ============================================================ */
  function create(luaparse, fengari){
    if(!luaparse) throw new Error('LuaMin.create 需要 luaparse 实例');

    // 真·Lua 5.3 语法校验器（fengari）。返回 null 表示语法正确，否则返回错误串。
    // 这是与游戏内解释器一致的权威校验——能抓住 luaparse 宽容放过的"畸形数字"等。
    var luaValidate = null;
    if(fengari){
      var lua=fengari.lua, lauxlib=fengari.lauxlib, lualib=fengari.lualib, to_luastring=fengari.to_luastring;
      luaValidate = function(code){
        var L=lauxlib.luaL_newstate();
        lualib.luaL_openlibs(L);
        var status=lauxlib.luaL_loadstring(L, to_luastring(code));
        if(status===lua.LUA_OK){ return null; }
        var err=lua.lua_tojsstring(L,-1);
        lua.lua_pop(L,1);
        return err||'未知语法错误';
      };
    }

    // 共享上下文：词法器与配置项先放入，随后各安装器把自己的函数挂上来。
    var C = {
      KEYWORDS: KEYWORDS,
      lex: lex,
      needSpace: needSpace,
      isDigit: isDigit,
      isHex: isHex,
      isNameStart: isNameStart,
      isNamePart: isNamePart,
      isSpace: isSpace,
      luaValidate: luaValidate,
      luaparse: luaparse,
      fengari: fengari
    };

    var parts = root.__LuaMinParts || [];
    var byName = {};
    parts.forEach(function(p){ byName[p.name]=p; });
    PART_ORDER.forEach(function(name){
      var p = byName[name];
      if(!p) throw new Error('LuaMin: 缺少模块 '+name+'（src/'+name+'.js 未加载）');
      p.install(C);
    });

    return {
      compress: C.compress,
      searchOptimize: C.searchOptimize,
      // 以下下划线成员仅供测试/调试使用
      _parse: C.parse,
      _analyze: C.analyze,
      _canonical: C.canonical,
      _preprocess: C.preprocess,
      _lex: lex,
      _needSpace: needSpace,
      _planAll: C.planAll,
      _applyEdits: C.applyEdits,
      _collectGlobalNames: C.collectGlobalNames
    };
  }

  root.LuaMin = { create: create, lex: lex, needSpace: needSpace, KEYWORDS: KEYWORDS };

})(typeof window !== 'undefined' ? window : globalThis);
