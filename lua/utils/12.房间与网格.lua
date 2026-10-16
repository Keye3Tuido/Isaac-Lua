--房间与网格：房间增删、红房/隐藏门与网格障碍物。

--[[
作为模板: true
模板id: open-floor-red-rooms
说明: 开启当前层、当前维度，所有能打开的红房间
]]
l local S,D,G,E,L,R,T,C,P,O,m,x='SafeGridIndex','Data','GetRoomByIdx','GetRooms',Game():GetLevel(),{}T=L[E](L)C,O=#T,function(r,i,d)i=r[S]d=r[D]and r[D].Doors for j=0,7 do if(not d or d&1==1)then L:MakeRedRoomDoor(i,j)L:UncoverHiddenDoor(i,j)end d=d and d>>1 end R[i]=true r.DisplayFlags=5 end O(L[G](L,L:GetCurrentRoomDesc()[S]))while P~=C do P=C for i=1,C do m=T:Get(i-1)x=m[S]m=L[G](L,x,N)if not R[x]then O(m)end end T=L[E](L)C=#T end L:UpdateVisibility()

--[[
作为模板: true
模板id: del-room-types
说明: |-
  删除每层的指定类型房间：{P2}。
参数定义:
  P1: {类型: "房间类型列表", 默认: "4,24", 性质: "局部", 说明: "RoomType枚举值列表"}
  P2: {类型: "描述", 默认: "宝箱房(类型为4)、星象房(类型为24)", 性质: "局部", 说明: "说明文本中的被删除房间类型描述"}
]]
l local Del={P1}local D,G,S,T='Data','GetRoomByIdx','SafeGridIndex','Type'Isaac.AddCallback({},ModCallbacks.MC_POST_NEW_LEVEL,function()local L,C,R,r=Game():GetLevel()C,R=L:GetCurrentRoomDesc(),L:GetRooms()for i=1,#R do r=R:Get(i-1)for k,v in pairs(Del)do if v==r[D][T]then L[G](L,r[S])[D]=C[D]break end end end L:UpdateVisibility()for i=0,8 do r=Game():GetRoom():GetDoor(i)if r then R=L[G](L,r.TargetRoomIndex)[D][T]if R~=r.TargetRoomType then r:SetRoomTypes(C[D][T],R)r:SetLocked(false)end end end end)

--[[
作为模板: true
模板id: mouse-pos-show
说明: |-
  若未开启鼠标控制功能则显示鼠标位置。
]]
l Isaac.AddCallback({},2,function(p)if not Options.MouseControl then p=Isaac.WorldToScreen(Input.GetMousePosition(true))Isaac.RenderText('o',p.X-2.2,p.Y-6.4,0,1,1,1)end end)

--[[
作为模板: true
模板id: entity-grid-inspector
说明: 按下"="键，展示所有实体和障碍物信息。
]]
l local a,z,b,c,d,I,j,k,l=table.insert,string.format,pairs,KColor,Vector,Isaac,Font(),{}j:Load('font/terminus.fnt')I.AddCallback({},ModCallbacks.MC_POST_RENDER,function(f,g,h,y)f=Game()g=f:GetRoom()h=function(e)e=I.WorldToScreen(e)if g:IsMirrorWorld()then e.X=I.GetScreenWidth()-e.X end return e end for i=1,f:GetNumPlayers()do if not Game():IsPaused()and Input.IsButtonTriggered(Keyboard.KEY_EQUAL,I.GetPlayer(i-1).ControllerIndex)then l=not l break end end if l then for _,e in b(I.GetRoomEntities())do f=e.InitSeed y=e.SubType a(k,{s=z('%d.%d.%d',e.Type,e.Variant,y>1<<31 and y-(1<<32)or y),p=h(e.Position),c=c(((f>>16)&255)/255,((f>>8)&255)/255,(f&255)/255,1.5)})end for i=0,g:GetGridSize()-1 do f=g:GetGridEntity(i)if(f)then a(k,{s=z('%d.%d(%d)',f:GetType(),f:GetVariant(),f.State),p=h(g:GetGridPosition(i)),c=c(1,1,1,.3)})end end h={}for _,e in b(k)do f=(e.p.X//15)..','..(e.p.Y//15)h[f]=h[f]or{}a(h[f],e)end for _,e in b(h)do f=d.Zero for _,i in b(e)do f=f+i.p end f=f/#e g=1.25*(1-#e)for _,i in b(e)do y=d(f.X,f.Y+g)j:DrawStringScaled(i.s,y.X-j:GetStringWidth(i.s)/8,y.Y-j:GetBaselineHeight()/8,.25,.25,i.c)g=g+2.5 end end k={}end end)

--[[
作为模板: true
模板id: grid-spawn-at-mouse
说明: |-
  强制在鼠标位置生成指定类型、变种、状态的障碍物。
  需要在控制台指定 TYPE,VARIANT,STATE的值，如在控制台输入 lua TYPE,VARIANT,STATE=18,2,1 后，再输入下面的指令，会在鼠标位置生成一个打开的会员商店门。
]]
l local c,d,a,r,b=Isaac,Vector,Input.GetMousePosition(true),Game():GetRoom()b=c.WorldToScreen(a)a=r:IsMirrorWorld()and d(a.X-2*c.ScreenToWorldDistance(b-c.WorldToRenderPosition(d(320,240))).X,a.Y)or a r:RemoveGridEntity(r:GetGridIndex(a),0,false)r:Update()a=c.GridSpawn(TYPE,0,a,true)if a then a:SetVariant(VARIANT)a:Init(a.Desc.SpawnSeed)a.State=STATE end

--[[
作为模板: true
模板id: door-id-map
名称: 门编号
说明: |-
  提供全局接口用于获取门的唯一编号：
  GetDoorId(GridIndex, RoomShape, DoorSlotId[, Dimension=0])->int 获取门编号；
  GetDim()->int 获取当前维度编号。
]]
l local a,S=GetPtrHash,{{0,1,2,28},{0,nil,2,nil},{nil,1,nil,28},{0,1,2,55,27,nil,29,nil},{nil,1,nil,55},{0,1,4,28,nil,3,nil,30},{0,nil,4,nil},{0,1,4,55,27,3,31,57},{2,28,4,55,27,3,31,57},{0,1,2,55,27,30,31,57},{0,1,4,28,29,3,31,57},{0,1,4,55,27,3,29,30}}function GetDoorId(i,s,r,d)if not d or d<0 then d=0 end return 2*(i%13)+27*(i//13)+S[s][r+1]+d*1e3 end function GetDim()local b=Game():GetLevel()local c=b:GetCurrentRoomIndex()for d=0,2 do if a(b:GetRoomByIdx(c,d))==a(b:GetRoomByIdx(c,-1))then return d end end end
