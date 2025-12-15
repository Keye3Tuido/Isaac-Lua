--天降酸雨
--角色限定：初始攻击方式为眼泪
--输入下面的代码后，开始一局新游戏
--除非重新加载了模组，否则不要重复输入代码！

---- 代码效果(不用管中文，全选复制即可) ----

--0. 删除匿名模组的回调。游戏胜利后自动清理代码效果。
--控制台输入 lua CLM() 可删除所有匿名模组的回调，用于预防重复输入代码和清理代码效果。
--重复输入此代码不额外生效。
l local A,I,M,t,m=ModCallbacks,Isaac,'Mod'function CLM()for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end CLM()I.AddCallback({},A.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)

--1. 强制锁定所有玩家射程为100（受谷底石、天秤影响）；锁定弹速为0（无法更改）
l local f=Isaac.AddCallback f(_,4,function(_,p)p.ShotSpeed=0 end)f(_,8,function(_,p)p.TearRange=4e3 end,8)

--2. 强制给予玩家道具149-吐根酊,315-怪异磁铁,330-豆奶,540-扁石。
l Isaac.AddCallback({},31,function(c,p,n)if 40~=p:GetPlayerType()and not p:HasCurseMistEffect()then for _,i in pairs({149,315,330,540})do c,n=table.unpack(type(i)=='table'and i or{i,1})while n>p:GetCollectibleNum(c)do p:AddCollectible(c,Isaac.GetItemConfig():GetCollectible(c).InitCharge)end Game():GetItemPool():RemoveCollectible(c)end end end)
--.