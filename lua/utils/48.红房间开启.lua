--红房间开启。

--[[
作为模板: true
模板id: open-floor-red-rooms
说明: 开启当前层、当前维度，所有能打开的红房间
]]
l local S,D,G,E,L,R,T,C,P,O,m,x='SafeGridIndex','Data','GetRoomByIdx','GetRooms',Game():GetLevel(),{}T=L[E](L)C,O=#T,function(r,i,d)i=r[S]d=r[D]and r[D].Doors for j=0,7 do if(not d or d&1==1)then L:MakeRedRoomDoor(i,j)L:UncoverHiddenDoor(i,j)end d=d and d>>1 end R[i]=true r.DisplayFlags=5 end O(L[G](L,L:GetCurrentRoomDesc()[S]))while P~=C do P=C for i=1,C do m=T:Get(i-1)x=m[S]m=L[G](L,x,N)if not R[x]then O(m)end end T=L[E](L)C=#T end L:UpdateVisibility()
