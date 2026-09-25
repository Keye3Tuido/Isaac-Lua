--突击考试
--禁止贪婪模式、禁止回溯路线

--[[
说明: |-
  从游戏中移除{P2}。
  特判：不阻止触发红钥匙效果
参数定义:
  P1: {类型: 道具id列表, 默认: "252,477,523,580,675,706", 性质: 局部, 说明: "要移除的道具id列表（580红钥匙的特判为代码中独立字面量，增删580需同步特判）"}
  P2: {类型: 描述, 默认: "道具252(小药袋)、道具477(虚空)、道具523(搬家盒)、道具580(红钥匙)、道具675(碎裂的宝珠)和道具706(无底坑)", 性质: 局部, 说明: "说明文本中的被移除道具描述"}
]]
l local I,C,Y,T,A=Isaac,{P1},true,{}A=I.AddCallback A(T,23,function(_,c)for _,v in pairs(C)do if c==v and c~=580 then return Y end end end)A(T,31,function(_,p)for _,i in pairs(C)do while p:HasCollectible(i)do p:RemoveCollectible(i)end end end)A(T,37,function(p,f,v,s)if v==100 then repeat p,f=Game():GetItemPool()for _,i in pairs(C)do if i==s then f,s=1,p:GetCollectible(p:GetLastPool(),Y)break end end until not f return{v,s}end end)

--[[
模板: remove-cards
]]

--[[
模板: remove-trinkets
参数:
  P1: "170"
  P2: "170(水晶钥匙)"
]]

--[[
说明: |-
  每新进入一层，根据红隐难度生成红钥匙碎片（单连4片、双连3片、三连2片、四连或以上1片）
  屏幕上方显示与红隐相连的非红房间数；若当前层不存在红隐则相连数显示为0、不生成红钥匙碎片。
  空拍红钥匙碎片，会替换为触发道具{P2}。
  若当前层存在红隐，玩家找到红隐之前无法拾取非任务道具和硬币。
名称: 红隐探测
参数定义:
  P1: {类型: 道具id, 默认: "175", 性质: 局部, 说明: "空拍红钥匙碎片时触发的道具id（175=爸爸的钥匙）"}
  P2: {类型: 描述, 默认: "175-“爸爸的钥匙”", 性质: 局部, 说明: "说明文本中的触发道具描述（对应P1）"}
]]
l local B,C,M,I,G,P,V,D,L,R,A,T,S,X,O,J,K,W,Q,Z,N,H,F,U,E=Color,0,math.abs,Isaac,Game(),'SubType','Variant','DisplayFlags','GetLevel','GetRooms','Data','Type','SafeGridIndex','GetRoomByIdx','Color','GetCard','SetCard','GetPill','SetPill',{}H,N,F,U,E=function(x,y)return M(x%13-y%13)+M(x//13-y//13)end,I.GetTime,I.AddCallback,function(s,r,l)l=G[L](G)s=l[R](l)for i=1,#s do r=s:Get(i-1)if r[A][T]==29 then return r end end end,function(p)return p[V]==20 or p[V]==100 and p[P]~=0 and not I.GetItemConfig():GetCollectible(p[P]):HasTags(1<<15)end F(Z,2,function(u,l,d,s,r)u=U()_Y=not u or u[D]>0 if not _Y and u then l=G[L](G)d=u[S]s=l[R](l)for i=1,#s do r=s:Get(i-1)if H(r[S],d)==1 and r[D]>0 then _Y=1 break end end end I.RenderText(C,I.GetScreenWidth()/2-4,10,not _Y and 1 or 0,_Y and 1 or 0,0,1)for i=1,G:GetNumPlayers()do u=I.GetPlayer(i-1)l=u:GetData()l._=l._ or{T=0}l=l._ if Input.IsActionPressed(10,u.ControllerIndex)and 78==u[J](u,0)and l.T+500<N()and not u:IsHoldingItem()and u:CanPickupItem()then l.T=N()s=u[W](u,1)if s~=0 then u[Q](u,0,s)u[Q](u,1,0)else u[K](u,0,u[J](u,1))u[K](u,1,0)end u:UseActiveItem(P1)return end end end)F(Z,18,function(l,d,r)C=0 if U()then l=G[L](G)d=U()[S]for i=0,168 do r=l[X](l,i)if r[A]and r.Flags&1024==0 and H(i,d)==2 then C=C+1 end end for _=1,C<5 and 5-C or 1 do I.Spawn(5,300,78,G:GetRoom():GetCenterPos(),Vector.Zero,nil)end end end)F(Z,34,function(_,p)if not _Y and E(p)then p[O]=B(1,0,0,1)end end)F(Z,36,function(_,p)if _Y then p[O]=B(1,1,1,1)end end)F(Z,38,function(_,p,c)if not _Y and c:ToPlayer()and E(p)then return true end end)

--[[
模板: curse-immune
]]

--[[
说明: |-
  按住TAB键时，角色会吸引非红色硬币
依赖: [红隐探测]
]]
l local A,M,T=Isaac.AddCallback,ModCallbacks,{}A(T,M.MC_POST_RENDER,function()T.C=false for i=1,Game():GetNumPlayers()do if Input.IsButtonPressed(Keyboard.KEY_TAB,Game():GetPlayer(i-1).ControllerIndex)then T.C=true break end end end)A(T,M.MC_POST_PICKUP_UPDATE,function(_,p)if _Y and T.C then local e,l=Game():GetNearestPlayer(p.Position)l=e.Position-p.Position p.Velocity=3*(l:Length()>10 and math.log(l:Length())or 0)*l:Normalized()p.GridCollisionClass=EntityGridCollisionClass.GRIDCOLL_NONE end end,PickupVariant.PICKUP_COIN)

--[[
模板: restart-game
]]
