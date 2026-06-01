// Compression baseline snapshot tool.
// Compresses every available Lua input across all corpora and records, per input:
//   key, inputLen, ok, outputLen, sha256(output).
// Writes a deterministic JSON to tests/_snapshot.json. Run before & after refactor;
// compare with `node tests/snapshot.js --check` to ensure NO compression regression
// (output must be byte-identical, or at least not longer).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const luaparse = require('../node_modules/luaparse');
const fengari = require('fengari');
require('../core.js');
const L = globalThis.LuaMin.create(luaparse, fengari);

function removeComments(src){
  try{
    const t=L._lex(src); const cr=[];
    for(let i=0;i<t.length;i++) if(t[i].type==='Comment') cr.push({start:t[i].start,end:t[i].end});
    if(!cr.length) return src;
    let o=src; for(let i=cr.length-1;i>=0;i--) o=o.slice(0,cr[i].start)+o.slice(cr[i].end);
    return o;
  }catch(e){ return src; }
}
function sha(s){ return crypto.createHash('sha256').update(s,'utf8').digest('hex').slice(0,16); }

const ROOT = path.join(__dirname, '..', '..');           // Isaac-Lua repo root
const REMOTE = path.join(__dirname, '.remote-cache');
const BULK = path.join(__dirname, '_bulk_test_repos');

function walkLua(dir, relBase, acc){
  if(!fs.existsSync(dir)) return acc;
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,e.name);
    if(e.isDirectory()){
      if(['.git','node_modules','spec','test','tests','_bulk_test_repos','.remote-cache'].includes(e.name)) continue;
      walkLua(full, relBase, acc);
    } else if(e.name.endsWith('.lua')){
      acc.push({full, rel: path.relative(relBase, full).replace(/\\/g,'/')});
    }
  }
  return acc;
}

// extract leading-l segments from a repo file (mirrors realtest)
function extractSegments(raw){
  const lines = raw.replace(/\r\n?/g,'\n').split('\n');
  const segs=[];
  for(const ln of lines){ if(/^[ \t]*(?:lua|l)[ \t]+\S/.test(ln)) segs.push(ln); }
  return segs;
}

const snap = {};   // key -> {inputLen, ok, outLen, sha}
function record(key, input){
  let r;
  try{ r = L.compress(input); }
  catch(e){ snap[key] = {inputLen: input.length, ok:false, err:String(e.message||e).slice(0,80)}; return; }
  snap[key] = {inputLen: input.length, ok:true, outLen: r.output.length, sha: sha(r.output)};
}

// 1. Hand-written unit cases (the targeted ones we care about most).
const UNIT = {
  'unit:multi_callback': [
    "l Isaac.AddCallback({},ModCallbacks.XXX,func,arg)",
    "l local A,M=Isaac.AddCallback,ModCallbacks;A({},M.XXX,func,arg)",
    "l local A,M,T=Isaac.AddCallback,ModCallbacks,{}A(T,M.XXX,func,arg)",
    "l local M,A=ModCallbacks,function(...)Isaac.AddCallback({},...)end;A(M.XXX,func,arg)"
  ].join('\n'),
  'unit:callback_pattern': [
    "l local A,M=Isaac.AddCallback,ModCallbacks A({},M.MC_POST_UPDATE,func1)",
    "l local A,M=Isaac.AddCallback,ModCallbacks A({},M.MC_POST_RENDER,func2)",
    "l local A,M=Isaac.AddCallback,ModCallbacks A({},M.MC_POST_NEW_ROOM,func3)"
  ].join('\n'),
  'unit:field_repeat': "l local a,b=Isaac,ModCallbacks a.AddCallback({},b.XXX,f)a.AddCallback({},b.XXX,g)a.AddCallback({},b.XXX,h)",
  'unit:single_alias': "l local M=ModCallbacks A({},M.MC_POST_UPDATE,func1)A({},M.MC_POST_RENDER,func2)A({},M.MC_POST_NEW_ROOM,func3)"
};
for(const k in UNIT) record(k, UNIT[k]);

