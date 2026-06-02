// 分析阈值选择的有效性和开销
const fs = require('fs');
const luaparse = require('../node_modules/luaparse');
const fengari = require('fengari');

// 测试用例集合
const testCases = [
  { name: '用户例子', code: 'l local oriChallenge=Game().Challenge Game().Challenge=6 Isaac.GetPlayer():UpdateCanShoot() Isaac.GetPlayer():AddNullCostume(14) Game().Challenge=oriChallenge' },
  { name: 'three_identical', code: "l local A,M=Isaac.AddCallback,ModCallbacks A({},M.MC_POST_UPDATE,func1)\nl local A,M=Isaac.AddCallback,ModCallbacks A({},M.MC_POST_RENDER,func2)\nl local A,M=Isaac.AddCallback,ModCallbacks A({},M.MC_POST_NEW_ROOM,func3)" },
  { name: 'short_globals', code: 'l local x=a.b a.c() a.d() a.e() a.f()' },
  { name: 'medium_globals', code: 'l local x=Entity.HasShield() Entity.GetType() Entity.GetVariant() Entity.GetSubType()' },
  { name: 'long_globals', code: 'l local x=CollectibleType.COLLECTIBLE_SAD_ONION y=CollectibleType.COLLECTIBLE_INNER_EYE z=CollectibleType.COLLECTIBLE_SPOON_BENDER' }
];

// 测试所有可能的阈值
const allThresholds = [2, 3, 4, 5, 6, 7, 8];

console.log('阈值有效性分析\n');
console.log('=' .repeat(80));

testCases.forEach(tc => {
  console.log(`\n测试用例: ${tc.name}`);
  console.log('-'.repeat(80));

  const results = new Map();

  allThresholds.forEach(T => {
    require('../core.js');
    const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

    try {
      const result = LuaMin.compress(tc.code, { thresholds: [T] });
      results.set(T, result.output.length);
      console.log(`  阈值 m+${T}: ${result.output.length} 字符`);
    } catch(e) {
      console.log(`  阈值 m+${T}: 压缩失败`);
    }

    // 清除缓存
    delete require.cache[require.resolve('../core.js')];
  });

  // 分析结果
  const lengths = Array.from(results.values());
  const minLen = Math.min(...lengths);
  const maxLen = Math.max(...lengths);
  const uniqueLengths = new Set(lengths);

  console.log(`  最短: ${minLen}, 最长: ${maxLen}, 差异: ${maxLen - minLen}`);
  console.log(`  唯一长度数: ${uniqueLengths.size}`);

  // 找出产生最短结果的阈值
  const bestThresholds = [];
  results.forEach((len, T) => {
    if (len === minLen) bestThresholds.push(T);
  });
  console.log(`  最优阈值: [${bestThresholds.join(', ')}]`);
});

console.log('\n' + '='.repeat(80));
console.log('开销分析\n');

// 测量实际运行时间
const perfTest = testCases[0].code;
const thresholdSets = [
  { name: '[2, 8]', thresholds: [2, 8] },
  { name: '[2, 4, 8]', thresholds: [2, 4, 8] },
  { name: '[2, 3, 4, 5, 6, 7, 8]', thresholds: [2, 3, 4, 5, 6, 7, 8] }
];

thresholdSets.forEach(set => {
  delete require.cache[require.resolve('../core.js')];
  require('../core.js');
  const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

  const start = Date.now();
  const iterations = 10;

  for (let i = 0; i < iterations; i++) {
    LuaMin.compress(perfTest, { thresholds: set.thresholds });
  }

  const elapsed = Date.now() - start;
  const avgTime = elapsed / iterations;

  console.log(`${set.name}: ${avgTime.toFixed(2)} ms/次 (${iterations}次平均)`);
});

console.log('\n建议：');
console.log('基于以上分析，推荐的阈值配置...');
