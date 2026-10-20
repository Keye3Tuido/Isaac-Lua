--地图显示。

--[[
作为模板: true
模板id: reveal-map
说明: 每次进入新房间时揭示全图。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_NEW_ROOM,function(l,s)l=Game():GetLevel()s=l:GetRooms()for i=1,#s do l:GetRoomByIdx(s:Get(i-1).SafeGridIndex).DisplayFlags=5 end l:UpdateVisibility()end)
