--子弹时间
--推荐攻击方式：眼泪攻击
--除非重新加载了模组，否则不要重复输入代码！

---- 代码效果(不用管中文，全选复制即可) ----

--0. 删除匿名模组的回调。游戏胜利后自动清理代码效果。
--控制台输入 lua CLM() 可删除所有匿名模组的回调，用于预防重复输入代码和清理代码效果。
--重复输入此代码不额外生效。
l local A,I,M,t,m=ModCallbacks,Isaac,'Mod'function CLM()for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end CLM()I.AddCallback({},A.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)

--1. 强制给予玩家道具282(跳跃教程)。
l Isaac.AddCallback({},31,function(c,p,n)if 40~=p:GetPlayerType()and not p:HasCurseMistEffect()then for _,i in pairs({282})do c,n=table.unpack(type(i)=='table'and i or{i,1})while n>p:GetCollectibleNum(c)do p:AddCollectible(c,Isaac.GetItemConfig():GetCollectible(c).InitCharge)end Game():GetItemPool():RemoveCollectible(c)end end end)

--2. 强制给予玩家饰品149(紧急按钮)。
l Isaac.AddCallback({},31,function(a,p,b)if 40~=p:GetPlayerType()and not p:HasCurseMistEffect()then b='Parent'a=p[b]p[b]=nil for _,i in pairs({149})do if not p:HasTrinket(i)then p:DropTrinket(p.Position+p.PositionOffset,true)p:AddTrinket(i)p:UseActiveItem(479,3339)end end p[b]=a end end)

--3. 实时监测游戏帧率，可使用指令：lua SetTimeScale(数值) 来设置游戏速率(默认1，最小0)。
-- GetTimeScale()可获取{[1]=当前渲染帧倍率,[2]=当前逻辑帧倍率}。
-- 由于监测数据和调控速率之间存在延迟，实际效果与预期效果会有一定偏差。
l local H,I,J,K,M,N,O,P,U,V,X,T,A,B,C,D,E,F,G,L,Q='GetFrameCount',Isaac,1,Game,ModCallbacks,math.max,1,1,1,1,true,{}A,D,L,B,C=I.AddCallback,I.GetTime,K().IsPaused,I[H],K()[H]Q,E,F,G=X,B(),C(K()),D()A(T,M.MC_POST_RENDER,function()local c,r,g,d=D(),B(),C(K())d=c-G G,E,O=c,r,50/d/3*(r-E)if r&1<1 then F,P=g,50/d/3*(g-F)end if J<1 and not L(K())then if J<O then U=U*1.2 elseif J>O then U=N(U/2,.5)end for i=1,U do I.GetRoomEntities()end end end)A(T,M.MC_POST_UPDATE,function()if Q and J>1 and not L(K())then if J>P then V=V*1.2 elseif J<P then V=N(V/2,.5)end Q=false for i=1,V do K():Update()end Q=X end end)function SetTimeScale(v)J=N(tonumber(v)or 1,0)end function GetTimeScale()return{O,P}end

--4. 游戏1.5倍速运行。
-- 可通过指令 lua TimeScale = 数值 来调整默认游戏速率(默认1.5倍)。
-- 紧急按钮触发主动道具时，将会进入子弹时间状态 5 秒。
-- 可通过指令 lua BulletTime = 数值 来调整子弹时间的持续时间(默认5秒)。
-- 依赖代码3.
l BulletTime=5;TimeScale=1.5;local A,B,C,I,M,T=Isaac.AddCallback,TimeScale,ButtonAction,Input.IsActionTriggered,ModCallbacks,{}A(T,M.MC_PRE_USE_ITEM,function(_,_,_,p)local x=p.ControllerIndex if not(I(C.ACTION_ITEM,x)or I(C.ACTION_PILLCARD,x))then B=.1 end end)A(T,M.MC_POST_UPDATE,function()local t=TimeScale SetTimeScale(B<t and B or t)if B<t then B=B+.03/BulletTime end end)

--5. 强制非精英敌人变为精英怪(仅包括10粉色变种，“0”和“1”可替换为非负整数表示权重)。
l local A,I,C={[0]=0,[1]=0,[2]=0,[3]=0,[4]=0,[5]=0,[6]=0,[7]=0,[8]=0,[9]=0,[10]=1,[11]=0,[12]=0,[13]=0,[14]=0,[15]=0,[16]=0,[17]=0,[18]=0,[19]=0,[20]=0,[21]=0,[22]=0,[23]=0,[24]=0,[25]=0},'InitSeed',{}for k,v in pairs(A)do for _=1,v do C[#C+1]=k end end Isaac.AddCallback({}, ModCallbacks.MC_NPC_UPDATE, function(_,e)if e:IsVulnerableEnemy()and e:IsActiveEnemy(false)and not e:IsBoss()and not e:IsInvincible()and not e:IsChampion()then e:MakeChampion(e[I],C[e[I]%#C+1])end end)

--6. 角色受到惩罚伤害时,会清除所有投射物。
l local function Action(p,a,f,s,c)for k,v in pairs(Isaac.FindByType(EntityType.ENTITY_PROJECTILE))do v:Remove()end end;local D,E=DamageFlag,EntityType Isaac.AddCallback({},ModCallbacks.MC_ENTITY_TAKE_DMG,function(_,e,a,f,s,c)e=e:ToPlayer()if e:GetPlayerType()==PlayerType.PLAYER_JACOB_B and s.Type==E.ENTITY_DARK_ESAU or 0<f&(D.DAMAGE_RED_HEARTS|D.DAMAGE_IV_BAG|D.DAMAGE_FAKE|D.DAMAGE_NO_PENALTIES)then return end Action(e,a,f,s,c)end,E.ENTITY_PLAYER)

--7. 眼泪实体有固定概率替换为橡皮擦。投射物更加危险。
l local A,B,C,D,E,F,G,M,T=Isaac.AddCallback,{'ERASER'},ProjectileFlags,{'CHANGE_FLAGS_AFTER_TIMEOUT','C.CHANGE_VELOCITY_AFTER_TIMEOUT'},table,{},'InitSeed',ModCallbacks,{}for k,v in pairs(C)do E.insert(F,v)for i,j in pairs(D)do if k==j then E.remove(F,#F)end end end A(T,M.MC_POST_TEAR_INIT,function(_,t)local f=t[G]&15 if f<#B then t:ChangeVariant(TearVariant[B[f+1]])end end)A(T,M.MC_POST_PROJECTILE_INIT,function(_,p)for i=1,2 do p:AddProjectileFlags(F[p[G]*i%#F+1])end end)
--.