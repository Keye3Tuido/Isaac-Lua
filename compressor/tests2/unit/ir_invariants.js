// tests2/unit/ir_invariants.js — IR 不变式（INV-1/2/3）与 SSA 交叉校验
// 语料：与 v1 tests/realtest.js 同口径加载 _repo_segments.json（逐段、去注释）。
// 对每段：
//   INV-3 交叉：ssa 绑定数 / 赋值数 / 使用数 与 analyze.js 独立统计一致；
//   INV-1：合成别名条目的 declRange 指向真实 local 声明项（含编辑后重映射复查）；
//   INV-2：版本递增后证据槽失效（空槽），getEvidence 惰性重建。
// canonicalKey 等价键为固定种子抽样（见下方 SAMPLE 常量与输出说明）。
'use strict';
const luaparse = require('../../node_modules/luaparse');
const fengari = require('fengari');
const L = require('../../src2/base.js').create({ luaparse, fengari });
const IR = require('../../src2/ir.js');

const { removeComments } = require('../_helpers');
const { loadRepoSegments } = require('../repo-lua-files');

const deps = { luaparse, fengari, base: L };

// 独立统计（交叉校验用，不经过 src2）：赋值给局部变量的 Identifier 目标数
function countLocalAssigns(ast, info){
  let n = 0;
  (function walk(node){
    if(!node || typeof node !== 'object') return;
    if(Array.isArray(node)){ node.forEach(walk); return; }
    if(node.type === 'AssignmentStatement' && node.variables){
      node.variables.forEach(function(t){
        if(t && t.type === 'Identifier' && info.varOf.get(t)) n++;
      });
    }
    for(const k in node){
      if(k === 'range' || k === 'loc') continue;
      if(Object.prototype.hasOwnProperty.call(node, k)) walk(node[k]);
    }
  })(ast.body);
  return n;
}

// 在 src 中找第一个 `local <Name>` 声明项区间（INV-1 测试桩）；找不到返回 null
function findLocalDeclRange(src){
  const toks = L._lex(src);
  for(let i=0; i+1<toks.length; i++){
    if(toks[i].type === 'Keyword' && toks[i].value === 'local'
       && toks[i+1].type === 'Name'){
      return { range:[toks[i].start, toks[i+1].end], name: toks[i+1].value };
    }
  }
  return null;
}

// 固定种子 LCG：备用——语料膨胀导致 canonicalKey 全集超时时恢复抽样用
function lcg(seed){ let s = seed >>> 0; return function(){ s = (s * 1103515245 + 12345) >>> 0; return s; }; }
void lcg;

