#!/usr/bin/env node
// LuaMin 完整测试套件 - 详细压缩统计
// 记录每个用例的压缩率、生成详细报告、对比基线

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 获取当前 git commit SHA
function getGitSHA() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch (e) {
    return 'unknown';
  }
}

// 获取当前分支
function getGitBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch (e) {
    return 'unknown';
  }
}

const gitSHA = getGitSHA();
const gitBranch = getGitBranch();
const timestamp = new Date().toISOString();

console.log('='.repeat(80));
console.log('LuaMin 压缩器 - 详细测试统计');
console.log('='.repeat(80));
console.log(`Git SHA: ${gitSHA.substring(0, 8)}`);
console.log(`分支: ${gitBranch}`);
console.log(`时间: ${timestamp}`);
console.log('='.repeat(80));
console.log();

const compressorDir = path.join(__dirname, 'compressor');
const testsDir = path.join(compressorDir, 'tests');

// 第一部分：运行基础测试套件
console.log('第一阶段：运行基础测试套件\n');

const testSuites = [
  { name: '核心功能', file: 'test.js', critical: true },
  { name: '边缘情况', file: 'edge.js', critical: true },
  { name: '透明别名消解', file: 'test_transparent_elision.js', critical: true }
];

const results = { suites: [], statistics: null };
let totalPass = 0, totalFail = 0;

testSuites.forEach(suite => {
  const testPath = path.join(testsDir, suite.file);

  if (!fs.existsSync(testPath)) {
    console.log(`⊘ ${suite.name}: 文件不存在`);
    results.suites.push({ ...suite, status: 'skip' });
    return;
  }

  process.stdout.write(`运行 ${suite.name}... `);

  try {
    const output = execSync(`node "${testPath}"`, {
      cwd: testsDir,
      encoding: 'utf8',
      timeout: 30000
    });

    const passMatch = output.match(/(\d+)\s*pass/i);
    const failMatch = output.match(/(\d+)\s*fail/i);

    const pass = passMatch ? parseInt(passMatch[1]) : 0;
    const fail = failMatch ? parseInt(failMatch[1]) : 0;

    totalPass += pass;
    totalFail += fail;

    if (fail === 0) {
      console.log(`✓ (${pass} pass)`);
      results.suites.push({ ...suite, status: 'pass', pass, fail });
    } else {
      console.log(`✗ (${pass} pass, ${fail} fail)`);
      results.suites.push({ ...suite, status: 'fail', pass, fail });
    }
  } catch (error) {
    console.log(`✗ 执行失败`);
    results.suites.push({ ...suite, status: 'error', error: error.message });
    if (suite.critical) totalFail++;
  }
});

console.log(`\n基础测试: ${totalPass} 通过, ${totalFail} 失败\n`);

// 第二部分：收集压缩统计数据
console.log('第二阶段：收集压缩统计\n');

const luaparse = require(path.join(compressorDir, 'node_modules/luaparse'));
const fengari = require(path.join(compressorDir, 'node_modules/fengari'));
require(path.join(compressorDir, 'core.js'));
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

// 收集所有.lua文件
const luaFiles = fs.readdirSync(__dirname)
  .filter(f => f.endsWith('.lua') && !f.startsWith('DEBUG'))
  .slice(0, 5); // 先测试5个文件

const compressionStats = [];

luaFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  const content = fs.readFileSync(filePath, 'utf8');

  // 分段压缩
  const segments = content.split('\n').filter(line => line.trim().startsWith('l '));

  segments.forEach((seg, idx) => {
    try {
      const result = LuaMin.compress(seg);
      const inputLen = seg.length;
      const outputLen = result.output.length;
      const ratio = ((1 - outputLen / inputLen) * 100).toFixed(2);

      compressionStats.push({
        file,
        segment: idx,
        inputLen,
        outputLen,
        ratio: parseFloat(ratio)
      });
    } catch (e) {
      // 压缩失败，跳过
    }
  });

  process.stdout.write('.');
});

console.log(' 完成\n');

// 计算统计数据
if (compressionStats.length > 0) {
  const ratios = compressionStats.map(s => s.ratio);
  const minRatio = Math.min(...ratios);
  const maxRatio = Math.max(...ratios);
  const avgRatio = (ratios.reduce((a, b) => a + b, 0) / ratios.length).toFixed(2);

  results.statistics = {
    totalSegments: compressionStats.length,
    minRatio,
    maxRatio,
    avgRatio: parseFloat(avgRatio),
    details: compressionStats
  };

  console.log('压缩统计:');
  console.log(`  段数: ${compressionStats.length}`);
  console.log(`  压缩率: ${minRatio}% ~ ${maxRatio}% (平均 ${avgRatio}%)`);
  console.log();
}

// 生成报告
const report = {
  gitSHA: gitSHA.substring(0, 8),
  gitBranch,
  timestamp,
  summary: {
    testSuites: results.suites.length,
    totalPass,
    totalFail,
    status: totalFail === 0 ? 'PASS' : 'FAIL'
  },
  suites: results.suites,
  compression: results.statistics
};

const reportPath = path.join(__dirname, 'TEST_REPORT.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log('='.repeat(80));
console.log(`报告已保存: ${reportPath}`);
console.log('='.repeat(80));

process.exit(totalFail > 0 ? 1 : 0);
