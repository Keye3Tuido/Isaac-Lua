--饕餮
--除非重新加载了模组，否则不要重复输入代码！

---- 代码效果(不用管中文，全选复制即可) ----

--0. 删除匿名模组的回调。游戏胜利后自动清理代码效果。
--控制台输入 lua CLM() 可删除所有匿名模组的回调，用于预防重复输入代码和清理代码效果。
--重复输入此代码不额外生效。
l local A,I,M,t,m=ModCallbacks,Isaac,'Mod'function CLM()for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end CLM()I.AddCallback({},A.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)

--1. 玩家拾取非任务道具时，自动触发道具477-虚空效果；玩家拾取饰品时，自动触发道具479-熔炉效果。
l Isaac.AddCallback({},31,function(i,p,u,f)i,f,u=p.QueuedItem.Item,3339,'UseActiveItem'if 0~=p:GetTrinket(0)then p[u](p,479,f)end if(not p:IsItemQueueEmpty())then if(i:IsCollectible()and not i:HasTags(1<<15))then p[u](p,477,f)elseif(i:IsTrinket())then p[u](p,479,f)end end end)

--2. 掉落物受玩家吸引。
l local P,O='Position','PositionOffset'Isaac.AddCallback({},35,function(v,e,p)p=Game():GetNearestPlayer(e[P]+e[O])v=p[P]+p[O]-e[P]-e[O]e.GridCollisionClass=0 e:AddVelocity(10<v:Length()and v:Normalized()or Vector.Zero)end)

--3. 玩家会自动使用副手的卡牌、符文、药丸等消耗品
l Isaac.AddCallback({},31,function(_,p,t,u)for i=0,1 do t,u=p:GetPill(i),p:GetCard(i)if t~=0 then p:UsePill(Game():GetItemPool():GetPillEffect(t,p),t)p:SetPill(i,0)elseif u~=0 then p:UseCard(u)p:SetCard(i,0)end end end)

--4. 强制给予玩家饰品140(所多玛之果)。
l Isaac.AddCallback({},31,function(a,p,b)if 40~=p:GetPlayerType()and not p:HasCurseMistEffect()then b='Parent'a=p[b]p[b]=nil for _,i in pairs({140})do if not p:HasTrinket(i)then p:DropTrinket(p.Position+p.PositionOffset,true)p:AddTrinket(i)p:UseActiveItem(479,3339)end end p[b]=a end end)
--.