// tests2/unit/corpus_boundary.js — 压缩器测试语料不得回耦项目 lua/ 业务目录
'use strict';
const fs = require('fs');
const path = require('path');
const { loadFixtureSegments } = require('../fixtures/corpus');

const TESTS2 = path.resolve(__dirname, '..');
const PROJECT = path.resolve(TESTS2, '../..');

function walkJs(dir, out){
  for(const entry of fs.readdirSync(dir, { withFileTypes:true })){
    if(entry.name === 'node_modules' || entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if(entry.isDirectory()) walkJs(full, out);
    else if(entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function run(){
  let pass = 0, fail = 0;
  const bad = [];
  function ok(cond, label){
    if(cond) pass++;
    else{ fail++; bad.push(label); }
  }

  const banned = [
    { name:'动态仓库语料加载器', re:/repo-lua-files|loadRepoSegments/ },
    { name:'业务语料导出器', re:/export_segments\.py|_repo_segments\.json/ },
    { name:'项目 lua 路径', re:/['"](?:\.\.\/){2,}lua(?:\/|['"])|path\.join\([^;\n]*['"]lua['"]/ }
  ];
  const self = path.resolve(__filename);
  for(const file of walkJs(TESTS2, [])){
    if(path.resolve(file) === self) continue;
    const src = fs.readFileSync(file, 'utf8');
    for(const rule of banned){
      ok(!rule.re.test(src), path.relative(TESTS2, file) + ' 包含' + rule.name);
    }
  }

  ok(!fs.existsSync(path.join(TESTS2, 'repo-lua-files.js')), 'repo-lua-files.js 必须保持删除');
  ok(!fs.existsSync(path.join(PROJECT, 'scripts', 'export_segments.py')), 'export_segments.py 必须保持删除');
  const segments = loadFixtureSegments();
  ok(Object.keys(segments).length > 0, '固定语料不能为空');
  ok(Object.keys(segments).every(k => k.startsWith('fixtures/')), '固定语料键必须属于 fixtures/');

  if(bad.length){
    console.log('--- 语料边界失败 ---');
    bad.forEach(function(b){ console.log('✗', b); });
  }
  return { pass, fail };
}

module.exports = { name:'corpus_boundary', run };
