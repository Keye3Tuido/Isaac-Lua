#!/usr/bin/env node
// 统一测试入口：自动发现并运行 tests/ 下的所有测试，汇总结果

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('='.repeat(80));
console.log('LuaMin 压缩器 - 完整测试套件');
console.log('='.repeat(80));
console.log();

const testsDir = path.join(__dirname, 'tests');
const startTime = Date.now();

// 测试配置：定义要运行的测试及其类型
const testSuites = [
  { name: '核心功能测试', file: 'test.js', critical: true },
  { name: '边缘情况测试', file: 'edge.js', critical: true },
  { name: '透明别名消解', file: 'test_transparent_elision.js', critical: true },
  { name: 'Canonical前向nil', file: 'test_canonical_fwdnil.js', critical: false },
  { name: 'Canonical if-not', file: 'test_canonical_ifnot.js', critical: false },
  { name: 'Canonical重定位', file: 'test_canonical_relocpull.js', critical: false },
  { name: '分号消解', file: 'test_semicolon_elision.js', critical: false },
  { name: '别名链', file: 'test_alias_chain.js', critical: false },
  { name: '回调模式', file: 'test_callback_pattern.js', critical: false },
  { name: '字段重复', file: 'test_field_repeat.js', critical: false },
  { name: '增量压缩', file: 'test_incremental.js', critical: false },
  { name: '多回调', file: 'test_multi_callback.js', critical: false }
];

const results = [];
let totalPass = 0, totalFail = 0;

console.log('开始运行测试套件...\n');

testSuites.forEach(suite => {
  const testPath = path.join(testsDir, suite.file);

  if (!fs.existsSync(testPath)) {
    console.log(`⊘ ${suite.name}: 文件不存在`);
    results.push({ ...suite, status: 'skip', reason: '文件不存在' });
    return;
  }

  process.stdout.write(`运行 ${suite.name}... `);

  try {
    const output = execSync(`node "${testPath}"`, {
      cwd: path.dirname(testPath),
      encoding: 'utf8',
      timeout: 30000
    });

    // 解析测试输出
    const passMatch = output.match(/(\d+)\s*pass/i);
    const failMatch = output.match(/(\d+)\s*fail/i);

    const pass = passMatch ? parseInt(passMatch[1]) : 0;
    const fail = failMatch ? parseInt(failMatch[1]) : 0;

    totalPass += pass;
    totalFail += fail;

    if (fail === 0) {
      console.log(`✓ (${pass} pass)`);
      results.push({ ...suite, status: 'pass', pass, fail });
    } else {
      console.log(`✗ (${pass} pass, ${fail} fail)`);
      results.push({ ...suite, status: 'fail', pass, fail });
    }
  } catch (error) {
    console.log(`✗ 执行失败`);
    results.push({ ...suite, status: 'error', error: error.message });
    if (suite.critical) totalFail++;
  }
});

const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

console.log();
console.log('='.repeat(80));
console.log('测试报告');
console.log('='.repeat(80));
console.log();
console.log(`总计: ${totalPass} 通过, ${totalFail} 失败`);
console.log(`耗时: ${elapsed} 秒`);
console.log();

if (totalFail > 0) {
  console.log('失败的测试:');
  results.filter(r => r.status === 'fail' || r.status === 'error').forEach(r => {
    console.log(`  ✗ ${r.name} (${r.file})`);
  });
  console.log();
}

// 生成JSON报告
const report = {
  timestamp: new Date().toISOString(),
  summary: {
    total: results.length,
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail' || r.status === 'error').length,
    skipped: results.filter(r => r.status === 'skip').length,
    totalPass,
    totalFail,
    elapsed: parseFloat(elapsed)
  },
  results
};

const reportPath = path.join(__dirname, 'test-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`详细报告已保存: ${reportPath}`);
console.log();

process.exit(totalFail > 0 ? 1 : 0);
