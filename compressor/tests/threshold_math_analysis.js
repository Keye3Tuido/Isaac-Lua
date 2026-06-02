// 阈值数学推导：分析不同 (m, k) 组合下的临界阈值
// 预筛选条件：(m-1)*k > m+T
// 改写为：m(k-1) - k > T
// 即：T < m(k-1) - k

console.log('全局折叠阈值数学分析');
console.log('=' .repeat(80));
console.log('预筛选条件：(m-1)*k > m+T');
console.log('其中 m=名字长度，k=使用次数，T=阈值\n');

// 计算临界阈值：对于给定的 (m, k)，最大的 T 使得条件成立
function maxThreshold(m, k) {
  return m * (k - 1) - k;
}

// 常见的全局变量名长度
const nameLengths = [
  { range: 'm=3', desc: '短名(如 obj)', values: [3] },
  { range: 'm=4', desc: '短名(如 Game)', values: [4] },
  { range: 'm=5', desc: '中短(如 Isaac)', values: [5] },
  { range: 'm=6-8', desc: '中等(如 Entity)', values: [6, 7, 8] },
  { range: 'm=10-12', desc: '长名(如 ModCallbacks)', values: [10, 11, 12] }
];

// 常见的使用次数
const useCounts = [2, 3, 4, 5, 6];

console.log('临界阈值表（T_max）：\n');
console.log('m\\k  ', useCounts.map(k => k.toString().padStart(4)).join(''));
console.log('-'.repeat(80));

for (let m = 3; m <= 12; m++) {
  const row = [m.toString().padStart(4)];
  for (const k of useCounts) {
    const T_max = maxThreshold(m, k);
    row.push(T_max.toString().padStart(4));
  }
  console.log(row.join(''));
}

console.log('\n' + '='.repeat(80));
console.log('关键临界点分析\n');

// 分析关键的 (m, k) 组合
const criticalCases = [
  { m: 4, k: 2, name: 'Game 用2次' },
  { m: 4, k: 3, name: 'Game 用3次' },
  { m: 5, k: 2, name: 'Isaac 用2次' },
  { m: 5, k: 3, name: 'Isaac 用3次' },
  { m: 6, k: 2, name: 'Entity 用2次' },
  { m: 8, k: 2, name: 'longName 用2次' },
  { m: 12, k: 3, name: 'ModCallbacks 用3次' }
];

criticalCases.forEach(c => {
  const T_max = maxThreshold(c.m, c.k);
  console.log(`${c.name} (m=${c.m}, k=${c.k}):`);
  console.log(`  临界阈值 T_max = ${T_max}`);
  console.log(`  T≤${T_max}: 通过预筛选（会折叠）`);
  console.log(`  T>${T_max}: 不通过预筛选（不折叠）`);
  console.log();
});

console.log('='.repeat(80));
console.log('阈值配置建议\n');

console.log('方案1: [2] (仅激进折叠)');
console.log('  适用：短名字高频使用');
console.log('  通过：m≥4且k≥3, 或 m≥5且k≥2, 或更长名字');
console.log('  不通过：m=3~4且k=2 (最短最低频)');
console.log();

console.log('方案2: [2, 8] (激进+保守)');
console.log('  T=2: 覆盖 m≥5,k≥2 或 m≥4,k≥3');
console.log('  T=8: 覆盖 m≥10,k=2 或 m≥6,k≥3 或更长/更频繁');
console.log('  互补性好，开销最小');
console.log();

console.log('方案3: [2, 7, 8] (增加临界点)');
console.log('  T=7: 专门覆盖 m=5,k=3 的临界情况');
console.log('  但测试显示 T=7 和 T=8 行为相似，可能冗余');
console.log();

console.log('方案4: [2, 4, 8] (当前实现)');
console.log('  T=4: 意图覆盖中间场景');
console.log('  但测试显示 T=4 结果等于 T=2 或 T=8，确认冗余');
console.log();

console.log('='.repeat(80));
console.log('推荐配置: [2, 8]');
console.log('  理由：');
console.log('  1. 数学上覆盖两个极端（激进 vs 保守）');
console.log('  2. 测试验证在5个用例上效果等同 [2,4,8]');
console.log('  3. 性能开销最小（-15%）');
console.log('  4. 简洁易理解');
