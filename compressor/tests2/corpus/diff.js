// tests2/corpus/diff.js — v2 语料差分 harness（M5：硬门）
// 逐语料段跑 v2 compress（透镜管线）：
//   硬断言 A：v2 产物三重终审绿（compress 内建）+ 独立 luaparse 复核；
//   硬断言 B：幂等——v2 产物再过 v2，canonical 等价且长度不增；
//   硬断言 C（M5 新增）：无劣化——v2.bodyLength <= v1 历史基线（tests2/_snapshot.json）
//     对应段 outLen，除 WHITELIST 显式豁免的段（每条约注原因）。
'use strict';
const fs = require('fs'), path = require('path');
const luaparse = require('../../node_modules/luaparse');
const fengari = require('fengari');
const L1 = require('../../src2/base.js').create({ luaparse, fengari });
const LuaMin2 = require('../../src2/core2.js');
const C2 = require('../../src2/canonical2.js');
const L2 = LuaMin2.create({ luaparse, fengari });

const { removeComments } = require('../_helpers');
const { loadRepoSegments } = require('../repo-lua-files');

// v1 历史基线（v1 管线退役前录制的逐段 outLen；无劣化门的参照物，永不以 v2 数据覆盖）
const SNAP = path.join(__dirname, '..', '_snapshot.json');

// M5 无劣化白名单：户主规则要求空名单，任何 v2 比 v1 基线长的段都必须立即修复。
const WHITELIST = {};

function run(){
  let pass = 0, fail = 0;
  const bad = [];
  function ok(cond, label, detail){
    if(cond){ pass++; }
    else { fail++; if(bad.length < 20) bad.push(label + (detail ? ' | ' + detail : '')); }
  }

  const baseline = fs.existsSync(SNAP) ? JSON.parse(fs.readFileSync(SNAP, 'utf8')) : null;
  if(!baseline) console.log('[diff] 警告：无 tests2/_snapshot.json 基线，无劣化门（断言 C）跳过');

  const segments = loadRepoSegments();
  const files = Object.keys(segments).sort();
  let segTotal = 0, baseN = 0, srcChanged = 0, v2ok = 0, win = 0, tie = 0, loss = 0, v2Fail = 0;
  let bytesV1 = 0, bytesV2 = 0, bytesIn = 0;
  const familyStats = {};   // 透镜族 -> { steps, saved }（信息输出：alias/norm/encode 各阶段贡献）

  for(const f of files){
    segments[f].forEach(function(code, idx){
      const label = f + '#' + idx;
      const body = removeComments(L1, code);
      if(!body || !body.trim()) return;
      segTotal++;
      const seg = 'l ' + body;
      bytesIn += body.length;

      // v2 别名阶段管线
      let r2 = null;
      try{
        r2 = L2.compress(seg);
        v2ok++;
        // 分族统计（信息输出）
        (r2.report.trace || []).forEach(function(st){
          const fam = st.lens.split('.')[0];
          familyStats[fam] = familyStats[fam] || { steps: 0, saved: 0 };
          familyStats[fam].steps++;
          familyStats[fam].saved += -st.delta;
        });
        // A1：独立复核产物可解析（终审已在 compress 内跑过，这里再查一次 luaparse）
        luaparse.parse(r2.body, { luaVersion:'5.3' });
        pass++;
      }catch(e){
        v2Fail++;
        ok(false, label, 'v2 compress/parse 失败: ' + String(e.message||e).slice(0,90));
        return;
      }

      // A2：幂等——v2 产物再过 v2，canonical 等价（双侧各用报告/推导还原映射）且长度不增。
      // pureInline 恒带：normPureCopyProp 是纯值单用内联的恒安全兜底归一（仅在前置口径
      // 都对不上时才启用、只还原纯值单用内联，绝不会把不等价误判成等价）。inlinePure/
      // inlineValue 在「纯单用」领域叠加时，缺它会假阳性（util5.编解码#2 实证：{} 不等价、
      // {pureInline:true} 等价且双端实跑一致）。
      try{
        const r3 = L2.compress(r2.code);
        const eq = C2.equivalent(r2.body, r3.body, { luaparse, fengari, base: L1 },
          L2._buildIR(r2.body), L2._buildIR(r3.body), { pureInline: true },
          r2.report.aliasMap || undefined, r3.report.aliasMap || undefined);
        ok(eq, label, '幂等性：二次压缩 canonical 不等价');
        ok(r3.bodyLength <= r2.bodyLength, label,
           '幂等性：二次压缩变长 ' + r2.bodyLength + ' -> ' + r3.bodyLength);
      }catch(e){
        ok(false, label, '二次压缩失败: ' + String(e.message||e).slice(0,90));
      }

      // 硬断言 C（M5 无劣化门）：v2 ≤ v1 基线 outLen（均含 l 前缀，与 snapshot_compare 同口径），
      // 白名单段须在豁免额度内。基线录制后输入已变的段（lua/ 增长/模板迭代）长度对比无意义，
      // 只保留 A/B 断言并计数（与 snapshot_v2 --check 的 SOURCE 口径一致）。
      const b1 = baseline && baseline['repo-seg:' + label];
      if(b1 && b1.ok){
        if(b1.inputLen !== seg.length){ srcChanged++; return; }
        baseN++;
        const v2Len = r2.output.length;
        bytesV1 += b1.outLen; bytesV2 += v2Len;
        const over = v2Len - b1.outLen;
        if(over > 0){
          const quota = WHITELIST[label];
          ok(quota !== undefined && over <= quota, label,
             '无劣化：v2 比 v1 基线长 ' + over + ' 字节'
             + (quota !== undefined ? '（白名单额度 ' + quota + '）' : '（不在白名单）'));
        }
        if(v2Len < b1.outLen) win++;
        else if(v2Len === b1.outLen) tie++;
        else loss++;
      }
    });
  }
  const wlUsed = Object.keys(WHITELIST).length;

  console.log('[diff] 语料段数:', segTotal, ' 基线可比:', baseN, ' 输入已变(跳过C):', srcChanged, ' v2 成功:', v2ok, ' v2 失败:', v2Fail);
  console.log('[diff] 长度对比（v2 全透镜管线 vs v1 基线）: 更短', win, ' 持平', tie, ' 更长', loss,
              '（白名单豁免 ' + wlUsed + ' 段）');
  console.log('[diff] 字节数: 输入', bytesIn, ' v1 基线', bytesV1, ' v2', bytesV2);
  Object.keys(familyStats).sort().forEach(function(f){
    console.log('[diff] 阶段', f, ': 提交', familyStats[f].steps, '步， 省', familyStats[f].saved, '字节');
  });
  if(bad.length){
    console.log('--- 失败明细（前 ' + bad.length + ' 条）---');
    bad.forEach(function(b){ console.log('✗', b); });
  }
  return { pass, fail };
}

module.exports = { name: 'corpus_diff', run };
