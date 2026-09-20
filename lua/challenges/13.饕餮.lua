--饕餮


---- 代码效果 ----

--===--

--[[
说明: "玩家拾取非任务道具时，自动触发道具{P3}效果；玩家拾取饰品时，自动触发道具{P4}效果。"
参数定义:
  P1: {类型: 道具id, 默认: "477", 性质: 局部, 说明: "拾取非任务道具时触发的道具id（477=虚空）"}
  P2: {类型: 道具id, 默认: "479", 性质: 局部, 说明: "拾取饰品时触发的道具id（479=熔炉），代码中出现两处需同步"}
  P3: {类型: 描述, 默认: "477-虚空", 性质: 局部, 说明: "说明文本中的道具描述（对应P1）"}
  P4: {类型: 描述, 默认: "479-熔炉", 性质: 局部, 说明: "说明文本中的道具描述（对应P2）"}
]]
l Isaac.AddCallback({},31,function(i,p,u,f)i,f,u=p.QueuedItem.Item,3339,'UseActiveItem'if 0~=p:GetTrinket(0)then p[u](p,P2,f)end if(not p:IsItemQueueEmpty())then if(i:IsCollectible()and not i:HasTags(1<<15))then p[u](p,P1,f)elseif(i:IsTrinket())then p[u](p,P2,f)end end end)

--[[
说明: "掉落物受玩家吸引。"
]]
l local P='Position'Isaac.AddCallback({},35,function(v,e,p)p=Game():GetNearestPlayer(e[P])v=p[P]-e[P]e.GridCollisionClass=0 e:AddVelocity(10<v:Length()and v:Normalized()or Vector.Zero)end)

--[[
说明: "玩家会自动使用副手的卡牌、符文、药丸等消耗品"
]]
l Isaac.AddCallback({},31,function(_,p,t,u)for i=0,1 do t=p:GetPill(i)u=p:GetCard(i)if t~=0 then p:UsePill(Game():GetItemPool():GetPillEffect(t,p),t)p:SetPill(i,0)elseif u~=0 then p:UseCard(u)p:SetCard(i,0)end end end)

--[[
模板: force-give-items
参数:
  P1: "'t140'"
  P2: "饰品140(所多玛之果)"
]]

--===--
--[[
模板: restart-game
]]

