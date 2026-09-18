// 把构建期「默认参数替换后」的最终代码【逐块】压缩（每条代码单独测试，去注释后压缩），验证不崩、语义等价。
// 语料来自 scripts/export_segments.py（与站点/kb.json 同口径），不是仓库文件里的原始 l 行：
// 模板引用块在源文件里没有代码行，模板定义块的裸 Pn 占位也不是合法 Lua 语句。
const luaparse=require('../node_modules/luaparse');
const fengari=require('fengari');
require('../core.js');
const LuaMin=globalThis.LuaMin.create(luaparse, fengari);
const { loadRepoSegments } = require('./repo-lua-files');

const { removeComments } = require('./_helpers');

const segments=loadRepoSegments();   // { 仓库相对路径: [块代码, ...] }
const files=Object.keys(segments);
let segTotal=0, segOk=0, segReject=0, errs=[];
let bytesIn=0, bytesOut=0;

// 逐块测试
for(const f of files){
  segments[f].forEach((code,i)=>{
    const seg='l '+code;                 // 与站点/复制口径一致的单行段
    segTotal++;
    try{
      const r=LuaMin.compress(removeComments(LuaMin, seg)); // 测试前先去除注释
      const body=r.output.replace(/^l /,'');
      // 真·luaparse 复核
      luaparse.parse(body,{luaVersion:'5.3'});
      const cb=r.aliasMapInfo?LuaMin._canonical(body,r.aliasMapInfo):LuaMin._canonical(body);
      const eq=LuaMin._canonical(LuaMin._preprocess(seg))===cb;
      if(eq){segOk++; bytesIn+=r.original.length; bytesOut+=r.bodyLength;}
      else {segReject++; errs.push([f+'#'+i,'NOT-EQUIV',seg.slice(0,60)]);}
    }catch(e){
      segReject++; errs.push([f+'#'+i, e.message.slice(0,80), seg.slice(0,60)]);
    }
  });
}
console.log('文件数:',files.length);
console.log('[逐块] 段总数:',segTotal,' 成功:',segOk,' 失败/拒绝:',segReject);
console.log('成功段 正文总字符: 输入',bytesIn,'→ 输出',bytesOut,'(省 '+(bytesIn-bytesOut)+', '+Math.round((bytesIn-bytesOut)/bytesIn*100)+'%)');

if(errs.length){
  console.log('\n--- 失败/拒绝明细（前 30 条）---');
  errs.slice(0,30).forEach(e=>console.log(e[0],'|',e[1],'|',e[2]));
}
