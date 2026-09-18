--寂
--禁止回溯路线

---- 代码效果 ----

--===--
--[[
模板: safe-wrap-mec
名称: 安全包装
]]

--[[
说明: 启用安全包装。
依赖: [安全包装]
]]
l MEC()

--[[
模板: clean-anon-callbacks
名称: 清理回调
]]

--[[
说明: 游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果。
依赖: [安全包装, 清理回调]
]]
l CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then DEMEC()CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then DEMEC()CLM()Game():FinishChallenge()Game():Fadeout(1,2)end return end end F=p end)

--[[
模板: lock-achievements
]]

--===--

--[[
说明: |-
  所有房间自动清理，并完全陷入黑暗。无法记忆地图。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_NEW_ROOM,function()local R,T,l,m,t,s,r=RoomDescriptor,RoomType.ROOM_BOSS,Game():GetLevel(),Game():GetRoom(),{}s=l:GetRooms()for i=-18,-1 do t[#t+1]=i end for i=1,#s do t[#t+1]=s:Get(i-1).SafeGridIndex end for _,i in pairs(t)do r=l:GetRoomByIdx(i)r.DisplayFlags,r.Flags=RoomDescriptor.DISPLAY_NONE,r.Flags|R.FLAG_CLEAR|R.FLAG_CHALLENGE_DONE|R.FLAG_PITCH_BLACK|R.FLAG_CURSED_MIST|(r.Data and r.Data.Type~=T and R.FLAG_NO_REWARD or 0)end if m:IsFirstVisit()and T==m:GetType()then m:TriggerClear()end end)

--[[
模板: curse-immune
]]

--===--
--[[
模板: restart-game
说明: |-
  重开一局新游戏。
]]
