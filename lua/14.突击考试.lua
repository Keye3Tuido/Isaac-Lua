--突击考试
--禁止贪婪模式、禁止回溯路线

---- 代码效果 ----

--0. 前置功能性代码：避免代码污染和重复输入问题;
--默认锁定游戏成就;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--提供接口: CLM()删除匿名回调, MEC()包装报错模组, DEMEC()恢复对报错模组的包装
l local c,a,b,i,e,g,h,j,d=table,Isaac,pairs,ModCallbacks,'unpack','AddPriorityCallback','RemoveCallback','GetCallbacks','Function'if not(REPENTOGON or _MEC)then _MEC=true local o,u,m,l,r,p=false,function(f)return function(...)local k=c.pack(pcall(f,...))if k[1]then return c[e](k,2,k.n)end end end,{},{},a[g],a[h]local q=function(f)local k=m[f]or u(f)m[k]=f m[f]=k l[f]=(l[f]or 0)+1 return k end local w,x=function(s,t,v,f,k)r(s,t,v,q(f),k)end,function(s,t,f)if l[f]then p(s,t,m[f])l[f]=l[f]-1 if l[f]<1 then local n={}for k,v in b(l)do if k~=f then n[k]=v end end l=n n={}for k,v in b(m)do if k~=f and v~=f then n[k]=v end end m=n end else p(s,t,f)end end function MEC()if not o then a[g]=w a[h]=x for _,k in b(i)do local n=a[j](k)for _,f in b(n)do f[d]=q(f[d])end end o=true end end function DEMEC()if o then a[g]=r a[h]=p for _,k in b(i)do local n=a[j](k)for _,f in b(n)do f[d]=m[f[d]]or f[d]end end m={}l={}o=false end end end --[[ 包装报错模组 ]]MEC()function CLM(t,m)for i,j in pairs(ModCallbacks)do t=Isaac.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then Isaac.RemoveCallback(m,j,t[x].Function)end end end end --[[ 清理匿名模组回调,预防代码污染 ]]CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then DEMEC()CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then DEMEC()CLM()end return end end F=p end) --[[ 自动清理回调 ]] Isaac.AddPriorityCallback({},ModCallbacks.MC_POST_GAME_STARTED,CallbackPriority.IMPORTANT,function(_,c)if not c then Isaac.ExecuteCommand('seed '..Seeds.Seed2String(Game():GetSeeds():GetNextSeed()))end end) --[[ 游戏锁定成就 ]]

--1. 从游戏中移除道具252(小药袋)、道具477(虚空)、道具523(搬家盒)、道具580(红钥匙)、道具675(碎裂的宝珠)和道具706(无底坑)。
-- 特判：不阻止触发红钥匙效果
l local I,C,Y,T,A=Isaac,{252,477,523,580,675,706},true,{}A=I.AddCallback A(T,23,function(_,c)for _,v in pairs(C)do if c==v and c~=580 then return Y end end end)A(T,31,function(_,p)for _,i in pairs(C)do while p:HasCollectible(i)do p:RemoveCollectible(i)end end end)A(T,37,function(p,f,v,s)if v==100 then repeat p,f=Game():GetItemPool()for _,i in pairs(C)do if i==s then f,s=1,p:GetCollectible(p:GetLastPool(),Y)break end end until not f return{v,s}end end)

--2. 从游戏中移除符文41(黑符文)、卡牌74(月亮?)和魂石83(该隐的魂石)。
l local b,Y,F,G={41,74,83},true,Isaac.AddCallback,Game()F({},31,function(_,p)for _,i in pairs(b)do for s=0,3 do if p:GetCard(s)==i then p:SetCard(s,0)end end end end)F({},37,function(r,f,v,s)if v==300 then repeat f=Y for _,i in pairs(b)do if i==s then f,r=false,G:GetRandomPlayer(Vector.Zero,0):GetCardRNG(REPENTANCE_PLUS and-1 or 0)s=G:GetItemPool():GetCard(r:GetSeed(),22<s and s<32,Y,31<s and s<42 or 55==s or 80<s)r:Next()break end end until f return{v,s}end end)

--3.从游戏中移除饰品170(水晶钥匙)。
l local G,F,b=32768,Isaac.AddCallback,{170}F({},31,function(_,p)for _,i in pairs(b)do if p:HasTrinket(i)then p:TryRemoveTrinket(i)end end end)F({},37,function(_,f,v,s)if v==350 then repeat f=1 for _,i in pairs(b)do if i|G==s|G then f,s=0,Game():GetItemPool():GetTrinket()break end end until f>0 return{v,s}end end)

