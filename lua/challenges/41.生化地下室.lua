--生化地下室
--限定难度：非贪婪模式
--禁用Goodtrip和Time Machine

--[[
模板: persistent-data
名称: 数据保存
]]

--[[
模板: force-give-items
参数:
  P1: "'c402'"
  P2: "道具402(混沌)"
]]

--[[
模板: curse-immune-quad
]]

--[[
模板: reveal-map
]]

--[[
说明: |-
  每层随机选中初始房间和若干普通房间作为安全屋；其他房间均为毒气室
  通过接口IsGridSafe(safeGridIndex)判断是否为安全屋
名称: 安全屋与毒气室
依赖: [数据保存]
]]
l local a,b,A,R=Game,'SafeGridIndex',{}R=function(d,l,s,r)d={}l=a():GetLevel()s=l:GetRooms()for i=0,#s-1 do r=s:Get(i)if r.Data and r.Data.Type==RoomType.ROOM_DEFAULT then d[#d+1]=r[b]end end r=RNG()r:SetSeed(a():GetSeeds():GetStageSeed(l:GetStage()),35)for i=#d,2,-1 do s=1+r:RandomInt(#d-1)d[i],d[s]=d[s],d[i]end d=table.move(d,1,#d//5,1,{})s=_Data()s[A]={[l:GetStartingRoomIndex()]=true}for _,v in pairs(d)do s[A][v]=true end return s[A]end Isaac.AddCallback(A,ModCallbacks.MC_POST_NEW_LEVEL,R)function IsGridSafe(s,d)d=_Data()[A]or R()return d[a():GetLevel():GetRoomByIdx(s)[b]]end

