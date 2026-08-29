// Full safety gate. Runs local, remote, bulk, search, snapshot and performance suites, then compares
// deterministic results against both the pre-refactor baseline and the previous passing run.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TEST_DIR = __dirname;
const COMPRESSOR_DIR = path.dirname(TEST_DIR);
const BASELINE_FILE = path.join(TEST_DIR, '_refactor_baseline.json');
const LAST_FILE = path.join(TEST_DIR, '_last_full_result.json');
const RECORD = process.argv.includes('--record-baseline');

const specs = [
  ['unit', 'test.js', []],
  ['edge', 'edge.js', []],
  ['real', 'realtest.js', []],
  ['validationCache', 'test_validation_cache.js', []],
  ['semicolon', 'test_semicolon_elision.js', []],
  ['transparent', 'test_transparent_elision.js', []],
  ['forwardNil', 'test_canonical_fwdnil.js', []],
  ['ifNot', 'test_canonical_ifnot.js', []],
  ['relocation', 'test_canonical_relocpull.js', []],
  ['incremental', 'test_incremental.js', []],
  ['idempotency', 'test_idempotency.js', []],
  ['remote', 'remotetest.js', []],
  ['search', 'test_search_compare.js', []],
  ['bulk', 'bulktest.js', ['--offline']],
  ['snapshot', 'snapshot.js', ['--check']],
  ['performance', 'performance_probe.js', []]
];

function runSpec(name, script, args) {
  console.log(`\n${'='.repeat(72)}\n[${name}] node tests/${script} ${args.join(' ')}\n${'='.repeat(72)}`);
  const proc = spawnSync(process.execPath, [path.join(TEST_DIR, script), ...args], {
    cwd: COMPRESSOR_DIR,
    encoding: 'utf8',
    timeout: name === 'bulk' || name === 'search' || name === 'snapshot' ? 600000 : 180000,
    maxBuffer: 64 * 1024 * 1024
  });
  if (proc.stdout) process.stdout.write(proc.stdout);
  if (proc.stderr) process.stderr.write(proc.stderr);
  const ok = !proc.error && proc.status === 0;
  if (!ok) console.error(`[${name}] FAILED: ${proc.error ? proc.error.message : `exit ${proc.status}`}`);
  return { name, ok, status: proc.status, output: `${proc.stdout || ''}\n${proc.stderr || ''}` };
}

function numbers(output, regex, names) {
  const match = output.match(regex);
  if (!match) return null;
  const value = {};
  names.forEach((name, index) => { value[name] = Number(match[index + 1]); });
  return value;
}

function metricsFor(run) {
  const o = run.output;
  let metrics = { ok: run.ok };
  let parsed;
  switch (run.name) {
    case 'unit':
      parsed = numbers(o, /测试结果:\s*(\d+)\s*通过,\s*(\d+)\s*失败/, ['pass', 'fail']); break;
    case 'edge':
    case 'pipelineParity':
    case 'validationCache':
      parsed = numbers(o, /(\d+)\s*pass,\s*(\d+)\s*fail/i, ['pass', 'fail']); break;
    case 'semicolon':
    case 'transparent':
    case 'forwardNil':
    case 'ifNot':
    case 'relocation':
      parsed = numbers(o, /:\s*(\d+)\s*pass,\s*(\d+)\s*fail\s*===/i, ['pass', 'fail']); break;
    case 'incremental':
      parsed = numbers(o, /总结:\s*(\d+)\s*通过,\s*(\d+)\s*失败/, ['pass', 'fail']); break;
    case 'idempotency':
      parsed = numbers(o, /幂等\(逆向回代\)测试:\s*(\d+)\s*pass,\s*(\d+)\s*fail/, ['pass', 'fail']); break;
    case 'real': {
      parsed = numbers(o, /l 段总数:\s*(\d+)\s+成功:\s*(\d+)\s+失败\/拒绝:\s*(\d+)/, ['totalSegments', 'passSegments', 'failSegments']); break;
    }
    case 'remote':
      parsed = numbers(o, /远程测试:\s*(\d+)\s*通过,\s*(\d+)\s*失败\s*\(共\s*(\d+)\)/, ['pass', 'fail', 'total']); break;
    case 'bulk': {
      const repos = numbers(o, /仓库:\s*(\d+)\s*可用,\s*(\d+)\s*缺失/, ['availableRepos', 'missingRepos']);
      const total = numbers(o, /总计:\s*(\d+)\s*文件,\s*(\d+)\s*bytes/, ['totalFiles', 'totalBytes']);
      const counts = numbers(o, /(\d+)\s*pass,\s*(\d+)\s*fail/i, ['pass', 'fail']);
      parsed = Object.assign({}, repos || {}, total || {}, counts || {}); break;
    }
    case 'search':
      parsed = numbers(o, /规则系统总计:\s*(\d+)\s*字符[\s\S]*?搜索优化总计:\s*(\d+)\s*字符[\s\S]*?差值:\s*(-?\d+)\s*字符/, ['ruleBytes', 'searchBytes', 'savedBytes']); break;
    case 'snapshot':
      parsed = numbers(o, /CHECK:\s*total\s*(\d+)\s*\|\s*changed\s*(\d+)\s*\|\s*regress\s*(\d+)\s*\|\s*improve\s*(\d+)\s*\|\s*lost-ok\s*(\d+)\s*\|\s*new-ok\s*(\d+)\s*\|\s*source-changed\s*(\d+)\s*\|\s*removed\s*(\d+)/, ['total', 'changed', 'regress', 'improve', 'lostOk', 'newOk', 'sourceChanged', 'removed']); break;
    case 'performance': {
      const match = o.match(/PERF_JSON\s+(.+)/);
      if (match) {
        const perf = JSON.parse(match[1]);
        parsed = {
          sampleCount: perf.sampleCount,
          parseCount: perf.parseCount,
          inputBytes: perf.inputBytes,
          outputBytes: perf.outputBytes
        };
      }
      break;
    }
  }
  if (!parsed || !Object.keys(parsed).length) {
    metrics.parseError = true;
    metrics.ok = false;
  } else {
    Object.assign(metrics, parsed);
  }
  return metrics;
}

