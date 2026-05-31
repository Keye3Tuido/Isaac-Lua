/**
 * 增量压缩测试
 *
 * 验证规则：
 * 1. 每条裸代码单独压缩，长度只减不增
 * 2. 合并后的裸代码压缩，长度 <= 逐条压缩长度之和
 */

const luaparse = require('../node_modules/luaparse');
const fengari = require('fengari');
require('../core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

// 辅助函数：去除每行的 l/lua 前缀
function stripPrefixes(code) {
    return code.split(/\r?\n/).map(line => {
        return line.replace(/^[ \t]*(?:lua|l)[ \t]+/, '');
    }).join('\n');
}

// 测试用例集
const testCases = [
    {
        name: '多条全局变量引用',
        lines: [
            'l local a=ModCallbacks',
            'l local b=ModCallbacks',
            'l function test1() return a.MC_POST_GAME_END end',
            'l function test2() return b.MC_POST_RENDER end'
        ]
    },
    {
        name: '多条独立函数',
        lines: [
            'l function add(x,y) return x+y end',
            'l function sub(x,y) return x-y end',
            'l function mul(x,y) return x*y end'
        ]
    },
    {
        name: '共享全局变量',
        lines: [
            'l local g=Game():GetRoom()',
            'l local d=g:GetDoor(DoorSlot.LEFT0)',
            'l if d then d:Open() end'
        ]
    }
];

console.log('=== 增量压缩测试 ===\n');

let totalPass = 0;
let totalFail = 0;

testCases.forEach((testCase, idx) => {
    console.log(`测试 ${idx + 1}: ${testCase.name}`);
    console.log('-'.repeat(50));

    // 去除前缀，得到裸代码
    const bareLines = testCase.lines.map(stripPrefixes);
    const mergedBare = bareLines.join('\n');

    console.log('原始代码:');
    testCase.lines.forEach(line => console.log('  ' + line));
    console.log();

    // 测试1: 每条裸代码单独压缩
    const individualResults = [];
    let allIndividualPass = true;

    console.log('单条压缩结果:');
    bareLines.forEach((bare, i) => {
        try {
            const result = LuaMin.compress(bare);
            const originalLen = bare.length;
            const compressedLen = result.bodyLength;
            const saved = originalLen - compressedLen;

            individualResults.push({
                original: bare,
                compressed: result.output,
                originalLen,
                compressedLen,
                saved
            });

            const pass = saved >= 0;
            const status = pass ? '✓' : '✗';
            console.log(`  ${status} [${i + 1}] ${originalLen} → ${compressedLen} (${saved >= 0 ? '+' : ''}${saved})`);

            if (!pass) {
                allIndividualPass = false;
                console.log(`     原始: ${bare}`);
                console.log(`     压缩: ${result.output}`);
            }
        } catch (e) {
            console.log(`  ✗ [${i + 1}] 压缩失败: ${e.message}`);
            allIndividualPass = false;
        }
    });
    console.log();

    // 测试2: 合并后的代码压缩
    console.log('合并压缩结果:');
    let mergedPass = true;
    let mergedResult = null;

    try {
        mergedResult = LuaMin.compress(mergedBare);
        const mergedOriginalLen = mergedBare.length;
        const mergedCompressedLen = mergedResult.bodyLength;
        const mergedSaved = mergedOriginalLen - mergedCompressedLen;

        console.log(`  原始长度: ${mergedOriginalLen}`);
        console.log(`  压缩长度: ${mergedCompressedLen}`);
        console.log(`  节省: ${mergedSaved} 字符`);
        console.log();

        // 比较：合并压缩 vs 逐条压缩之和（包括 'l ' 前缀）
        const individualBareLen = individualResults.reduce((sum, r) => sum + r.compressedLen, 0);
        const individualWithPrefixLen = individualResults.reduce((sum, r) => sum + r.compressedLen + 2, 0); // 每条加 'l '
        const mergedWithPrefixLen = mergedCompressedLen + 2; // 只加一个 'l '
        const mergeBenefit = individualWithPrefixLen - mergedWithPrefixLen;

        console.log('对比分析:');
        console.log(`  逐条压缩裸代码总长度: ${individualBareLen}`);
        console.log(`  逐条压缩含前缀总长度: ${individualWithPrefixLen} (${individualResults.length}个'l '前缀)`);
        console.log(`  合并压缩裸代码长度: ${mergedCompressedLen}`);
        console.log(`  合并压缩含前缀长度: ${mergedWithPrefixLen} (1个'l '前缀)`);
        console.log(`  合并优势: ${mergeBenefit >= 0 ? '+' : ''}${mergeBenefit} 字符`);

        if (mergeBenefit < 0) {
            console.log(`  ✗ 合并压缩（含前缀）反而更长！`);
            mergedPass = false;
        } else {
            console.log(`  ✓ 合并压缩（含前缀）更优`);
        }
    } catch (e) {
        console.log(`  ✗ 合并压缩失败: ${e.message}`);
        mergedPass = false;
    }

    console.log();

    // 测试结果
    const testPass = allIndividualPass && mergedPass;
    if (testPass) {
        console.log(`✓ 测试通过\n`);
        totalPass++;
    } else {
        console.log(`✗ 测试失败\n`);
        totalFail++;
    }

    console.log('='.repeat(50) + '\n');
});

console.log(`\n总结: ${totalPass} 通过, ${totalFail} 失败`);
process.exit(totalFail > 0 ? 1 : 0);
