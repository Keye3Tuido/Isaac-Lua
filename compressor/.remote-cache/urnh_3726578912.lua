--[[
    UltraRoomNotHere
    -----------------------------------------------------------------
    判断当前房间内 DOOR_OUTLINE 槽位（红房间提示）是否有可能通向"究极隐藏房（Ultra Secret Room / USR）"。

    距离逻辑参考 guidepost：把每个房间拆成它在 13x13 网格上占据的若干 1x1 格点。两点距离 = 它们的曼哈顿距离，不考虑可达性。

    实现要点：遍历 level:GetRoomByIdx(i)（i = 0..168），对同一个房间会在它占据的多个 GridIndex 上重复返回；用 SafeGridIndex 去重，并按 SafeGridIndex + ShapeFootprint 推出该房间的所有 cells。已经存在的究极隐藏房本身会被排除在 rooms / occupancy 之外，避免它把候选格点挤掉或自己跟自己比较。

    USR 生成条件：
      1. USR 距离所有非红房间的最短曼哈顿距离 = 2
      2. USR 与不带红房间标签的 BOSS / SECRET / SUPER SECRET / CURSE 房的曼哈顿距离 > 2
      3. 所有与 USR 距离恰好为 2 的非红房间，其到 USR 的每一条最短路径，经过的非红房间门槽位都必须在该房间的 AllowedDoors 内
      4. USR 在 (0..12, 0..12) 合法地图格点上，且未被任何房间占据
]]

local UltraRoomNotHere = RegisterMod("UltraRoomNotHere", 1)

----------------------------------------------------------------
-- 1. 房型几何数据（沿用 guidepost 的 SafeGridIndex 偏移表）
----------------------------------------------------------------

