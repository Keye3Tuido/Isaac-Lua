--绯红之王
--除非重新加载了模组，否则不要重复输入代码

---- 代码效果(不用管中文，全选复制即可) ----

--0. 删除匿名模组的回调。游戏胜利后自动清理代码效果。
--控制台输入 lua CLM() 可删除所有匿名模组的回调，用于预防重复输入代码和清理代码效果。
--重复输入此代码不额外生效。
l local A,I,M,t,m=ModCallbacks,Isaac,'Mod'function CLM()for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end CLM()I.AddCallback({},A.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)

--1. 每10秒会删除角色1.5秒的时间
l local s,a,e,n=0,1 Isaac.AddCallback({},1,function()e=Isaac.GetTime()if a and e-s>1e4 then s=e a=n for _=1,45 do Game():Update()end a=1 end end)
--.