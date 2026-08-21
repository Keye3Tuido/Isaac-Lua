--寂
--禁止回溯路线

---- 代码效果 ----

--0. 前置功能性代码：避免代码污染和重复输入问题;
--默认锁定游戏成就;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--提供接口: CLM()删除匿名回调。
l function CLM(t,m)for i,j in pairs(ModCallbacks)do t=Isaac.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then Isaac.RemoveCallback(m,j,t[x].Function)end end end end --[[ 清理匿名模组回调,预防代码污染 ]]CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then CLM()end return end end F=p end) --[[ 自动清理回调 ]] Isaac.AddPriorityCallback({},ModCallbacks.MC_POST_GAME_STARTED,CallbackPriority.IMPORTANT,function(_,c)if not c then Isaac.ExecuteCommand('seed '..Seeds.Seed2String(Game():GetSeeds():GetNextSeed()))end end) --[[ 游戏锁定成就 ]]

--1.所有房间自动清理，并完全陷入黑暗。无法记忆地图。
l Isaac.AddCallback({},ModCallbacks.MC_POST_NEW_ROOM,function()local R,T,l,m,t,s,r=RoomDescriptor,RoomType.ROOM_BOSS,Game():GetLevel(),Game():GetRoom(),{}s=l:GetRooms()for i=-18,-1 do t[#t+1]=i end for i=1,#s do t[#t+1]=s:Get(i-1).SafeGridIndex end for _,i in pairs(t)do r=l:GetRoomByIdx(i)r.DisplayFlags,r.Flags=RoomDescriptor.DISPLAY_NONE,r.Flags|R.FLAG_CLEAR|R.FLAG_CHALLENGE_DONE|R.FLAG_PITCH_BLACK|R.FLAG_CURSED_MIST|(r.Data and r.Data.Type~=T and R.FLAG_NO_REWARD or 0)end if m:IsFirstVisit()and T==m:GetType()then m:TriggerClear()end end)

--2. 免疫失忆症、免疫迷途诅咒。
l local F=Isaac.AddCallback F({},10,function()Game():GetLevel():RemoveCurses(4)end,25)F({},12,function(_,c)return~4&c end)

--重开一局新游戏。
l Isaac.ExecuteCommand'restart'
--.