--[[
说明: 未清理的毒气室内始终有毒雾。
依赖: [安全屋与毒气室]
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_PEFFECT_UPDATE,function(c,p)if not IsGridSafe(Game():GetLevel():GetCurrentRoomIndex())and Game():GetFrameCount()%30<1 then c=CollectibleType.COLLECTIBLE_TOXIC_SHOCK p:AddCollectible(c)p:RemoveCollectible(c)end end)

--[[
说明: 安全屋被视为红房间，红房间被视为普通房间。安全屋自动清理。
依赖: [安全屋与毒气室]
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(l,s,r,x,f,a)if Game():GetFrameCount()%30<1 then a=RoomDescriptor f=a.FLAG_RED_ROOM l=Game():GetLevel()s=l:GetRooms()for i=0,#s-1 do x=s:Get(i).SafeGridIndex r=l:GetRoomByIdx(x)r.Flags=(~f&r.Flags)|(IsGridSafe(x)and(a.FLAG_CLEAR|f)or 0)end l:UpdateVisibility()end end)

--[[
说明: 毒气室内屏幕偏绿
依赖: [安全屋与毒气室]
]]
l local b,a,S=Vector,Isaac,Sprite()S:Load('gfx/ui/loading.anm2',true)S:Play('1',true)S.Scale=b(9,9)S.Color=Color(0,0,0,.2,0,.3)a.AddCallback({},ModCallbacks.MC_POST_RENDER,function()if not IsGridSafe(Game():GetLevel():GetCurrentRoomIndex())then S:RenderLayer(0,b.Zero)end end)

--[[
模板: attract-coins
]]

--[[
说明: 每清理一个毒气室，根据房间难度生成硬币
依赖: [安全屋与毒气室]
]]
l Isaac.AddCallback({},ModCallbacks.MC_PRE_SPAWN_CLEAN_AWARD,function(l,_,p)l=Game():GetLevel()if not IsGridSafe(l:GetCurrentRoomIndex())then for i=1,l:GetCurrentRoomDesc().Data.Difficulty do Isaac.Spawn(EntityType.ENTITY_PICKUP,PickupVariant.PICKUP_COIN,CoinSubType.COIN_PENNY,Isaac.GetFreeNearPosition(p,0),Vector.Zero,nil)end end end)

--[[
说明: 每个安全室内，摧毁所有障碍物，固定生成1~2个补货机和1~2组双选一道具
依赖: [安全屋与毒气室]
]]
l local f,b,d,e,c=EntityType,Isaac,Vector.Zero,'GetRandomPosition'c=b.GetFreeNearPosition b.AddCallback({},ModCallbacks.MC_POST_NEW_ROOM,function(l,r,a,p)l=Game():GetLevel()r=Game():GetRoom()if IsGridSafe(l:GetCurrentRoomIndex())and r:IsFirstVisit()then for i=1,r:GetGridSize()do r:DestroyGrid(i-1)end a=1+(1&r:GetDecorationSeed())p=c(r[e](r,40),0)for i=1,a do for j=0,1 do b.Spawn(f.ENTITY_PICKUP,PickupVariant.PICKUP_COLLECTIBLE,0,p+29*Vector.FromAngle(90*(i*2+j+.5)),d,nil):ToPickup().OptionsPickupIndex=i end end for _=a+1,3 do b.Spawn(f.ENTITY_SLOT,10,0,c(r[e](r,40),0),d,nil)end end end)

--[[
说明: 击败头目后，房间右下角生成一个可消除碎心的商品
]]
l local f,a,d,b=Vector,Isaac,ModCallbacks,'InitSeed'local i,j,k,l,S=PickupVariant.PICKUP_COIN,a.AddCallback,EntityType.ENTITY_PICKUP,f.Zero,Sprite()S:Load('gfx/006.017_confessional.anm2',true)S:Play('Idle',true)S.Scale=f.One/3 j({},d.MC_PRE_SPAWN_CLEAN_AWARD,function(r)r=Game():GetRoom()if RoomType.ROOM_BOSS==r:GetType()then r=Game():Spawn(k,i,a.GetFreeNearPosition(r:GetGridPosition(r:GetGridSize()-1),0),l,nil,CoinSubType.COIN_PENNY,1):ToPickup()r.AutoUpdatePrice=false r.Price=50 r.SpriteScale=l end end)j({},d.MC_POST_PICKUP_RENDER,function(_,p,o)if 1==p[b]then S:Render(a.WorldToRenderPosition(p.Position+p.PositionOffset)+o)end end,i)j({},d.MC_PRE_PICKUP_COLLISION,function(_,p,c)c=c:ToPlayer()if c and 50<=c:GetNumCoins()and c:AreControlsEnabled()and c.ItemHoldCooldown<1 and 1==p[b]then c:AddBrokenHearts(-1)end end,i)

--[[
说明: |-
  在毒气室内，每秒属性临时下降0.5%，每20s属性永久下降1%；
  属性最多下降90%；
  在安全屋内，每秒临时下降的属性回升5%；
  只影响：移动速度、攻击速度、攻击力、射程
依赖: [数据保存,安全屋与毒气室]
]]
l local e,a,b,j,C,g,h,i,K=Game,ModCallbacks,_Data,Isaac.AddCallback,CacheFlag,'MoveSpeed','MaxFireDelay','TearRange',{}j({},a.MC_POST_GAME_STARTED,function(_,c)if not c then b()[K]=nil end end)j({},a.MC_POST_UPDATE,function(d,t)d=b()d[K]=d[K]or{A=0,B=0,T=0}d=d[K]t=e():GetFrameCount()if t%30<1 then if IsGridSafe(e():GetLevel():GetCurrentRoomIndex())then d.B=math.max(0,d.B-.05)d.T=t else if t-d.T>599 then d.A=d.A+.01 d.T=t end d.B=d.B+5e-3 end for i=1,e():GetNumPlayers()do d=Isaac.GetPlayer(i-1)d:AddCacheFlags(C.CACHE_ALL)d:EvaluateItems()end end end)j({},a.MC_EVALUATE_CACHE,function(m,p,f)m=b()[K]if m then m=1-math.min(m.A+m.B,.9)if f==C.CACHE_SPEED then p[g]=m*p[g]elseif f==C.CACHE_FIREDELAY then p[h]=(p[h]+1)/m-1 elseif f==C.CACHE_DAMAGE then p.Damage=m*p.Damage elseif f==C.CACHE_RANGE then p[i]=m*p[i]end end end)

--[[
说明: 在毒气室内，每40秒给玩家增加一颗碎心
依赖: [数据保存,安全屋与毒气室]
]]
l local b,a,e,K=Game,ModCallbacks,Isaac.AddCallback,{}e(K,a.MC_POST_GAME_STARTED,function(_,c)if not c then _Data()[K]=nil end end)e(K,a.MC_POST_UPDATE,function(d,t)d=_Data()d[K]=d[K]or 0 t=b():GetFrameCount()if t%30<1 then if IsGridSafe(b():GetLevel():GetCurrentRoomIndex())then d[K]=t else if 1199<t-d[K]then d[K]=t for i=1,b():GetNumPlayers()do d=Isaac.GetPlayer(i-1)d:AddBrokenHearts(1)d:UseActiveItem(CollectibleType.COLLECTIBLE_DULL_RAZOR,UseFlag.USE_NOANIM)end end end end end)

--[[
说明: |-
  在毒气室内，每秒屏幕变暗2%；变暗80%以后，屏幕不再变暗；
  毒气室内每停留30s，屏幕边缘永久缩小一点；
  毒气室内停留40s后，角色获得永久像素视野；
  毒气室内停留50s后，所有房间永久陷入黑暗。
  在安全屋内，变暗的屏幕每秒恢复10%。
依赖: [数据保存,安全屋与毒气室]
]]
l local k,b,a,e,f,g,h=Sprite,Vector,Isaac,ModCallbacks,_Data,Game,math local m,B,C,K=a.AddCallback,k(),k(),{}B:Load('gfx/ui/loading.anm2',true)B:Play('1',true)B.Scale=b(9,9)C:Load('gfx/ui/bossoverlay_dogma.anm2',true)C:SetFrame('FadeIn',60)m(K,e.MC_POST_GAME_STARTED,function(_,c)if not c then f()[K]=nil end end)m(K,e.MC_POST_UPDATE,function(d,t,l)d=f()d[K]=d[K]or{A=0,B=false,C=false,D=0,T=0}d=d[K]t=g():GetFrameCount()if t%30<1 then l=g():GetLevel()if IsGridSafe(l:GetCurrentRoomIndex())then d.A=h.max(0,d.A-.1)d.T=t else d.A=h.min(.8,d.A+.02)t=t-d.T if t>899 and t%900<1 then d.D=h.min(40,d.D+.8)end if t>1199 and not d.B then d.B=true g():AddPixelation(9e9)end d.C=t>1499 or d.C end if d.C then t=l:GetRooms()for i=0,#t-1 do d=l:GetRoomByIdx(t:Get(i).SafeGridIndex)d.Flags=d.Flags|RoomDescriptor.FLAG_PITCH_BLACK end end end end)m(K,e.MC_POST_RENDER,function(d)d=f()[K]if d then B.Color=Color(1,1,1,d.A)B:RenderLayer(0,b.Zero)C.Scale=b(a.GetScreenWidth()/480,a.GetScreenHeight()/270)C.Color=Color(1,1,1,d.D)C:RenderLayer(0,b.Zero)end end)

--[[
说明: 毒气室内屏幕中央会有标识。
依赖: [数据保存,安全屋与毒气室]
]]
l local f,i=Isaac,Vector local b,e,h,s,K=ModCallbacks,_Data,f.AddCallback,Sprite(),{}s:Load('gfx/005.100_Collectible.anm2',true)s:ReplaceSpritesheet(1,f.GetItemConfig():GetCollectible(CollectibleType.COLLECTIBLE_TOXIC_SHOCK).GfxFileName)s:LoadGraphics()s:Play('Idle',true)s.Scale=i.One/4 h(K,b.MC_POST_GAME_STARTED,function(_,c)if not c then e()[K]=nil end end)h(K,b.MC_POST_RENDER,function(d,t,p,u)d=e()d[K]=d[K]or 0 t=Game():GetFrameCount()if IsGridSafe(Game():GetLevel():GetCurrentRoomIndex())then d[K]=t else u=string.format('%.2fs',(t-d[K])/30)p=i(f.GetScreenWidth()/2,f.GetScreenHeight()/8)s:Render(p)f.RenderScaledText(u,p.X-f.GetTextWidth(u)/4,p.Y,.5,.5,0,1,0,1)end end)

--[[
模板: restart-game
]]