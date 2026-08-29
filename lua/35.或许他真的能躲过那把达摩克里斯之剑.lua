--或许他真的能躲过那把达摩克里斯之剑
--推荐角色：堕化犹大


---- 代码效果 ----

--0. 前置功能性代码：避免代码污染和重复输入问题;
--默认锁定游戏成就;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--提供接口: CLM()删除匿名回调, MEC()包装报错模组, DEMEC()撤销对报错模组的包装
l local g,a,b,h,d,e,i,c=table,Isaac,pairs,ModCallbacks,'AddPriorityCallback','RemoveCallback','GetCallbacks','Function'if not(REPENTOGON or _MEC)then _MEC=true local n,t,l,j,p=false,function(f)return function(...)local k=g.pack(pcall(f,...))if k[1]then return g.unpack(k,2,k.n)end end end,{},{}p=function(f)local k=l[f]or t(f)l[k]=f l[f]=k j[f]=(j[f]or 0)+1 return k end local q,o,u=a[d],a[e]u=function(f,k,m,r,s)q(f,k,m,p(r),s)end local function w(r,s,f)if j[f]then o(r,s,l[f])j[f]=j[f]-1 if 1>j[f]then local m={}for k,v in b(j)do if k~=f then m[k]=v end end j=m m={}for k,v in b(l)do if k~=f and v~=f then m[k]=v end end l=m end else o(r,s,f)end end function MEC()if not n then a[d]=u a[e]=w for _,k in b(h)do _=a[i](k)for _,f in b(_)do f[c]=p(f[c])end end n=true end end function DEMEC()if n then a[d]=q a[e]=o for _,k in b(h)do _=a[i](k)for _,f in b(_)do f[c]=l[f[c]]or f[c]end end l={}j={}n=false end end end --[[ 包装报错模组 ]]MEC()function CLM(t,m)for i,j in pairs(ModCallbacks)do t=Isaac.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then Isaac.RemoveCallback(m,j,t[x].Function)end end end end --[[ 清理匿名模组回调,预防代码污染 ]]CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then DEMEC()CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then DEMEC()CLM()Game():FinishChallenge()Game():Fadeout(1,2)end return end end F=p end) --[[ 自动清理回调 ]] Isaac.AddPriorityCallback({},ModCallbacks.MC_POST_GAME_STARTED,CallbackPriority.IMPORTANT,function(_,c)if not c then Isaac.ExecuteCommand('seed '..Seeds.Seed2String(Game():GetSeeds():GetNextSeed()))end end) --[[ 游戏锁定成就 ]]

--1. 初始给予玩家道具58(影之书)。
l local I,G=Isaac,Game()I.AddCallback({},15,function(p,c,t,n)if not c then for _,i in pairs{58}do for k=1,G:GetNumPlayers()do p,t,n=I.GetPlayer(k-1),table.unpack(type(i)=='table'and i or{i,1})for _=1,n do p:AddCollectible(t,I.GetItemConfig():GetCollectible(t).InitCharge)end end G:GetItemPool():RemoveCollectible(t)end end end)

