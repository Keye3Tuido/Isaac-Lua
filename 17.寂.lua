--寂
--禁止回溯路线
--输入下面的代码后，重新开始一局新游戏
--除非重新加载了模组，否则不要重复输入代码！

---- 代码效果(不用管中文，全选复制即可) ----

--0. 删除匿名模组的回调。游戏胜利后自动清理代码效果。
--控制台输入 lua CLM() 可删除所有匿名模组的回调，用于预防重复输入代码和清理代码效果。
--重复输入此代码不额外生效。
l local A,I,M,t,m=ModCallbacks,Isaac,'Mod'function CLM()for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end CLM()I.AddCallback({},A.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)

--1.所有房间自动清理，并完全陷入黑暗。无法记忆地图。
l Isaac.AddCallback({},ModCallbacks.MC_POST_NEW_ROOM,function()local R,T,l,m,t,s,r=RoomDescriptor,RoomType.ROOM_BOSS,Game():GetLevel(),Game():GetRoom(),{}s=l:GetRooms()for i=-18,-1 do t[#t+1]=i end for i=1,#s do t[#t+1]=s:Get(i-1).SafeGridIndex end for _,i in pairs(t)do r=l:GetRoomByIdx(i)r.DisplayFlags,r.Flags=RoomDescriptor.DISPLAY_NONE,r.Flags|R.FLAG_CLEAR|R.FLAG_CHALLENGE_DONE|R.FLAG_PITCH_BLACK|R.FLAG_CURSED_MIST|(r.Data and r.Data.Type~=T and R.FLAG_NO_REWARD or 0)end if m:IsFirstVisit()and T==m:GetType()then m:TriggerClear()end end)

--2. 免疫失忆症、免疫迷途诅咒。
l local F=Isaac.AddCallback F({},10,function()Game():GetLevel():RemoveCurses(4)end,25)F({},12,function(_,c)return ~4&c end)
--.