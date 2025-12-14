--御灵术
--禁用角色：Lilith, Lilith(Tainted)
--输入下面的代码后，重新开始一局新游戏
--除非重新加载了模组，否则不要重复输入代码！

--简要介绍
--玩家蒙眼，身边会生成小精灵自动攻击敌人，可用鼠标左键指定小精灵的优先攻击位置。
--小精灵兼容角色属性和泪弹特效，不兼容弹道数量和攻击方式。
--击败敌人会释放灵魂，灵魂会给敌人施加负面增益，给玩家提供属性增益。

---- 代码效果(不用管中文，全选复制即可) ----

--0. 删除匿名模组的回调。
--控制台输入 lua CLM() 可删除所有匿名模组的回调，用于预防重复输入代码和清理代码效果。
l function CLM()local I,M,t=Isaac,'Mod'for i,j in pairs(ModCallbacks)do t=I.GetCallbacks(j)for x=#t,1,-1 do if not(t[x][M]and t[x][M].Name)then table.remove(t,x)end if #t<1 then I.SetBuiltInCallbackState(j,false)end end end end CLM()

--1. 所有玩家永久蒙眼（在矿洞逃亡中不生效）。
l Isaac.AddCallback({},31,function(s,p,g,c,f)f,s,g=1,'Challenge',Game()c=g[s]if p:HasCurseMistEffect()then g[s],f=0 p:TryRemoveNullCostume(14)elseif p:CanShoot()then g[s],f=6 p:AddNullCostume(14)end if not f then p:UpdateCanShoot()end g[s]=c end)

