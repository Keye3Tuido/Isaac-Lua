--诅咒与地图显示：诅咒免疫、全图揭示与纯黑房间。

--[[
作为模板: true
模板id: curse-immune
说明: 免疫失忆症、免疫迷途诅咒。
]]
l local F=Isaac.AddCallback F({},10,function()Game():GetLevel():RemoveCurses(4)end,25)F({},12,function(_,c)return~4&c end)

--[[
作为模板: true
模板id: curse-immune-quad
说明: 免疫失忆症、免疫???、免疫迷途诅咒、免疫混乱诅咒。
]]
l local A,M,C,P,T=Isaac.AddCallback,ModCallbacks,LevelCurse,PillEffect,{}A(T,M.MC_USE_PILL,function()Game():GetLevel():RemoveCurses(C.CURSE_OF_THE_LOST)end,P.PILLEFFECT_AMNESIA)A(T,M.MC_USE_PILL,function()Game():GetLevel():RemoveCurses(C.CURSE_OF_MAZE)end,P.PILLEFFECT_QUESTIONMARK)A(T,M.MC_POST_CURSE_EVAL,function(_,c)return~(C.CURSE_OF_THE_LOST|C.CURSE_OF_MAZE)&c end)

--[[
作为模板: true
模板id: reveal-map
说明: 每次进入新房间时揭示全图。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_NEW_ROOM,function(l,s)l=Game():GetLevel()s=l:GetRooms()for i=1,#s do l:GetRoomByIdx(s:Get(i-1).SafeGridIndex).DisplayFlags=5 end l:UpdateVisibility()end)

--[[
作为模板: true
模板id: pitch-black
说明: 所有房间陷入黑暗
名称: 纯黑房间
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_NEW_ROOM,function(l,r)l=Game():GetLevel()r=l:GetRoomByIdx(l:GetCurrentRoomIndex())r.Flags=r.Flags|RoomDescriptor.FLAG_PITCH_BLACK end)
