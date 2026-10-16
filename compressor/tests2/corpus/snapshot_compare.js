// tests2/corpus/snapshot_compare.js — v2 对 v1 历史基线的字节级快照差分（M6 新增，M7 保留）
// 户主硬性规则（2026-10-14）：
//   (a) 每个快照条目 v2 必须压缩成功（ok）；
//   (b) 每个条目 v2.outLen <= 快照 outLen（WHITELIST 显式豁免 <=8 条，逐条约注原因）；
//   (c) 真实开源代码（bulk 前缀条目）v2 总 outLen 必须【严格小于】快照总和；
//       本仓库手工压缩代码（repo-seg/unit/remote）只需无劣化。
//   (b)/(c) 仅对输入与基线一致的条目生效——基线录制后输入已变的条目（lua/ 增长/
//       模板迭代）长度对比无意义，只断言 (a) 并计数（与 snapshot_v2 --check 的 SOURCE 口径一致）。
//   (d) 基线键在当前语料枚举中找不到时：`repo-seg:` 键按【失效键】计数报告（lua/ 改名/拆分
//       属正常内容迭代，且 v1 管线已退役、无法重锚），不再判失败；unit/remote/bulk 三类键
//       的枚举是固定的（硬编码用例 / 固定缓存目录 / 固定第三方库），其缺失仍是硬失败。
// 快照基线 = tests2/_snapshot.json（v1 管线退役前录制；永不以 v2 数据覆盖）。
// env SNAPSHOT_FILE 可指向替代基线（自检用；默认 tests2/_snapshot.json）。
// 输入枚举沿用原 v1 snapshot.js 口径（unit 用例 + repo 段 + .remote-cache + _bulk_test_repos）。
//
// 运行模式（全量重建 IR 的 v2 在大整文件上是分钟级，设计风险 §9.1 备案）：
//   门禁模式（默认）：unit + remote + repo-seg——repo-seg 的无劣化与 corpus/diff.js
//     同语料同基线但口径不同（diff 还查幂等性），bulk 段跳过（打印提示）；
//   全量模式（SNAPSHOT_FULL=1）：含 bulk 152 整文件，户主规则 (c) 的强制执行入口。
'use strict';
const fs = require('fs'), path = require('path');
const luaparse = require('../../node_modules/luaparse');
const fengari = require('fengari');
const L1 = require('../../src2/base.js').create({ luaparse, fengari });
const LuaMin2 = require('../../src2/core2.js');
const L2 = LuaMin2.create({ luaparse, fengari });

const { removeComments } = require('../_helpers');
const { loadRepoSegments } = require('../repo-lua-files');

const TESTS2 = path.join(__dirname, '..');
const REMOTE = path.join(TESTS2, '.remote-cache');
const BULK = path.join(TESTS2, '_bulk_test_repos');
const SNAP = process.env.SNAPSHOT_FILE || path.join(TESTS2, '_snapshot.json');
const FULL = !!process.env.SNAPSHOT_FULL;

// v2 劣化白名单：户主规则要求空名单，任何 v2 比 v1 长的条目都必须立即修复。
const WHITELIST = {};

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

