--异食游戏
--输入下面的代码后，开始一局新游戏

--注意：使用创世记仅最多生成一组3选1饰品。

---- 代码效果(不用管中文，全选复制即可) ----

--0. 前置功能性代码：避免代码污染和重复输入问题;
--默认锁定游戏成就;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--提供接口: CLM()删除匿名回调。
l function CLM(t,m)for i,j in pairs(ModCallbacks)do t=Isaac.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then Isaac.RemoveCallback(m,j,t[x].Function)end end end end --[[ 清理匿名模组回调,预防代码污染 ]]CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then CLM()end return end end F=p end) --[[ 自动清理回调 ]] Isaac.AddPriorityCallback({},ModCallbacks.MC_POST_GAME_STARTED,CallbackPriority.IMPORTANT,function(_,c)if not c then Isaac.ExecuteCommand('seed '..Seeds.Seed2String(Game():GetSeeds():GetNextSeed()))end end) --[[ 游戏锁定成就 ]]

--1. 死亡证明内的道具、任务道具之外的所有道具均被替换为饰品掉落；角色受伤时自动吃掉携带的饰品
l local F,G=Isaac.AddCallback,Game()F({},11,function(_,e)e:ToPlayer():UseActiveItem(479,3339)SFXManager():Play(157)end,1)F({},37,function(_,_,v,s)if(v==100 and not Isaac.GetItemConfig():GetCollectible(s):HasTags(1<<15)and G:GetLevel():GetCurrentRoomDesc().Data.Name~='Death Certificate')then return{350,G:GetItemPool():GetTrinket()}end end)

--2. 初始给予玩家道具139-妈妈的钱包，249-额外选择，414-更多选择，439-妈妈的盒子，670-选择?
l local I,G=Isaac,Game()I.AddCallback({},15,function(p,c,t,n)if not c then for _,i in pairs{139,249,414,439,670}do for k=1,G:GetNumPlayers()do p,t,n=I.GetPlayer(k-1),table.unpack(type(i)=='table'and i or{i,1})for _=1,n do p:AddCollectible(t,I.GetItemConfig():GetCollectible(t).InitCharge)end end G:GetItemPool():RemoveCollectible(t)end end end)

--.
