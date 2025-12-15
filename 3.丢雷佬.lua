--丢雷佬
--禁用角色：Lilith, Lilith(Tainted)
--除非重新加载了模组，否则不要重复输入代码！

---- 代码效果(不用管中文，全选复制即可) ----

--0. 删除匿名模组的回调。游戏胜利后自动清理代码效果。
--控制台输入 lua CLM() 可删除所有匿名模组的回调，用于预防重复输入代码和清理代码效果。
--重复输入此代码不额外生效。
l local A,I,M,t,m=ModCallbacks,Isaac,'Mod'function CLM()for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end CLM()I.AddCallback({},A.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)

--1. 所有玩家永久蒙眼（在矿洞逃亡中不生效）。
l Isaac.AddCallback({},31,function(s,p,g,c,f)f,s,g=1,'Challenge',Game()c=g[s]if p:HasCurseMistEffect()then g[s],f=0 p:TryRemoveNullCostume(14)elseif p:CanShoot()then g[s],f=6 p:AddNullCostume(14)end if not f then p:UpdateCanShoot()end g[s]=c end)

--2. 玩家放置炸弹改为托举炸弹（被托举的炸弹与道具-胎儿博士-拥有相同的伤害与特效），同时不再消耗炸弹数量：
l local I,Z,F,P=Isaac,Vector.Zero,Isaac.AddCallback,'Position'F({},2,function()for i=0,Game():GetNumPlayers()-1 do local p,d,b=I.GetPlayer(i)d=p.ControllerIndex if Input.IsActionTriggered(8,d)and not p:IsHoldingItem()then if p:GetNumGigaBombs()>0 then b=I.Spawn(4,17,0,p[P],Z,p):ToBomb()p:AddGigaBombs(-1)else b=p:FireBomb(p[P],Z)end b.Flags=p:GetBombFlags()p:TryHoldEntity(b)end end end)F({},13,function(_,e,_,a)if e and e:ToPlayer()and a==8 then return false end end,1)

--3. 炸弹掉落物50%替换为超级炸弹，50%替换为大笑脸炸弹：
l local I,F=Isaac,Isaac.AddCallback F({},24,function(_,t,v,s,_,_,_,d)if t==5 and v==40 then if d&1==0 then s=7 else t,v,s=4,4,0 end end return{t,v,s,d}end)F({},34,function(_,e)if e.SubType~=7 then I.Spawn(5,40,0,e.Position,e.Velocity,e.SpawnerEntity)e:Remove()end end,40)
--.