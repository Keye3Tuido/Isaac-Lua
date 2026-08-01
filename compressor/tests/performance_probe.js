// Deterministic performance probe: counts actual luaparse.parse calls on the five
// largest merged repository inputs. Wall time is informational; parse count is gated.
const fs = require('fs');
const { performance } = require('perf_hooks');
const baseParser = require('luaparse');
const fengari = require('fengari');
const { listRepoLuaFiles } = require('./repo-lua-files');

let parseCount = 0;
const countedParser = Object.assign({}, baseParser, {
  parse(...args) {
    parseCount++;
    return baseParser.parse(...args);
  }
});

require('../core.js');
const LuaMin = globalThis.LuaMin.create(countedParser, fengari);

const samples = listRepoLuaFiles().map((file) => {
  const segments = fs.readFileSync(file.abs, 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^\s*(?:lua|l)\s+\S/.test(line));
  return { key: file.rel.replace(/\\/g, '/'), source: segments.join('\n'), segments: segments.length };
}).filter((sample) => sample.segments > 0)
  .sort((a, b) => b.source.length - a.source.length || a.key.localeCompare(b.key))
  .slice(0, 5);

const result = { sampleCount: samples.length, parseCount: 0, inputBytes: 0, outputBytes: 0, samples: [] };
const started = performance.now();
for (const sample of samples) {
  parseCount = 0;
  const sampleStarted = performance.now();
  const report = LuaMin.compress(sample.source);
  const elapsedMs = performance.now() - sampleStarted;
  result.parseCount += parseCount;
  result.inputBytes += sample.source.length;
  result.outputBytes += report.output.length;
  result.samples.push({
    key: sample.key,
    segments: sample.segments,
    inputBytes: sample.source.length,
    outputBytes: report.output.length,
    parseCount,
    elapsedMs: Number(elapsedMs.toFixed(1))
  });
}
result.elapsedMs = Number((performance.now() - started).toFixed(1));

for (const sample of result.samples) {
  console.log(`${sample.key}: ${sample.inputBytes}->${sample.outputBytes}, ${sample.parseCount} parses, ${sample.elapsedMs} ms`);
}
console.log(`PERF_JSON ${JSON.stringify(result)}`);