-- 每种房型每个门槽通向房间外侧那一格的偏移（相对真正参考点）
local Slot2ExtOffset = {
    [RoomShape.ROOMSHAPE_1x1] = {
        [DoorSlot.LEFT0]  = {x=-1, y=0},
        [DoorSlot.UP0]    = {x=0,  y=-1},
        [DoorSlot.RIGHT0] = {x=1,  y=0},
        [DoorSlot.DOWN0]  = {x=0,  y=1},
    },
    [RoomShape.ROOMSHAPE_IH] = {
        [DoorSlot.LEFT0]  = {x=-1, y=0},
        [DoorSlot.RIGHT0] = {x=1,  y=0},
    },
    [RoomShape.ROOMSHAPE_IV] = {
        [DoorSlot.UP0]   = {x=0, y=-1},
        [DoorSlot.DOWN0] = {x=0, y=1},
    },
    [RoomShape.ROOMSHAPE_1x2] = {
        [DoorSlot.LEFT0]  = {x=-1, y=0},
        [DoorSlot.UP0]    = {x=0,  y=-1},
        [DoorSlot.RIGHT0] = {x=1,  y=0},
        [DoorSlot.DOWN0]  = {x=0,  y=2},
        [DoorSlot.LEFT1]  = {x=-1, y=1},
        [DoorSlot.RIGHT1] = {x=1,  y=1},
    },
    [RoomShape.ROOMSHAPE_IIV] = {
        [DoorSlot.UP0]   = {x=0, y=-1},
        [DoorSlot.DOWN0] = {x=0, y=2},
    },
    [RoomShape.ROOMSHAPE_2x1] = {
        [DoorSlot.LEFT0]  = {x=-1, y=0},
        [DoorSlot.UP0]    = {x=0,  y=-1},
        [DoorSlot.RIGHT0] = {x=2,  y=0},
        [DoorSlot.DOWN0]  = {x=0,  y=1},
        [DoorSlot.UP1]    = {x=1,  y=-1},
        [DoorSlot.DOWN1]  = {x=1,  y=1},
    },
    [RoomShape.ROOMSHAPE_IIH] = {
        [DoorSlot.LEFT0]  = {x=-1, y=0},
        [DoorSlot.RIGHT0] = {x=2,  y=0},
    },
    [RoomShape.ROOMSHAPE_2x2] = {
        [DoorSlot.LEFT0]  = {x=-1, y=0},
        [DoorSlot.UP0]    = {x=0,  y=-1},
        [DoorSlot.RIGHT0] = {x=2,  y=0},
        [DoorSlot.DOWN0]  = {x=0,  y=2},
        [DoorSlot.LEFT1]  = {x=-1, y=1},
        [DoorSlot.UP1]    = {x=1,  y=-1},
        [DoorSlot.RIGHT1] = {x=2,  y=1},
        [DoorSlot.DOWN1]  = {x=1,  y=2},
    },
    [RoomShape.ROOMSHAPE_LTL] = {
        [DoorSlot.LEFT0]  = {x=-1, y=0},
        [DoorSlot.UP0]    = {x=-1, y=0},
        [DoorSlot.RIGHT0] = {x=1,  y=0},
        [DoorSlot.DOWN0]  = {x=-1, y=2},
        [DoorSlot.LEFT1]  = {x=-2, y=1},
        [DoorSlot.UP1]    = {x=0,  y=-1},
        [DoorSlot.RIGHT1] = {x=1,  y=1},
        [DoorSlot.DOWN1]  = {x=0,  y=2},
    },
    [RoomShape.ROOMSHAPE_LTR] = {
        [DoorSlot.LEFT0]  = {x=-1, y=0},
        [DoorSlot.UP0]    = {x=0,  y=-1},
        [DoorSlot.RIGHT0] = {x=1,  y=0},
        [DoorSlot.DOWN0]  = {x=0,  y=2},
        [DoorSlot.LEFT1]  = {x=-1, y=1},
        [DoorSlot.UP1]    = {x=1,  y=0},
        [DoorSlot.RIGHT1] = {x=2,  y=1},
        [DoorSlot.DOWN1]  = {x=1,  y=2},
    },
    [RoomShape.ROOMSHAPE_LBL] = {
        [DoorSlot.LEFT0]  = {x=-1, y=0},
        [DoorSlot.UP0]    = {x=0,  y=-1},
        [DoorSlot.RIGHT0] = {x=2,  y=0},
        [DoorSlot.DOWN0]  = {x=0,  y=1},
        [DoorSlot.LEFT1]  = {x=0,  y=1},
        [DoorSlot.UP1]    = {x=1,  y=-1},
        [DoorSlot.RIGHT1] = {x=2,  y=1},
        [DoorSlot.DOWN1]  = {x=1,  y=2},
    },
    [RoomShape.ROOMSHAPE_LBR] = {
        [DoorSlot.LEFT0]  = {x=-1, y=0},
        [DoorSlot.UP0]    = {x=0,  y=-1},
        [DoorSlot.RIGHT0] = {x=2,  y=0},
        [DoorSlot.DOWN0]  = {x=0,  y=2},
        [DoorSlot.LEFT1]  = {x=-1, y=1},
        [DoorSlot.UP1]    = {x=1,  y=-1},
        [DoorSlot.RIGHT1] = {x=1,  y=1},
        [DoorSlot.DOWN1]  = {x=1,  y=1},
    },
}

-- 每个槽位的 outward 单位向量
local SlotDir = {
    [DoorSlot.LEFT0]  = {x=-1, y=0},
    [DoorSlot.UP0]    = {x=0,  y=-1},
    [DoorSlot.RIGHT0] = {x=1,  y=0},
    [DoorSlot.DOWN0]  = {x=0,  y=1},
    [DoorSlot.LEFT1]  = {x=-1, y=0},
    [DoorSlot.UP1]    = {x=0,  y=-1},
    [DoorSlot.RIGHT1] = {x=1,  y=0},
    [DoorSlot.DOWN1]  = {x=0,  y=1},
}