--2. 玩家周围每秒生成{射速}只小精灵，小精灵存在时间为{0.37*射程^0.57}秒，飞行速度与{弹速}相关。小精灵会自动攻击房间内的敌人，并对敌人发射{玩家泪弹}，不兼容弹道数量和攻击方式。
--可按住鼠标左键指定小精灵的优先攻击位置。
--击败敌人时，敌人会释放1只灵魂；灵魂会四散逃逸然后飞向玩家，每收集一只灵魂都会为玩家提供{灵魂所属敌人最大生命值1%}的临时或永久属性增益，其中临时属性增益每帧（每秒60次）衰减{0.1%(最低0.001)}。
--灵魂有4种颜色，32.8125%为红色，会对路径上的敌人造成2秒{灼烧}伤害（每秒造成等同于玩家攻击力的伤害），并给予玩家{临时攻击力增益}；32.8125%为绿色，会对路径上的敌人造成2秒{中毒}伤害（每秒造成敌人最大血量10%的伤害(头目为1%)，并给予玩家{临时射速增益}；32.8125%为蓝色，会对路径上的敌人造成3秒{冰冻}效果，并给予玩家{临时射程增益}；1.5625%为白色，会对路径上的敌人使用{圣光}攻击，并给予玩家{永久幸运增益}，圣光会对敌人造成最多6段伤害，每段伤害为{200%玩家的攻击力}。
--场上最多存在100只小精灵，超过时玩家不再召唤小精灵，已存在的小精灵可以触发多次攻击。
--场上最多存在20只灵魂，超过时新的灵魂将被储存入队。场上灵魂数量低于上限时，储存的灵魂将被释放。
--小退和rewind会清除所有增益。
l local Ve,Af,Hf,Ga,Is,Re,Di,Q,R,I,F,B,J,C,Z,O,Y,E,K,G,P,D,L,A,U,M,S,V,W,T,H,N,X='AddVelocity','AddEntityFlags','HasEntityFlags',Game(),'IsVulnerableEnemy','Remove','Distance',math,Random,Isaac,Isaac.AddCallback,Isaac.Spawn,Isaac.GetRoomEntities,Vector,Vector.Zero,Color,true,1e3,1<<37,Isaac.GetFrameCount,'Position','InitSeed','FromAngle','Parent','Variant','Color','MaxHitPoints',1<<29,{[1]={'Damage',function(l,a)return l+a end},[2]={'MaxFireDelay',function(l,a)return(30/(30/(l+1)+a))-1 end},[8]={'TearRange',function(l,a)return l+40*a end},[1024]={'Luck',function(l,a)return l+a end}},{},function(m)local a,b='Size','SizeMulti'return m and m[a]/2*(m[b].X+m[b].Y)or 0 end,{}X=function(e)local s=e[D]N[s]=N[s]or{}return N[s]end F(N,4,function(_,p)p:EvaluateItems()end)for f,t in pairs(W)do F(N,8,function(_,p)local d,s=X(p),t[1]p[s]=t[2](p[s],d[s]or 0)end,f)end F(N,15,function()N,T={},{}end)F(N,29,function(_,e)if e:IsEnemy()and not e:IsInvincible()then N.W=N.W or{}N.W[#N.W+1]=e end end)F(N,31,function(_,p)local d,t,w,s,c=X(p),.5/(1+p[W[2][1]])for f,r in pairs(W)do s=r[1]d[s]=Q.max(0,d[s]and(d[s]-(f~=1024 and Q.max(1e-3,d[s]*1e-3)or 0))or 0)p:AddCacheFlags(f)end d.A=d.A and d.A+t or t if d.A>=1 then d.A=d.A-1 if not N.C or N.C<100 then w=B(E,65,0,p[P]+80*C[L](R()),Z,p)c=w:GetSprite()[M]w[M]=O(c.R,c.G,c.B,2)w[Af](w,K)X(w).T=G()T[w[D]]=p N.C=N.C and N.C+1 or 1 else d.B=d.B and d.B+1 or 1 end end if(not N.I or N.I<20)and N.W and #N.W>0 then w=table.remove(N.W,1)d=B(E,179,1,w[P],90*C[L](R()),w)d.Target=p d[Af](d,K)X(d).H=w[S]/100 t=B(E,166,0,d[P],Z,d)t[A]=d t[Af](t,K)d.Child=t c=d[D]&63 if c<21 then d[M]=O(1,0,0,3)elseif c<42 then d[M]=O(0,1,0,3)elseif c<63 then d[M]=O(0,1,1,3)else d[M]=O(1,1,1,10)end t[M]=d[M]T[d[D]]=p T[t[D]]=p N.I=N.I and N.I+1 or 1 end end)F(N,55,function(_,e)local p,x,j,s,u,a,k,l,v,f,c,t=T[e[D]],Input.GetMousePosition(Y),1/0,e[P]if p then a=X(p)t=.37*(p[W[8][1]]/40)^.57 u=(G()-X(e).T)/60 c=e[M]e[M]=O(c.R,c.G,c.B,2*(1-u/t))if t<u then e[Re](e)return end f=function(m,z)local d,v,t=z or m[P]v=(d-s):Normalized()*p.ShotSpeed if d[Di](d,s)<=H(m)+H(e)then t=p:FireTear(s,10*v,Y,Y)t:AddTearFlags(1)t.Scale=.1 if a.B and a.B>0 then a.B=a.B-1 else e[Re](e)end else e[Ve](e,v)end end if Ga:GetRoom():IsMirrorWorld()then x.X=x.X-2*I.ScreenToWorldDistance(I.WorldToScreen(x)-I.WorldToRenderPosition(C(320,240))).X end if Input.IsMouseBtnPressed(0)then return f(nil,x)else for _,m in pairs(J())do if m[Is](m)and not m[Hf](m,V)then l=m[P][Di](m[P],s)-H(m)if l<j then j,k=l,m end end end end if l then return f(k)end v=(p[P]+80*C[L](R())-s):Normalized()e[Ve](e,.1*v+.2*C[L](R()))end end,65)F(N,55,function(_,e)local p,v,x,w,d,h=T[e[D]]if e[U]~=65 and p then for _,n in pairs(J())do if e[A]then e[P]=e[A].PositionOffset+e[A][P]elseif R()&7==0 then v=(n[P]-e[P]):Normalized()e[Ve](e,((e[D]&1)*2-1)*C(-v.Y,v.X))end if n[Is](n)and not n[Hf](n,V)and n[P][Di](n[P],e[P])<=H(n)+H(e)then x,w=(e[A]and e[A][D]or e[D])&63,EntityRef(p)if x<21 then n:AddBurn(w,60,p[W[1][1]]/30)elseif x<42 then if n:IsBoss()then d=3e3 else d=3e2 end n:AddPoison(w,60,e[S]/d)elseif x<63 then n:AddFreeze(w,90)else h=B(E,19,0,n[P],Z,p)h[A]=p h.CollisionDamage=2*p[W[1][1]]end end end end end)F(N,67,function(_,e)local h,x,p,d,f=X(e).H,e[D]&63,T[e[D]]if p then if e[U]==179 then d=X(p)N.I=N.I and N.I-1 or 0 if x<21 then f=W[1][1]elseif x<42 then f=W[2][1]elseif x<63 then f=W[8][1]else f=W[1024][1]end d[f]=d[f]and d[f]+h or h elseif e[U]==65 then N.C=N.C-1 end end T[e[D]]=nil end,E)F(N,67,function(_,e)N[e[D]]=nil end)

--3. 游戏开始时根据玩家数生成道具653-“驱魔护符”。
l Isaac.AddCallback({},15,function(_,c)if not c then for i=1,Game():GetNumPlayers()do Isaac.Spawn(5,100,653,Isaac.GetPlayer(i).Position,Vector.Zero,nil)end end end)

--4. 若未开启鼠标控制功能则显示鼠标位置。
l Isaac.AddCallback({},2,function(p)if not Options.MouseControl then p=Isaac.WorldToScreen(Input.GetMousePosition(true))Isaac.RenderText('o',p.X-2.2,p.Y-6.4,0,1,1,1)end end)
--.