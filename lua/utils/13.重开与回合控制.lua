--重开与回合控制：重开、结束回合、连胜与达摩克里斯之剑。

--[[
作为模板: true
模板id: damocles-never-fall
说明: 达摩克里斯之剑永不落下。
]]
l Isaac.AddCallback({},ModCallbacks.MC_FAMILIAR_UPDATE,function(_,f)f.State=1 end,FamiliarVariant.DAMOCLES)

--[[
作为模板: true
模板id: damocles-fall-now
说明: 达摩克里斯之剑立刻落下。
]]
l for _,v in pairs(Isaac.FindByType(EntityType.ENTITY_FAMILIAR,FamiliarVariant.DAMOCLES))do v:ToFamiliar().State=2 end

--[[
作为模板: true
模板id: finish-run-keep-streak
说明: 立即结束本局游戏，并不影响连胜进度。
]]
l Game():FinishChallenge()Game():Fadeout(9,2)

--[[
作为模板: true
模板id: add-win-streak
说明: 连胜次数增加{P2}次。
参数定义:
  P1: {类型: "数值", 默认: "1e3", 性质: "局部", 说明: "增加的连胜次数，1000=1e3"}
  P2: {类型: "描述", 默认: "1000", 性质: "局部", 说明: "说明文本中的连胜次数显示值（1000=1e3）"}
]]
l for _=1,P1 do Game():End(0)end

--[[
作为模板: true
模板id: delirium-teleport
说明: 如果本层存在，则传送玩家到精神错乱房间
]]
l local s,r=Game():GetLevel():GetRooms()for i=1,#s do r=s:Get(i-1)if r.Data.Name=='Delirium'then Game():StartRoomTransition(r.SafeGridIndex,Direction.NO_DIRECTION)break end end

--[[
作为模板: true
模板id: restart-game
说明: |-
  重开一局新游戏。
]]
l local A,B,C,Z=Isaac,ModCallbacks.MC_POST_UPDATE,{}Z=function()A.ExecuteCommand'restart'A.RemoveCallback(C,B,Z)end A.AddCallback(C,B,Z)

--[[
作为模板: true
模板id: restart-as-character
说明: |-
  以指定角色{P1}重开一局新游戏。
参数定义:
  P1: {类型: "角色枚举", 性质: "局部", 默认: "PlayerType.PLAYER_JUDAS_B", 说明: "PlayerType枚举表达式；示例：PlayerType.PLAYER_JUDAS_B、PlayerType.PLAYER_KEEPER_B"}
]]
l local A,B,C,Z=Isaac,ModCallbacks.MC_POST_UPDATE,{}Z=function()A.ExecuteCommand('restart '..P1)A.RemoveCallback(C,B,Z)end A.AddCallback(C,B,Z)
