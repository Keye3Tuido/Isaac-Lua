/**
 * 压缩统计数据收集脚本
 * 收集每个测试条目的详细压缩数据
 */

const luaparse = require('../node_modules/luaparse');
const fengari = require('fengari');
require('../core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

function stripPrefixes(code) {
    return code.split(/\r?\n/).map(line => {
        return line.replace(/^[ \t]*(?:lua|l)[ \t]+/, '');
    }).join('\n');
}

const testCases = [
    {
        name: 'test_merge_locals',
        lines: [
            'l local a=ModCallbacks',
            'l local b=ModCallbacks',
            'l function test1() return a.MC_POST_GAME_END end',
            'l function test2() return b.MC_POST_RENDER end'
        ]
    },
    {
        name: 'test_incremental - case1',
        lines: [
            'l function add(x,y) return x+y end',
            'l function sub(x,y) return x-y end',
            'l function mul(x,y) return x*y end'
        ]
    },
    {
        name: 'test_incremental - case2',
        lines: [
            'l local g=Game():GetRoom()',
            'l local d=g:GetDoor(DoorSlot.LEFT0)',
            'l if d then d:Open() end'
        ]
    }
];

console.log('=== 详细压缩统计 ===\n');

testCases.forEach((testCase, idx) => {
    console.log(`测试 ${idx + 1}: ${testCase.name}`);
    console.log('-'.repeat(60));

    const bareLines = testCase.lines.map(stripPrefixes);
    const mergedBare = bareLines.join('\n');

    console.log('单条压缩:');
    bareLines.forEach((bare, i) => {
        const result = LuaMin.compress(bare);
        const ratio = ((bare.length - result.bodyLength) / bare.length * 100).toFixed(2);
        console.log(`  [${i + 1}] ${bare.length} → ${result.bodyLength} (${ratio}%)`);
    });

    const mergedResult = LuaMin.compress(mergedBare);
    const mergedRatio = ((mergedBare.length - mergedResult.bodyLength) / mergedBare.length * 100).toFixed(2);
    console.log(`合并压缩: ${mergedBare.length} → ${mergedResult.bodyLength} (${mergedRatio}%)`);
    console.log();
});
