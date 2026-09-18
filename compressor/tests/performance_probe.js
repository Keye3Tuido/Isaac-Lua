// Deterministic performance probe: counts actual luaparse.parse calls on the five
// largest individual blocks (每条代码单独测试，去注释后压缩；语料 = 构建期默认参数替换后的最终代码).
// Wall time is informational; parse count is gated.
const { performance } = require('perf_hooks');
const baseParser = require('luaparse');
const fengari = require('fengari');
const { loadRepoSegments } = require('./repo-lua-files');

let parseCount = 0;
const countedParser = Object.assign({}, baseParser, {
  parse(...args) {
    parseCount++;
    return baseParser.parse(...args);
  }
});

require('../core.js');
const LuaMin = globalThis.LuaMin.create(countedParser, fengari);

const { removeComments } = require('./_helpers');

// 逐块抽取：每块 = 一条替换后的最终代码，各自去注释后单独作为探针样本。
const segments = loadRepoSegments();
const samples = [];
for (const rel of Object.keys(segments)) {
  segments[rel].forEach((code, i) => {
    samples.push({ key: rel + '#' + i, source: removeComments(LuaMin, 'l ' + code) });
  });
}
samples.sort((a, b) => b.source.length - a.source.length || a.key.localeCompare(b.key));
const top = samples.slice(0, 5);

const result = { sampleCount: top.length, parseCount: 0, inputBytes: 0, outputBytes: 0, samples: [] };
const started = performance.now();
for (const sample of top) {
  parseCount = 0;
  const sampleStarted = performance.now();
  let report;
  try {
    report = LuaMin.compress(sample.source);
  } catch (err) {
    // 某段可能因超 Lua 局部上限等原因被拒，记为跳过而不是崩掉探针。
    result.samples.push({
      key: sample.key,
      inputBytes: sample.source.length,
      outputBytes: null,
      parseCount,
      elapsedMs: Number((performance.now() - sampleStarted).toFixed(1)),
      skipped: true,
      error: String((err && err.message) || err)
    });
    continue;
  }
  const elapsedMs = performance.now() - sampleStarted;
  result.parseCount += parseCount;
  result.inputBytes += sample.source.length;
  result.outputBytes += report.output.length;
  result.samples.push({
    key: sample.key,
    inputBytes: sample.source.length,
    outputBytes: report.output.length,
    parseCount,
    elapsedMs: Number(elapsedMs.toFixed(1))
  });
}
result.elapsedMs = Number((performance.now() - started).toFixed(1));

for (const sample of result.samples) {
  if (sample.skipped) {
    console.log(`${sample.key}: ${sample.inputBytes}->SKIPPED, ${sample.error}`);
    continue;
  }
  console.log(`${sample.key}: ${sample.inputBytes}->${sample.outputBytes}, ${sample.parseCount} parses, ${sample.elapsedMs} ms`);
}
console.log(`PERF_JSON ${JSON.stringify(result)}`);
