--灰蒙蒙的运气
--禁用角色：堕化该隐
--输入下面的代码后，重新开始一局新游戏


---- 代码效果(不用管中文，全选复制即可) ----

--0. 前置功能性代码：避免代码污染和重复输入问题;
--默认锁定游戏成就;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--提供接口: CLM()删除匿名回调。
l function CLM(t,m)for i,j in pairs(ModCallbacks)do t=Isaac.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then Isaac.RemoveCallback(m,j,t[x].Function)end end end end --[[ 清理匿名模组回调,预防代码污染 ]]CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then CLM()end return end end F=p end) --[[ 自动清理回调 ]] Isaac.AddPriorityCallback({},ModCallbacks.MC_POST_GAME_STARTED,CallbackPriority.IMPORTANT,function(_,c)if not c then Isaac.ExecuteCommand('seed '..Seeds.Seed2String(Game():GetSeeds():GetNextSeed()))end end) --[[ 游戏锁定成就 ]]

--1. 从道具池抽取道具时，大部分道具按照品质从低到高抽取；(1/SHUFFLE)*100%的道具会被插入到道具池底部。
l SHUFFLE=8;local f,Z=Isaac f.AddCallback({},ModCallbacks.MC_PRE_GET_COLLECTIBLE,function(a,z,y,x,b,c,d,e,g,h)if not Z then b=f.GetItemConfig()a=Game():GetItemPool()d='GetCollectible'g={}h=Game():GetSeeds():GetStartSeed()for i=0,10 do e=b[d..'s'](b).Size if i<10 then repeat e=e-1 c=b[d](b,e)if c then if not g[e]then g[e]=e~h for j=1,4 do g[e]=g[e]~(g[e]<<((j<<1)+1))~(g[e]>>(((j+1)<<1)+1))end g[e]=g[e]%math.max(1,SHUFFLE)end if c.Quality>i%5 or i<5 and 1>g[e]then a:AddRoomBlacklist(e)end end until e<0 and not c end Z=true c=b[d](b,a[d](a,z,y,x))e=c.ID Z=nil a:ResetRoomBlacklist()if CollectibleType.COLLECTIBLE_BREAKFAST~=e then return e end end end end)

--重开一局新游戏。
l Isaac.ExecuteCommand'restart'
--.