-- 每种房型占据的格点（相对真正参考点）
local ShapeFootprint = {
    [RoomShape.ROOMSHAPE_1x1]  = {{x=0,y=0}},
    [RoomShape.ROOMSHAPE_IH]   = {{x=0,y=0}},
    [RoomShape.ROOMSHAPE_IV]   = {{x=0,y=0}},
    [RoomShape.ROOMSHAPE_1x2]  = {{x=0,y=0}, {x=0,y=1}},
    [RoomShape.ROOMSHAPE_IIV]  = {{x=0,y=0}, {x=0,y=1}},
    [RoomShape.ROOMSHAPE_2x1]  = {{x=0,y=0}, {x=1,y=0}},
    [RoomShape.ROOMSHAPE_IIH]  = {{x=0,y=0}, {x=1,y=0}},
    [RoomShape.ROOMSHAPE_2x2]  = {{x=0,y=0}, {x=1,y=0}, {x=0,y=1}, {x=1,y=1}},
    [RoomShape.ROOMSHAPE_LTL]  = {{x=0,y=0}, {x=-1,y=1}, {x=0,y=1}},
    [RoomShape.ROOMSHAPE_LTR]  = {{x=0,y=0}, {x=0,y=1},  {x=1,y=1}},
    [RoomShape.ROOMSHAPE_LBL]  = {{x=0,y=0}, {x=1,y=0},  {x=1,y=1}},
    [RoomShape.ROOMSHAPE_LBR]  = {{x=0,y=0}, {x=1,y=0},  {x=0,y=1}},
}

-- 反向表：CellDirToSlot[shape][cellOffsetKey][dirKey] = slot
-- cellOffsetKey 为内部格点相对 SafeGridIndex 的偏移
local CellDirToSlot = {}
for shape, slotTbl in pairs(Slot2ExtOffset) do
    CellDirToSlot[shape] = {}
    for slot, ext in pairs(slotTbl) do
        local dir = SlotDir[slot]
        local ix, iy = ext.x - dir.x, ext.y - dir.y
        local cKey = ix .. "," .. iy
        local dKey = dir.x .. "," .. dir.y
        CellDirToSlot[shape][cKey] = CellDirToSlot[shape][cKey] or {}
        CellDirToSlot[shape][cKey][dKey] = slot
    end
end

----------------------------------------------------------------
-- 2. 通用辅助
----------------------------------------------------------------

local function ManhattanDist(ax, ay, bx, by)
    return math.abs(ax - bx) + math.abs(ay - by)
end

----------------------------------------------------------------
-- 3. 楼层数据扫描
----------------------------------------------------------------

local SPECIAL_NONRED_TYPES = {
    [RoomType.ROOM_BOSS]        = true,
    [RoomType.ROOM_SECRET]      = true,
    [RoomType.ROOM_SUPERSECRET] = true,
    [RoomType.ROOM_CURSE]       = true,
}

local function IsRedRoom(roomInfo)
    return (roomInfo.flags & RoomDescriptor.FLAG_RED_ROOM) > 0 or roomInfo.type == RoomType.ROOM_ULTRASECRET
end