--4. 每新进入一层，根据红隐难度生成红钥匙碎片（单连4片、双连3片、三连2片、四连或以上1片）
--屏幕上方显示与红隐相连的非红房间数；若当前层不存在红隐则相连数显示为0、不生成红钥匙碎片。
--空拍红钥匙碎片，会替换为触发道具175-“爸爸的钥匙”。
--若当前层存在红隐，玩家找到红隐之前无法拾取非任务道具和硬币。
l local B,C,M,I,G,P,V,D,L,R,A,T,S,X,O,J,K,W,Q,Z,N,H,F,U,E=Color,0,math.abs,Isaac,Game(),'SubType','Variant','DisplayFlags','GetLevel','GetRooms','Data','Type','SafeGridIndex','GetRoomByIdx','Color','GetCard','SetCard','GetPill','SetPill',{}H,N,F,U,E=function(x,y)return M(x%13-y%13)+M(x//13-y//13)end,I.GetTime,I.AddCallback,function(s,r,l)l=G[L](G)s=l[R](l)for i=1,#s do r=s:Get(i-1)if r[A][T]==29 then return r end end end,function(p)return p[V]==20 or p[V]==100 and p[P]~=0 and not I.GetItemConfig():GetCollectible(p[P]):HasTags(1<<15)end F(Z,2,function(u,l,d,s,r)u=U()_Y=not u or u[D]>0 if not _Y and u then l=G[L](G)d=u[S]s=l[R](l)for i=1,#s do r=s:Get(i-1)if H(r[S],d)==1 and r[D]>0 then _Y=1 break end end end I.RenderText(C,I.GetScreenWidth()/2-4,10,not _Y and 1 or 0,_Y and 1 or 0,0,1)for i=1,G:GetNumPlayers()do u=I.GetPlayer(i-1)l=u:GetData()l._=l._ or{T=0}l=l._ if Input.IsActionPressed(10,u.ControllerIndex)and 78==u[J](u,0)and l.T+500<N()and not u:IsHoldingItem()and u:CanPickupItem()then l.T=N()s=u[W](u,1)if s~=0 then u[Q](u,0,s)u[Q](u,1,0)else u[K](u,0,u[J](u,1))u[K](u,1,0)end u:UseActiveItem(175)return end end end)F(Z,18,function(l,d,r)C=0 if U()then l=G[L](G)d=U()[S]for i=0,168 do r=l[X](l,i)if r[A]and r.Flags&1024==0 and H(i,d)==2 then C=C+1 end end for _=1,C<5 and 5-C or 1 do I.Spawn(5,300,78,G:GetRoom():GetCenterPos(),Vector.Zero,nil)end end end)F(Z,34,function(_,p)if not _Y and E(p)then p[O]=B(1,0,0,1)end end)F(Z,36,function(_,p)if _Y then p[O]=B(1,1,1,1)end end)F(Z,38,function(_,p,c)if not _Y and c:ToPlayer()and E(p)then return true end end)

--5. 免疫失忆症、免疫迷途诅咒。
l local F=Isaac.AddCallback F({},10,function()Game():GetLevel():RemoveCurses(4)end,25)F({},12,function(_,c)return~4&c end)

--6. 按住TAB键时，角色会吸引非红色硬币
-- 依赖代码4
l local A,M,T=Isaac.AddCallback,ModCallbacks,{}A(T,M.MC_POST_RENDER,function()T.C=false for i=1,Game():GetNumPlayers()do if Input.IsButtonPressed(Keyboard.KEY_TAB,Game():GetPlayer(i-1).ControllerIndex)then T.C=true break end end end)A(T,M.MC_POST_PICKUP_UPDATE,function(_,p)if _Y and T.C then local e,l=Game():GetNearestPlayer(p.Position)l=e.Position-p.Position p.Velocity=3*(l:Length()>10 and math.log(l:Length())or 0)*l:Normalized()p.GridCollisionClass=EntityGridCollisionClass.GRIDCOLL_NONE end end,PickupVariant.PICKUP_COIN)

--重开一局新游戏。
l local A,B,C,Z=Isaac,ModCallbacks.MC_POST_UPDATE,{}Z=function()A.ExecuteCommand'restart'A.RemoveCallback(C,B,Z)end A.AddCallback(C,B,Z)
--.
