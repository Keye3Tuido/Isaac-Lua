-- 实用代码合辑

--1. 开启当前层、当前维度，所有能打开的红房间
l local S,D,G,E,L,R,T,C,P,O,m,x='SafeGridIndex','Data','GetRoomByIdx','GetRooms',Game():GetLevel(),{}T=L[E](L)C,O=#T,function(r,i,d)i,d=r[S],r[D] and r[D].Doors for j=0,7 do if(not d or d&1==1)then L:MakeRedRoomDoor(i,j)L:UncoverHiddenDoor(i,j)end d=d and d>>1 end R[i]=true r.DisplayFlags=4 end O(L[G](L,L:GetCurrentRoomDesc()[S]))while P~=C do P=C for i=1,C do m=T:Get(i-1)x=m[S]m=L[G](L,x,N)if not R[x]then O(m)end end T=L[E](L)C=#T end L:UpdateVisibility()

--2. 长按道具键/副手键1s以上=连续多次按键
l local A,M,H,B,K,G=Isaac.AddCallback,ModCallbacks,GetPtrHash,ButtonAction,{'ACTION_ITEM','ACTION_PILLCARD'},{M={}}A(G.M,M.MC_POST_PLAYER_RENDER,function(_,p)local k,n,a=H(p)G[k]=G[k]or{}n=G[k]for _,b in pairs(K)do a=B[b]if Input.IsActionPressed(a,p.ControllerIndex)then n[a]=n[a]or Isaac.GetTime()else n[a]=nil end end end)A(G.M,M.MC_INPUT_ACTION,function(_,e,_,a)e=e and e:ToPlayer()if e then local k,t,s=H(e),Isaac.GetTime()s=G[k]and G[k][a]if s and s<t then return t>1e3+s end end end,InputHook.IS_ACTION_TRIGGERED)A(G.M,M.MC_POST_ENTITY_REMOVE,function(_,e)G[H(e)]=nil end,EntityType.ENTITY_PLAYER)

--3. 所有玩家永久蒙眼（在矿洞逃亡中不生效）。
l Isaac.AddCallback({},31,function(s,p,g,c,f)f,s,g=1,'Challenge',Game()c=g[s]if p:HasCurseMistEffect()then g[s],f=0 p:TryRemoveNullCostume(14)elseif p:CanShoot()then g[s],f=6 p:AddNullCostume(14)end if not f then p:UpdateCanShoot()end g[s]=c end)

--4. 强制给予玩家道具590(水星)、3x道具649(甜甜糖梅宝)。
l Isaac.AddCallback({},31,function(c,p,n)if 40~=p:GetPlayerType()and not p:HasCurseMistEffect()then for _,i in pairs({590,{649,3}})do c,n=table.unpack(type(i)=='table'and i or{i,1})while n>p:GetCollectibleNum(c)do p:AddCollectible(c,Isaac.GetItemConfig():GetCollectible(c).InitCharge)end Game():GetItemPool():RemoveCollectible(c)end end end)

--5. 从游戏中移除捐款机
l Isaac.AddCallback({},18,function()Game():SetStateFlag(17,true)end)

--6. 从游戏中移除饰品85(业报)。
l local G,F,b=32768,Isaac.AddCallback,{85}F({},31,function(_,p)for _,i in pairs(b)do if p:HasTrinket(i)then p:TryRemoveTrinket(i)end end end)F({},37,function(_,f,v,s)if v==350 then repeat f=1 for _,i in pairs(b)do if i|G==s|G then f,s=0,s&G|Game():GetItemPool():GetTrinket()break end end until f>0 return{v,s}end end)

