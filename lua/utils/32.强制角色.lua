--强制角色。

--[[
作为模板: true
模板id: force-character
名称: 锁定玩家类型
说明: |-
  强制角色为指定PlayerType。
参数:
  P1: {类型: "角色枚举", 默认: "PlayerType.PLAYER_THELOST", 性质: "局部", 说明: "PlayerType枚举值"}
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(_,p)local t=P1 if t~=p:GetPlayerType()then p:ChangePlayerType(t)end end,0)
