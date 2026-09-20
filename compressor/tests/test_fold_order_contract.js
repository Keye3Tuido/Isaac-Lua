// Guard tests for the fold-order contract (FOLD_ORDER_RULES + validateFoldOrder in src/compress.js).
// Hard preconditions with evidence: fwdNilInline before locals/declHoist, fwdNilInlineFinal after
// declHoist (commit ba57143 + fwdNilInlineStage comment). opts.foldOrder must not silently violate
// them; the search layer's reorderFold presets must all keep passing.
const lp = require('../node_modules/luaparse');
const f = require('fengari');
require('../core.js');
const L = globalThis.LuaMin.create(lp, f);

let pass = 0, fail = 0;
function check(label, ok, detail){
  if(ok){ pass++; console.log('✓', label); }
  else { fail++; console.log('✗', label, detail || ''); }
}

const SAMPLE = 'l local a=1 local b=2 print(a+b)';

// (a) 默认顺序通过校验，且真实压缩正常
try{
  L._validateFoldOrder(L._DEFAULT_FOLD_ORDER);
  L.compress(SAMPLE);
  check('默认顺序通过校验', true);
}catch(e){ check('默认顺序通过校验', false, e.message); }

// 搜索层顺序预设（search.js BASELINE_ORDER_PRESETS 的全部 reorderFold 用法）逐一过校验 + 真实压缩
function reorderFold(moveKey, beforeKey){
  const o = L._DEFAULT_FOLD_ORDER.slice();
  const mi = o.indexOf(moveKey);
  if(mi >= 0){ o.splice(mi, 1); const bi = o.indexOf(beforeKey); if(bi >= 0) o.splice(bi, 0, moveKey); else o.push(moveKey); }
  return o;
}
const presets = [
  ['blockWrapper→callSugar', reorderFold('blockWrapper', 'callSugar')],
  ['stringFactors→stringLiterals', reorderFold('stringFactors', 'stringLiterals')],
  ['blockWrapper→methods', reorderFold('blockWrapper', 'methods')],
  ['reuse→locals', reorderFold('reuse', 'locals')],
  ['memberField→memberChain', reorderFold('memberField', 'memberChain')]
];
presets.forEach(function(p){
  try{
    L._validateFoldOrder(p[1]);
    L.compress(SAMPLE, { foldOrder: p[1] });
    check('搜索预设 ' + p[0] + ' 通过校验', true);
  }catch(e){ check('搜索预设 ' + p[0] + ' 通过校验', false, e.message); }
});

// (b) 违例顺序被拒：fwdNilInline 挪到 locals 之后
const v1 = L._DEFAULT_FOLD_ORDER.slice();
v1.splice(v1.indexOf('fwdNilInline'), 1);
v1.splice(v1.indexOf('locals') + 1, 0, 'fwdNilInline');
let msg = '';
try{ L._validateFoldOrder(v1); }catch(e){ msg = e.message; }
check('locals 先于 fwdNilInline 被拒', /fold 顺序违反契约：locals 必须排在 fwdNilInline 之后/.test(msg), msg);

// 违例经 opts.foldOrder 传入 compress 同样在入口抛错（不被多阈值 catch 吞掉）
msg = '';
try{ L.compress(SAMPLE, { foldOrder: v1 }); }catch(e){ msg = e.message; }
check('compress 拒绝违例 foldOrder', /fold 顺序违反契约/.test(msg), msg);

// (b2) 违例顺序被拒：fwdNilInlineFinal 挪到 declHoist 之前
const v2 = L._DEFAULT_FOLD_ORDER.slice();
v2.splice(v2.indexOf('fwdNilInlineFinal'), 1);
v2.splice(v2.indexOf('declHoist'), 0, 'fwdNilInlineFinal');
msg = '';
try{ L._validateFoldOrder(v2); }catch(e){ msg = e.message; }
check('fwdNilInlineFinal 先于 declHoist 被拒', /fold 顺序违反契约：fwdNilInlineFinal 必须排在 declHoist 之后/.test(msg), msg);

// 部分顺序（契约双方有一方未出现）不报错——调用方可传子集
try{
  L._validateFoldOrder(['locals', 'declHoist']);
  check('缺 fwdNilInline 的部分顺序不报错', true);
}catch(e){ check('缺 fwdNilInline 的部分顺序不报错', false, e.message); }

console.log('\n=== fold order contract: ' + pass + ' pass, ' + fail + ' fail ===');
process.exit(fail ? 1 : 0);
