--绯红之王
--除非重新加载了模组，否则不要重复输入代码

---- 代码效果(不用管中文，全选复制即可) ----

--0. 控制台输入 lua CLM() 可删除所有匿名模组的回调，用于预防重复输入代码和清理代码效果。
l function CLM()local I,M,t=Isaac,'Mod'for i,j in pairs(ModCallbacks)do t=I.GetCallbacks(j)for x=#t,1,-1 do if not(t[x][M]and t[x][M].Name)then table.remove(t,x)end if #t<1 then I.SetBuiltInCallbackState(j,false)end end end end CLM()

--1. 每10秒会删除角色1.5秒的时间
l local s,a,e,n=0,1 Isaac.AddCallback({},1,function()e=Isaac.GetTime()if a and e-s>1e4 then s=e a=n for _=1,45 do Game():Update()end a=1 end end)
--.