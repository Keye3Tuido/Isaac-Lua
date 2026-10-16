--强制给予与替换：强制给物品、起始道具与预生成替换。

--[[
作为模板: true
模板id: force-give-items
名称: 强制给予物品
说明: |-
  强制给予玩家：{P2}
  主动道具数量不够时，强制锁门，房间内生成对应道具
  格式：c=道具,t/T=饰品(仅保证层数一致),物品=｛'类别',数量｝;数量为一时可简化为物品='类别'; 道具id必须>0
参数:
  P1: {类型: "物品条目列表", 默认: "'c534',{'c649',3},{'t145',5},'c105','c284'", 性质: "全局", 说明: "行首全局变量ITEMS的值，玩家可在控制台手改；'c<id>'=道具、't<id>'=饰品、{'类别',数量}=多件，单件可简写"}
  P2: {类型: "物品描述", 默认: "道具534(书包)、3x道具649(甜甜糖梅宝)、5x饰品145(满分考卷)、道具105(六面骰)、道具284(四面骰)", 性质: "局部", 说明: "说明文本中的物品描述部分"}
]]
l ITEMS={P1}local C,D,E,F,H,I,P,Q,L,M,T=CollectibleType,'OLLECTIBLE','GetPlayerType',PlayerType,'Get',Isaac,pairs,EntityType,'Remove',ModCallbacks,{}local A,B,G,J,K,N,O,S,U=I.AddCallback D,B='C'..D,'C'..D:lower()J=H..B K=J..'Num'O=L..B N=function(i,a,b)a,i=table.unpack(type(i)=='table'and i or{i,1})a,b=a:match('(%a)(%d+)')return i,a,tonumber(b)end G=function(_,a,b,p)for _,i in P(ITEMS)do i,a,b=N(i)if a=='c'then while 0<p[K](p,b)do p[O](p,b)end end end end A(T,M.MC_POST_PLAYER_UPDATE,function(a,p,b,c,e,g,h,j,k,l)if F.PLAYER_THESOUL_B~=p[E](p)and not p:HasCurseMistEffect()then c=I.GetItemConfig()e='Trinket'h='Add'for _,i in P(ITEMS)do i,a,b=N(i)if a=='T'then a='t'i=i*2 end if a=='c'then g=Game():GetItemPool()g[O](g,b)g=0 if not p:IsItemQueueEmpty()then g=p.QueuedItem.Item g=g and g['Is'..B](g)and b==g.ID and 1 or 0 end while i>g+p[K](p,b)do if c[J](c,b).Type==ItemType.ITEM_ACTIVE then S=b break else p[h..B](p,b)end end elseif a=='t'then g=H..e l=h..e while 1 do j=i-p[g..'Multiplier'](p,b)if j<=0 then break end k={}for s=0,1 do k[s]=p[g](p,s)p['Try'..L..e](p,k[s])p[l](p,b|((j>1 and s==0 or j>3)and TrinketType.TRINKET_GOLDEN_FLAG or 0))end p:UseActiveItem(C[D..'_SMELTER'],2315)for s=0,1 do p[l](p,k[s],false)end end end end end end,0)A(T,M.MC_POST_UPDATE,function(d,r,v,s)if S then r=Game():GetRoom()for _,i in P(DoorSlot)do d=r:GetDoor(i)if d then d:Close()end end d=Q.ENTITY_PICKUP v=PickupVariant.PICKUP_COLLECTIBLE s=I.FindByType if 1>#s(d,v,S)then U=U and U+1 or 1 if U>29 then I.Spawn(d,v,S,r:GetCenterPos(),Vector.Zero,nil)end else U=nil end for _,e in P(s(d,v,0))do e:Remove()end end S=nil end)A(T,M.MC_PRE_USE_ITEM,G,C[D..'_D4'])A(T,M.MC_ENTITY_TAKE_DMG,function(d,e,u,f)d=DamageFlag u='DAMAGE_'e=e:ToPlayer()if F.PLAYER_EDEN_B==e[E](e)and 0==f&(d[u..'RED_HEARTS']|d[u..'IV_BAG']|d[u..'FAKE']|d[u..'NO_PENALTIES'])then G(e,e,e,e)end end,Q.ENTITY_PLAYER)

--[[
作为模板: true
模板id: eat-trinkets
说明: |-
  死亡证明内的道具、任务道具之外的所有道具均被替换为饰品掉落；角色受伤时自动吃掉携带的饰品
]]
l local F,G=Isaac.AddCallback,Game()F({},11,function(_,e)e:ToPlayer():UseActiveItem(479,3339)SFXManager():Play(157)end,1)F({},37,function(_,_,v,s)if(v==100 and not Isaac.GetItemConfig():GetCollectible(s):HasTags(1<<15)and G:GetLevel():GetCurrentRoomDesc().Data.Name~='Death Certificate')then return{350,G:GetItemPool():GetTrinket()}end end)

--[[
作为模板: true
模板id: give-start-collectibles
说明: |-
  初始给予玩家{P2}
参数:
  P1: {类型: "道具列表", 默认: "116,{311,9},356,468,619", 性质: "局部", 说明: "道具id或{id,数量}的列表"}
  P2: {类型: "物品描述", 默认: "道具116(9伏特)、9*311(犹大的影子)、356(车载电池)、468(阴影)、619(长子权)。", 性质: "局部", 说明: "说明文本中的物品描述部分"}
]]
l local I,G=Isaac,Game()I.AddCallback({},15,function(p,c,t,n)if not c then for _,i in pairs{P1}do for k=1,G:GetNumPlayers()do p,t,n=I.GetPlayer(k-1),table.unpack(type(i)=='table'and i or{i,1})for _=1,n do p:AddCollectible(t,I.GetItemConfig():GetCollectible(t).InitCharge)end end G:GetItemPool():RemoveCollectible(t)end end end)

--[[
作为模板: true
模板id: force-pocket-active
说明: 强制角色副手道具为道具{P2}。
参数:
  P1: {类型: "道具id", 默认: "485", 性质: "全局", 说明: "行首全局变量POCKET，副手主动道具id"}
  P2: {类型: "描述", 默认: "485（掰弯的硬币）", 性质: "局部", 说明: "说明文本中的副手道具描述"}
]]
l POCKET=P1;Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(c,p,s)c=POCKET s=ActiveSlot.SLOT_POCKET if c~=p:GetActiveItem(s)then p:SetPocketActiveItem(c,s)end end,0)

--[[
作为模板: true
模板id: pickup-trigger-active
说明: 玩家拾取非任务道具时，自动触发道具{P2}效果。
参数:
  P1: {类型: "道具id", 默认: "706", 性质: "局部", 说明: "拾取非任务道具时触发使用的主动道具id"}
  P2: {类型: "描述", 默认: "706-无底坑", 性质: "局部", 说明: "说明文本中的触发道具描述"}
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(i,p)i=p.QueuedItem.Item if not p:IsItemQueueEmpty()and i:IsCollectible()and not i:HasTags(ItemConfig.TAG_QUEST)then p:UseActiveItem(P1)end end,0)

--[[
作为模板: true
模板id: pool-blacklist
说明: 抽取道具时不再抽取{P2}
参数:
  P1: {类型: 道具id列表, 默认: "360,698", 性质: 局部, 说明: 不再抽取的道具id列表（加入房间黑名单）}
  P2: {类型: 描述, 默认: "淫魔和作孽双子", 性质: 局部, 说明: 说明文本中的道具描述}
]]
l Isaac.AddCallback({},ModCallbacks.MC_PRE_GET_COLLECTIBLE,function()for _,c in pairs{P1}do Game():GetItemPool():AddRoomBlacklist(c)end end)
