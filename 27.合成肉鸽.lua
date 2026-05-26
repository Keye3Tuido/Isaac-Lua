--合成肉鸽
--禁用角色：雅各&以扫，堕化遗骸，堕化拉撒路，莉莉丝，堕化莉莉丝
--不要小退！不要Rewind！不要后悔！
--输入下面的代码后，重新开始一局新游戏
--除非重新加载了模组，否则不要重复输入代码！

---- 代码效果(不用管中文，全选复制即可) ----

--* 前置功能性代码（重复输入不额外生效）
l if not(REPENTOGON or _CBH)then local D,E,F,I,J,O,P,Y,W,A,B,C,G,H,K,L,Q,R=require'debug',{},'Function',Isaac,'Callback',{},pairs,true,{}_CBH,A,B,C,G,K,Q,R=Y,D.getlocal,D.setlocal,D.sethook,I.GetCallbacks,'Run'..J,function(i)for _,m in P(G(i))do local o=m[F]if not W[o]then m[F]=O[o]or R(o)end end end,function(f)local function r(...)local s={pcall(f,...)}if s[1]then return table.unpack(s,2)end end O[f],W[r]=r,f return r end L=function(i)_,i=A(3,i)if not E[i]then E[i]=Y Q(i)end end for _,i in P(ModCallbacks)do E[i]=Y end function Wrap()if not H then for i,_ in P(E)do Q(i)end C(function(e)local a=D.getinfo(2,'f').func if a==I['AddPriority'..J]then _,a=A(2,4)L(2)if not W[a]then B(2,4,O[a]or R(a))end elseif a==I['Remove'..J]then _,a=A(2,3)L(2)if not W[a]then B(2,3,O[a]or a)end elseif a==I[K]or a==I[K..'WithParam']or a==G then L(1)end end,'c')H=Y end end function Unwrap()if H then C()for i,_ in P(E)do for _,m in P(G(i))do m[F]=W[m[F]]or m[F]end end O,W,H={},{}end end end -- 安全包装,预防模组兼容问题
l local A,I,M=ModCallbacks,Isaac,'Mod'function CLM(t,m)for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end -- 清理匿名模组回调,预防代码污染
--0. 避免代码污染和模组不兼容问题，游戏胜利后自动清除代码效果。
--依赖代码* | 提供接口: CLM()删除匿名回调; Wrap()包装模组回调; Unwrap()取消包装。
l Wrap,Unwrap=Wrap or CLM,Unwrap or CLM Wrap()CLM()Isaac.AddCallback({},ModCallbacks.MC_POST_GAME_END,function(_,f)if not f then Unwrap()CLM()end end)

--1. 所有玩家永久蒙眼（在矿洞逃亡中不生效）。
l Isaac.AddCallback({},31,function(s,p,g,c,f)f,s,g=1,'Challenge',Game()c=g[s]if p:HasCurseMistEffect()then g[s],f=0 p:TryRemoveNullCostume(14)elseif p:CanShoot()then g[s],f=6 p:AddNullCostume(14)end if not f then p:UpdateCanShoot()end g[s]=c end)

