const luaparse = require('../node_modules/luaparse');
const fengari = require('fengari');
require('../core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

const code = `local c=ModCallbacks
local M=ModCallbacks
function test1() return c.MC_POST_GAME_END end
function test2() return M.MC_POST_RENDER end`;

console.log('原始代码:');
console.log(code);
console.log();

try {
    const result = LuaMin.compress(code);
    console.log('压缩结果:');
    console.log(result.output);
    console.log();

    const expected = 'l local a=ModCallbacks function test1()return a.MC_POST_GAME_END end function test2()return a.MC_POST_RENDER end';
    if (result.output === expected) {
        console.log('✓ 测试通过！c和M都被正确替换为a');
    } else {
        console.log('✗ 测试失败！');
        console.log('期望:', expected);
    }

    console.log('节省:', code.length - result.bodyLength, '字符');
} catch(e) {
    console.log('✗ 压缩失败:', e.message);
}
