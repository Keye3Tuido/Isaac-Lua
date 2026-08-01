const luaparse = require('luaparse');
const fengari = require('fengari');
require('../core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

let pass = 0;
let fail = 0;
function ok(name, condition, detail) {
  if (condition) pass++;
  else {
    fail++;
    console.error('FAIL:', name, detail || '');
  }
}

function compressAsync(source, options) {
  return new Promise((resolve, reject) => {
    const progress = [];
    const stages = [];
    LuaMin.compress(source, Object.assign({}, options, {
      onProgress(p) { progress.push(p); },
      stageCallback(name) { stages.push(name); },
      _done(report) { resolve({ report, progress, stages }); },
      _error: reject
    }));
  });
}

async function main() {
  const cases = [
    {
      name: 'default',
      source: 'local player=Isaac.GetPlayer(0) local data={1,2,3,} return player,data',
      options: { thresholds: [2] }
    },
    {
      name: 'no-rename',
      source: 'local first=1 local second=2 return first+second',
      options: { thresholds: [2], rename: false }
    },
    {
      name: 'no-encode',
      source: 'local first=1 -- keep\nlocal second=2 return first+second',
      options: { thresholds: [2], encode: false }
    },
    {
      name: 'no-method-or-reuse',
      source: 'local object=source local value=object.Method(object,1) return value',
      options: { thresholds: [2], method: false, reuse: false }
    }
  ];

  for (const item of cases) {
    const sync = LuaMin.compress(item.source, item.options);
    const asyncResult = await compressAsync(item.source, item.options);
    const asyncReport = asyncResult.report;
    ok(item.name + '/output', asyncReport.output === sync.output, asyncReport.output + ' != ' + sync.output);
    ok(item.name + '/stages', JSON.stringify(asyncReport.stages) === JSON.stringify(sync.stages));
    ok(item.name + '/build', JSON.stringify(asyncReport.build) === JSON.stringify(sync.build));
    ok(item.name + '/counts', asyncReport.renamedCount === sync.renamedCount && asyncReport.aliasedCount === sync.aliasedCount);
    ok(item.name + '/progress', asyncResult.progress.length === item.options.thresholds.length, asyncResult.progress.length);
    ok(item.name + '/callbacks', asyncResult.stages.length > 0);
  }

  let errorCount = 0;
  let doneCount = 0;
  await new Promise((resolve) => {
    LuaMin.compress('local =', {
      thresholds: [2, 8],
      onProgress() {},
      _done() { doneCount++; resolve(); },
      _error() { errorCount++; resolve(); }
    });
  });
  ok('async-error/once', errorCount === 1, errorCount);
  ok('async-error/no-done', doneCount === 0, doneCount);

  console.log(`${pass} pass, ${fail} fail`);
  if (fail) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});