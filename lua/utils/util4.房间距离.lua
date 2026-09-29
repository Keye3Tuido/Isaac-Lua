--房间距离：返回两个 RoomDescriptor 之间普通房门图上的最短距离，以及最短路径节点的并集。

--[[
作为模板: true
模板id: room-distance
说明: 调用 GetRoomDistance(fromRoomDesc, toRoomDesc)。返回 (int, table)：第一个值为最短距离（不可达返回 -1，同房间返回 0），第二个值为所有最短路径上房间的 RoomDescriptor 顺序表。算法通过 level:GetRooms() 实时热读取、按维度区分，使用单次 BFS 记录前驱并回溯得到路径并集。
]]
l local ae='ROOMSHAPE_'local b,a,s,t,u,w,x,y,z,A,B,C,D,E,e,f,g,j,l,m,n,k,q=RoomShape,DoorSlot,ae..'1x1',ae..'IH',ae..'IV',ae..'1x2',ae..'IIV',ae..'2x1',ae..'IIH',ae..'2x2',ae..'LTL',ae..'LTR',ae..'LBL',ae..'LBR','LEFT0','UP0','RIGHT0','DOWN0','LEFT1','RIGHT1','DOWN1','Data','SafeGridIndex'local ab,ac,N={[b[s]]={{0,0}},[b[t]]={{0,0}},[b[u]]={{0,0}},[b[w]]={{0,0},{0,1}},[b[x]]={{0,0},{0,1}},[b[y]]={{0,0},{1,0}},[b[z]]={{0,0},{1,0}},[b[A]]={{0,0},{1,0},{0,1},{1,1}},[b[B]]={{0,0},{-1,1},{0,1}},[b[C]]={{0,0},{0,1},{1,1}},[b[D]]={{0,0},{1,0},{1,1}},[b[E]]={{0,0},{1,0},{0,1}}},{[b[s]]={[a[e]]={-1,0},[a[f]]={0,-1},[a[g]]={1,0},[a[j]]={0,1}},[b[t]]={[a[e]]={-1,0},[a[g]]={1,0}},[b[u]]={[a[f]]={0,-1},[a[j]]={0,1}},[b[w]]={[a[e]]={-1,0},[a[f]]={0,-1},[a[g]]={1,0},[a[j]]={0,2},[a[l]]={-1,1},[a[m]]={1,1}},[b[x]]={[a[f]]={0,-1},[a[j]]={0,2}},[b[y]]={[a[e]]={-1,0},[a[f]]={0,-1},[a[g]]={2,0},[a[j]]={0,1},[a.UP1]={1,-1},[a[n]]={1,1}},[b[z]]={[a[e]]={-1,0},[a[g]]={2,0}},[b[A]]={[a[e]]={-1,0},[a[f]]={0,-1},[a[g]]={2,0},[a[j]]={0,2},[a[l]]={-1,1},[a.UP1]={1,-1},[a[m]]={2,1},[a[n]]={1,2}},[b[B]]={[a[e]]={-1,0},[a[f]]={-1,0},[a[g]]={1,0},[a[j]]={-1,2},[a[l]]={-2,1},[a.UP1]={0,-1},[a[m]]={1,1},[a[n]]={0,2}},[b[C]]={[a[e]]={-1,0},[a[f]]={0,-1},[a[g]]={1,0},[a[j]]={0,2},[a[l]]={-1,1},[a.UP1]={1,0},[a[m]]={2,1},[a[n]]={1,2}},[b[D]]={[a[e]]={-1,0},[a[f]]={0,-1},[a[g]]={2,0},[a[j]]={0,1},[a[l]]={0,1},[a.UP1]={1,-1},[a[m]]={2,1},[a[n]]={1,2}},[b[E]]={[a[e]]={-1,0},[a[f]]={0,-1},[a[g]]={2,0},[a[j]]={0,2},[a[l]]={-1,1},[a.UP1]={1,-1},[a[m]]={1,1},[a[n]]={1,1}}},function(p,i)if not(i and i[k])then return nil end local o=i[q]if not o or o<0 then return nil end local h=GetPtrHash(i)for d=0,2 do local c=p:GetRoomByIdx(o,d)if c and c[k]and h==GetPtrHash(c)then return d end end end function GetRoomDistance(O,U)local G=Game():GetLevel()local P,V=N(G,O),N(G,U)if not(P and V and P==V)then return-1,{}end local H,I=O[q],U[q]if H==I then return 0,{O}end local F,W,X={},{},G:GetRooms()for i=1,#X do local r=X:Get(i-1)if r and r[k]and 0<=r[q]and P==N(G,r)then local c=r[q]F[c]=r local p=ab[r[k].Shape]if p then local v,Y=c%13,c//13 for _,o in ipairs(p)do local d,h=v+o[1],Y+o[2]if d>=0 and d<13 and h>=0 and h<13 then W[h*13+d]=c end end end end end if not(F[H]and F[I])then return-1,{}end local J,K,L,Q,M,R={H},1,{[H]=0},{},false,nil while K<=#J do local c=J[K]K=K+1 local d=L[c]if c==I and not M then M=true R=d end if not M or d<R then local i=F[c]local v=i and i[k]and ac[i[k].Shape]if v then local bx,by,ad,Y=c%13,c//13,i[k].Doors or 0,d+1 for Z=0,7 do local o=v[Z]if o and 0~=ad&(1<<Z)then local p,r=bx+o[1],by+o[2]if p>=0 and p<13 and r>=0 and r<13 then local h=W[r*13+p]if h and h~=c then if nil==L[h]then L[h]=Y Q[h]={c}J[#J+1]=h elseif Y==L[h]then table.insert(Q[h],c)end end end end end end end end if not M then return-1,{}end local aa,S,T={},{},{I}while#T>0 do local c=table.remove(T)if not aa[c]then aa[c]=true local d=F[c]if d then S[#S+1]=d end d=Q[c]if d then for _,v in ipairs(d)do table.insert(T,v)end end end end return R,S end

