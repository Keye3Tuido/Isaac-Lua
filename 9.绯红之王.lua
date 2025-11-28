--绯红之王
--除非重新加载了模组，否则不要重复输入代码

---- 代码效果(不用管中文，全选复制即可) ----

--1. 每10秒会删除角色1.5秒的时间
l local s,a,e,n=0,1 Isaac.AddCallback({},1,function()e=Isaac.GetTime()if a and e-s>1e4 then s=e a=n for _=1,45 do Game():Update()end a=1 end end)
--.