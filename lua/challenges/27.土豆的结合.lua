--土豆的结合（原：合成肉鸽）
--禁用角色：雅各&以扫，堕化遗骸，堕化+长子权拉撒路，堕化伯大尼，堕化参孙，堕化该隐

-- 玩法简介：
-- 拾取道具时，若按住TAB键，则将道具给予自己
-- 否则，道具将给予被绿色十字标记的炮台
-- 按Ctrl键可以切换绿色十字标记
-- 每个炮台的道具和属性独立计算

---- 代码效果 ----

--===--
--[[
模板: blind-permanent
]]

--[[
说明: |-
  生成6个与玩家类型相同、跟随玩家的炮台；
  玩家拾取的道具，会给予被十字标记的炮台，道具栏右侧会显示标记炮台的物品栏
  按住MAP键时，道具会给予玩家自身
  按下DROP键可切换当前标记的炮台
  玩家的每个炮台攻击倍率为玩家原本属性的1/10
  玩家自身的攻击倍率为原本属性的2/15
]]
l local F,I,J,K,L,G,H,D,M,O,S,T,U,V,W,X,Z,E,Q,R,C,B,A,P,N,Y=1,Isaac,Game,true,false,function(p)return tostring(p:GetCollectibleRNG(1):GetSeed())end,'MAP',FamiliarVariant,ModCallbacks,CacheFlag.CACHE_DAMAGE,{},{},'GetPlayerType','Parent','Position','Player',Vector,'Visible','INCUBUS','KING_BABY','Collectible',Sprite()A,P,N=I.AddCallback,I.GetPlayer,function(b,x)return Input['IsAction'..(x and'Triggered'or'Pressed')](ButtonAction['ACTION_'..b],P().ControllerIndex)end;B:Load('gfx/1000.185_redemption.anm2',K)B.Color=Color(0,1,0,1)B:Play('Idle',K)A(T,M.MC_POST_GAME_STARTED,function(_,c)F=1 if not c then S={}end end)A(T,M.MC_POST_UPDATE,function(m,d,i,p,h,u)B:Update()if Y then J():GetHUD():AssignPlayerHUDs()end m,Y=P()d,i=0,1 while d<6 do p=P(i)h=G(p)if h==G(m)then I.ExecuteCommand('addplayer '..m[U](m))p=P(i)Y,h=K,G(p)end u=p[U](p)if u<PlayerType.NUM_PLAYER_TYPES then d=d+1 S[h]={n=d,p=p,x=50*Z.FromAngle(60*d)}S[i]=S[h]if Y then p:AddCacheFlags(O)p:EvaluateItems()end end i=i+1 end end)A(T,M.MC_POST_PLAYER_UPDATE,function(u,p,m,o,y,z,b,t,a)m=P()a='Add'u,o,b,z=G(p),_G[C..'Type'],a..C,'COLLECTIBLE_'y=S[u]if y or u==G(m)then if not p:HasCurseMistEffect()then for k,v in pairs{[L]=o[z..Q],[K]=o[z..R]}do if not p['Has'..C](p,v)and(y or k)then p[b](p,v)end end end o='Remove'..C if y then if y.n==F then p[V]=nil p[b](p,7)p[o](p,7)end y.p,p.SpriteScale,p[E],p[V],p[W],o=p,Z.Zero,L,m,m[W],'BrokenHearts'z=a..o p:SetMinDamageCooldown(1)p[z](p,1e3)p[z](p,-p['Get'..o](p))p:AddMaxHearts(2)p:AddHearts(2)p:Revive()z=m[U](m)if z~=p[U](p)then p:ChangePlayerType(z)end elseif not p:IsItemQueueEmpty()then z=p.QueuedItem y=z.Item if y.Type~=ItemType.ITEM_ACTIVE and y['Is'..C](y)and not y:HasTags(ItemConfig.TAG_QUEST)then t,m,y=p.FlushQueueItem,y.ID,S[F].p if N(H)then t(p)else y[b](y,m,0,not z.Touched)t(p)p[o](p,m)end end end end end)A(T,M.MC_INPUT_ACTION,function(x,e,h,a)e=e and e:ToPlayer()x=e and G(e)if e and(S[x]or x==G(P()))then if h==InputHook.GET_ACTION_VALUE then e,h=1,0 else e,h=K,L end if a//4==1 then for _,v in pairs{'LEFT','RIGHT','UP','DOWN'}do if N('SHOOT'..v)then return a==4+J():GetFrameCount()%4 and e or h end end elseif not S[x]then return end return h end end)A(T,M.MC_FAMILIAR_UPDATE,function(p,f,v,s)v,p,s=f.Variant,P()[W],S[G(f[X])]if v==D[R]then f[E],f[W]=L,p elseif s then if v==D[Q]then f:AddVelocity(s.x+p-f[W])else f:FollowPosition(2*s.x+p)end end end)A(T,M.MC_POST_FAMILIAR_RENDER,function(s,f,o,p)p,s=N(H),S[G(f[X])]if s then f[E],o=not p,o+I.WorldToRenderPosition(p and P()[W]or f[W])if s.n==F then B:Render(o+Z(0,p and 10 or 20))end end end,D[Q])A(T,M.MC_POST_RENDER,function()if N('DROP',K)and not N(H)and not J():IsPaused()then F=F%6+1 end end)A(T,M.MC_EVALUATE_CACHE,function(d,p)d=G(p)if d==G(P())or S[d]then d='Damage'p[d]=p[d]/7.5 end end,O)

--[[
模板: remove-collectibles
参数:
  P1: "122,482,704"
  P2: "道具122(巴比伦大淫妇)、482(遥控器)、704(狂怒)"
]]

--[[
模板: give-start-collectibles
参数:
  P1: "376,402,416,602"
  P2: "道具376(补货)、402(混沌)、416(深口袋)、602(会员卡)。"
]]

--[[
说明: 清理房间时生成硬币
]]
l local I=Isaac I.AddCallback({},ModCallbacks.MC_PRE_SPAWN_CLEAN_AWARD,function(_,_,p)for _=1,2 do I.Spawn(EntityType.ENTITY_PICKUP,PickupVariant.PICKUP_COIN,0,I.GetFreeNearPosition(p,0),Vector.Zero,I.GetPlayer())end end)

--[[
模板: attract-coins
说明: 角色吸引硬币
]]

--[[
模板: sticky-to-nickel
说明: 黏币变为镍币
]]

--[[
模板: pool-blacklist
]]

--===--
--[[
模板: restart-game
]]

