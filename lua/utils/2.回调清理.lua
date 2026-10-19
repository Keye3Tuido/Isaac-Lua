--回调清理：清理匿名模组回调，并清理使用它的代码。

--[[
作为模板: true
模板id: clean-anon-callbacks
名称: 清理回调
说明: 控制台输入 lua CLM() 删除所有匿名模组的回调函数；重复输入此代码不额外生效。
]]
l function CLM(t,m)for _,j in pairs(ModCallbacks)do t=Isaac.GetCallbacks(j)for x=#t,1,-1 do m=t[x]if m and not(m.Mod or{}).Name then Isaac.RemoveCallback(m.Mod,j,m.Function)end end end end

--[[
作为模板: true
模板id: remove-anon-mod-callbacks
说明: 清理所有匿名模组回调。
]]
l local t,m for _,j in pairs(ModCallbacks)do t=Isaac.GetCallbacks(j)for x=#t,1,-1 do m=t[x]if m and not(m.Mod or{}).Name then Isaac.RemoveCallback(m.Mod,j,m.Function)end end end
