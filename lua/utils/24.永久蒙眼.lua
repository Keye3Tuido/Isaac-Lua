--永久蒙眼。

--[[
作为模板: true
模板id: blind-permanent
说明: |-
  所有玩家永久蒙眼（在矿洞逃亡中不生效）。
]]
l Isaac.AddCallback({},31,function(s,p,g,c,f)f=1 s='Challenge'g=Game()c=g[s]if p:HasCurseMistEffect()then g[s],f=0 p:TryRemoveNullCostume(14)elseif p:CanShoot()then g[s],f=6 p:AddNullCostume(14)end if not f then p:UpdateCanShoot()end g[s]=c end,0)
