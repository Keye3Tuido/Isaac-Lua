--异食游戏
--输入下面的代码后，开始一局新游戏
--除非重新加载了模组，否则不要重复输入代码！
--注意：使用创世记仅最多生成一组3选1饰品。

---- 代码效果(不用管中文，全选复制即可) ----

--0. 删除匿名模组的回调。游戏胜利后自动清理代码效果。
--控制台输入 lua CLM() 可删除所有匿名模组的回调，用于预防重复输入代码和清理代码效果。
--重复输入此代码不额外生效。
l local A,I,M,t,m=ModCallbacks,Isaac,'Mod'function CLM()for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end CLM()I.AddCallback({},A.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)

--1. 死亡证明内的道具、任务道具之外的所有道具均被替换为饰品掉落；角色受伤时自动吃掉携带的饰品
l local F,G=Isaac.AddCallback,Game()F({},11,function(_,e)e:ToPlayer():UseActiveItem(479,3339)SFXManager():Play(157)end,1)F({},37,function(_,_,v,s)if(v==100 and not Isaac.GetItemConfig():GetCollectible(s):HasTags(1<<15)and G:GetLevel():GetCurrentRoomDesc().Data.Name~='Death Certificate')then return{350,G:GetItemPool():GetTrinket()}end end)

--2. 初始给予玩家道具139-妈妈的钱包，249-额外选择，414-更多选择，439-妈妈的盒子，670-选择?
l local I,G=Isaac,Game()I.AddCallback({},15,function(p,c,t,n)if not c then for _,i in pairs({139,249,414,439,670})do for k=1,G:GetNumPlayers()do p,t,n=I.GetPlayer(k-1),table.unpack(type(i)=='table'and i or{i,1})while n>p:GetCollectibleNum(t)do p:AddCollectible(t,I.GetItemConfig():GetCollectible(t).InitCharge)end end G:GetItemPool():RemoveCollectible(t)end end end)
--.