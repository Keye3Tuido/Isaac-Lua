--拉撒路不复活。

--[[
作为模板: true
模板id: lazarus-no-revive
说明: 当角色为拉撒路时，转换角色为死亡的拉撒路。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(_,p)if PlayerType.PLAYER_LAZARUS==p:GetPlayerType()then p:ChangePlayerType(PlayerType.PLAYER_LAZARUS2)end end,0)
