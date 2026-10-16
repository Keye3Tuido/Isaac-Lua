--快刀游戏
--限定角色：堕化犹大

--[[
模板: blind-permanent
]]

--[[
模板: force-give-items
参数:
  P1: "'c251','c467','c534','t88'"
  P2: "道具251(新手牌组)、467(手指)、534(书包)、饰品88(不!)"
]]

--[[
模板: give-start-collectibles
]]

--[[
模板: force-character
说明: |-
  强制角色为堕化犹大。
参数:
  P1: "PlayerType.PLAYER_JUDAS_B"
]]

--[[
说明: 每隔一段时间强制切换玩家的某个槽位物品为道具暗仪刺刀、其他槽位为道具计划C或卡牌自杀之王。可在控制台输入 lua Duration = 数值 来调整切换间隔，数值单位为逻辑帧，默认90逻辑帧(3秒)。
名称: 致命切手
参数:
  P1: {类型: 数值, 默认: 90, 性质: 全局, 说明: "全局变量Duration，强制切换的间隔帧数（默认90）"}
  P2: {类型: 描述, 默认: "3秒", 性质: 局部, 说明: "说明文本中的切换间隔秒数显示值（90帧=3秒）"}
]]
l Duration=P1;local C,D,E,F,G,H,I,M,N,P,Q,S,T,A,U,V='GetFrameCount','ControlsCooldown','SetPocketActiveItem',0,0,math,Isaac,ModCallbacks,false,CollectibleType,Card.CARD_SUICIDE_KING,true,{}A,U,V=I.AddCallback,P.COLLECTIBLE_PLAN_C,P.COLLECTIBLE_DARK_ARTS A(T,M.MC_POST_PLAYER_UPDATE,function(_,p)local g,s,t=Game()if g[C](g)%Duration<1 then F=(F+H.random(1,5))%6 for i=0,3 do s,t=(i==F)and V or U,p:GetActiveItem(i)if s~=t or i>1 then p:RemoveCollectible(t,S,i,S)if i<2 then p:AddCollectible(s,I.GetItemConfig():GetCollectible(s).InitCharge,N,i)end end end for i=0,3 do if Q~=p:GetCard(i)then p:DropPocketItem(i,I.GetFreeNearPosition(p.Position,9))end end G=(F>1)and F or G p[E](p,F>1 and V or U,2,N)p[E](p,U,3,N)for i=2,3 do p:SetCard(i,Q)end end end,0)A(T,M.MC_INPUT_ACTION,function(_,e,h,a)if e and e:ToPlayer()and a==ButtonAction.ACTION_DROP and G>0 then G=G-1 return S end end,InputHook.IS_ACTION_TRIGGERED)A(T,M.MC_POST_RENDER,function()local d,g,t,c,s=Duration,Game()t=(d-g[C](g)%d)/30 c,s=t*30/d,string.format('%.2fs',t)I.RenderText(s,(I.GetScreenWidth()-I.GetTextWidth(s))/2,I.GetScreenHeight()/16,1,c,c,1)end)A(T,M.MC_USE_ITEM,function(_,c,r,p)p[D]=H.max(p[D],180)end,U)A(T,M.MC_POST_PICKUP_INIT,function(_,e)if e.SubType==Q then e:Remove()end end,PickupVariant.PICKUP_TAROTCARD)

--[[
模板: restart-as-character
说明: |-
  以堕化犹大重开一局新游戏。
]]