function compareMetricSet(label, previous, current) {
  const errors = [];
  for (const name of Object.keys(previous.suites)) {
    const oldSuite = previous.suites[name];
    const newSuite = current.suites[name];
    if (!newSuite) { errors.push(`${label}: missing suite ${name}`); continue; }
    if (oldSuite.ok && !newSuite.ok) errors.push(`${label}: ${name} changed from pass to fail`);
    for (const key of Object.keys(oldSuite)) {
      if (key === 'ok' || typeof oldSuite[key] !== 'number' || typeof newSuite[key] !== 'number') continue;
      if (name === 'search' && oldSuite.ruleBytes !== newSuite.ruleBytes && /^(ruleBytes|searchBytes|savedBytes)$/.test(key)) continue;
      if (name === 'snapshot' && key === 'total') continue;
      if (/fail|regress|lostOk/i.test(key)) {
        if (newSuite[key] > oldSuite[key]) errors.push(`${label}: ${name}.${key} ${oldSuite[key]} -> ${newSuite[key]}`);
      } else if (/pass|total|sampleCount|savedBytes/i.test(key)) {
        if (newSuite[key] < oldSuite[key]) errors.push(`${label}: ${name}.${key} ${oldSuite[key]} -> ${newSuite[key]}`);
      }
    }
  }
  const oldPerf = previous.suites.performance;
  const newPerf = current.suites.performance;
  if (oldPerf && newPerf && newPerf.parseCount > oldPerf.parseCount) {
    errors.push(`${label}: performance.parseCount ${oldPerf.parseCount} -> ${newPerf.parseCount}`);
  }
  if (oldPerf && newPerf && newPerf.outputBytes > oldPerf.outputBytes) {
    errors.push(`${label}: performance.outputBytes ${oldPerf.outputBytes} -> ${newPerf.outputBytes}`);
  }
  const oldBulk = previous.suites.bulk;
  const newBulk = current.suites.bulk;
  if (oldBulk && newBulk && newBulk.availableRepos < oldBulk.availableRepos) {
    errors.push(`${label}: bulk.availableRepos ${oldBulk.availableRepos} -> ${newBulk.availableRepos}`);
  }
  if (oldBulk && newBulk && newBulk.missingRepos > oldBulk.missingRepos) {
    errors.push(`${label}: bulk.missingRepos ${oldBulk.missingRepos} -> ${newBulk.missingRepos}`);
  }
  const oldSearch = previous.suites.search;
  const newSearch = current.suites.search;
  if (oldSearch && newSearch && oldSearch.ruleBytes === newSearch.ruleBytes && newSearch.searchBytes > oldSearch.searchBytes) {
    errors.push(`${label}: search.searchBytes ${oldSearch.searchBytes} -> ${newSearch.searchBytes}`);
  }
  return errors;
}

const runs = specs.map((spec) => runSpec(...spec));
const current = { version: 1, suites: {} };
for (const run of runs) current.suites[run.name] = metricsFor(run);

let errors = [];
for (const [name, suite] of Object.entries(current.suites)) {
  if (!suite.ok) errors.push(`current: ${name} did not pass or metrics could not be parsed`);
}

if (RECORD) {
  if (errors.length) {
    console.error('\nCannot record a failing baseline.');
    process.exit(1);
  }
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(current, null, 2) + '\n');
  fs.writeFileSync(LAST_FILE, JSON.stringify(current, null, 2) + '\n');
  console.log(`\nRecorded pre-refactor baseline: ${BASELINE_FILE}`);
  console.log(`Recorded previous passing result: ${LAST_FILE}`);
  process.exit(0);
}

if (!fs.existsSync(BASELINE_FILE) || !fs.existsSync(LAST_FILE)) {
  console.error('\nMissing comparison files. Run: node tests/full_regression.js --record-baseline');
  process.exit(2);
}
const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
const previous = JSON.parse(fs.readFileSync(LAST_FILE, 'utf8'));
errors = errors.concat(compareMetricSet('pre-refactor baseline', baseline, current));
errors = errors.concat(compareMetricSet('previous passing run', previous, current));

console.log('\n' + '='.repeat(72));
console.log('FULL REGRESSION COMPARISON');
console.log('='.repeat(72));
if (errors.length) {
  errors.forEach((error) => console.error('REGRESSION:', error));
  console.error(`RESULT: FAIL (${errors.length} regression(s)); previous result was not updated.`);
  process.exit(1);
}
fs.writeFileSync(LAST_FILE, JSON.stringify(current, null, 2) + '\n');
console.log('RESULT: OK');
console.log('Compared against: pre-refactor baseline + previous passing run');
console.log(`Performance parse calls: baseline ${baseline.suites.performance.parseCount} -> current ${current.suites.performance.parseCount}`);
console.log(`Representative output bytes: baseline ${baseline.suites.performance.outputBytes} -> current ${current.suites.performance.outputBytes}`);