-- 给定一个 RoomDescriptor，按 SafeGridIndex + ShapeFootprint 拆出全部格点
local function MakeRoomInfo(r)
    local fp = ShapeFootprint[r.Data.Shape]
    if not fp then return nil end
    local sgi = r.SafeGridIndex
    local sx, sy = sgi % 13, sgi // 13
    local info = {
        refX  = sx,
        refY  = sy,
        shape = r.Data.Shape,
        doors = r.Data.Doors or 0,
        type  = r.Data.Type,
        flags = r.Flags,
        cells = {},
    }
    for _, c in ipairs(fp) do
        info.cells[#info.cells + 1] = {x = sx + c.x, y = sy + c.y}
    end
    return info
end

-- 收集楼层上的"其它房间"——不包含已经生成的 USR 自身（避免它把候选挤掉）
local function CollectOtherRooms()
    local level = Game():GetLevel()
    local occupancy = {}     -- gridIndex -> roomInfo
    local rooms = {}
    local seen = {}          -- SafeGridIndex 去重

    for i = 0, 168 do
        local r = level:GetRoomByIdx(i)
        if r and r.Data and not seen[r.SafeGridIndex]
           and r.Data.Type ~= RoomType.ROOM_ULTRASECRET
           and r.Flags & RoomDescriptor.FLAG_RED_ROOM == 0 then
            seen[r.SafeGridIndex] = true
            local info = MakeRoomInfo(r)
            if info then
                rooms[#rooms + 1] = info
                for _, c in ipairs(info.cells) do
                    if c.x >= 0 and c.x < 13 and c.y >= 0 and c.y < 13 then
                        occupancy[c.y * 13 + c.x] = info
                    end
                end
            end
        end
    end
    return occupancy, rooms
end

local function MinDistToRoom(ux, uy, roomInfo)
    local minD = math.huge
    for _, c in ipairs(roomInfo.cells) do
        local d = ManhattanDist(ux, uy, c.x, c.y)
        if d < minD then minD = d end
    end
    return minD
end

----------------------------------------------------------------
-- 4. USR 条件判定
----------------------------------------------------------------

-- 条件 3：对距离 USR 候选恰好为 2 的非红房间 R，从 R 内每个距离为 2 的格点到 USR 的所有最短路径，其首步出门槽位都必须在 AllowedDoors 内。
-- 由条件 1 已经保证 USR 周围 1 格内不存在任何非红房间，因此最短路径上唯一需要校验的非红房间门槽即 R 自己最近格点朝 USR 出去的那一步。
-- 任一最短路径首步走的门槽未开放（或结构上不存在）即否决该候选。
local function CheckCondition3ForRoom(R, ux, uy)
    local doors = R.doors
    local slotMap = CellDirToSlot[R.shape]
    if not slotMap then return false end

    local checkedAny = false
    for _, c in ipairs(R.cells) do
        if ManhattanDist(c.x, c.y, ux, uy) == 2 then
            local dx, dy = ux - c.x, uy - c.y
            local dirs = {}
            if dx ~= 0 then dirs[#dirs + 1] = {x = (dx > 0 and 1 or -1), y = 0} end
            if dy ~= 0 then dirs[#dirs + 1] = {x = 0, y = (dy > 0 and 1 or -1)} end

            local cKey = (c.x - R.refX) .. "," .. (c.y - R.refY)
            local cellSlots = slotMap[cKey]
            for _, d in ipairs(dirs) do
                local dKey = d.x .. "," .. d.y
                local slot = cellSlots and cellSlots[dKey] or nil
                if slot == nil then
                    -- 该方向结构上没有门槽，最短路径首步无法穿出
                    return false
                end
                if (doors & (1 << slot)) == 0 then
                    return false
                end
                checkedAny = true
            end
        end
    end
    return checkedAny
end

-- 候选格点 (ux,uy) 是否满足全部 USR 生成条件
-- 返回 isValid, distance2NonRedRoomCount
local function CheckUSRCandidate(ux, uy, occupancy, rooms)
    -- 条件 4
    if ux < 0 or ux > 12 or uy < 0 or uy > 12 then return false, 0 end
    if occupancy[uy * 13 + ux] then return false, 0 end

    local minD = math.huge
    local distance2List = {}
    local distance2Count = 0

    for _, R in ipairs(rooms) do
        if not IsRedRoom(R) then
            local d = MinDistToRoom(ux, uy, R)
            if d < minD then minD = d end
            -- 距离USR过近
            if d < 2 then return false, 0 end
            -- 与特殊房间距离过近
            if d <= 2 and SPECIAL_NONRED_TYPES[R.type] then
                return false, 0
            end
            if d == 2 then
                distance2List[#distance2List + 1] = R
                -- 统计该房间中与候选点曼哈顿距离恰好为 2 的格点数量
                for _, c in ipairs(R.cells) do
                    if ManhattanDist(c.x, c.y, ux, uy) == 2 then
                        distance2Count = distance2Count + 1
                    end
                end
            end
        end
    end

    -- 距离关系不符
    if minD ~= 2 then return false, 0 end

    -- 检查是否存在堵门情况
    for _, R in ipairs(distance2List) do
        if not CheckCondition3ForRoom(R, ux, uy) then
            return false, 0
        end
    end
    return true, distance2Count
end

-- 给定当前房间和门槽，沿直线 / 折线延伸 2 个曼哈顿距离的 3 个候选格点
local function GetCandidates(currentInfo, slot)
    local extMap = Slot2ExtOffset[currentInfo.shape]
    local ext = extMap and extMap[slot]
    if not ext then return {} end
    local d = SlotDir[slot]
    local ex, ey = currentInfo.refX + ext.x, currentInfo.refY + ext.y
    local px, py = -d.y, d.x
    return {
        {x = ex + d.x, y = ey + d.y},   -- 直走
        {x = ex + px,  y = ey + py},    -- 折一边
        {x = ex - px,  y = ey - py},    -- 折另一边
    }
end


-- 该楼层存在USR
local USR_EXISTS = false
local function USRExists()
    local level = Game():GetLevel()
    local rooms = level:GetRooms()
    for i=1,rooms.Size do
        local room = rooms:Get(i-1)
        if room.Data and room.Data.Type == RoomType.ROOM_ULTRASECRET then
            return true
        end
    end
    return false
end

UltraRoomNotHere:AddCallback(ModCallbacks.MC_POST_NEW_ROOM, function()
    USR_EXISTS = USRExists()
end)

-- 饰品键被按下
local KeyType = ButtonAction.ACTION_DROP
local KeyPressed = false
UltraRoomNotHere:AddCallback(ModCallbacks.MC_POST_RENDER, function()
    for i=1, Game():GetNumPlayers() do
        local player = Isaac.GetPlayer(i-1)
        if Input.IsActionPressed(KeyType, player.ControllerIndex) then
            KeyPressed = true
            return
        end
    end
    KeyPressed = false
end)
----------------------------------------------------------------
-- 5. 渲染
----------------------------------------------------------------

-- 一个 DOOR_OUTLINE 实体到最近槽位的最大允许世界距离（像素）
local SLOT_MATCH_THRESHOLD = 40

UltraRoomNotHere:AddCallback(ModCallbacks.MC_POST_EFFECT_RENDER, function(_, effect, renderOffset)
    if not Game():GetHUD():IsVisible() then return end
    if not USR_EXISTS then return end
    if not KeyPressed then return end

    local level = Game():GetLevel()
    local currentDesc = level:GetCurrentRoomDesc()
    if not currentDesc or not currentDesc.Data then return end

    local currentInfo = MakeRoomInfo(currentDesc)
    if not currentInfo then return end

    local validSlotMap = Slot2ExtOffset[currentInfo.shape]
    if not validSlotMap then return end

    -- 找到该 DOOR_OUTLINE 对应的门槽
    local room = Game():GetRoom()
    local closestSlot, closestDist = -1, math.huge
    for s = 0, 7 do
        if validSlotMap[s] then
            local pos = room:GetDoorSlotPosition(s)
            local d = effect.Position:Distance(pos)
            if d < closestDist then
                closestDist = d
                closestSlot = s
            end
        end
    end
    if closestSlot < 0 or closestDist > SLOT_MATCH_THRESHOLD then return end

    -- 计算三个候选点位
    local occupancy, rooms = CollectOtherRooms()
    local candidates = GetCandidates(currentInfo, closestSlot)
    local validDistanceCounts = {}
    for _, cand in ipairs(candidates) do
        local ok, cnt = CheckUSRCandidate(cand.x, cand.y, occupancy, rooms)
        if ok then
            validDistanceCounts[#validDistanceCounts + 1] = cnt
        end
    end

    local screen = Isaac.WorldToRenderPosition(effect.Position) + renderOffset
    local validN = #validDistanceCounts

    local textScale = 1
    local text = ''
    local r,g,b,a = 0, 0, 0, 0
    if validN == 0 then
        text = 'x'
        r, g, b, a = 1, 0, 0, 1
    else
        local parts = {}
        for _, cnt in ipairs(validDistanceCounts) do
            parts[#parts + 1] = tostring(cnt)
        end
        text = table.concat(parts, ' ')
        r, g, b, a = 0, 1, 1, 1
    end
    Isaac.RenderScaledText(text, screen.X - textScale*Isaac.GetTextWidth(text)/2, screen.Y, textScale, textScale, r, g, b, a)
end, EffectVariant.DOOR_OUTLINE)