--7. 每开启新游戏时，在初始房间根据玩家人数n，生成n组多选一道具(87-洛基的角,229-萌死戳的肺,233-小小星球)
l local V,g,N=Vector,{87,229,233}Isaac.AddCallback({},15,function(_,c)local n,x,y=Game():GetNumPlayers()if not c then x,y=(720-#g*80)/2,(640-n*80)/2 for i=1,n do for j=1,#g do Isaac.Spawn(5,100,g[j],V(x+80*(j-1),y),V.Zero,N):ToPickup().OptionsPickupIndex=i end y=y+80 end end end)

--8.  从游戏中移除道具329(鲁多维科科技)和579(英灵剑)
l local I,C,Y,T,A=Isaac,{329,579},true,{}A=I.AddCallback A(T,23,function(_,c)for _,v in pairs(C)do if c==v then return Y end end end)A(T,31,function(_,p)for _,i in pairs(C)do for _=1,p:GetCollectibleNum(i)do p:RemoveCollectible(i)end end end)A(T,37,function(p,f,v,s)if v==100 then repeat p,f=Game():GetItemPool()for _,i in pairs(C)do if i==s then f,s=1,p:GetCollectible(p:GetLastPool(),Y)break end end until not f return{v,s}end end)

--9. [不适配手柄]禁止玩家暂停游戏、禁止使用控制台(忏悔+不生效)；可使用Esc返回游戏菜单
l local A,B,M,T,O,P=Isaac.AddCallback,ButtonAction,ModCallbacks,{},Options,'PauseOnFocusLost'A(T,M.MC_POST_RENDER,function()O[P]=false for i=1,Game():GetNumPlayers()do local c=Isaac.GetPlayer(i-1).ControllerIndex if Input.IsActionPressed(B.ACTION_MENUBACK,c)then Game():Fadeout(1,2)end end end)A(T,M.MC_INPUT_ACTION,function(_,_,h,b)if b==B.ACTION_CONSOLE or b==B.ACTION_PAUSE then return h==InputHook.GET_ACTION_VALUE and 0 or false end end)A(T,M.MC_PRE_MOD_UNLOAD,function()O[P]=true end)

--10. 死亡证明内的道具、任务道具之外的所有道具均被替换为饰品掉落；角色受伤时自动吃掉携带的饰品
l local F,G=Isaac.AddCallback,Game()F({},11,function(_,e)e:ToPlayer():UseActiveItem(479,3339)SFXManager():Play(157)end,1)F({},37,function(_,_,v,s)if(v==100 and not Isaac.GetItemConfig():GetCollectible(s):HasTags(1<<15)and G:GetLevel():GetCurrentRoomDesc().Data.Name~='Death Certificate')then return{350,G:GetItemPool():GetTrinket()}end end)

--11. 初始给予玩家道具116(9伏特)、9*311(犹大的影子)、356(车载电池)、468(阴影)、619(长子权)。
l local I,G=Isaac,Game()I.AddCallback({},15,function(p,c,t,n)if not c then for _,i in pairs({116,{311,9},356,468,619})do for k=1,G:GetNumPlayers()do p,t,n=I.GetPlayer(k-1),table.unpack(type(i)=='table'and i or{i,1})while n>p:GetCollectibleNum(t)do p:AddCollectible(t,I.GetItemConfig():GetCollectible(t).InitCharge)end end G:GetItemPool():RemoveCollectible(t)end end end)

--12. 免疫失忆症、免疫迷途诅咒。
l local F=Isaac.AddCallback F({},10,function()Game():GetLevel():RemoveCurses(4)end,25)F({},12,function(_,c)return ~4&c end)

--13. 强制给予玩家饰品140(所多玛之果)。
l Isaac.AddCallback({},31,function(a,p,b)if 40~=p:GetPlayerType()and not p:HasCurseMistEffect()then b='Parent'a=p[b]p[b]=nil for _,i in pairs({140})do if not p:HasTrinket(i)then p:DropTrinket(p.Position+p.PositionOffset,true)p:AddTrinket(i)p:UseActiveItem(479,3339)end end p[b]=a end end)

--14. 从游戏中移除符文41(黑符文)、卡牌74(月亮?)和魂石83(该隐的魂石)。
l local b,Y,N,F,G={41,74,83},true,false,Isaac.AddCallback,Game()F({},31,function(_,p)for _,i in pairs(b)do for s=0,3 do if p:GetCard(s)==i then p:SetCard(s,0)end end end end)F({},37,function(r,f,v,s)if v==300 then repeat f=Y for _,i in pairs(b)do if i==s then f,r=N,G:GetRandomPlayer(Vector.Zero,0):GetCardRNG(REPENTANCE_PLUS and -1 or 0)s=G:GetItemPool():GetCard(r:GetSeed(),Y,Y,N)r:Next()break end end until f return{v,s}end end)

--15. 从游戏中移除药丸23(我能永远看清)。
l local b,Y,N,F,G,P,E,L,T={23},true,false,Isaac.AddCallback,Game(),'GetItemPool','GetPillEffect','GetPill',{}F(T,31,function(_,p,o)o=G[P](G)for _,i in pairs(b)do for s=0,3 do if o[E](o,p[L](p,s),p)==i then p:SetPill(s,0)end end end end)F(T,37,function(p,f,v,s,r)p=G[P](G)if v==70 then repeat f=Y for _,i in pairs(b)do if i==p[E](p,s)then f,r=N,G:GetRandomPlayer(Vector.Zero,0):GetPillRNG(REPENTANCE_PLUS and -1 or 0)s=p[L](p,r:GetSeed())r:Next()break end end until f return{v,s}end end)

--16. 强制非精英敌人变为精英怪(不包括6无敌变种和25彩虹变种，“0”和“1”可替换为非负整数表示权重)。
l local A,C={[0]=1,[1]=1,[2]=1,[3]=1,[4]=1,[5]=1,[6]=0,[7]=1,[8]=1,[9]=1,[10]=1,[11]=1,[12]=1,[13]=1,[14]=1,[15]=1,[16]=1,[17]=1,[18]=1,[19]=1,[20]=1,[21]=1,[22]=1,[23]=1,[24]=1,[25]=0},{}for k,v in pairs(A)do for _=1,v do C[#C+1]=k end end Isaac.AddCallback({}, ModCallbacks.MC_NPC_UPDATE, function(_,e)if e:IsVulnerableEnemy()and e:IsActiveEnemy(false)and not e:IsBoss()and not e:IsInvincible()and not e:IsChampion()then e:MakeChampion(e.InitSeed,C[e.InitSeed%#C+1])end end)

--17. 黏币变为镍币
l Isaac.AddCallback({},ModCallbacks.MC_POST_PICKUP_INIT,function(_,p)if p.SubType==CoinSubType.COIN_STICKYNICKEL then p:Morph(p.Type,p.Variant,CoinSubType.COIN_NICKEL,true)end end,PickupVariant.PICKUP_COIN)

--18. 角色吸引硬币
l Isaac.AddCallback({},ModCallbacks.MC_POST_PICKUP_UPDATE,function(_,p)local e,l=Game():GetNearestPlayer(p.Position+p.PositionOffset)l=e.Position+e.PositionOffset-p.Position-p.PositionOffset p.Velocity=3*(l:Length()>10 and math.log(l:Length())or 0)*l:Normalized()p.GridCollisionClass=EntityGridCollisionClass.GRIDCOLL_NONE end,PickupVariant.PICKUP_COIN)

--19. 非任务道具替换为以下道具之一：道具36(大便)、道具74(25美分)、道具667(稻草人)
l local I,C=Isaac,{36,74,667}I.AddCallback({},ModCallbacks.MC_POST_PICKUP_INIT,function(_,p)local s=p.SubType if not I.GetItemConfig():GetCollectible(s):HasTags(ItemConfig.TAG_QUEST)then for _,v in pairs(C)do if v==s then return end end local r=RNG()r:SetSeed(p.InitSeed,35)p:Morph(p.Type,p.Variant,C[r:RandomInt(#C)+1],true,true)end end,PickupVariant.PICKUP_COLLECTIBLE)

--20. 强制角色为游魂。
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(_,p)local t=PlayerType.PLAYER_THELOST if t~=p:GetPlayerType()then p:ChangePlayerType(t)end end)

--21. 用于储存数据，无实际效果（兼容发光沙漏，不兼容rewind）
--_Data()返回的数据兼容发光沙漏,_Data(entity)=entity:GetData(),_rew()返回当前是否处于rew状态（不更新数据）,_Pata()返回的数据仅在游戏结束时重置;rewind会触发游戏结束和游戏开始。
l local I,M,N,H,T,F,D,A=Isaac,ModCallbacks,'MC_POST_NEW_ROOM',function(e)return e.InitSeed end,true,false D,A={B={},D={},T={},R=F,C=F,G=F,M={}},function(S,...)I.AddPriorityCallback(D.M,S,CallbackPriority.IMPORTANT,...)end local function C(s)if type(s)=='table'then local c={}for k,v in pairs(s)do c[k]=C(v)end return c end return s end A(M.MC_USE_ITEM,function()D.T=C(D.B)D.R,D.C=T,F end,CollectibleType.COLLECTIBLE_GLOWING_HOUR_GLASS)A(M[N],function()if not D.G then D.G=T return end if D.R then if D.C then D.R=F end D.C=not D.C end if not D.R then D.B=C(D.T)end end)A(M.MC_POST_GAME_STARTED,function(_,c)D.R,D.C=F,F if c then D.T=C(D.B)else D.T,D.B,D.D={},{},{}end I.RunCallback(M[N])end)A(M.MC_PRE_GAME_EXIT,function(_,d)if d then D.B=C(D.T)else D.D,D.B={},{}end D.R,D.C,D.G,D.T=F,F,F,{}end)A(M.MC_POST_ENTITY_REMOVE,function(_,e)D.T[H(e)]=nil end)function _Data(e)if e then local k=H(e)D.T[k]=D.T[k]or{}return D.T[k]end return D.T end function _rew()return D.R end function _Pata()return D.D end

--22. 固定开启下列彩蛋种子：G_FUEL。
l local S={SeedEffect.SEED_G_FUEL}Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function()local D,f=Game():GetSeeds()for _,d in pairs(S)do if D:CanAddSeedEffect(d)then D:AddSeedEffect(d)f=true end end if f then Isaac.ExecuteCommand('restart')end end)

--23. 角色的下列属性不会超出限定的值（nil表示不做限制）：移速(nil~2.00)；弹速(nil~3.00)
l local A,M,V,T,E=Isaac.AddCallback,ModCallbacks,{['MoveSpeed']={min=nil,max=2.00,F='SPEED'},['MaxFireDelay']={min=nil,max=nil,F='FIREDELAY'},['Damage']={min=nil,max=nil,F='DAMAGE'},['TearRange']={min=nil,max=nil,F='RANGE'},['ShotSpeed']={min=nil,max=3.00,F='SHOTSPEED'},['Luck']={min=nil,max=nil,F='LUCK'},['SpriteScale']={min=nil,max=nil,F='SIZE'}},{}E=function(p,k,v)local l,r=v.min,v.max if l and l>p[k]then p[k]=l end if r and r<p[k]then p[k]=r end end A(T,M.MC_EVALUATE_CACHE,function(_,p,f)for k,v in pairs(V)do if f==CacheFlag['CACHE_'..v.F]then return E(p,k,v)end end end)A(T,M.MC_POST_PEFFECT_UPDATE,function(_,p)for k,v in pairs(V)do E(p,k,v)end end)

--24. 取消屏幕晃动
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function()Game():ShakeScreen(0)end)

--25. 角色受到惩罚伤害时,执行Action函数(参数：玩家实体，伤害数值，伤害标签，伤害来源，受伤冷却)
l local function Action(p,a,f,s,c)end;local D,E=DamageFlag,EntityType Isaac.AddCallback({},ModCallbacks.MC_ENTITY_TAKE_DMG,function(_,e,a,f,s,c)e=e:ToPlayer()if e:GetPlayerType()==PlayerType.PLAYER_JACOB_B and s.Type==E.ENTITY_DARK_ESAU or 0<f&(D.DAMAGE_RED_HEARTS|D.DAMAGE_IV_BAG|D.DAMAGE_FAKE|D.DAMAGE_NO_PENALTIES)then return end Action(e,a,f,s,c)end,E.ENTITY_PLAYER)
--.