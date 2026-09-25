--丢雷佬

--[[
模板: blind-permanent
]]

--[[
说明: "玩家放置炸弹改为托举炸弹（被托举的炸弹与道具-胎儿博士-拥有相同的伤害与特效），同时不再消耗炸弹数量："
]]
l local I,Z,F,P=Isaac,Vector.Zero,Isaac.AddCallback,'Position'F({},2,function()for i=0,Game():GetNumPlayers()-1 do local p,d,b=I.GetPlayer(i)d=p.ControllerIndex if Input.IsActionTriggered(8,d)and not p:IsHoldingItem()then if p:GetNumGigaBombs()>0 then b=I.Spawn(4,17,0,p[P],Z,p):ToBomb()p:AddGigaBombs(-1)else b=p:FireBomb(p[P],Z)end b.Flags=p:GetBombFlags()p:TryHoldEntity(b)end end end)F({},13,function(_,e,_,a)if e and e:ToPlayer()and a==8 then return false end end,1)

--[[
说明: "炸弹掉落物50%替换为超级炸弹，50%替换为大笑脸炸弹："
]]
l local I,F=Isaac,Isaac.AddCallback F({},24,function(_,t,v,s,_,_,_,d)if t==5 and v==40 then if d&1==0 then s=7 else t,v,s=4,4,0 end end return{t,v,s,d}end)F({},34,function(_,e)if e.SubType~=7 then I.Spawn(5,40,0,e.Position,e.Velocity,e.SpawnerEntity)e:Remove()end end,40)

--[[
模板: restart-game
]]
