--拖家带口
--限定角色: 游魂


---- 代码效果 ----

--===--

--[[
模板: persistent-data
说明: |-
  用于储存数据，无实际效果。
  _Data()返回的表兼容发光沙漏和rewind（可回溯）,_Data(entity)=entity:GetData()（可回溯）,_rew()返回当前是否处于rew状态（不要更新表中的数据）,_Pata()返回的数据仅在游戏结束时重置（不回溯）。
名称: 数据保存
]]

--[[
说明: |-
  道具:迷失游魂 可叠加。
依赖: [数据保存]
]]
l local B,C,D,E,F,G,H,I,J,L,M,O,P,R,S,T,A,N=_Data,'Player','InitSeed',EntityType.ENTITY_FAMILIAR,FamiliarVariant.LOST_SOUL,'Position',GetPtrHash,Isaac,'ToFamiliar',Vector,ModCallbacks,math,'Parent','Remove','State',{}A,N=I.AddCallback,I.FindByType A(T,M.MC_POST_NEW_LEVEL,function()for k,v in pairs(B())do v.N=0 end end)A(T,M.MC_POST_PLAYER_UPDATE,function(_,p)local a,b,c,h,n,e=N(E,F),{},0,H(p)n=p:GetCollectibleNum(CollectibleType.COLLECTIBLE_LOST_SOUL)-(B(p).N or 0)for k,v in pairs(a)do e=v[J](v)if h==H(e[C])then c=c+1 if c>n then e[R](e)else b[#b+1]=e end end end while c<n and 64>#N(E)do c,e=c+1,I.Spawn(E,F,0,p[G],L.Zero,p)b[#b+1]=e[J](e)end table.sort(b,function(x,y)return x[D]<y[D]end)for k,v in pairs(b)do v[C],v[P],e=p,p,b[1]a=e[G]if k>1 then v:FollowPosition(a+(40-O.max(O.min((v[G]-a):Length(),160),1)/8)*L.FromAngle(360*k/(#b-1)+Game():GetFrameCount()))end end end)A(T,M.MC_FAMILIAR_UPDATE,function(_,f)local p=f[C]if f[S]==4 and f:GetSprite():IsFinished()then B(p).N=(B(p).N or 0)+1 f[R](f)end end,F)

--[[
模板: force-character
说明: |-
  强制角色为游魂。
]]

--[[
模板: give-start-collectibles
参数:
  P1: "247"
  P2: "道具247(好朋友一辈子!)。"
]]

--[[
模板: per-floor-spawn-collectibles
参数:
  P1: "{612,2}"
  P2: "2*道具612-迷失游魂"
]]

--[[
模板: del-room-types
说明: |-
  删除每层的：宝箱房(类型为4)、星象房(类型为24)。
]]

--[[
模板: remove-collectibles
参数:
  P1: "123,567,704"
  P2: "道具123(怪物手册)、567(逾越节蜡烛)、704(狂怒!)"
]]

--[[
模板: remove-cards
参数:
  P1: "87"
  P2: "符文87(参孙的魂石)。"
]]

--[[
说明: |-
  角色拾取跟班类道具时，立刻将道具加入道具列表。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(c,p)if not p:IsItemQueueEmpty()and p.QueuedItem.Item.Type==ItemType.ITEM_FAMILIAR then p:FlushQueueItem()end end)

--[[
模板: remove-trinkets
参数:
  P1: "75,180"
  P2: "75(错误)和饰品180(复得游魂)"
]]

--===--
--[[
模板: restart-as-character
说明: |-
  以游魂重开一局新游戏。
参数:
  P1: "PlayerType.PLAYER_THELOST"
]]