--以下为可读多行源代码，已注释化，仅保留作参考。
--[[ 可读源代码（非 YAML 头）
local RoomShapeCells = {
    [RoomShape.ROOMSHAPE_1x1] = {{0,0}},
    [RoomShape.ROOMSHAPE_IH] = {{0,0}},
    [RoomShape.ROOMSHAPE_IV] = {{0,0}},
    [RoomShape.ROOMSHAPE_1x2] = {{0,0},{0,1}},
    [RoomShape.ROOMSHAPE_IIV] = {{0,0},{0,1}},
    [RoomShape.ROOMSHAPE_2x1] = {{0,0},{1,0}},
    [RoomShape.ROOMSHAPE_IIH] = {{0,0},{1,0}},
    [RoomShape.ROOMSHAPE_2x2] = {{0,0},{1,0},{0,1},{1,1}},
    [RoomShape.ROOMSHAPE_LTL] = {{0,0},{-1,1},{0,1}},
    [RoomShape.ROOMSHAPE_LTR] = {{0,0},{0,1},{1,1}},
    [RoomShape.ROOMSHAPE_LBL] = {{0,0},{1,0},{1,1}},
    [RoomShape.ROOMSHAPE_LBR] = {{0,0},{1,0},{0,1}},
}

local RoomShapeSlotOffset = {
    [RoomShape.ROOMSHAPE_1x1] = {[DoorSlot.LEFT0]={-1,0},[DoorSlot.UP0]={0,-1},[DoorSlot.RIGHT0]={1,0},[DoorSlot.DOWN0]={0,1}},
    [RoomShape.ROOMSHAPE_IH] = {[DoorSlot.LEFT0]={-1,0},[DoorSlot.RIGHT0]={1,0}},
    [RoomShape.ROOMSHAPE_IV] = {[DoorSlot.UP0]={0,-1},[DoorSlot.DOWN0]={0,1}},
    [RoomShape.ROOMSHAPE_1x2] = {[DoorSlot.LEFT0]={-1,0},[DoorSlot.UP0]={0,-1},[DoorSlot.RIGHT0]={1,0},[DoorSlot.DOWN0]={0,2},[DoorSlot.LEFT1]={-1,1},[DoorSlot.RIGHT1]={1,1}},
    [RoomShape.ROOMSHAPE_IIV] = {[DoorSlot.UP0]={0,-1},[DoorSlot.DOWN0]={0,2}},
    [RoomShape.ROOMSHAPE_2x1] = {[DoorSlot.LEFT0]={-1,0},[DoorSlot.UP0]={0,-1},[DoorSlot.RIGHT0]={2,0},[DoorSlot.DOWN0]={0,1},[DoorSlot.UP1]={1,-1},[DoorSlot.DOWN1]={1,1}},
    [RoomShape.ROOMSHAPE_IIH] = {[DoorSlot.LEFT0]={-1,0},[DoorSlot.RIGHT0]={2,0}},
    [RoomShape.ROOMSHAPE_2x2] = {[DoorSlot.LEFT0]={-1,0},[DoorSlot.UP0]={0,-1},[DoorSlot.RIGHT0]={2,0},[DoorSlot.DOWN0]={0,2},[DoorSlot.LEFT1]={-1,1},[DoorSlot.UP1]={1,-1},[DoorSlot.RIGHT1]={2,1},[DoorSlot.DOWN1]={1,2}},
    [RoomShape.ROOMSHAPE_LTL] = {[DoorSlot.LEFT0]={-1,0},[DoorSlot.UP0]={-1,0},[DoorSlot.RIGHT0]={1,0},[DoorSlot.DOWN0]={-1,2},[DoorSlot.LEFT1]={-2,1},[DoorSlot.UP1]={0,-1},[DoorSlot.RIGHT1]={1,1},[DoorSlot.DOWN1]={0,2}},
    [RoomShape.ROOMSHAPE_LTR] = {[DoorSlot.LEFT0]={-1,0},[DoorSlot.UP0]={0,-1},[DoorSlot.RIGHT0]={1,0},[DoorSlot.DOWN0]={0,2},[DoorSlot.LEFT1]={-1,1},[DoorSlot.UP1]={1,0},[DoorSlot.RIGHT1]={2,1},[DoorSlot.DOWN1]={1,2}},
    [RoomShape.ROOMSHAPE_LBL] = {[DoorSlot.LEFT0]={-1,0},[DoorSlot.UP0]={0,-1},[DoorSlot.RIGHT0]={2,0},[DoorSlot.DOWN0]={0,1},[DoorSlot.LEFT1]={0,1},[DoorSlot.UP1]={1,-1},[DoorSlot.RIGHT1]={2,1},[DoorSlot.DOWN1]={1,2}},
    [RoomShape.ROOMSHAPE_LBR] = {[DoorSlot.LEFT0]={-1,0},[DoorSlot.UP0]={0,-1},[DoorSlot.RIGHT0]={2,0},[DoorSlot.DOWN0]={0,2},[DoorSlot.LEFT1]={-1,1},[DoorSlot.UP1]={1,-1},[DoorSlot.RIGHT1]={1,1},[DoorSlot.DOWN1]={1,1}},
}

local function GetDim(level, roomDesc)
    if not (roomDesc and roomDesc.Data) then return nil end
    local sgi = roomDesc.SafeGridIndex
    if not sgi or sgi < 0 then return nil end
    local h = GetPtrHash(roomDesc)
    for d = 0, 2 do
        local c = level:GetRoomByIdx(sgi, d)
        if c and c.Data and GetPtrHash(c) == h then return d end
    end
end

function GetRoomDistance(fromRoomDesc, toRoomDesc)
    local level = Game():GetLevel()
    local fromDim, toDim = GetDim(level, fromRoomDesc), GetDim(level, toRoomDesc)
    if not (fromDim and toDim and fromDim == toDim) then return -1, {} end

    local start = fromRoomDesc.SafeGridIndex
    local target = toRoomDesc.SafeGridIndex
    if start == target then return 0, {fromRoomDesc} end

    local roomBySafe, safeByCell = {}, {}
    local rooms = level:GetRooms()
    for i = 1, #rooms do
        local r = rooms:Get(i - 1)
        if r and r.Data and r.SafeGridIndex >= 0 and GetDim(level, r) == fromDim then
            local sgi = r.SafeGridIndex
            roomBySafe[sgi] = r
            local cells = RoomShapeCells[r.Data.Shape]
            if cells then
                local bx, by = sgi % 13, sgi // 13
                for _, o in ipairs(cells) do
                    local cx, cy = bx + o[1], by + o[2]
                    if cx >= 0 and cx < 13 and cy >= 0 and cy < 13 then
                        safeByCell[cy * 13 + cx] = sgi
                    end
                end
            end
        end
    end
    if not (roomBySafe[start] and roomBySafe[target]) then return -1, {} end

    local queue = {start}
    local head = 1
    local dist = {[start] = 0}
    local pred = {}
    local found, minDist = false, nil

    while head <= #queue do
        local cur = queue[head]
        head = head + 1
        local d = dist[cur]

        if cur == target and not found then
            found = true
            minDist = d
        end

        if not found or d < minDist then
            local room = roomBySafe[cur]
            local offsets = room and room.Data and RoomShapeSlotOffset[room.Data.Shape]
            if offsets then
                local bx, by = cur % 13, cur // 13
                local doors = room.Data.Doors or 0
                local nd = d + 1
                for slot = 0, 7 do
                    local o = offsets[slot]
                    if o and (doors & (1 << slot)) ~= 0 then
                        local tx, ty = bx + o[1], by + o[2]
                        if tx >= 0 and tx < 13 and ty >= 0 and ty < 13 then
                            local nb = safeByCell[ty * 13 + tx]
                            if nb and nb ~= cur then
                                if dist[nb] == nil then
                                    dist[nb] = nd
                                    pred[nb] = {cur}
                                    queue[#queue + 1] = nb
                                elseif dist[nb] == nd then
                                    table.insert(pred[nb], cur)
                                end
                            end
                        end
                    end
                end
            end
        end
    end

    if not found then return -1, {} end

    local pathSet = {}
    local pathRooms = {}
    local stack = {target}
    while #stack > 0 do
        local cur = table.remove(stack)
        if not pathSet[cur] then
            pathSet[cur] = true
            local room = roomBySafe[cur]
            if room then
                pathRooms[#pathRooms + 1] = room
            end
            local p = pred[cur]
            if p then
                for _, v in ipairs(p) do
                    table.insert(stack, v)
                end
            end
        end
    end

    return minDist, pathRooms
end
]]
