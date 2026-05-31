/**
 * 透明别名合并优化测试
 *
 * 测试场景：当多个局部变量都是同一个全局变量的别名时，
 * 压缩器应该将它们合并为一个全局别名，并删除冗余的局部变量声明。
 *
 * 示例：
 *   原始代码：
 *     local A=ModCallbacks
 *     local B=ModCallbacks
 *     function test1() return A.MC_POST_GAME_END end
 *     function test2() return B.MC_POST_RENDER end
 *
 *   期望输出：
 *     l local a=ModCallbacks function test1()return a.MC_POST_GAME_END end function test2()return a.MC_POST_RENDER end
 *
 *   优化效果：
 *     - A 和 B 的使用都被替换为全局别名 'a'
 *     - A 和 B 的声明被删除
 *     - 节省 23 字符（vs 优化前的 9 字符）
 */

const luaparse = require('../node_modules/luaparse');
const fengari = require('fengari');
require('../core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

// 测试用例 1：基本的透明别名合并
const code1 = `local A=ModCallbacks
local B=ModCallbacks
function test1() return A.MC_POST_GAME_END end
function test2() return B.MC_POST_RENDER end`;

console.log('=== 测试 1: 基本透明别名合并 ===');
console.log('原始代码:');
console.log(code1);
console.log('\n压缩结果:');

try {
    const r1 = LuaMin.compress(code1);
    console.log(r1.output);

    const expected = 'l local a=ModCallbacks function test1()return a.MC_POST_GAME_END end function test2()return a.MC_POST_RENDER end';
    if (r1.output === expected) {
        console.log('\n✓ 测试通过！输出符合期望');
    } else {
        console.log('\n✗ 测试失败！输出不符合期望');
        console.log('期望:', expected);
    }

    const saved = code1.length - r1.bodyLength;
    console.log(`节省: ${saved} 字符`);
} catch(e) {
    console.log('\n✗ 压缩失败:', e.message);
}

console.log('\n' + '='.repeat(50) + '\n');
