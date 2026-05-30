// 把仓库里真实的 l 段抽出来逐段压缩 + 按文件合并全段压缩，验证不崩、语义等价
const fs=require('fs'), path=require('path');
const luaparse=require('../node_modules/luaparse');
const fengari=require('fengari');
require('../core.js');
const LuaMin=globalThis.LuaMin.create(luaparse, fengari);

const dir=path.join(__dirname,'../..');
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.lua'));
let segTotal=0, segOk=0, segReject=0, errs=[];
let bytesIn=0, bytesOut=0;

// 逐段测试
for(const f of files){
  let text;
  try{ text=fs.readFileSync(path.join(dir,f),'utf8'); }catch(e){ continue; }
  const lines=text.split(/\r?\n/);
  for(const line of lines){
    if(!/^l\s/.test(line)) continue;       // 只取 l 段
    const seg=line;                         // 单行单段
    segTotal++;
    try{
      const r=LuaMin.compress(seg);
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

// 按文件合并所有 l 段一起压缩（模拟用户全选粘贴的真实场景）
let fileTotal=0, fileOk=0, fileReject=0, fileErrs=[];
for(const f of files){
  let text;
  try{ text=fs.readFileSync(path.join(dir,f),'utf8'); }catch(e){ continue; }
  const lines=text.split(/\r?\n/);
  const segs=[];
  for(const line of lines){
    if(/^l\s/.test(line)) segs.push(line);
  }
  if(!segs.length) continue;
  fileTotal++;
  const merged=segs.join('\n');
  try{
    const r=LuaMin.compress(merged);
    const body=r.output.replace(/^l /,'');
    luaparse.parse(body,{luaVersion:'5.3'});
    const cb=r.aliasMapInfo?LuaMin._canonical(body,r.aliasMapInfo):LuaMin._canonical(body);
    const eq=LuaMin._canonical(LuaMin._preprocess(merged))===cb;
    if(eq){fileOk++;}
    else {fileReject++; fileErrs.push([f,'NOT-EQUIV',merged.slice(0,60)]);}
  }catch(e){
    fileReject++; fileErrs.push([f, e.message.slice(0,80), merged.slice(0,60)]);
  }
}
console.log('\n[合并] 有 l 段的文件数:',fileTotal,' 成功:',fileOk,' 失败/拒绝:',fileReject);

if(errs.length || fileErrs.length){
  console.log('\n--- 失败/拒绝明细（前 30 条）---');
  errs.concat(fileErrs).slice(0,30).forEach(e=>console.log(e[0],'|',e[1],'|',e[2]));
}
