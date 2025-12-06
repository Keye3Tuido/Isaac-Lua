--勇往直前
--禁用Goodtrip
--禁回溯路线
--输入下面的代码后，开始一局新游戏
--除非重新加载了模组，否则不要重复输入代码！

-- 简要介绍：
-- 1. 地图大小变更为13x13，每个房间仅能进入一次；无法通过发光沙漏回到上一层；
-- 2. 非终点楼层会有天堂光柱追逐玩家；终点层有R键追逐玩家。每被R键追到一次，追逐者的数量+1；
-- 3. 房间未清理时，靠近绿色雅各会删除当前房间的清理奖励。
-- 4. (仅适用键盘玩家)禁用暂停键，Esc键会直接小退。

---- 代码效果(不用管中文，全选复制即可) ----

-- 1. 用于储存数据，无实际效果（兼容发光沙漏，不兼容rewind）
-- _Data()返回的数据兼容发光沙漏,_Data(entity)=entity:GetData(),_rew()返回当前是否处于rew状态（不更新数据）,_Pata()返回的数据仅在游戏结束时重置;rewind会触发游戏结束和游戏开始。
l local I,M,N,H,T,F,D,A=Isaac,ModCallbacks,'MC_POST_NEW_ROOM',function(e)return e.InitSeed end,true,false D,A={B={},D={},T={},R=F,C=F,G=F,M={}},function(S,...)I.AddPriorityCallback(D.M,S,CallbackPriority.IMPORTANT,...)end local function C(s)if type(s)=='table'then local c={}for k,v in pairs(s)do c[k]=C(v)end return c end return s end A(M.MC_USE_ITEM,function()D.T=C(D.B)D.R,D.C=T,F end,CollectibleType.COLLECTIBLE_GLOWING_HOUR_GLASS)A(M[N],function()if not D.G then D.G=T return end if D.R then if D.C then D.R=F end D.C=not D.C end if not D.R then D.B=C(D.T)end end)A(M.MC_POST_GAME_STARTED,function(_,c)D.R,D.C=F,F if c then D.T=C(D.B)else D.T,D.B,D.D={},{},{}end I.RunCallback(M[N])end)A(M.MC_PRE_GAME_EXIT,function(_,d)if d then D.B=C(D.T)else D.D,D.B={},{}end D.R,D.C,D.G,D.T=F,F,F,{}end)A(M.MC_POST_ENTITY_REMOVE,function(_,e)D.T[H(e)]=nil end)function _Data(e)if e then local k=H(e)D.T[k]=D.T[k]or{}return D.T[k]end return D.T end function _rew()return D.R end function _Pata()return D.D end

