// tests2/run.js — v2 测试总入口：依序运行 tests2/unit 下全部套件，
// 逐套件打印 `=== name: X pass, Y fail ===`（与 v1 测试同款风格），
// 末尾打印总计；任一失败则进程退出码非零。
'use strict';
const fs = require('fs');
const path = require('path');

const SUITE_DIRS = ['unit', 'corpus', 'regression'];   // 后续里程碑追加 composition / fuzz

let totalPass = 0, totalFail = 0;
for(const dir of SUITE_DIRS){
  const abs = path.join(__dirname, dir);
  if(!fs.existsSync(abs)) continue;
  const files = fs.readdirSync(abs).filter(function(f){ return f.endsWith('.js') && f[0] !== '_'; }).sort();
  for(const f of files){
    const suite = require(path.join(abs, f));
    if(!suite || typeof suite.run !== 'function'){
      console.log('=== ' + f + ': 套件未导出 run()，跳过 ===');
      continue;
    }
    const r = suite.run();
    console.log('=== ' + (suite.name || f) + ': ' + r.pass + ' pass, ' + r.fail + ' fail ===');
    totalPass += r.pass; totalFail += r.fail;
  }
}
console.log('\n=== tests2 TOTAL: ' + totalPass + ' pass, ' + totalFail + ' fail ===');
process.exit(totalFail ? 1 : 0);
