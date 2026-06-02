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

const compressorDir = __dirname;
const testsDir = path.join(compressorDir, 'tests');

// 第一部分：运行基础测试套件
console.log('第一阶段：运行基础测试套件\n');

// 自动发现所有测试文件（排除工具脚本）
const excludeFiles = ['bench.js', 'collect_stats.js', 'threshold_math_analysis.js', 'snapshot.js'];
const allTestFiles = fs.readdirSync(testsDir)
  .filter(f => f.endsWith('.js') && !excludeFiles.includes(f))
  .sort();

const results = { suites: [], statistics: null };
let totalPass = 0, totalFail = 0;

allTestFiles.forEach(file => {
  const testPath = path.join(testsDir, file);
  process.stdout.write(`运行 ${file}... `);

  try {
    // bulktest/realtest/search_compare 需要更长的超时时间
    var timeout = 30000;
    if (file === 'bulktest.js') timeout = 300000;
    else if (file === 'test_search_compare.js') timeout = 300000;
    else if (file === 'realtest.js') timeout = 120000;

    const output = execSync(`node "${testPath}"`, {
      cwd: testsDir,
      encoding: 'utf8',
      timeout: timeout
    });

    // 修正：使用更精确的正则，匹配 "X pass, Y fail" 格式，避免跨行匹配
    const summaryMatch = output.match(/(\d+)\s+pass,\s+(\d+)\s+fail/i);
    const pass = summaryMatch ? parseInt(summaryMatch[1]) : 0;
    const fail = summaryMatch ? parseInt(summaryMatch[2]) : 0;

    totalPass += pass;
    totalFail += fail;

    if (fail === 0) {
      console.log(`✓ (${pass} pass)`);
      results.suites.push({ file, status: 'pass', pass, fail });
    } else {
      console.log(`✗ (${pass} pass, ${fail} fail)`);
      results.suites.push({ file, status: 'fail', pass, fail });
    }
  } catch (error) {
    console.log(`✗ 执行失败`);
    results.suites.push({ file, status: 'error', error: error.message });
    totalFail++;
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
const projectRoot = path.join(__dirname, '..');
const luaFiles = fs.readdirSync(projectRoot)
  .filter(f => f.endsWith('.lua') && !f.startsWith('DEBUG'))
  .slice(0, 5); // 先测试5个文件

const compressionStats = [];

luaFiles.forEach(file => {
  const filePath = path.join(projectRoot, file);
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