-- 2. 用于获取门的编号，无实际效果
l local S={{0,1,2,28},{0,nil,2,nil},{nil,1,nil,28},{0,1,2,55,27,nil,29,nil},{nil,1,nil,55},{0,1,4,28,nil,3,nil,30},{0,nil,4,nil},{0,1,4,55,27,3,31,57},{2,28,4,55,27,3,31,57},{0,1,2,55,27,30,31,57},{0,1,4,28,29,3,31,57},{0,1,4,55,27,3,29,30}}function GetDoorId(i,s,r,d)if not d or d<0 then d=0 end return 2*(i%13)+27*(i//13)+S[s][r+1]+d*1e3 end function GetDim()local level=Game():GetLevel()local idx=level:GetCurrentRoomIndex()for d=0,2 do if GetPtrHash(level:GetRoomByIdx(idx,d))==GetPtrHash(level:GetRoomByIdx(idx,-1))then return d end end end

-- 3. 进入新房间时，自动开启地图全部房间和红房间，并移除所有房间的红色标签。
l local A,M,T=Isaac.AddCallback,ModCallbacks,{}A(T,M.MC_POST_NEW_ROOM,function()local l,r,s,t,f,g,x,v,e,o,n,a,m=Game():GetLevel(),{},'SafeGridIndex','Data','Flags','GetRooms','GetRoomByIdx','VisitedCount'l:SetCanSeeEverything(true)e,o=function(c,k,d)c[f],d,k=c[v]>0 and c[f]|(1<<10)or ~(1<<10)&c[f],c[t]and c[t].Doors,c[s]if k<0 then return end for j=0,7 do if not d or d&1>0 then l:MakeRedRoomDoor(k,j)l:UncoverHiddenDoor(k,j)end d=d and d>>1 end r[k]=1 end,l[g](l)n=#o e(l[x](l,l:GetCurrentRoomDesc()[s]))while a~=n do a=n for j=1,n do m=l[x](l,o:Get(j-1)[s])if not r[m[s]]then e(m)end end o=l[g](l)n=#o end end)

-- 4.每个房间仅允许进入一次（兼容发光沙漏，不兼容rewind）
-- 依赖代码1
-- 依赖代码2
l local A,M,T,D=Isaac.AddCallback,ModCallbacks,{},_Data()A(T,M.MC_POST_GAME_STARTED,function(_,c)if not c then D=_Data()D.LastDim,D.Locked,D.Now=-1,{},{}end end)A(T,M.MC_POST_NEW_LEVEL,function()D=_Data()D.LastDim,D.Locked,D.Now=-1,{},{}end)A(T,M.MC_POST_NEW_ROOM,function()D=_Data()for k,v in pairs({['LastDim']=-1,['Locked']={},['Now']={}})do D[k]=D[k]or v end local Dim=GetDim()local level=Game():GetLevel()local desc=level:GetCurrentRoomDesc()local idx=desc.SafeGridIndex local room=Game():GetRoom()if not _rew()then if Dim==D.LastDim and idx>=0 then for k,_ in pairs(D.Now)do D.Locked[k]=true end end D.Now={}end if(idx~=level:GetStartingRoomIndex()or not room:IsFirstVisit())and idx>=0 then local doors=desc.Data and desc.Data.Doors for i=0,7 do if not doors or doors&1>0 then if desc.Data and D.Locked[GetDoorId(idx,desc.Data.Shape,i,Dim)]then room:RemoveDoor(i)end end doors=doors and doors>>1 end end if not _rew()and idx>=0 then for i=0,7 do if room:GetDoor(i)then D.Now[GetDoorId(idx,desc.Data and desc.Data.Shape,i,Dim)]=true end end end D.LastDim=Dim end)

--5. 免疫失忆症、免疫???、辨认传送药、免疫迷途诅咒、免疫混乱诅咒。
l local A,M,C,P,T=Isaac.AddCallback,ModCallbacks,LevelCurse,PillEffect,{}A(T,M.MC_USE_PILL,function()Game():GetLevel():RemoveCurses(C.CURSE_OF_THE_LOST)end,P.PILLEFFECT_AMNESIA)A(T,M.MC_USE_PILL,function()Game():GetLevel():RemoveCurses(C.CURSE_OF_MAZE)end,P.PILLEFFECT_QUESTIONMARK)A(T,M.MC_POST_CURSE_EVAL,function(_,c)return ~(C.CURSE_OF_THE_LOST|C.CURSE_OF_MAZE)&c end)A(T,M.MC_GET_PILL_EFFECT,function(_,pillEffect,pillColor)if pillEffect==P.PILLEFFECT_TELEPILLS then Game():GetItemPool():IdentifyPill(pillColor)end end)

--6. 从游戏中移除道具76(X光透视)和道具580(红钥匙)。
l local I,C,Y,T,A=Isaac,{76,580},true,{}A=I.AddCallback A(T,23,function(_,c)for _,v in pairs(C)do if c==v then return Y end end end)A(T,31,function(_,p)for _,i in pairs(C)do for _=1,p:GetCollectibleNum(i)do p:RemoveCollectible(i)end end end)A(T,37,function(p,f,v,s)if v==100 then repeat p,f=Game():GetItemPool()for _,i in pairs(C)do if i==s then f,s=1,p:GetCollectible(p:GetLastPool(),Y)break end end until not f return{v,s}end end)

--7. 从游戏中移除饰品170(水晶钥匙)。
l local G,F,b=32768,Isaac.AddCallback,{170}F({},31,function(_,p)for _,i in pairs(b)do if p:HasTrinket(i)then p:TryRemoveTrinket(i)end end end)F({},37,function(_,f,v,s)if v==350 then repeat f=1 for _,i in pairs(b)do if i|G==s|G then f,s=0,s&G|Game():GetItemPool():GetTrinket()break end end until f>0 return{v,s}end end)

--8. 从游戏中移除卡牌78(红钥匙碎片)。
l local b,Y,N,F,G={78},true,false,Isaac.AddCallback,Game()F({},31,function(_,p)for _,i in pairs(b)do for s=0,3 do if p:GetCard(s)==i then p:SetCard(s,0)end end end end)F({},37,function(r,f,v,s)if v==300 then repeat f=Y for _,i in pairs(b)do if i==s then f,r=N,G:GetRandomPlayer(Vector.Zero,0):GetCardRNG(REPENTANCE_PLUS and -1 or 0)s=G:GetItemPool():GetCard(r:GetSeed(),22<s and s<32,Y,31<s and s<42 or 55==s or 80<s)r:Next()break end end until f return{v,s}end end)

--9. 从游戏中移除药丸23(我能永远看清)。
l local b,Y,N,F,G,P,E,L,T={23},true,false,Isaac.AddCallback,Game(),'GetItemPool','GetPillEffect','GetPill',{}F(T,31,function(_,p,o)o=G[P](G)for _,i in pairs(b)do for s=0,3 do if o[E](o,p[L](p,s),p)==i then p:SetPill(s,0)end end end end)F(T,37,function(p,f,v,s,r)p=G[P](G)if v==70 then repeat f=Y for _,i in pairs(b)do if i==p[E](p,s)then f,r=N,G:GetRandomPlayer(Vector.Zero,0):GetPillRNG(REPENTANCE_PLUS and -1 or 0)s=p[L](p,r:GetSeed())r:Next()break end end until f return{v,s}end end)

--10. 强制给予玩家道具91(探窟帽)、道具327(全家福)和道具328(底片)。
l Isaac.AddCallback({},31,function(c,p,n)if 40~=p:GetPlayerType()and not p:HasCurseMistEffect()then for _,i in pairs({91,327,328})do c,n=table.unpack(type(i)=='table'and i or{i,1})while n>p:GetCollectibleNum(c)do p:AddCollectible(c,Isaac.GetItemConfig():GetCollectible(c).InitCharge)end Game():GetItemPool():RemoveCollectible(c)end end end)

--11. 生成迷你绿色堕化雅各吸引玩家，非终点层时，其身边会生成天堂光柱；终点层时，绿色堕化雅各变为R键。
-- 在头目房内雅各不会生成光柱。
-- 每被迫使用一次R键，会多一只绿色堕化雅各追逐玩家。
-- 无法通过发光沙漏回到上一层。
-- （兼容发光沙漏，不兼容rewind）
-- 依赖代码1
l local Y,N,A,M,T,E,V,Z,R,L,D,S,H=true,false,Isaac.AddCallback,ModCallbacks,{},EntityType.ENTITY_DARK_ESAU,Vector.One,Vector.Zero,Sprite()L,D,H=function()local s=Game():GetLevel():GetAbsoluteStage()if s>10 or s==0 then return Y end end,function(d)if d.SpawnerEntity then return N end local s,G=d.InitSeed,_Data()local chaser=G.Chasers and G.Chasers[s]if chaser then if chaser:Exists()then return Y end G.Chasers[s]=nil end if d.Type==E then d:Remove()end return N end,function(a,b)return a.Position+a.PositionOffset-(b and(b.Position-b.PositionOffset)or Z)end R:Load('gfx/005.100_Collectible.anm2',Y)R:ReplaceSpritesheet(1,Isaac.GetItemConfig():GetCollectible(CollectibleType.COLLECTIBLE_R_KEY).GfxFileName)R:LoadGraphics()R:SetFrame('Idle',1)A(T,M.MC_PRE_USE_ITEM,function(_,_,_,p)local G=Game()local level,room=G:GetLevel(),G:GetRoom()local index=level:GetStartingRoomIndex()if index==level:GetCurrentRoomIndex()and room:IsFirstVisit()then p:AnimateSad()return Y end end,CollectibleType.COLLECTIBLE_GLOWING_HOUR_GLASS)A(T,M.MC_POST_NEW_ROOM,function()for _,e in pairs(Isaac.FindByType(E,0,1))do D(e)end S=N local count,G=0,_Data()G.Chasers=G.Chasers or{}G.Count=G.Count or 1 for _,e in pairs(G.Chasers)do if D(e)then count=count+1 end end for _=count+1,G.Count do local chaser=Isaac.Spawn(E,0,1,Game():GetRoom():GetCenterPos(),Z,nil)G.Chasers[chaser.InitSeed]=chaser end if L()then return end for _,chaser in pairs(G.Chasers)do local heavenDoor=Isaac.Spawn(EntityType.ENTITY_EFFECT,EffectVariant.HEAVEN_LIGHT_DOOR,0,H(chaser),Z,chaser):ToEffect()heavenDoor.Parent=chaser end end)A(T,M.MC_POST_NEW_LEVEL,function()local G=_Data()G.Chasers=G.Chasers or{}for _,e in pairs(G.Chasers)do e:Remove()end end)A(T,M.MC_PRE_NPC_COLLISION,function(_,e,c)c=c:ToPlayer()if D(e)then if c then local r=Game():GetRoom()if L()then local G=_Data()G.Count=G.Count+1 c:UseActiveItem(CollectibleType.COLLECTIBLE_R_KEY)elseif not r:IsClear()and r:GetType()~=RoomType.ROOM_BOSS then S=Y r:TriggerClear()c:AnimateSad()end end return Y end end,E)A(T,M.MC_NPC_UPDATE,function(_,e)if D(e)then e.EntityCollisionClass=EntityCollisionClass.ENTCOLL_PLAYERONLY e:AddVelocity(.1*Vector.FromAngle(Random())+.3*H(Game():GetRandomPlayer(Z,0),e):Normalized())for i=1,Game():GetNumPlayers()do local p=Isaac.GetPlayer(i-1)if not p.Parent then e.Target=p break end end for k,v in pairs(_Data().Chasers)do if e.InitSeed~=k then local d=H(e,v)e:AddVelocity(d:Length()<40 and d:Normalized()or Z)end end end end,E)A(T,M.MC_POST_NPC_RENDER,function(_,e,o)if D(e)then if L()then e.Visible=N e.SizeMulti=V R:Render(Isaac.WorldToRenderPosition(H(e))+o+Vector(0,10))else e.Color=Color(0,1,0,1)e.Visible=Y end end end,E)A(T,M.MC_POST_EFFECT_UPDATE,function(_,e)if e.SubType==1 then return end local p=e.Parent if p then for i=1,Game():GetNumPlayers()do local r=Isaac.GetPlayer(i-1)local d=H(e,r)if not r.Parent and d:Length()<50 then r:AddVelocity(d:Normalized())end end p.SpriteScale=.5*V p.SizeMulti=2.5*V e.Position=H(p)e:FollowParent(p)else e:Remove()end end,EffectVariant.HEAVEN_LIGHT_DOOR)A(T,M.MC_PRE_SPAWN_CLEAN_AWARD,function()return S end)

--12. [不适配手柄]禁止玩家暂停游戏、禁止使用控制台(忏悔+不生效)；可使用Esc返回游戏菜单
l local A,B,M,T,O,P=Isaac.AddCallback,ButtonAction,ModCallbacks,{},Options,'PauseOnFocusLost'A(T,M.MC_POST_RENDER,function()O[P]=false for i=1,Game():GetNumPlayers()do local c=Isaac.GetPlayer(i-1).ControllerIndex if Input.IsActionPressed(B.ACTION_MENUBACK,c)then Game():Fadeout(1,2)end end end)A(T,M.MC_INPUT_ACTION,function(_,_,h,b)if b==B.ACTION_CONSOLE or b==B.ACTION_PAUSE then return h==InputHook.GET_ACTION_VALUE and 0 or false end end)A(T,M.MC_PRE_MOD_UNLOAD,function()O[P]=true end)
--.