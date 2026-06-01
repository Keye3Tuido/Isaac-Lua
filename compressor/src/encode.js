/* LuaMin part: encode — 由 _refactor_split.js 从 core.js 抽取，函数体逐字保留 */
(function(root){
  'use strict';
  (root.__LuaMinParts = root.__LuaMinParts || []).push({name:'encode', install:function(C){
    var lex=C.lex, needSpace=C.needSpace;
    function removeComments(src){
      var allToks=lex(src);
      var commentRanges=[];
      for(var i=0;i<allToks.length;i++){
        if(allToks[i].type==='Comment'){
          commentRanges.push({start:allToks[i].start, end:allToks[i].end});
        }
      }
      if(commentRanges.length===0) return src;
      // 从后往前删除注释，避免位置偏移
      var out=src;
      for(var i=commentRanges.length-1;i>=0;i--){
        var r=commentRanges[i];
        out=out.slice(0,r.start)+out.slice(r.end);
      }
      return out;
    }

    // 6.2 间隔符最小化 + 单行
    function minimizeSpacing(src){
      var toks=lex(src).filter(function(t){return t.type!=='EOF';});
      // 语句分隔 ';' 在 Lua 里几乎总是可省。两类【不可省】场景必须保留：
      //   (1) 载荷分号：其后跟 '(' —— 省掉会让前一语句把 '(...)' 当作调用续接
      //       （`a=b;(f)()` ≠ `a=b(f)()`）。
      //   (2) 表构造器内的 ';' 是【字段分隔符】（`{a;b}` ≡ `{a,b}`），不是语句分隔，删除会破坏表。
      //       这里通过括号配对深度判定：仅当 ';' 处于"表构造器 { } 内层"时保留。
      // 其余（真正的语句分隔 ';'）一律删除；删除后相邻 token 由 needSpace 自然补空格。
      //
      // 深度跟踪：维护一个括号栈，区分 '{'（表构造器）与 '(' '['。';' 只有在最近未闭合的
      // 括号是 '{' 时才算"表内字段分隔符"。注意：表内也可能嵌函数体 `{f=function()a;b end}`，
      // 此时 ';' 在函数体里是语句分隔——但函数体由 'function'...'end' 包裹而非括号，
      // 栈顶仍是 '{'，会误判为保留。为绝对安全，表内 ';' 一律保留（保留不影响正确性，
      // 仅放弃表内那一处节省，极少见且收益微小）。
      var stack=[];   // 记录未闭合的 '(' '[' '{'
      var kept=[];
      for(var ti=0;ti<toks.length;ti++){
        var tk=toks[ti];
        if(tk.type==='Punct'){
          if(tk.value==='('||tk.value==='['||tk.value==='{'){ stack.push(tk.value); kept.push(tk); continue; }
          if(tk.value===')'||tk.value===']'||tk.value==='}'){ if(stack.length) stack.pop(); kept.push(tk); continue; }
          if(tk.value===';'){
            var inTable = stack.length>0 && stack[stack.length-1]==='{';
            if(inTable){ kept.push(tk); continue; }       // 表内字段分隔符：保留
            // 语句分隔 ';'：仅当其后是 '(' 才保留（载荷），否则删除
            var nj=ti+1;
            while(nj<toks.length && toks[nj].type==='Punct' && toks[nj].value===';') nj++;
            var nextTok=(nj<toks.length)?toks[nj]:null;
            if(nextTok && nextTok.value==='('){ kept.push(tk); }   // 载荷分号：保留
            // 否则丢弃
            continue;
          }
        }
        kept.push(tk);
      }
      toks=kept;
      var out='';
      var prev=null;
      for(var i=0;i<toks.length;i++){
        var t=toks[i];
        if(prev!==null && needSpace(prev.value, t.value)) out+=' ';
        out+=t.value;
        prev=t;
      }
      return out;
    }

    // 旧的 applyEncoding（去注释 + 间隔符最小化 + 单行）- 保留用于向后兼容
    function applyEncoding(src){
      var toks=lex(src).filter(function(t){return t.type!=='Comment'&&t.type!=='EOF';});
      var out='';
      var prev=null;
      for(var i=0;i<toks.length;i++){
        var t=toks[i];
        if(prev!==null && needSpace(prev.value, t.value)) out+=' ';
        out+=t.value;
        prev=t;
      }
      return out;
    }

    C.removeComments=removeComments; C.minimizeSpacing=minimizeSpacing; C.applyEncoding=applyEncoding;
  }});
})(typeof window !== 'undefined' ? window : globalThis);
