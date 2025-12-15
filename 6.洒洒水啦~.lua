--洒洒水啦~
--禁用角色：Lilith, Lilith(Tainted)
--输入下面的代码后，开始一局新游戏
--除非重新加载了模组，否则不要重新输入代码！

---- 代码效果(不用管中文，全选复制即可) ----

--0. 删除匿名模组的回调。游戏胜利后自动清理代码效果。
--控制台输入 lua CLM() 可删除所有匿名模组的回调，用于预防重复输入代码和清理代码效果。
--重复输入此代码不额外生效。
l local A,I,M,t,m=ModCallbacks,Isaac,'Mod'function CLM()for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end CLM()I.AddCallback({},A.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)

--1. 所有玩家永久蒙眼（在矿洞逃亡中不生效）。
l Isaac.AddCallback({},31,function(s,p,g,c,f)f,s,g=1,'Challenge',Game()c=g[s]if p:HasCurseMistEffect()then g[s],f=0 p:TryRemoveNullCostume(14)elseif p:CanShoot()then g[s],f=6 p:AddNullCostume(14)end if not f then p:UpdateCanShoot()end g[s]=c end)

--2. 每开启新游戏时，在初始房间根据玩家人数n，生成n组多选一道具(87-洛基的角,229-萌死戳的肺,233-小小星球)
l local V,g,N=Vector,{87,229,233}Isaac.AddCallback({},15,function(_,c)local n,x,y=Game():GetNumPlayers()if not c then x,y=(720-#g*80)/2,(640-n*80)/2 for i=1,n do for j=1,#g do Isaac.Spawn(5,100,g[j],V(x+80*(j-1),y),V.Zero,N):ToPickup().OptionsPickupIndex=i end y=y+80 end end end)

--3. 从游戏中移除道具329(鲁多维科科技)和579(英灵剑)
l local I,C,Y,T,A=Isaac,{329,579},true,{}A=I.AddCallback A(T,23,function(_,c)for _,v in pairs(C)do if c==v then return Y end end end)A(T,31,function(_,p)for _,i in pairs(C)do for _=1,p:GetCollectibleNum(i)do p:RemoveCollectible(i)end end end)A(T,37,function(p,f,v,s)if v==100 then repeat p,f=Game():GetItemPool()for _,i in pairs(C)do if i==s then f,s=1,p:GetCollectible(p:GetLastPool(),Y)break end end until not f return{v,s}end end)

--4. 所有玩家攻击方式变更为自动攻击
l local F,T,S,D=Isaac.AddCallback,{},'InitSeed'D=function(e)local k=e[S]T[k]=T[k]or{}return T[k]end F(T,8,function(d,p)d=D(p)if d.s then d.s:Remove()d.s=nil end end,1<<8)F(T,31,function(d,p)d=D(p)if d.s and d.s:Exists()then d.s.TargetPosition=p.Position d.s.Visible=false else if d.s then d.s:Remove()end d.s=Isaac.Spawn(3,120,1,p.Position,Vector.Zero,p)d.s:AddEntityFlags(1<<37)end end)F(T,67,function(_,e)T[e[S]]=nil end)
--.