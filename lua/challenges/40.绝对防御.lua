--绝对防御

--[[
模板: fly-permanent
]]

--[[
说明: 在玩家周围生成隐形的神圣干预同心圆
]]
l local b,c,h,k,n,i,a,m,K=Isaac,ModCallbacks,GetPtrHash,EffectVariant.DIVINE_INTERVENTION,Vector,'SpawnerEntity','Position'm=b.AddCallback K={}m(K,c.MC_POST_PLAYER_UPDATE,function(d,p)d=p:GetData()d[K]=d[K]or{}d=d[K]for i=0,251 do d[i]=d[i]or{}if not(d[i].e and d[i].e:Exists())then d[i].e=b.Spawn(EntityType.ENTITY_EFFECT,k,0,p[a],n.Zero,p)d[i].h=h(d[i].e)d[i].e:GetData()[K]=i end end end,0)m(K,c.MC_POST_EFFECT_UPDATE,function(p,e,l,d,j)p=e[i]d=e:GetData()[K]l=p and p:GetData()[K]if l and p:Exists()and d and l[d]and l[d].h==h(e)then e.Visible=false j=d<36 and 1 or d<108 and 2 or 4 e.Size=8/j e.Rotation=10/j*d e[a]=p[a]+(20+10*j)*n.FromAngle(10/j*d)else e:Remove()end end,k)

--[[
模板: champion-force
参数:
  P10: "1"
  P26: "将所有非精英敌人变为粉色精英怪"
]]

--[[
说明: "投射物自带激光射击"
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_PROJECTILE_INIT,function(_,p)p:AddProjectileFlags(ProjectileFlags.LASER_SHOT)end)

--[[
模板: restart-game
]]
