--眼泪未命中回调。

--[[
作为模板: true
模板id: tear-miss-action
说明: |-
  玩家的眼泪未命中实体时，执行Action函数（参数：眼泪实体）。Action为空占位，由使用方改写函数体。
参数:
  P1: {类型: 函数体, 性质: 局部, 默认: '', 说明: 函数体内容，默认空（空占位）}
]]
l local function Action(t)P1 end;local A,B,E,H,M,T,N=Isaac.AddCallback,{},EntityType,GetPtrHash,ModCallbacks,{}A(T,M.MC_POST_FIRE_TEAR,function(_,e)B[H(e)]=e.SpawnerType==E.ENTITY_PLAYER end)A(T,M.MC_POST_TEAR_UPDATE,function(_,t)local h,m,r,a,b=H(t),math,Game():GetRoom()a=m.max b=m.abs if B[h]then for i=0,r:GetGridSize()-1 do local g,p=r:GetGridEntity(i),r:GetGridPosition(i)if g then local s,e,v=g.State,GridEntityType,g:GetType()if(v==e.GRID_POOP and s~=1e3 or v==e.GRID_TNT and s~=4)then s=t.Position e=a(0,b(s.X-p.X)-20)v=a(0,b(s.Y-p.Y)-20)if m.ceil(t.Size)>=m.sqrt(e*e+v*v)then B[h]=N break end end end end end end)A(T,M.MC_PRE_TEAR_COLLISION,function(_,e)B[H(e)]=N end)A(T,M.MC_POST_ENTITY_REMOVE,function(_,e)local h=H(e)e=e:ToTear()if B[h]then Action(e)end B[h]=N end,E.ENTITY_TEAR)A(T,M.MC_POST_NEW_ROOM,function(t)t={}for k,v in pairs(B)do if v then t[k]=v end end B=t end)
