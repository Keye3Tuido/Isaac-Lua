// 拉取 remote-sources.json 里列出的真实模组 main.lua，整文件压缩并做 SSA 等价校验。
// 首次联网拉取后缓存到 .remote-cache/（已 gitignore）；之后离线复用缓存。
// 用法:
//   node remotetest.js            # 有缓存用缓存，无缓存联网拉
//   node remotetest.js --refresh  # 强制重新联网拉取并刷新缓存
const fs=require('fs'), path=require('path');
const luaparse=require('../node_modules/luaparse');
const fengari=require('fengari');
require('../core.js');
const LuaMin=globalThis.LuaMin.create(luaparse, fengari);

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

const REFRESH=process.argv.includes('--refresh');
const cfg=JSON.parse(fs.readFileSync(path.join(__dirname,'remote-sources.json'),'utf8'));
const cacheDir=path.join(__dirname,'.remote-cache');
if(!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir,{recursive:true});

async function getSource(s){
  const cacheFile=path.join(cacheDir, s.name+'.lua');
  if(!REFRESH && fs.existsSync(cacheFile)) return fs.readFileSync(cacheFile,'utf8');
  const resp=await fetch(s.raw);
  if(!resp.ok) throw new Error('HTTP '+resp.status+' '+s.raw);
  const text=await resp.text();
  fs.writeFileSync(cacheFile, text);
  return text;
}

(async ()=>{
  let pass=0, fail=0; const fails=[];
  for(const s of cfg.sources){
    let src;
    try{ src=await getSource(s); }
    catch(e){ fail++; fails.push([s.name,'FETCH '+e.message]); console.log('✗',s.name,'拉取失败:',e.message); continue; }
    try{
      const r=LuaMin.compress(removeComments(src)); // 测试前先去除注释
      const body=r.output.replace(/^l /,'');
      luaparse.parse(body,{luaVersion:'5.3'});                 // 真·luaparse 复核
      const cb=r.aliasMapInfo?LuaMin._canonical(body,r.aliasMapInfo):LuaMin._canonical(body);
      const eq=LuaMin._canonical(LuaMin._preprocess(src))===cb; // SSA 等价
      if(eq){
        pass++;
        const ratio=((r.bodyLength+2)/src.length*100).toFixed(1);
        console.log('✓',s.name,'  '+src.length+' → '+(r.bodyLength+2)+'  ('+ratio+'%)');
      }else{
        fail++; fails.push([s.name,'NOT-EQUIV']); console.log('✗',s.name,'SSA 等价校验失败');
      }
    }catch(e){
      fail++; fails.push([s.name, e.message.slice(0,120)]); console.log('✗',s.name,'压缩/校验异常:',e.message.slice(0,120));
    }
  }
  console.log('\n=== 远程测试: '+pass+' 通过, '+fail+' 失败 (共 '+cfg.sources.length+') ===');
  if(fail){ process.exit(1); }
})();
