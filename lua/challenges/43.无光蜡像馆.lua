--无光蜡像馆


--[[
模板: pixel-factory
]]

--[[
模板: simulate-night-light
]]

--[[
说明: 强制给予主角色小夜灯
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(p)p=Isaac.GetPlayer(0)if not(40==p:GetPlayerType()or p:HasCurseMistEffect()or p:HasCollectible(425))then p:AddCollectible(425)end end)

--[[
说明: 主角色小夜灯视野以外的屏幕全部漆黑
依赖: [像素工厂, 夜灯光锥方向模拟]
]]
l local d,b,c,M=Isaac,Vector,math,ModCallbacks local A,P=d.AddCallback,MakePixel()A({},M.MC_POST_RENDER,function()local p,W,H,D,g,j,f,v,t=d.GetPlayer(0),d.GetScreenWidth(),d.GetScreenHeight()D,g=(W*W+H*H)^.5,Game():GetRoom()j=g:IsMirrorWorld()f=d.WorldToRenderPosition(p.Position)+g:GetRenderScrollOffset()v=GetNightLightDirection(p)if j then f=b(W-f.X,f.Y)end t=c.deg(c.atan(v.Y,v.X))P.Color=Color(0,0,0)P.Scale=b(2*D,D)for i=-30,30,60 do local a=t+i local e=b(c.cos(c.rad(a)),c.sin(c.rad(a)))local n=b(-e.Y,e.X)if n.X*v.X+n.Y*v.Y>0 then n=b(-n.X,-n.Y)end P.Rotation=a P:Render(f+n*(D/2))end end)

--[[
说明: 主角色锥形视野内的实体冻结
依赖: [夜灯光锥方向模拟]
]]
l local a=Isaac a.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(p,v)p=a.GetPlayer()v=GetNightLightDirection(p)for _,e in ipairs(a.GetRoomEntities())do if e:ToNPC()and e.Type~=EntityType.ENTITY_PLAYER then if(3^.5)/2<=(e.Position-p.Position):Normalized():Dot(v)then e:AddFreeze(EntityRef(p),1)end end end end)

--[[
模板: restart-game
]]