--2. 强制给予玩家：道具656(达摩克里斯之剑-被动)
-- 主动道具数量不够时，强制锁门，房间内生成对应道具
-- 格式：c=道具,t/T=饰品(仅保证层数一致),物品={'类别',数量};数量为一时可简化为物品='类别'; 道具id必须>0
l ITEMS={'c656'}local C,D,E,F,H,I,P,Q,L,M,T=CollectibleType,'OLLECTIBLE','GetPlayerType',PlayerType,'Get',Isaac,pairs,EntityType,'Remove',ModCallbacks,{}local A,B,G,J,K,N,O,S,U=I.AddCallback D,B='C'..D,'C'..D:lower()J=H..B K=J..'Num'O=L..B N=function(i,a,b)a,i=table.unpack(type(i)=='table'and i or{i,1})a,b=a:match('(%a)(%d+)')return i,a,tonumber(b)end G=function(_,a,b,p)for _,i in P(ITEMS)do i,a,b=N(i)if a=='c'then while 0<p[K](p,b)do p[O](p,b)end end end end A(T,M.MC_POST_PLAYER_UPDATE,function(a,p,b,c,e,g,h,j,k,l)if F.PLAYER_THESOUL_B~=p[E](p)and not p:HasCurseMistEffect()then c=I.GetItemConfig()e='Trinket'h='Add'for _,i in P(ITEMS)do i,a,b=N(i)if a=='T'then a='t'i=i*2 end if a=='c'then g=Game():GetItemPool()g[O](g,b)g=0 if not p:IsItemQueueEmpty()then g=p.QueuedItem.Item g=g and g['Is'..B](g)and b==g.ID and 1 or 0 end while i>g+p[K](p,b)do if c[J](c,b).Type==ItemType.ITEM_ACTIVE then S=b break else p[h..B](p,b)end end elseif a=='t'then g=H..e l=h..e while 1 do j=i-p[g..'Multiplier'](p,b)if j<=0 then break end k={}for s=0,1 do k[s]=p[g](p,s)p['Try'..L..e](p,k[s])p[l](p,b|((j>1 and s==0 or j>3)and TrinketType.TRINKET_GOLDEN_FLAG or 0))end p:UseActiveItem(C[D..'_SMELTER'],2315)for s=0,1 do p[l](p,k[s],false)end end end end end end)A(T,M.MC_POST_UPDATE,function(d,r,v,s)if S then r=Game():GetRoom()for _,i in P(DoorSlot)do d=r:GetDoor(i)if d then d:Close()end end d=Q.ENTITY_PICKUP v=PickupVariant.PICKUP_COLLECTIBLE s=I.FindByType if 1>#s(d,v,S)then U=U and U+1 or 1 if U>29 then I.Spawn(d,v,S,r:GetCenterPos(),Vector.Zero,nil)end else U=nil end for _,e in P(s(d,v,0))do e:Remove()end end S=nil end)A(T,M.MC_PRE_USE_ITEM,G,C[D..'_D4'])A(T,M.MC_ENTITY_TAKE_DMG,function(d,e,u,f)d=DamageFlag u='DAMAGE_'e=e:ToPlayer()if F.PLAYER_EDEN_B==e[E](e)and 0==f&(d[u..'RED_HEARTS']|d[u..'IV_BAG']|d[u..'FAKE']|d[u..'NO_PENALTIES'])then G(e,e,e,e)end end,Q.ENTITY_PLAYER)

--3. 随机3~10分钟内，达摩克里斯之剑会落下。
-- 落下前会提前0.5秒播放警示音效、掉落动画开始播放0.5秒后剑头落地。
-- 控制台输入：lua DAMOCLES_ALARM=true 开启预警(默认开启)
-- 控制台输入：lua DAMOCLES_ALARM=false 关闭预警
l DAMOCLES_ALARM=true;local A,B,C,D,U,V,W,X,Y,Z=Isaac,ModCallbacks,'GetFrameCount',{}Z=A.AddCallback Y=function()W=Game()W=W[C](W)X,V=W+math.random(5400,18e3)end Z(D,B.MC_POST_UPDATE,function(g)g=Game()if U and W>g[C](g)then X=U.x W=U.w V=U.v end end)Z(D,B.MC_POST_GAME_STARTED,function(_,c)if not c then U=Y()end end)Z(D,B.MC_FAMILIAR_UPDATE,function(g,e,s)g=Game()s='State'g=g[C](g)if X then if g<X then if g-W>16 then e[s]=1 end else e[s]=2 U={v=V,w=W,x=X}Y()end if X-g<16 and not V then V=X if DAMOCLES_ALARM then SFXManager():Play(SoundEffect.SOUND_BERSERK_END,3)end end end end,FamiliarVariant.DAMOCLES)

--4. 从游戏中移除道具81(嗝屁猫)和210(狸猫树叶)
l local I,C,Y,T,A=Isaac,{81,210},true,{}A=I.AddCallback A(T,23,function(_,c)for _,v in pairs(C)do if c==v then return Y end end end)A(T,31,function(_,p)for _,i in pairs(C)do while p:HasCollectible(i)do p:RemoveCollectible(i)end end end)A(T,37,function(p,f,v,s)if v==100 then repeat p,f=Game():GetItemPool()for _,i in pairs(C)do if i==s then f,s=1,p:GetCollectible(p:GetLastPool(),Y)break end end until not f return{v,s}end end)

--5. 当角色为拉撒路时，转换角色为死亡的拉撒路。
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(_,p)if PlayerType.PLAYER_LAZARUS==p:GetPlayerType()then p:ChangePlayerType(PlayerType.PLAYER_LAZARUS2)end end)

--重开一局新游戏。
l local A,B,C,Z=Isaac,ModCallbacks.MC_POST_UPDATE,{}Z=function()A.ExecuteCommand'restart'A.RemoveCallback(C,B,Z)end A.AddCallback(C,B,Z)
--.
