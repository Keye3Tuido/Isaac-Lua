--洒洒水啦~

--[[
模板: blind-permanent
]]

--[[
模板: multi-choice-spawn
]]

--[[
模板: remove-collectibles
]]

--[[
说明: "所有玩家攻击方式变更为自动攻击"
]]
l local F,T,S,D=Isaac.AddCallback,{},'InitSeed'D=function(e)local k=e[S]T[k]=T[k]or{}return T[k]end F({},8,function(d,p)d=D(p)if d.s then d.s:Remove()d.s=nil end end,1<<8)F({},18,function(t)t={}for k,v in pairs(T)do if v then t[k]=v end end T=t end)F({},31,function(d,p)d=D(p)if d.s and d.s:Exists()then d.s.TargetPosition=p.Position d.s.Visible=false else if d.s then d.s:Remove()end d.s=Isaac.Spawn(3,120,1,p.Position,Vector.Zero,p)d.s:AddEntityFlags(1<<37)end end)F(T,67,function(_,e)T[e[S]]=nil end)

--[[
模板: restart-game
]]
