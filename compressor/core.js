/* ===================================================================
 * LuaMin - 以撒控制台代码压缩器 词法基础库 (Lua 5.3)
 * 纯静态语义/语法分析驱动；不改变语义；浏览器与 Node 通用。
 *
 * 本文件是 v2 透镜架构（src2/）的公共词法基础：
 *  - Lua 5.3 词法器（token 流是一切改写与成本判定的底座；luaparse 不在 AST
 *    保留括号，故一切改写都在 token 流上做，仅依据 AST 的作用域信息）；
 *  - 粘连/引号等廉价字符级安全判定（needSpace 是全 token 级精确判定）；
 *  - create(luaparse, fengari) 构造共享词法上下文（含 fengari 真·Lua 语法校验器）。
 *
 * 上层语义/等价/编码助手（parse/analyze/canonical/encode/preprocess 等）由
 * src2/shared/ 各安装器模块提供，经 src2/base.js 聚合成统一门面。
 *
 * 加载方式（无需构建步骤）：
 *  - 浏览器：index.html 依序 <script> 引入 core.js、src2/shared/*.js、src2/base.js，
 *    再引入 src2 其余模块。
 *  - Node：src2/base.js 在 create() 内 require 本文件。
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

  // ---- 热路径上的廉价字符级安全判定（needSpace 是全 token 级精确判定、需重词法）----
  // 短字符串还原：raw 为 '...'/"..." 形态时返回内容，否则（长字符串/缺 raw）返回 null。
  // 长字符串 [[...]] 在 Lua 里不处理转义，与短字符串内容含义不同，刻意排除。
  function unquoteShort(raw){
    if(typeof raw!=='string'||raw.length<2) return null;
    var q=raw[0];
    if(q!=="'"&&q!=='"') return null;
    return raw.slice(1,-1);
  }
  // 内容能否安全回填进单引号字面量：不含 ' \ 与换行（含这些字符回填会非法/变义）。
  function canSingleQuote(s){
    return s.indexOf("'")<0 && s.indexOf('\\')<0 && s.indexOf('\n')<0 && s.indexOf('\r')<0;
  }
  // 粘连守卫（右向）：把「以 lastCh 收尾」的文本插到 nextCh 之前，二者直接相邻是否会被
  // 误并为一个 token。规则：nextCh 是名字字符（字母/数字/下划线）则粘连；或 lastCh 是
  // 数字且 nextCh 是 '.'（内联 1 后紧跟 .x → 拼成 1.x，真·Lua 判畸形数字）。
  // 近似方向必须保守：多给空格无害（编码层 minimizeSpacing 会收回），漏给才出错。
  function needsSepAfter(lastCh, nextCh){
    if(!nextCh) return false;
    return isNamePart(nextCh) || (nextCh==='.' && isDigit(lastCh));
  }

  /* ============================================================
   * 工厂：传入 luaparse 实例（必需）与 fengari 实例（可选，用于真·Lua 语法校验），
   * 返回共享词法上下文。语义/等价/编码助手见 src2/base.js。
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

    return {
      KEYWORDS: KEYWORDS,
      lex: lex,
      needSpace: needSpace,
      isDigit: isDigit,
      isHex: isHex,
      isNameStart: isNameStart,
      isNamePart: isNamePart,
      isSpace: isSpace,
      unquoteShort: unquoteShort,
      canSingleQuote: canSingleQuote,
      needsSepAfter: needsSepAfter,
      luaValidate: luaValidate,
      luaparse: luaparse,
      fengari: fengari
    };
  }

  root.LuaMin = { create: create, lex: lex, needSpace: needSpace, KEYWORDS: KEYWORDS };

})(typeof window !== 'undefined' ? window : globalThis);