function run(){
  let pass = 0, fail = 0;
  const bad = [];
  function ok(cond, label, detail){
    if(cond){ pass++; }
    else { fail++; if(bad.length < 20) bad.push(label + (detail ? ' | ' + detail : '')); }
  }

  const segments = loadRepoSegments();
  const files = Object.keys(segments).sort();
  let segTotal = 0, inv1Checked = 0;

  // ---------- 逐段：INV-3 交叉校验 + INV-1/INV-2 合成编辑 ----------
  for(const f of files){
    segments[f].forEach(function(code, idx){
      const label = f + '#' + idx;
      const src = removeComments(L, code);
      if(!src || !src.trim()) return;
      segTotal++;
      let ir;
      try{ ir = IR.buildIR(src, deps); }
      catch(e){ ok(false, label, 'buildIR threw: ' + String(e.message||e).slice(0,80)); return; }

      // INV-3 交叉 1：SSA 绑定数 === analyze.js bindings 数（每 binding 恰一 v0 声明版本）
      ok(ir.ssa.byBinding.size === ir.info.bindings.length, label,
         'byBinding ' + ir.ssa.byBinding.size + ' !== bindings ' + ir.info.bindings.length);
      ok(ir.ssa.declCount === ir.info.bindings.length, label, 'declCount 不一致');

      // INV-3 交叉 2：赋值版本数 === 独立统计的局部赋值目标数
      ok(ir.ssa.assignCount === countLocalAssigns(ir.ast, ir.info), label,
         'assignCount ' + ir.ssa.assignCount + ' !== 独立统计 ' + countLocalAssigns(ir.ast, ir.info));

      // INV-3 交叉 3：SSA 使用点总数 === analyze.js uses 总数 − 局部赋值目标数。
      // 口径差异（语义原因）：analyze.js 的 resolve() 把赋值目标也 push 进 b.uses，
      // 而 SSA 表里赋值目标是 def（产生新版本），不算使用点——故须扣除 assignCount。
      let useA = 0, useB = 0;
      ir.info.bindings.forEach(function(b){ useA += b.uses.length; });
      ir.ssa.byBinding.forEach(function(e){
        e.versions.forEach(function(v){ useB += v.useSites.length; });
      });
      ok(useA - ir.ssa.assignCount === useB, label, 'useSites ' + useB + ' !== uses-assigns ' + (useA - ir.ssa.assignCount));

      // INV-1 正向：合成别名条目指向真实 local 声明项
      const decl = findLocalDeclRange(src);
      if(!decl) return; // 全段无 local 声明，跳过 INV-1（全局直写段）
      inv1Checked++;
      ir.aliases.addEntry(decl.name, {
        kind: 'global', target: decl.name, declRange: decl.range.slice(),
        introducedBy: 'test', roundtripKey: decl.name
      });
      ok(IR.checkInv1(ir) === true, label, 'INV-1 正向失败: ' + String(IR.checkInv1(ir)));

      // 证据槽惰性写入（INV-2 前置）
      IR.getEvidence(ir, 'probe', function(){ return { n: 1 }; });
      ok(ir.evidence.size === 1, label, 'getEvidence 未入槽');

      // 合成编辑：段首插入空语句 ';'（恒合法），走统一重映射器
      let nir;
      try{ nir = IR.applyEditsToIR(ir, [{ start:0, end:0, text:';' }]); }
      catch(e){ ok(false, label, 'applyEditsToIR threw: ' + String(e.message||e).slice(0,80)); return; }

      // INV-2：版本 +1 且证据槽随版本失效
      ok(nir.version === ir.version + 1, label, '版本未递增');
      ok(nir.evidence.size === 0, label, '证据槽未失效');

      // INV-1 重映射：declRange 整体 +1 平移，且在新 src 上仍指向真实声明项
      const e2 = nir.aliases.entries.get(decl.name);
      ok(!!e2 && e2.declRange[0] === decl.range[0]+1 && e2.declRange[1] === decl.range[1]+1,
         label, 'declRange 未平移: ' + (e2 ? JSON.stringify(e2.declRange) : 'missing'));
      ok(IR.checkInv1(nir) === true, label, 'INV-1 编辑后失败: ' + String(IR.checkInv1(nir)));

      // INV-1 反向（仅前 10 段，控制耗时）：篡改 declRange 必须被机器检查拒绝
      if(inv1Checked <= 10){
        const bad2 = IR.buildIR(src, deps);
        bad2.aliases.addEntry(decl.name, {
          kind:'global', target:decl.name, declRange:[0,1], introducedBy:'test', roundtripKey:'x'
        });
        ok(IR.checkInv1(bad2) !== true, label, 'INV-1 反向未被拒绝');
      }
    });
  }

  // ---------- canonicalKey：全集等价键校验（v1 canonical 委托一致性）----------
  // 实测全集 <1s，无需抽样；若未来语料膨胀导致超时，可恢复固定种子抽样（lcg 已备）。
  const allSrc = [];
  for(const f of files) segments[f].forEach(function(code){
    const s = removeComments(L, code);
    if(s && s.trim()) allSrc.push(s);
  });
  const SAMPLE = allSrc.length;
  const idxs = allSrc.map(function(_, i){ return i; });
  for(let k=0; k<SAMPLE; k++){
    const i = idxs[k], src = allSrc[i];
    let ir;
    try{ ir = IR.buildIR(src, deps); }catch(e){ ok(false, 'canonical-sample#'+i, 'buildIR threw'); continue; }
    let expect;
    try{ expect = L._canonical(src); }catch(e){ ok(false, 'canonical-sample#'+i, 'v1 canonical threw'); continue; }
    ok(IR.canonicalKey(ir) === expect, 'canonical-sample#'+i, 'canonicalKey 与 v1 canonical 不一致');
  }
  console.log('[ir_invariants] 语料段数:', segTotal, ' INV-1 覆盖段数:', inv1Checked,
              ' canonicalKey 全集校验:', SAMPLE, '/', allSrc.length);

  if(bad.length){
    console.log('--- 失败明细（前 ' + bad.length + ' 条）---');
    bad.forEach(function(b){ console.log('✗', b); });
  }
  return { pass, fail };
}

module.exports = { name: 'ir_invariants', run };
