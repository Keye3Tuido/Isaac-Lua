// tests2/snapshot_v2.js — v2 自身压缩基线（M6 收口落盘，M7 起的新回归门）
// 与 tests2/_snapshot.json（v1 历史基线）同格式同语料枚举（964 条：unit + repo-seg + remote + bulk），
// 记录 v2 每条输出的 {inputLen, ok, outLen, sha} 到 tests2/_baseline_v2.json。
// 用法：
//   node tests2/snapshot_v2.js           录制/重锚基线（全量，bulk 大文件分钟级）
//   node tests2/snapshot_v2.js --check   回归校验：当前 v2 对基线，变长/拒压即失败
// 注意：tests2/_snapshot.json 是【v1 历史基线】（snapshot_compare 的户主规则参照物），
// 永不以 v2 数据覆盖；本文件维护的是 v2 自己的基线。
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const luaparse = require('../node_modules/luaparse');
const fengari = require('fengari');
const L1 = require('../src2/base.js').create({ luaparse, fengari });
const LuaMin2 = require('../src2/core2.js');
const L2 = LuaMin2.create({ luaparse, fengari });

const { removeComments } = require('./_helpers');
const { loadRepoSegments } = require('./repo-lua-files');
function sha(s){ return crypto.createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16); }

const REMOTE = path.join(__dirname, '.remote-cache');
const BULK = path.join(__dirname, '_bulk_test_repos');
const OUT = path.join(__dirname, '_baseline_v2.json');

function walkLua(dir, relBase, acc){
  if(!fs.existsSync(dir)) return acc;
  for(const e of fs.readdirSync(dir, { withFileTypes: true })){
    const full = path.join(dir, e.name);
    if(e.isDirectory()){
      if(['.git','node_modules','spec','test','tests','_bulk_test_repos','.remote-cache'].includes(e.name)) continue;
      walkLua(full, relBase, acc);
    }else if(e.name.endsWith('.lua')){
      acc.push({ full, rel: path.relative(relBase, full).replace(/\\/g, '/') });
    }
  }
  return acc;
}

const snap = {};
function record(key, input){
  let r;
  try{ r = L2.compress(input); }
  catch(e){ snap[key] = { inputLen: input.length, ok: false, err: String(e.message || e).slice(0, 80) }; return; }
  snap[key] = { inputLen: input.length, ok: true, outLen: r.output.length, sha: sha(r.output) };
}

// 1. unit 用例（与 v1 snapshot.js 逐字一致）
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

// 2. repo 段（构建期默认参数替换后的最终代码，去注释）
const repoSegs = loadRepoSegments();
for(const rel of Object.keys(repoSegs)){
  repoSegs[rel].forEach(function(code, i){ record('repo-seg:' + rel + '#' + i, removeComments(L1, 'l ' + code)); });
}

// 3. remote 整文件
walkLua(REMOTE, REMOTE, []).forEach(function(f){
  let raw; try{ raw = fs.readFileSync(f.full, 'utf8'); }catch(e){ return; }
  record('remote:' + f.rel, removeComments(L1, raw));
});

// 4. bulk 整文件
const bulkOverride = { zerobrane: 'lualibs' };
if(fs.existsSync(BULK)){
  for(const name of fs.readdirSync(BULK)){
    const dir = path.join(BULK, name); if(!fs.statSync(dir).isDirectory()) continue;
    const luaDir = bulkOverride[name] ? path.join(dir, bulkOverride[name]) : dir;
    walkLua(luaDir, dir, []).forEach(function(f){
      let raw; try{ raw = fs.readFileSync(f.full, 'utf8'); }catch(e){ return; }
      if(raw.length < 10 || raw.includes('\0') || raw.startsWith('#!')) return;
      record('bulk:' + name + '/' + f.rel, removeComments(L1, raw));
    });
  }
}

if(process.argv.includes('--check')){
  if(!fs.existsSync(OUT)){ console.error('无 v2 基线。先运行 node tests2/snapshot_v2.js 录制。'); process.exit(2); }
  const base = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  let regressions = 0, improvements = 0, changed = 0, newOk = 0, lostOk = 0, removed = 0, total = 0;
  const details = [];
  const keys = new Set([...Object.keys(base), ...Object.keys(snap)]);
  for(const k of keys){
    total++;
    const b = base[k], n = snap[k];
    if(!b && n){ if(n.ok){ newOk++; details.push('NEW-OK    ' + k); } continue; }
    if(b && !n){ removed++; details.push('REMOVED   ' + k); continue; }
    if(b.ok && !n.ok){ lostOk++; details.push('LOST-OK   ' + k + '  (THREW: ' + (n.err || '') + ')'); continue; }
    if(!b.ok && n.ok){ newOk++; details.push('NEW-OK    ' + k); continue; }
    if(!b.ok && !n.ok) continue;
    if(b.inputLen !== n.inputLen){ changed++; details.push('SOURCE    ' + k + '  input 变了（' + b.inputLen + ' -> ' + n.inputLen + '）'); continue; }
    if(n.sha !== b.sha){
      changed++;
      if(n.outLen > b.outLen){ regressions++; details.push('REGRESS   ' + k + '  ' + b.outLen + ' -> ' + n.outLen + '  (+' + (n.outLen - b.outLen) + ')'); }
      else if(n.outLen < b.outLen){ improvements++; details.push('IMPROVE   ' + k + '  ' + b.outLen + ' -> ' + n.outLen + '  (' + (n.outLen - b.outLen) + ')'); }
    }
  }
  details.sort();
  details.forEach(function(d){ console.log(d); });
  console.log('\n=== v2 基线 CHECK: total ' + total + ' | changed ' + changed + ' | regress ' + regressions
              + ' | improve ' + improvements + ' | lost-ok ' + lostOk + ' | new-ok ' + newOk + ' | removed ' + removed + ' ===');
  if(regressions > 0 || lostOk > 0){ console.log('RESULT: FAIL（v2 出现变长或拒压）'); process.exit(1); }
  console.log('RESULT: OK（v2 无回退）');
  process.exit(0);
}else{
  fs.writeFileSync(OUT, JSON.stringify(snap, null, 0));
  let okN = 0, errN = 0, totalIn = 0, totalOut = 0;
  for(const k in snap){ if(snap[k].ok){ okN++; totalIn += snap[k].inputLen; totalOut += snap[k].outLen; } else errN++; }
  console.log('v2 基线已写入: ' + OUT);
  console.log('条目: ' + Object.keys(snap).length + ' | ok ' + okN + ' | err ' + errN);
  console.log('总输入 ' + totalIn + ' -> 总输出 ' + totalOut + '（省 ' + (totalIn - totalOut) + '）');
}
