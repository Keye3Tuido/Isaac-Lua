require('../core.js');
const luamin = require('luamin');
const fs = require('fs');
const path = require('path');
const LuaMin = globalThis.LuaMin.create(require('luaparse'), require('fengari'));

function rc(s){ try{ const t=LuaMin._lex(s); const r=[]; for(let i=0;i<t.length;i++) if(t[i].type==='Comment') r.push({s:t[i].start,e:t[i].end}); if(!r.length) return s; let o=s; for(let i=r.length-1;i>=0;i--) o=o.slice(0,r[i].s)+o.slice(r[i].e); return o; }catch(e){return s;} }
function walk(dir,out){ for(const e of fs.readdirSync(dir,{withFileTypes:true})){ const p=path.join(dir,e.name); if(e.isDirectory()){ if(['.git','node_modules','spec','test','tests'].includes(e.name)) continue; walk(p,out);} else if(e.name.endsWith('.lua')) out.push(p);} return out; }

let files=[]; for(const f of fs.readdirSync('tests/_bulk_test_repos')){ const d=path.join('tests/_bulk_test_repos',f); if(fs.statSync(d).isDirectory()) walk(d,files);}
let inT=0, luaminT=0, ourT=0, n=0;
for(const p of files){ let s; try{s=fs.readFileSync(p,'utf8');}catch(e){continue;} if(s.length<10||s.includes('\0')||s.startsWith('#!')) continue; const c=rc(s); try{ const lm=luamin.minify(c); const our=LuaMin.compress(c); inT+=c.length; luaminT+=lm.length; ourT+=our.bodyLength; n++; }catch(e){} }
console.log('files:',n);
console.log('input:',inT);
console.log('luamin :',luaminT,'('+((inT-luaminT)/inT*100).toFixed(1)+'%)');
console.log('我们   :',ourT,'('+((inT-ourT)/inT*100).toFixed(1)+'%)');
console.log('我们相对 luamin 再省:',luaminT-ourT,'('+((luaminT-ourT)/luaminT*100).toFixed(1)+'%)');
