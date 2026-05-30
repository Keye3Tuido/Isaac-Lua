const luaparse=require('../node_modules/luaparse');
const fengari=require('fengari');
require('../core.js');
const LuaMin=globalThis.LuaMin.create(luaparse, fengari);

// 一段“正常编写格式”的代码（带缩进、长变量名、注释），看压缩效果
const pretty = `
-- 给予玩家若干道具
local Isaac = Isaac
local items = {116, 356, 468}
Isaac.AddCallback({}, ModCallbacks.MC_POST_PLAYER_UPDATE, function(_, player)
    for index = 1, #items do
        local collectibleId = items[index]
        if not player:HasCollectible(collectibleId) then
            player:AddCollectible(collectibleId)
        end
    end
end)
`;
const r=LuaMin.compress(pretty);
console.log('原始长度:', pretty.length);
console.log('结构后  :', r.stages[0].len, r.stages[0].code);
console.log('编码后  :', r.bodyLength);
console.log('输出    :', r.output);
console.log('重命名数:', r.renamedCount);