// 与 snapshot.js 完全同口径的输入枚举（键 -> 输入文本）
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

  const repoSegs = loadRepoSegments();
  for(const rel of Object.keys(repoSegs)){
    repoSegs[rel].forEach(function(code, i){
      inputs['repo-seg:' + rel + '#' + i] = removeComments(L1, 'l ' + code);
    });
  }

  walkLua(REMOTE, REMOTE, []).forEach(function(f){
    let raw; try{ raw = fs.readFileSync(f.full, 'utf8'); }catch(e){ return; }
    inputs['remote:' + f.rel] = removeComments(L1, raw);
  });

  const bulkOverride = { zerobrane: 'lualibs' };
  if(FULL && fs.existsSync(BULK)){
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
    if(cond){ pass++; }
    else { fail++; if(bad.length < 30) bad.push(label + (detail ? ' | ' + detail : '')); }
  }

  if(!fs.existsSync(SNAP)){
    console.log('[snapshot_compare] 无 tests2/_snapshot.json 基线，跳过');
    return { pass: 0, fail: 0 };
  }
  const base = JSON.parse(fs.readFileSync(SNAP, 'utf8'));
  const inputs = enumerateInputs();
  // remote 缓存目录整体缺失时（如 CI 只导出 repo 语料）：remote 条目按 bulk 同款跳过处理；
  // repo-seg/unit 条目缺失仍是硬失败（语料枚举与基线必须一致）。
  const remoteAbsent = !fs.existsSync(REMOTE);

  let total = 0, win = 0, tie = 0, loss = 0, threw = 0, missing = 0, skipped = 0, srcChanged = 0;
  let bulkV1 = 0, bulkV2 = 0, bulkN = 0;
  let allV1 = 0, allV2 = 0;
  const obsoleteFiles = {};   // 失效 repo-seg 键的来源文件（报告用，去重）
  const t0 = Date.now();

  for(const k of Object.keys(base)){
    const b = base[k];
    const isBulk = k.startsWith('bulk:');
    if(isBulk && !FULL){ skipped++; continue; }
    if(remoteAbsent && k.startsWith('remote:')){ skipped++; continue; }
    total++;
    const input = inputs[k];
    if(input === undefined){
      // (d) 基线录制后 lua/ 改名/拆分会让 repo-seg 键失去对应语料段——该键再也无法做任何
      // 对比（v1 管线已退役，无法重锚），计入失效键并从明细里排除；其余三类键的枚举固定，
      // 缺失仍判失败（配置漂移）。
      if(k.startsWith('repo-seg:')){ missing++; obsoleteFiles[k.slice('repo-seg:'.length).replace(/#\d+$/, '')] = true; continue; }
      ok(false, k, '快照条目在当前语料枚举中缺失');
      continue;
    }
    if(!b.ok){ continue; }   // 快照本身失败的条目不参与对比（当前 964 条全 ok）
    let r = null, err = null;
    try{ r = L2.compress(input); }catch(e){ err = e; }
    if(!r){ threw++; ok(false, k, 'v2 压缩失败: ' + String(err && err.message || err).slice(0, 90)); continue; }
    // 基线录制后输入已变的条目（lua/ 增长/模板迭代）：成功性已断言（规则 a），
    // 长度对比无意义，跳过（规则 b/c 仅对输入一致的条目生效）。
    if(input.length !== b.inputLen){ srcChanged++; continue; }
    const v2Len = r.output.length;
    allV1 += b.outLen; allV2 += v2Len;
    if(isBulk){ bulkV1 += b.outLen; bulkV2 += v2Len; bulkN++; }
    const over = v2Len - b.outLen;
    if(over > 0){
      loss++;
      const quota = WHITELIST[k];
      ok(quota !== undefined && over <= quota, k,
         'v2 比快照长 ' + over + ' 字节（' + b.outLen + ' -> ' + v2Len + '）'
         + (quota !== undefined ? '（白名单额度 ' + quota + '）' : '（不在白名单）'));
    }
    else if(over < 0) win++;
    else tie++;
  }

  if(FULL){
    // (c) bulk 总和严格小于
    ok(bulkV2 < bulkV1, 'bulk 总和严格改善',
       'bulk v1=' + bulkV1 + ' v2=' + bulkV2 + '（' + (bulkV2 - bulkV1) + '，未严格小于）');
  }

  console.log('[snapshot_compare] 模式:', FULL ? '全量' : '门禁（bulk ' + skipped + ' 条跳过，SNAPSHOT_FULL=1 强制执行）',
              '| 条目', total, '| v2 失败', threw, '| 失效键(repo-seg 布局变更)', missing, '| 输入已变(跳过)', srcChanged,
              '| 更短', win, '持平', tie, '更长', loss, '| 用时', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  if(missing){
    const fl = Object.keys(obsoleteFiles).sort();
    console.log('[snapshot_compare] 失效键来源（前 8 个，共 ' + fl.length + ' 个文件）：' + fl.slice(0, 8).join('、')
                + (fl.length > 8 ? ' …' : '') + '（lua/ 改名/拆分所致，不影响无劣化判定）');
  }
  console.log('[snapshot_compare] 全量字节: v1', allV1, 'v2', allV2, '差', allV2 - allV1,
              FULL ? ('| bulk(' + bulkN + '): v1 ' + bulkV1 + ' v2 ' + bulkV2 + ' 差 ' + (bulkV2 - bulkV1)) : '');
  if(bad.length){
    console.log('--- 失败明细（前 ' + bad.length + ' 条）---');
    bad.forEach(function(b){ console.log('✗', b); });
  }
  return { pass, fail };
}

module.exports = { name: 'snapshot_compare', run };