--2. 生成6个与玩家类型相同、跟随玩家的炮台；小退后无法继续存档的游戏
-- 玩家的每个炮台攻击倍率为玩家原本属性的1/10
-- 玩家拾取的道具，会复制给绿色编号的炮台
l local F,I,J,K,L,G,H,D,M,N,O,S,T,U,V,W,X,Y,Z,E,Q,R,A,B,C,P=1,Isaac,Game,true,false,GetPtrHash,tostring,FamiliarVariant,ModCallbacks,ButtonAction,CacheFlag.CACHE_DAMAGE,{},{},'GetPlayerType','Parent','Position','Player','ACTION_SHOOT','COLLECTIBLE_','Visible','INCUBUS','KING_BABY'A,P,C=I.AddCallback,I.GetPlayer,{[N[Y..'LEFT']]=K,[N[Y..'RIGHT']]=K,[N[Y..'UP']]=K,[N[Y..'DOWN']]=K}A(T,M.MC_POST_GAME_STARTED,function(_,c)F=1 if c then J():Fadeout(1,5)end end)A(T,M.MC_PRE_GAME_EXIT,function()S={}end)A(T,M.MC_POST_UPDATE,function(m,x,t,d,i,p,h,u)if B then J():GetHUD():AssignPlayerHUDs()end m,B=P()d,i,x,t=0,1,H(G(m)),m[U](m)while d<6 do p=P(i)h=H(G(p))if h==x then I.ExecuteCommand('addplayer '..t)p=P(i)B,h=p,H(G(p))p:AddCacheFlags(O)p:EvaluateItems()end u=p[U](p)if u<PlayerType.NUM_PLAYER_TYPES then d=d+1 if not(p[V]and S[h])then S[h]={n=i,p=p}S[i]=S[h]end end i=i+1 end end)A(T,M.MC_POST_PLAYER_UPDATE,function(u,p,q,m,o,y,z)m=P()u,o,y,z=H(G(p)),CollectibleType,'Item','AddCollectible'if S[u]then p.Size,p[E],p[V],p[W]=0,L,m,m[W]p:SetMinDamageCooldown(1)u=m[U](m)if u~=p[U](p)then p:ChangePlayerType(u)end if not p:HasCurseMistEffect()then for _,v in pairs{o[Z..Q],o[Z..R]}do if not p:HasCollectible(v)then p[z](p,v)end end end elseif u==H(G(m))and not p:IsItemQueueEmpty()then u=p.QueuedItem if not u.Touched and u[y]:IsCollectible()then m,q=u[y].ID,S[F].p q[z](q,m,I.GetItemConfig():GetCollectible(m).InitCharge)p:FlushQueueItem()end end end)A(T,M.MC_INPUT_ACTION,function(t,e,h,a,f)e=e and e:ToPlayer()if e and S[H(G(e))]then t,f=K,L if h==InputHook.GET_ACTION_VALUE then t,f=1,0 end return J():GetFrameCount()%4+4==a and C[a]and t or f end end)A(T,M.MC_FAMILIAR_UPDATE,function(p,f,v)v,p=f.Variant,P()[W]if v==D[R]then f[E],f[W]=L,p elseif v==D[Q]then f:FollowPosition(p+50*Vector.FromAngle(S[H(G(f[X]))].n*60))end end)A(T,M.MC_POST_FAMILIAR_RENDER,function(t,f,o,c)t,o=S[H(G(f[X]))].n,o+I.WorldToRenderPosition(f[W])c,t=t==F and 0 or 1,H(t)I.RenderScaledText(t,o.X-2,o.Y-2,.5,.5,c,1,c,1)end,D[Q])A(T,M.MC_POST_RENDER,function(p)if Input.IsActionTriggered(N['ACTION_DROP'],P().ControllerIndex)then F=F%6+1 end end)A(T,M.MC_EVALUATE_CACHE,function(d,p)if S[H(G(p))]then d='Damage'p[d]=p[d]/7.5 end end,o)

--3. 从游戏中移除道具422(发光沙漏)、482(遥控器)
l local I,C,Y,T,A=Isaac,{422,482},true,{}A=I.AddCallback A(T,23,function(_,c)for _,v in pairs(C)do if c==v then return Y end end end)A(T,31,function(_,p)for _,i in pairs(C)do for _=1,p:GetCollectibleNum(i)do p:RemoveCollectible(i)end end end)A(T,37,function(p,f,v,s)if v==100 then repeat p,f=Game():GetItemPool()for _,i in pairs(C)do if i==s then f,s=1,p:GetCollectible(p:GetLastPool(),Y)break end end until not f return{v,s}end end)

--4. 初始给予玩家道具376(补货)、402(混沌)、416(深口袋)、602(会员卡)。
l local I,G=Isaac,Game()I.AddCallback({},15,function(p,c,t,n)if not c then for _,i in pairs({376,402,416,602})do for k=1,G:GetNumPlayers()do p,t,n=I.GetPlayer(k-1),table.unpack(type(i)=='table'and i or{i,1})while n>p:GetCollectibleNum(t)do p:AddCollectible(t,I.GetItemConfig():GetCollectible(t).InitCharge)end end G:GetItemPool():RemoveCollectible(t)end end end)

--5. 击杀怪物掉落金币
l Isaac.AddCallback({},ModCallbacks.MC_EVALUATE_CACHE,function(t,p)t='TearFlags'p[t]=_G[t].TEAR_COIN_DROP_DEATH|p[t]end,CacheFlag.CACHE_TEARFLAG)
--.