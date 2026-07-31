--* 控制台输入 lua CLM() 删除所有匿名模组的回调函数，
--重复输入此代码不额外生效。
l function CLM(t,m)for i,j in pairs(ModCallbacks)do t=Isaac.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then Isaac.RemoveCallback(m,j,t[x].Function)end end end end

--.
