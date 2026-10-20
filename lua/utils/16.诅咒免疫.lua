--诅咒免疫。

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
模板id: pitch-black
说明: 所有房间陷入黑暗
名称: 纯黑房间
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_NEW_ROOM,function(l,r)l=Game():GetLevel()r=l:GetRoomByIdx(l:GetCurrentRoomIndex())r.Flags=r.Flags|RoomDescriptor.FLAG_PITCH_BLACK end)
--[[
作为模板: true
模板id: teleport-pill-reveal
说明: |-
  辨认传送胶囊。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(t,p)t=Game():GetItemPool()for _,c in pairs(PillColor)do if t:GetPillEffect(c,p)==PillEffect.PILLEFFECT_TELEPILLS and not t:IsPillIdentified(c)then t:IdentifyPill(c)end end end,0)