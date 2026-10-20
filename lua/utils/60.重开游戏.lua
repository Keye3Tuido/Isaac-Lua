--重开游戏。

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
参数:
  P1: {类型: "角色枚举", 性质: "局部", 默认: "PlayerType.PLAYER_JUDAS_B", 说明: "PlayerType枚举表达式；示例：PlayerType.PLAYER_JUDAS_B、PlayerType.PLAYER_KEEPER_B"}
]]
l local A,B,C,Z=Isaac,ModCallbacks.MC_POST_UPDATE,{}Z=function()A.ExecuteCommand('restart '..P1)A.RemoveCallback(C,B,Z)end A.AddCallback(C,B,Z)
