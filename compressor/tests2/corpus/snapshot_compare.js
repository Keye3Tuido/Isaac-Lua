// tests2/corpus/snapshot_compare.js — v2 对 v1 历史基线的字节级差分
// 仅比较 tests2 自有 unit/remote/bulk 输入；历史 repo-seg 条目永久忽略。
// 默认仅比较 unit；SNAPSHOT_FULL=1 时包含 remote/bulk，并要求 bulk 总量严格改善。
'use strict';
const fs = require('fs'), path = require('path');
const luaparse = require('../../node_modules/luaparse');
const fengari = require('fengari');
const L1 = require('../../src2/base.js').create({ luaparse, fengari });
const LuaMin2 = require('../../src2/core2.js');
const L2 = LuaMin2.create({ luaparse, fengari });
const { removeComments } = require('../_helpers');

const TESTS2 = path.join(__dirname, '..');
const REMOTE = path.join(TESTS2, '.remote-cache');
const BULK = path.join(TESTS2, '_bulk_test_repos');
const SNAP = process.env.SNAPSHOT_FILE || path.join(TESTS2, '_snapshot.json');
const FULL = !!process.env.SNAPSHOT_FULL;
const WHITELIST = {};

function walkLua(dir, relBase, acc){
  if(!fs.existsSync(dir)) return acc;
  for(const e of fs.readdirSync(dir, { withFileTypes:true })){
    const full = path.join(dir, e.name);
    if(e.isDirectory()){
      if(['.git','node_modules','spec','test','tests','_bulk_test_repos','.remote-cache'].includes(e.name)) continue;
      walkLua(full, relBase, acc);
    }else if(e.name.endsWith('.lua')){
      acc.push({ full, rel:path.relative(relBase, full).replace(/\\/g, '/') });
    }
  }
  return acc;
}

function enumerateInputs(){
  const inputs = {};
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
  for(const k in UNIT) inputs[k] = UNIT[k];

  if(FULL){
    walkLua(REMOTE, REMOTE, []).forEach(function(f){
      let raw; try{ raw = fs.readFileSync(f.full, 'utf8'); }catch(e){ return; }
      inputs['remote:' + f.rel] = removeComments(L1, raw);
    });
  }

  if(FULL && fs.existsSync(BULK)){
    const bulkOverride = { zerobrane:'lualibs' };
    for(const name of fs.readdirSync(BULK)){
      const dir = path.join(BULK, name); if(!fs.statSync(dir).isDirectory()) continue;
      const luaDir = bulkOverride[name] ? path.join(dir, bulkOverride[name]) : dir;
      walkLua(luaDir, dir, []).forEach(function(f){
        let raw; try{ raw = fs.readFileSync(f.full, 'utf8'); }catch(e){ return; }
        if(raw.length < 10 || raw.includes('\0') || raw.startsWith('#!')) return;
        inputs['bulk:' + name + '/' + f.rel] = removeComments(L1, raw);
      });
    }
  }
  return inputs;
}

function run(){
  let pass = 0, fail = 0;
  const bad = [];
  function ok(cond, label, detail){
    if(cond) pass++;
    else{ fail++; if(bad.length < 30) bad.push(label + (detail ? ' | ' + detail : '')); }
  }
  if(!fs.existsSync(SNAP)){
    console.log('[snapshot_compare] 无 tests2/_snapshot.json 基线，跳过');
    return { pass:0, fail:0 };
  }

  const base = JSON.parse(fs.readFileSync(SNAP, 'utf8'));
  const inputs = enumerateInputs();
  const remoteAbsent = !fs.existsSync(REMOTE);
  let total = 0, win = 0, tie = 0, loss = 0, threw = 0, skipped = 0, srcChanged = 0, retiredRepo = 0;
  let bulkV1 = 0, bulkV2 = 0, bulkN = 0, allV1 = 0, allV2 = 0;
  const t0 = Date.now();

  for(const k of Object.keys(base)){
    if(k.startsWith('repo-seg:')){ retiredRepo++; continue; }
    const b = base[k];
    const isBulk = k.startsWith('bulk:');
    if(isBulk && !FULL){ skipped++; continue; }
    if(k.startsWith('remote:') && (!FULL || remoteAbsent)){ skipped++; continue; }
    total++;
    const input = inputs[k];
    if(input === undefined){ ok(false, k, 'tests2 固定输入缺失'); continue; }
    if(!b.ok) continue;
    let r, err;
    try{ r = L2.compress(input); }catch(e){ err = e; }
    if(!r){ threw++; ok(false, k, 'v2 压缩失败: ' + String(err && err.message || err).slice(0, 90)); continue; }
    if(input.length !== b.inputLen){ srcChanged++; continue; }
    const v2Len = r.output.length;
    allV1 += b.outLen; allV2 += v2Len;
    if(isBulk){ bulkV1 += b.outLen; bulkV2 += v2Len; bulkN++; }
    const over = v2Len - b.outLen;
    if(over > 0){
      loss++;
      const quota = WHITELIST[k];
      ok(quota !== undefined && over <= quota, k,
        'v2 比快照长 ' + over + ' 字节（' + b.outLen + ' -> ' + v2Len + '）');
    }else{
      ok(true, k);
      if(over < 0) win++;
      else tie++;
    }
  }
  if(FULL) ok(bulkV2 < bulkV1, 'bulk 总和严格改善',
    'bulk v1=' + bulkV1 + ' v2=' + bulkV2 + '（' + (bulkV2 - bulkV1) + '）');

  console.log('[snapshot_compare] 模式:', FULL ? 'unit + remote + bulk' : 'unit',
    '| 条目', total, '| v2 失败', threw, '| 退役 repo-seg', retiredRepo,
    '| 跳过', skipped, '| 输入已变', srcChanged, '| 更短', win, '持平', tie, '更长', loss,
    '| 用时', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  console.log('[snapshot_compare] 总字节: v1', allV1, 'v2', allV2, '差', allV2 - allV1,
    FULL ? ('| bulk(' + bulkN + '): v1 ' + bulkV1 + ' v2 ' + bulkV2 + ' 差 ' + (bulkV2 - bulkV1)) : '');
  if(bad.length){
    console.log('--- 失败明细（前 ' + bad.length + ' 条）---');
    bad.forEach(function(b){ console.log('✗', b); });
  }
  return { pass, fail };
}

module.exports = { name:'snapshot_compare', run };
