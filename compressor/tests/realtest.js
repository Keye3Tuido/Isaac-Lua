// 把仓库里真实的 l 段抽出来【逐段】压缩（每条代码单独测试，去注释后压缩），验证不崩、语义等价
const fs=require('fs'), path=require('path');
const luaparse=require('../node_modules/luaparse');
const fengari=require('fengari');
require('../core.js');
const LuaMin=globalThis.LuaMin.create(luaparse, fengari);
const { listRepoLuaFiles } = require('./repo-lua-files');

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

const files=listRepoLuaFiles();
let segTotal=0, segOk=0, segReject=0, errs=[];
let bytesIn=0, bytesOut=0;

// 逐段测试
for(const file of files){
  const f=file.rel;
  let text;
  try{ text=fs.readFileSync(file.abs,'utf8'); }catch(e){ continue; }
  const lines=text.split(/\r?\n/);
  for(const line of lines){
    if(!/^l\s/.test(line)) continue;       // 只取 l 段
    const seg=line;                         // 单行单段
    segTotal++;
    try{
      const r=LuaMin.compress(removeComments(seg)); // 测试前先去除注释
      const body=r.output.replace(/^l /,'');
      // 真·luaparse 复核
      luaparse.parse(body,{luaVersion:'5.3'});
      const cb=r.aliasMapInfo?LuaMin._canonical(body,r.aliasMapInfo):LuaMin._canonical(body);
      const eq=LuaMin._canonical(LuaMin._preprocess(seg))===cb;
      if(eq){segOk++; bytesIn+=r.original.length; bytesOut+=r.bodyLength;}
      else {segReject++; errs.push([f,'NOT-EQUIV',seg.slice(0,60)]);}
    }catch(e){
      segReject++; errs.push([f, e.message.slice(0,80), seg.slice(0,60)]);
    }
  }
}
console.log('文件数:',files.length);
console.log('[逐段] l 段总数:',segTotal,' 成功:',segOk,' 失败/拒绝:',segReject);
console.log('成功段 正文总字符: 输入',bytesIn,'→ 输出',bytesOut,'(省 '+(bytesIn-bytesOut)+', '+Math.round((bytesIn-bytesOut)/bytesIn*100)+'%)');

if(errs.length){
  console.log('\n--- 失败/拒绝明细（前 30 条）---');
  errs.slice(0,30).forEach(e=>console.log(e[0],'|',e[1],'|',e[2]));
}