// 2. Repo .lua files: per-segment + per-file merged (mirrors realtest corpus).
const repoFiles = walkLua(ROOT, ROOT, []).filter(f=>!f.rel.startsWith('compressor/'));
for(const f of repoFiles){
  let raw; try{ raw=fs.readFileSync(f.full,'utf8'); }catch(e){ continue; }
  const segs = extractSegments(raw);
  segs.forEach((seg,i)=>{ record('repo-seg:'+f.rel+'#'+i, removeComments(seg)); });
  if(segs.length){ record('repo-merged:'+f.rel, removeComments(segs.join('\n'))); }
}

// 3. Remote cache whole files.
walkLua(REMOTE, REMOTE, []).forEach(f=>{
  let raw; try{ raw=fs.readFileSync(f.full,'utf8'); }catch(e){ return; }
  record('remote:'+f.rel, removeComments(raw));
});

// 4. Bulk repos whole files (the big corpus).
const bulkOverride = { zerobrane: 'lualibs' };
if(fs.existsSync(BULK)){
  for(const name of fs.readdirSync(BULK)){
    const dir=path.join(BULK,name); if(!fs.statSync(dir).isDirectory()) continue;
    const luaDir = bulkOverride[name]?path.join(dir,bulkOverride[name]):dir;
    walkLua(luaDir, dir, []).forEach(f=>{
      let raw; try{ raw=fs.readFileSync(f.full,'utf8'); }catch(e){ return; }
      if(raw.length<10||raw.includes('\0')||raw.startsWith('#!')) return;
      record('bulk:'+name+'/'+f.rel, removeComments(raw));
    });
  }
}

const OUT = path.join(__dirname, '_snapshot.json');

if(process.argv.includes('--check')){
  if(!fs.existsSync(OUT)){ console.error('No baseline snapshot to check against. Run without --check first.'); process.exit(2); }
  const base = JSON.parse(fs.readFileSync(OUT,'utf8'));
  let regressions=0, improvements=0, changed=0, newOk=0, lostOk=0, total=0;
  const keys = new Set([...Object.keys(base), ...Object.keys(snap)]);
  const details=[];
  for(const k of keys){
    total++;
    const b=base[k], n=snap[k];
    if(!b||!n) continue;
    if(b.ok && !n.ok){ lostOk++; details.push('LOST-OK   '+k+'  ('+b.outLen+' -> THREW: '+(n.err||'')+')'); continue; }
    if(!b.ok && n.ok){ newOk++; details.push('NEW-OK    '+k+'  (was err -> '+n.outLen+')'); continue; }
    if(!b.ok && !n.ok) continue;
    if(n.sha!==b.sha){
      changed++;
      if(n.outLen>b.outLen){ regressions++; details.push('REGRESS   '+k+'  '+b.outLen+' -> '+n.outLen+'  (+'+(n.outLen-b.outLen)+')'); }
      else if(n.outLen<b.outLen){ improvements++; details.push('IMPROVE   '+k+'  '+b.outLen+' -> '+n.outLen+'  ('+(n.outLen-b.outLen)+')'); }
      else { details.push('REWORDED  '+k+'  same len '+b.outLen+' different bytes'); }
    }
  }
  details.sort();
  details.forEach(d=>console.log(d));
  console.log('\n=== CHECK: total '+total+' | changed '+changed+' | regress '+regressions+' | improve '+improvements+' | lost-ok '+lostOk+' | new-ok '+newOk+' ===');
  if(regressions>0 || lostOk>0){ console.log('RESULT: FAIL (compression got worse or a case stopped compiling)'); process.exit(1); }
  console.log('RESULT: OK (no regression; refactor preserved or improved all outputs)');
  process.exit(0);
}else{
  fs.writeFileSync(OUT, JSON.stringify(snap,null,0));
  let okN=0, errN=0, totalIn=0, totalOut=0;
  for(const k in snap){ if(snap[k].ok){ okN++; totalIn+=snap[k].inputLen; totalOut+=snap[k].outLen; } else errN++; }
  console.log('Snapshot written: '+OUT);
  console.log('cases: '+Object.keys(snap).length+' | ok '+okN+' | err '+errN);
  console.log('total input bytes '+totalIn+' -> output bytes '+totalOut+' (saved '+(totalIn-totalOut)+')');
}
