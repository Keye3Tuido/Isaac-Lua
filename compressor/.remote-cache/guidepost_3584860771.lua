local GuidePost = RegisterMod("GuidePost", 1)
GuidePost.Version = '4.0.1'
GuidePost.MaxCalcTimes = 333        -- per render frame
Isaac.ConsoleOutput('GuidePost v' .. GuidePost.Version .. ' - Keye3Tuido\n')

local json = require("json")


local RoomShape_Slot2IndexOffset = {
    [RoomShape.ROOMSHAPE_1x1]={
        [DoorSlot.LEFT0] = {x=-1, y=0},
        [DoorSlot.UP0] = {x=0, y=-1},
        [DoorSlot.RIGHT0] = {x=1, y=0},
        [DoorSlot.DOWN0] = {x=0, y=1},
    },
    [RoomShape.ROOMSHAPE_IH]={
        [DoorSlot.LEFT0] = {x=-1, y=0},
        [DoorSlot.RIGHT0] = {x=1, y=0},
    },
    [RoomShape.ROOMSHAPE_IV]={
        [DoorSlot.UP0] = {x=0, y=-1},
        [DoorSlot.DOWN0] = {x=0, y=1},
    },
    [RoomShape.ROOMSHAPE_1x2]={
        [DoorSlot.LEFT0] = {x=-1, y=0},
        [DoorSlot.UP0] = {x=0, y=-1},
        [DoorSlot.RIGHT0] = {x=1, y=0},
        [DoorSlot.DOWN0] = {x=0, y=2},
        [DoorSlot.LEFT1] = {x=-1, y=1},
        [DoorSlot.RIGHT1] = {x=1, y=1},
    },
    [RoomShape.ROOMSHAPE_IIV]={
        [DoorSlot.UP0] = {x=0, y=-1},
        [DoorSlot.DOWN0] = {x=0, y=2},
    },
    [RoomShape.ROOMSHAPE_2x1]={
        [DoorSlot.LEFT0] = {x=-1, y=0},
        [DoorSlot.UP0] = {x=0, y=-1},
        [DoorSlot.RIGHT0] = {x=2, y=0},
        [DoorSlot.DOWN0] = {x=0, y=1},
        [DoorSlot.UP1] = {x=1, y=-1},
        [DoorSlot.DOWN1] = {x=1, y=1}
    },
    [RoomShape.ROOMSHAPE_IIH]={
        [DoorSlot.LEFT0] = {x=-1, y=0},
        [DoorSlot.RIGHT0] = {x=2, y=0},
    },
    [RoomShape.ROOMSHAPE_2x2]={
        [DoorSlot.LEFT0] = {x=-1, y=0},
        [DoorSlot.UP0] = {x=0, y=-1},
        [DoorSlot.RIGHT0] = {x=2, y=0},
        [DoorSlot.DOWN0] = {x=0, y=2},
        [DoorSlot.LEFT1] = {x=-1, y=1},
        [DoorSlot.UP1] = {x=1, y=-1},
        [DoorSlot.RIGHT1] = {x=2, y=1},
        [DoorSlot.DOWN1] = {x=1, y=2}
    },
    [RoomShape.ROOMSHAPE_LTL]={
        [DoorSlot.LEFT0] = {x=-1, y=0},
        [DoorSlot.UP0] = {x=-1, y=0},
        [DoorSlot.RIGHT0] = {x=1, y=0},
        [DoorSlot.DOWN0] = {x=-1, y=2},
        [DoorSlot.LEFT1] = {x=-2, y=1},
        [DoorSlot.UP1] = {x=0, y=-1},
        [DoorSlot.RIGHT1] = {x=1, y=1},
        [DoorSlot.DOWN1] = {x=0, y=2}
    },
    [RoomShape.ROOMSHAPE_LTR]={
        [DoorSlot.LEFT0] = {x=-1, y=0},
        [DoorSlot.UP0] = {x=0, y=-1},
        [DoorSlot.RIGHT0] = {x=1, y=0},
        [DoorSlot.DOWN0] = {x=0, y=2},
        [DoorSlot.LEFT1] = {x=-1, y=1},
        [DoorSlot.UP1] = {x=1, y=0},
        [DoorSlot.RIGHT1] = {x=2, y=1},
        [DoorSlot.DOWN1] = {x=1, y=2}
    },
    [RoomShape.ROOMSHAPE_LBL]={
        [DoorSlot.LEFT0] = {x=-1, y=0},
        [DoorSlot.UP0] = {x=0, y=-1},
        [DoorSlot.RIGHT0] = {x=2, y=0},
        [DoorSlot.DOWN0] = {x=0, y=1},
        [DoorSlot.LEFT1] = {x=0, y=1},
        [DoorSlot.UP1] = {x=1, y=-1},
        [DoorSlot.RIGHT1] = {x=2, y=1},
        [DoorSlot.DOWN1] = {x=1, y=2}
    },
    [RoomShape.ROOMSHAPE_LBR]={
        [DoorSlot.LEFT0] = {x=-1, y=0},
        [DoorSlot.UP0] = {x=0, y=-1},
        [DoorSlot.RIGHT0] = {x=2, y=0},
        [DoorSlot.DOWN0] = {x=0, y=2},
        [DoorSlot.LEFT1] = {x=-1, y=1},
        [DoorSlot.UP1] = {x=1, y=-1},
        [DoorSlot.RIGHT1] = {x=1, y=1},
        [DoorSlot.DOWN1] = {x=1, y=1}
    }
}
local Dimension = -1
local function GetCurrentDimension()
    local level = Game():GetLevel()
    local currentRoomIndex = level:GetCurrentRoomIndex()
    for i=0,2 do
        if GetPtrHash(level:GetRoomByIdx(currentRoomIndex, i)) == GetPtrHash(level:GetRoomByIdx(currentRoomIndex, -1)) then
            Dimension = i
            return i
        end
    end
end

local RevealedRooms = {}
function GuidePost:Save()
    local data = {}
    for dim, rooms in pairs(RevealedRooms) do
        local sdim = tostring(dim)
        data[sdim] = {}
        for sgi, val in pairs(rooms) do
            data[sdim][tostring(sgi)] = val
        end
    end
    self:SaveData(json.encode(data))
end
function GuidePost:Load()
    RevealedRooms = {}
    if self:HasData() then
        local data = json.decode(self:LoadData())
        for sdim, rooms in pairs(data) do
            local dim = tonumber(sdim)
            RevealedRooms[dim] = {}
            for sgi, val in pairs(rooms) do
                RevealedRooms[dim][tonumber(sgi)] = val
            end
        end
    end
end
GuidePost:AddCallback(ModCallbacks.MC_POST_NEW_LEVEL, function(self)
    RevealedRooms = {}
    self:Save()
end)
GuidePost:AddCallback(ModCallbacks.MC_POST_GAME_STARTED, function(self, isContinued)
    ReavealedRooms = {}
    if isContinued then
        self:Load()
    else
        self:RemoveData()
    end
    self:Save()
end)

local function DeepCopy(orig)
    if type(orig) == 'table' then
        local copy = {}
        for k, v in pairs(orig) do
            copy[k] = DeepCopy(v)
        end
        return copy
    else
        return orig
    end
end
local CacheRooms = {}
local Room_Slot2SafeGridIndex = function(room, doorSlot, useCache) end
local function GetCacheRooms()
    local result = {}
    GuidePost:Load()
    local dimension = GetCurrentDimension()
    RevealedRooms[dimension] = RevealedRooms[dimension] or {}
    -- local rooms = Game():GetLevel():GetRooms()   -- 跨维度互相影响
    for i=0, 168 do
        local room = Game():GetLevel():GetRoomByIdx(i)
        if room.Data and room.DisplayFlags ~= RoomDescriptor.DISPLAY_NONE then
            result[room.SafeGridIndex] = {
                GridIndex = room.GridIndex,
                SafeGridIndex = room.SafeGridIndex,
                DisplayFlags = room.DisplayFlags,
                Flags = room.Flags,
                VisitedCount = room.VisitedCount,
                Data = {
                    Shape = room.Data.Shape,
                    Doors = room.Data.Doors,
                    Type = room.Data.Type,
                    Name = room.Data.Name
                }
            }
            result[i] = result[room.SafeGridIndex]
        end
    end
    local lost = Game():GetLevel():GetCurses() & LevelCurse.CURSE_OF_THE_LOST > 0
    if lost then
        for sgi,room in pairs(result) do
            if room.VisitedCount == 0 and not RevealedRooms[dimension][room.SafeGridIndex] then
                local doors = room.Data.Doors
                local found = false
                local LostCurse_SpecialRooms_ShouldReveal = {
                    RoomType.ROOM_SHOP,
                    RoomType.ROOM_TREASURE,
                    RoomType.ROOM_BOSS,
                    RoomType.ROOM_ARCADE,
                    RoomType.ROOM_CURSE,
                    RoomType.ROOM_CHALLENGE,
                    RoomType.ROOM_LIBRARY,
                    RoomType.ROOM_SACRIFICE,
                    RoomType.ROOM_DEVIL,
                    RoomType.ROOM_ANGEL,
                    RoomType.ROOM_ISAACS,
                    RoomType.ROOM_BARREN,
                    RoomType.ROOM_CHEST,
                    RoomType.ROOM_DICE,
                    RoomType.ROOM_PLANETARIUM,
                    RoomType.ROOM_ULTRASECRET
                }
                for _, t in pairs(LostCurse_SpecialRooms_ShouldReveal) do
                    if room.Data.Type == t then
                        for i=0,7 do
                            if doors & (1 << i) > 0 then
                                local targetIndex = Room_Slot2SafeGridIndex(room, i, result)
                                if targetIndex and result[targetIndex] and result[targetIndex].VisitedCount > 0 then
                                    found = true
                                    break
                                end
                            end
                        end
                        break
                    end
                end
                if not found then
                    result[sgi] = nil
                end
            end
        end
    end

    for sgi, room in pairs(result) do
        RevealedRooms[dimension][sgi] = room.SafeGridIndex
    end
    GuidePost:Save()
    
    return result
end
local function GetRoomByIdx(idx)
    return CacheRooms[idx]
end
local function table_equal(t1, t2)
    if type(t1) ~= type(t2) then return false end
    if type(t1) ~= 'table' then return t1 == t2 end
    for k,v in pairs(t1) do
        if not table_equal(v, t2[k]) then return false end
    end
    for k,v in pairs(t2) do
        if not table_equal(v, t1[k]) then return false end
    end
    return true
end
local isMapUpdated = false
local function IsMapUpdated()
    local tmp = GetCacheRooms()
    local result = not table_equal(CacheRooms, tmp)
    if result then
        CacheRooms = tmp
    end
    return result
end
Room_Slot2SafeGridIndex = function(room, doorSlot, useCache)
    local safeGridIndex, roomShape = room.SafeGridIndex, room.Data.Shape
    local x,y = safeGridIndex % 13, safeGridIndex // 13
    local offset = RoomShape_Slot2IndexOffset[roomShape][doorSlot]
    if offset then
        x, y = x + offset.x, y + offset.y
        if x >= 0 and x < 13 and y >= 0 and y < 13 then
            local targetIndex = y * 13 + x
            local targetRoom = useCache and useCache[targetIndex] or GetRoomByIdx(targetIndex)
            return targetRoom and targetRoom.SafeGridIndex
        end
    end
end

function GuidePost:FindPath()
    return coroutine.create(function()
        local level = Game():GetLevel()
        local current = level:GetCurrentRoomDesc().SafeGridIndex
        if current < 0 then return {} end
        local currentRoom = level:GetRoomByIdx(current)
        local queue = {}
        local distance = {[current] = 0}
        local meet = {[current] = 0}
        for i=0,7 do
            local doors = currentRoom.Data.Doors
            if doors & (1 << i) > 0 then
                local targetIndex = Room_Slot2SafeGridIndex(currentRoom, i)
                if targetIndex then
                    table.insert(queue, {dist = 1, path={[current] = {[i]=true}}, target=targetIndex})
                    distance[targetIndex] = 1
                    meet[targetIndex] = meet[targetIndex] and meet[targetIndex]+1 or 1
                end
            end
        end
        local visited = {[current]={dist=0, path={}, target=current}}
        local highway = {}
        local count = 0
        while #queue > 0 do
            local node = queue[1]
            local roomIndex = node.target
            local room = GetRoomByIdx(roomIndex)
            local roomType = room.Data.Type
            local roomName = room.Data.Name
            local key = room.VisitedCount > 0 and (roomName == 'Mirror Room' or roomName == 'Secret Entrance' or roomName == 'White Fire Room' or roomName == 'Delirium' or roomName == 'Button Room') and roomName or roomType

            if visited[roomIndex] then
                for k,v in pairs(node.path) do
                    local path = visited[roomIndex].path
                    path[k] = path[k] or {}
                    for door,val in pairs(v) do
                        if val then
                            path[k][door] = true
                        end
                    end
                end
            else
                visited[roomIndex] = node
            end
            
            table.remove(queue, 1)
            meet[roomIndex] = meet[roomIndex] - 1
            if meet[roomIndex] <= 0 then
                node.path = visited[roomIndex].path
                for i=0,7 do
                    local doors = room.Data.Doors
                    if doors & (1 << i) > 0 then
                        local targetIndex = Room_Slot2SafeGridIndex(room, i)
                        if targetIndex and not visited[targetIndex] and node.dist ~= distance[targetIndex] then
                            local tmp_path = DeepCopy(node.path)
                            tmp_path[roomIndex] = tmp_path[roomIndex] or {}
                            tmp_path[roomIndex][i] = true
                            table.insert(queue, {dist=node.dist+1, path=tmp_path, target=targetIndex})
                            distance[targetIndex] = node.dist + 1
                            meet[targetIndex] = meet[targetIndex] and meet[targetIndex]+1 or 1
                        end
                    end
                end
                if room.DisplayFlags & RoomDescriptor.DISPLAY_ICON > 0 and (type(key) == 'number' and roomType ~= RoomType.ROOM_DEFAULT or type(key)=='string') then
                    highway[key] = highway[key] or {}
                    highway[key][roomIndex] = visited[roomIndex]
                end
            end
            count = count + 1
            if count >= self.MaxCalcTimes then
                coroutine.yield(highway)
                count = 0
            end
        end
        return highway
    end)
end

local LoadedSprites = {}
local RoomTypeToName = {
    [RoomType.ROOM_SHOP] = "IconShop",
    [RoomType.ROOM_ERROR] = "IconErrorRoom",
    [RoomType.ROOM_TREASURE] = {"IconTreasureRoom","IconTreasureRoomRed","IconTreasureRoomGreed"},
    [RoomType.ROOM_BOSS] = "IconBoss",
    [RoomType.ROOM_MINIBOSS] = "IconMiniboss",
    [RoomType.ROOM_SECRET] = "IconSecretRoom",
    [RoomType.ROOM_SUPERSECRET] = "IconSuperSecretRoom",
    [RoomType.ROOM_ARCADE] = "IconArcade",
    [RoomType.ROOM_CURSE] = "IconCurseRoom",
    [RoomType.ROOM_CHALLENGE] = {"IconAmbushRoom","IconBossAmbushRoom"},
    [RoomType.ROOM_LIBRARY] = "IconLibrary",
    [RoomType.ROOM_SACRIFICE] = "IconSacrificeRoom",
    [RoomType.ROOM_DEVIL] = "IconDevilRoom",
    [RoomType.ROOM_ANGEL] = "IconAngelRoom",
    [RoomType.ROOM_ISAACS] = "IconIsaacsRoom",
    [RoomType.ROOM_BARREN] = "IconBarrenRoom",
    [RoomType.ROOM_CHEST] = "IconChestRoom",
    [RoomType.ROOM_DICE] = "IconDiceRoom",
    [RoomType.ROOM_PLANETARIUM] = "IconPlanetarium",
    [RoomType.ROOM_TELEPORTER] = "IconTeleporterRoom",
    [RoomType.ROOM_ULTRASECRET] = "IconUltraSecretRoom",
    ['Mirror Room'] = "IconMirrorRoom",
    ['Secret Entrance'] = 'IconMinecartRoom',
    ['White Fire Room'] = {filename='gfx/033.004_white fireplace.anm2',anm='Flickering',scale=.2,offset=Vector(6,8)},
    ['Delirium'] = {filename='gfx/005.100_collectible.anm2',anm='Idle',scale=.4,offset=Vector(6.5,16),replace={[1]='gfx/items/collectibles/collectibles_510_delirious.png'}},
    ['Button Room'] = {filename='gfx/grid/grid_pressureplate.anm2',anm='Off',scale=.3,offset=Vector(6.5,6),replace={[0]='gfx/grid/grid_button_rail.png'}}
}

for k,v in pairs(RoomTypeToName) do
    if type(k) == 'number' or type(k) == 'string' and type(v) == 'string' then
        if type(v) == "string" then
            local sprite = Sprite()
            sprite:Load('gfx/ui/minimap_icons.anm2', true)
            sprite:Play(v, true)
            LoadedSprites[k] = sprite
        else
            for i,j in pairs(v) do
                local sprite = Sprite()
                sprite:Load('gfx/ui/minimap_icons.anm2', true)
                sprite:Play(j, true)
                LoadedSprites[k] = LoadedSprites[k] or {}
                LoadedSprites[k][i] = sprite
            end
        end
    else
        local sprite = Sprite()
        sprite:Load(v.filename, true)
        sprite.Scale = v.scale * Vector.One
        sprite.Offset = v.offset
        if v.replace then
            for i,j in pairs(v.replace) do
                sprite:ReplaceSpritesheet(i, j)
            end
            sprite:LoadGraphics()
        end
        sprite:Play(v.anm, true)
        LoadedSprites[k] = sprite
    end
end
local function GetSprite(roomType, variant)
    local sprite = LoadedSprites[roomType]
    if type(sprite) == "table" then
        return sprite[variant or 1]
    end
    return sprite
end

local MouseLeftPressed = false
local MouseLeftPressing = false
local MouseRightPressed = false
local MouseRightPressing = false
local MouseMiddlePressed = false
local MouseMiddlePressing = false
GuidePost:AddCallback(ModCallbacks.MC_POST_RENDER, function(self)
    MouseLeftPressed = MouseLeftPressing
    MouseLeftPressing = Input.IsMouseBtnPressed(Mouse.MOUSE_BUTTON_LEFT)
    MouseRightPressed = MouseRightPressing
    MouseRightPressing = Input.IsMouseBtnPressed(Mouse.MOUSE_BUTTON_RIGHT)
    MouseMiddlePressed = MouseMiddlePressing
    MouseMiddlePressing = Input.IsMouseBtnPressed(Mouse.MOUSE_BUTTON_MIDDLE)
end)


local Door2Room = {}
local co = GuidePost:FindPath()
local SafeGridIndex2Sprite = {}
local Destinations = {}
local Path = {}
local navigator = { empty = true , amount = 0 , dim = Dimension}
local updateNavigator = false
local extraHUDStyle = extraHUDStyle or Options.ExtraHUDStyle
local toggleHeight = true
local function GetRoomSprite(room, roomType)
    local level = Game():GetLevel()
    local variant = 1
    roomType = roomType or room.Data.Type
    if roomType == RoomType.ROOM_TREASURE then
        if room.Flags & RoomDescriptor.FLAG_DEVIL_TREASURE > 0 then
            variant = 2
        elseif room.SafeGridIndex==98 and Game():IsGreedMode() and level:GetStage() < LevelStage.STAGE6_GREED then
            variant = 3
        end
    elseif roomType == RoomType.ROOM_CHALLENGE then
        if level:HasBossChallenge() then
            variant = 2
        end
    end
    return GetSprite(roomType, variant)
end
GuidePost:AddCallback(ModCallbacks.MC_POST_RENDER, function(self)
    if not Game():GetHUD():IsVisible() or Game():GetLevel():GetCurrentRoomDesc().SafeGridIndex < 0 then return end

    isMapUpdated = IsMapUpdated()
    if isMapUpdated or updateNavigator then
        co = self:FindPath()
    end
    
    local success, highway = coroutine.resume(co)
    
    if success then
        local tmp = {}
        SafeGridIndex2Sprite = {}
        Destinations = {}
        Path = {}
        local level = Game():GetLevel()
        local currentRoomIndex = level:GetCurrentRoomDesc().SafeGridIndex
        for roomType, rooms in pairs(highway) do
            for target, path in pairs(rooms) do
                if Dimension == navigator.dim and navigator[target] then
                    for roomIdx, doors in pairs(path.path) do
                        local found = false
                        for door,val in pairs(doors) do
                            if val then
                                found = true
                                break
                            end
                        end
                        if found then
                            Path[roomIdx] = Path[roomIdx] or 1
                        end
                    end
                    Path[currentRoomIndex] = 0
                    Path[target] = 2
                end

                local room = GetRoomByIdx(target)
                local sprite = GetRoomSprite(room, roomType)
                if sprite then
                    local dist = path.dist
                    local CurrentDoors = path.path[currentRoomIndex]
                    local targetRoom = {dist = dist, visitedCount = room.VisitedCount, target=target}
                    for door,val in pairs(CurrentDoors) do
                        if val then
                            tmp[door] = tmp[door] or {}
                            if not tmp[door][sprite] then
                                tmp[door][sprite] = {targetRoom}
                            else
                                table.insert(tmp[door][sprite], targetRoom)
                            end
                        end
                    end
                    SafeGridIndex2Sprite[target] = sprite
                    table.insert(Destinations, targetRoom)
                end
            end
        end
        table.sort(Destinations, function(a,b)
            local a_visited = a.visitedCount > 0 and 1 or 0
            local b_visited = b.visitedCount > 0 and 1 or 0
            if a_visited ~= b_visited then
                return a_visited < b_visited
            end
            if a.dist ~= b.dist then
                return a.dist < b.dist
            end
            return a.target < b.target
        end)
        Door2Room = {}
        for door, content in pairs(tmp) do
            Door2Room[door] = {}
            for key, dists in pairs(content) do
                table.sort(dists, function(a,b) return a.dist < b.dist end)
                table.insert(Door2Room[door], {dists = dists, sprite = key})
            end
            table.sort(Door2Room[door], function(a,b)
                for i=1,math.min(#a.dists,#b.dists) do
                    if a.dists[i].dist ~= b.dists[i].dist then
                        return a.dists[i].dist < b.dists[i].dist
                    end
                end
                return #a.dists < #b.dists
            end)
        end
        updateNavigator = false
    end
end)


local font = Font()
font:Load('font/luaminioutlined.fnt')
local textSize = .8
local textHeightScaled = font:GetBaselineHeight() * textSize
GuidePost:AddCallback(ModCallbacks.MC_POST_RENDER,function(self)
    local level = Game():GetLevel()
    local currentRoomIndex = level:GetCurrentRoomDesc().SafeGridIndex
    if not Game():GetHUD():IsVisible() or currentRoomIndex < 0 then return end
    if Isaac.GetFrameCount() & 3 == 0 then
        for key,sprites in pairs(LoadedSprites) do
            if type(sprites) == "table" then
                for _,sprite in pairs(sprites) do
                    sprite:Update()
                end
            else
                sprites:Update()
            end
        end
    end

    if not navigator.empty then
        if Input.IsButtonPressed(Keyboard.KEY_BACKSPACE, Isaac.GetPlayer().ControllerIndex) and not Game():IsPaused() then
            navigator = {empty = true, amount = 0, dim = Dimension}
            Options.ExtraHUDStyle, extraHUDStyle = extraHUDStyle or Options.ExtraHUDStyle
        elseif MouseMiddlePressed and not MouseMiddlePressing then
            navigator = {empty = false , amount = 1 , dim = Dimension}
            navigator[-1] = true
            updateNavigator = true
        end
    end
    local room = Game():GetRoom()
    for door, content in pairs(Door2Room) do
        local pos = room:GetDoorSlotPosition(door)
        local nums = #content
        local direction = door % 4 * 90
        local offset = Vector.FromAngle(direction)
        local isMirrorWorld = room:IsMirrorWorld()
        if isMirrorWorld then
            offset.X = -offset.X
        end
        local extend = Vector(offset.Y, -offset.X)
        local screenWidth = Isaac.GetScreenWidth()
        local renderPos_start = Isaac.WorldToScreen(pos) - 4 * extend * (nums - 1)
        for order, value in ipairs(content) do
            local sprite = value.sprite
            local renderPos = renderPos_start + extend * 8 * (order - 1)
            if isMirrorWorld then
                renderPos.X = screenWidth - renderPos.X
            end
            local textPos = renderPos + 5 * offset
            for i=1,#value.dists do
                local kcolor = value.dists[i].visitedCount > 0 and KColor.Green or KColor.White
                local target = value.dists[i].target
                local text = tostring(value.dists[i].dist)
                local textWidthScaled = font:GetStringWidth(text) * textSize
                local delta = Vector(textWidthScaled + 2, textHeightScaled - 3 * textSize):Length() * offset / 2
                textPos = textPos + delta
                if Isaac.WorldToScreen(Input.GetMousePosition(true)):Distance(textPos) <= 4  then
                    kcolor = KColor.Red
                    if MouseLeftPressed and not MouseLeftPressing then
                        if navigator.empty and toggleHeight then
                            extraHUDStyle = extraHUDStyle or Options.ExtraHUDStyle
                            Options.ExtraHUDStyle = 0
                        end
                        if Dimension ~= navigator.dim or not navigator[target] then
                            navigator = {empty = false, amount = 1, dim = Dimension}
                            updateNavigator = true
                            navigator[target] = true
                        end
                    elseif MouseRightPressed and not MouseRightPressing then
                        Game():StartRoomTransition(target, Direction.NO_DIRECTION)
                    end
                end
                if Dimension == navigator.dim and navigator[target] then
                    kcolor = KColor.Magenta
                end
                font:DrawStringScaled(text, textPos.X-textWidthScaled/2, textPos.Y-textHeightScaled/2, textSize, textSize, kcolor)
                textPos = textPos + delta
            end
            local spriteScale = Vector(sprite.Scale.X, sprite.Scale.Y)
            if Isaac.WorldToScreen(Input.GetMousePosition(true)):Distance(renderPos) <= 4 then
                sprite.Scale = spriteScale * 1.3
                if MouseLeftPressed and not MouseLeftPressing then
                    if navigator.empty and toggleHeight then
                        extraHUDStyle = extraHUDStyle or Options.ExtraHUDStyle
                        Options.ExtraHUDStyle = 0
                    end
                    local needUpdate = false
                    for i=1,#value.dists do
                        local target = value.dists[i].target
                        if Dimension ~= navigator.dim or not navigator[target] then
                            needUpdate = true
                            break
                        end
                    end
                    if needUpdate then
                        navigator = {empty = false, amount = 0, dim = Dimension}
                        updateNavigator = true
                        for i=1,#value.dists do
                            local target = value.dists[i].target
                            navigator[target] = true
                            navigator.amount = navigator.amount + 1
                        end
                    end
                end
            end
            renderPos = renderPos - Vector(6.5,4)
            sprite:Render(renderPos)
            sprite.Scale = spriteScale
        end
    end
end)


local LoadedMinimap = {}
local roomGridSize = Vector(18,16)
local pivot = Vector(-4,-4)
local roomOutline = Sprite()
roomOutline:Load('gfx/ui/minimap2.anm2', true)
roomOutline:SetFrame('RoomOutline', 0)
local function GetMinimapSprite(roomDesc)
    local roomShape = roomDesc.Data.Shape - 1
    local visited = roomDesc.VisitedCount > 0 and roomDesc.Flags & RoomDescriptor.FLAG_CLEAR > 0
    local isCurrent = roomDesc.SafeGridIndex == Game():GetLevel():GetCurrentRoomDesc().SafeGridIndex
    local key = isCurrent and 'RoomCurrent' or visited and 'RoomVisited' or 'RoomUnvisited'
    if not LoadedMinimap[roomShape] or not LoadedMinimap[roomShape][key] then
        local minimap2 = Sprite()
        minimap2:Load('gfx/ui/minimap2.anm2', true)
        minimap2:SetFrame(key, roomShape)
        LoadedMinimap[roomShape] = LoadedMinimap[roomShape] or {}
        LoadedMinimap[roomShape][key] = minimap2
    end
    return LoadedMinimap[roomShape][key]
end
local ActionMapPressed = false
GuidePost:AddCallback(ModCallbacks.MC_POST_RENDER, function(self)
    ActionMapPressed = false
    for i=1,Game():GetNumPlayers() do
        local player = Isaac.GetPlayer(i-1)
        if Input.IsActionPressed(ButtonAction.ACTION_MAP, player.ControllerIndex) then
            ActionMapPressed = true
            return
        end
    end
end)
local mapsize = 1
local Roomshape2Border = {
    [RoomShape.ROOMSHAPE_1x1] = {{left=-1, right=1, up=-1, down=1}},
    [RoomShape.ROOMSHAPE_IH] = {{left=-1, right=1, up=-1, down=1}},
    [RoomShape.ROOMSHAPE_IV] = {{left=-1, right=1, up=-1, down=1}},
    [RoomShape.ROOMSHAPE_1x2] = {{left=-1, right=1, up=-1, down=3}},
    [RoomShape.ROOMSHAPE_IIV] = {{left=-1, right=1, up=-1, down=3}},
    [RoomShape.ROOMSHAPE_2x1] = {{left=-1, right=3, up=-1, down=1}},
    [RoomShape.ROOMSHAPE_IIH] = {{left=-1, right=3, up=-1, down=1}},
    [RoomShape.ROOMSHAPE_2x2] = {{left=-1, right=3, up=-1, down=3}},
    [RoomShape.ROOMSHAPE_LTL] = {{left=1, right=3, up=-1, down=1},{left=-1, right=3, up=1, down=3}},
    [RoomShape.ROOMSHAPE_LTR] = {{left=-1, right=1, up=-1, down=1},{left=-1, right=3, up=1, down=3}},
    [RoomShape.ROOMSHAPE_LBL] = {{left=-1, right=3, up=-1, down=1},{left=1, right=3, up=1, down=3}},
    [RoomShape.ROOMSHAPE_LBR] = {{left=-1, right=3, up=-1, down=1},{left=-1, right=1, up=1, down=3}}
}
local function PosInRoom(roomCenter, roomShape, pos, halfRoomWidth, halfRoomHeight, isMirrorWorld)
    local deltaX = pos.X - roomCenter.X
    local deltaY = pos.Y - roomCenter.Y
    if isMirrorWorld then
        deltaX = -deltaX
    end
    local borders = Roomshape2Border[roomShape]
    for _, border in pairs(borders) do
        if border.left * halfRoomWidth <= deltaX and deltaX <= border.right * halfRoomWidth and border.up * halfRoomHeight <= deltaY and deltaY <= border.down * halfRoomHeight then
            return true
        end
    end
    return false
end
local function RenderMap(pos)
    if navigator.empty then return end
    local alpha = ActionMapPressed and 0 or 1
    if not Game():GetRoom():IsClear() then
        return
    end
    pos = pos + pivot * mapsize
    local minX, maxX, minY, maxY
    local OutlineQueue = {}
    local RoomQueue = {}
    local halfRoomWidth = roomGridSize.X * mapsize / 2
    local halfRoomHeight = roomGridSize.Y * mapsize / 2
    local flag = false
    for idx, roomDesc in pairs(CacheRooms) do
        local x = idx % 13
        local y = idx // 13
        local sprite = GetMinimapSprite(roomDesc)
        local renderPos = pos + Vector(2 * halfRoomWidth * x, 2 * halfRoomHeight * y)
        if not minX or renderPos.X < minX then minX = renderPos.X end
        if not maxX or renderPos.X + 2 * halfRoomWidth > maxX then maxX = renderPos.X + 2 * halfRoomWidth end
        if not minY or renderPos.Y < minY then minY = renderPos.Y end
        if not maxY or renderPos.Y + 2 * halfRoomHeight > maxY then maxY = renderPos.Y + 2 * halfRoomHeight end
        flag = true
        OutlineQueue[idx] = renderPos
        if idx == roomDesc.SafeGridIndex then
            local grid_x = roomDesc.GridIndex % 13
            local grid_y = roomDesc.GridIndex // 13
            renderPos = pos + Vector(2 * halfRoomWidth * grid_x , 2 * halfRoomHeight * grid_y )
            RoomQueue[idx] = {sprite=sprite, renderPos=renderPos}
        end
    end
    local screenWidth, screenHeight = Isaac.GetScreenWidth(), Isaac.GetScreenHeight()
    local ratio = screenHeight/4/(maxY - minY)
    if math.abs(ratio-1) > 0.01 then
        mapsize = mapsize * ratio
        if mapsize < 1 then return end
        mapsize = 1
    end
    
    if not flag then return end
    local center = Vector(maxX + minX, maxY + minY) / 2
    local offset = pos - center
    
    local isMirrorWorld = Game():GetRoom():IsMirrorWorld()
    minX, maxX = minX + offset.X, maxX + offset.X
    minY, maxY = minY + offset.Y, maxY + offset.Y

    if isMirrorWorld then
        minX, maxX = 2 * pos.X - maxX, 2 * pos.X - minX
    end
    if minX < 0 then
        offset.X = offset.X - minX
    end
    if maxX > screenWidth - halfRoomWidth then
        offset.X = offset.X - (maxX - (screenWidth - halfRoomWidth))
    end
    if minY < 0 then
        offset.Y = offset.Y - minY
    end
    if maxY > screenHeight - halfRoomHeight then
        offset.Y = offset.Y - (maxY - (screenHeight - halfRoomHeight))
    end
    center = center + offset

    roomOutline.Color = Color(roomOutline.Color.R, roomOutline.Color.G, roomOutline.Color.B, alpha)
    roomOutline.Scale = mapsize * Vector.One
    for idx, rpos in pairs(OutlineQueue) do
        local renderPos = rpos + offset
        if isMirrorWorld then
            renderPos.X = 2 * center.X - renderPos.X
            roomOutline.FlipX = true
        else
            roomOutline.FlipX = false
        end
        roomOutline:Render(renderPos)
    end
    
    for sgi, v in pairs(RoomQueue) do
        local room = GetRoomByIdx(sgi)
        local sprite = v.sprite
        sprite.Scale = mapsize * Vector.One
        local renderPos = v.renderPos + offset
        if isMirrorWorld then
            renderPos.X = 2 * center.X - renderPos.X
            sprite.FlipX = true
        else
            sprite.FlipX = false
        end
        local r,g,b,a = 1,1,1,alpha
        local MousePos = Isaac.WorldToScreen(Input.GetMousePosition(true))
        local roomCenter = renderPos + (isMirrorWorld and Vector(-halfRoomWidth, halfRoomHeight) - Vector(-pivot.X,pivot.Y) * mapsize or Vector(halfRoomWidth, halfRoomHeight) - pivot * mapsize)
        if PosInRoom(roomCenter, room.Data.Shape, MousePos, halfRoomWidth, halfRoomHeight, isMirrorWorld) then
            r,g,b,a = 1,1,0,3
            if SafeGridIndex2Sprite[sgi] and MouseLeftPressed and not MouseLeftPressing then
                if navigator.empty and toggleHeight then
                    extraHUDStyle = extraHUDStyle or Options.ExtraHUDStyle
                    Options.ExtraHUDStyle = 0
                end
                if Dimension ~= navigator.dim or not navigator[sgi] then
                    navigator = {empty = false, amount = 1, dim = Dimension}
                    navigator[sgi] = true
                else
                    navigator = {empty = false, amount = 1, dim = Dimension}
                    navigator[-1] = true
                end
                updateNavigator = true
            end
            if MouseRightPressed and not MouseRightPressing then
                Game():StartRoomTransition(sgi, Direction.NO_DIRECTION)
            end
        elseif Path[sgi] == 0 then
            r,g,b = 1,1,0
        elseif Path[sgi] == 1 then
            r,g,b = 0,1,1
        elseif Path[sgi] == 2 then
            if room.VisitedCount > 0 then
                r,g,b = 0,1,0
            else
                r,g,b = 1,0,1
            end
        elseif room.Flags & RoomDescriptor.FLAG_RED_ROOM > 0 then
            r,g,b = 1,0,0
        else
            r,g,b = 1,1,1
        end
        sprite.Color = Color(r,g,b,a)
        sprite:Render(renderPos)
        local icon = SafeGridIndex2Sprite[sgi] or GetRoomSprite(room)
        if icon then
            local ori_color = Color(icon.Color.R, icon.Color.G, icon.Color.B, icon.Color.A)
            local ori_Scale = Vector(icon.Scale.X, icon.Scale.Y)
            icon.Color = Color(icon.Color.R, icon.Color.G, icon.Color.B, alpha)
            icon.Scale = icon.Scale * mapsize
            if isMirrorWorld then
                renderPos = renderPos + Vector(-halfRoomWidth, halfRoomHeight) - Vector(-roomGridSize.X, roomGridSize.Y) * mapsize / 8
                icon.FlipX = true
                if icon.Offset:Length() > 0 then
                    local ori_offset = Vector(icon.Offset.X, icon.Offset.Y)
                    icon.Offset = Vector(-icon.Offset.X, icon.Offset.Y) * mapsize
                    icon:Render(renderPos)
                    icon.Offset = ori_offset
                else
                    icon:Render(renderPos)
                end
            else
                renderPos = renderPos + Vector(halfRoomWidth, halfRoomHeight) - roomGridSize * mapsize / 8
                if icon.Offset:Length() > 0 then
                    local ori_offset = Vector(icon.Offset.X, icon.Offset.Y)
                    icon.Offset = icon.Offset * mapsize
                    icon:Render(renderPos)
                    icon.Offset = ori_offset
                else
                    icon:Render(renderPos)
                end
            end
            icon.FlipX = false
            icon.Color = ori_color
            icon.Scale = ori_Scale
        end
    end
end
GuidePost:AddCallback(ModCallbacks.MC_POST_RENDER, function(self)
    local cid = Isaac.GetPlayer().ControllerIndex
    if (Input.IsButtonTriggered(Keyboard.KEY_LEFT_ALT, cid) or Input.IsButtonTriggered(Keyboard.KEY_RIGHT_ALT, cid)) and not Game():IsPaused() then
        if not navigator.empty then
            toggleHeight = not toggleHeight
            if toggleHeight then
                extraHUDStyle = extraHUDStyle or Options.ExtraHUDStyle
                Options.ExtraHUDStyle = 0
            else
                Options.ExtraHUDStyle, extraHUDStyle = extraHUDStyle or Options.ExtraHUDStyle
            end
        end
    end
    local mapPos = Vector(Isaac.GetScreenWidth(), toggleHeight and Isaac.GetScreenHeight()/2 or 0)
    if not Game():GetHUD():IsVisible() or Game():GetLevel():GetCurrentRoomDesc().SafeGridIndex < 0 then return end
    RenderMap(mapPos)
end)

GuidePost:AddCallback(ModCallbacks.MC_PRE_GAME_EXIT, function(self)
    navigator = {empty = true, amount = 0, dim = Dimension}
    Options.ExtraHUDStyle, extraHUDStyle = extraHUDStyle or Options.ExtraHUDStyle
end)

local currentDestinationIndex = 0
GuidePost:AddCallback(ModCallbacks.MC_POST_RENDER, function(self)
    local cid = Isaac.GetPlayer().ControllerIndex
    local paused = Game():IsPaused()
    local minusTriggered = Input.IsButtonTriggered(Keyboard.KEY_MINUS, cid) and not paused
    local equalTriggered = Input.IsButtonTriggered(Keyboard.KEY_EQUAL, cid) and not paused
    local Length = #Destinations
    if minusTriggered or equalTriggered then
        local targetIndex = -1
        if Length ~= 0 and not navigator.empty then
            currentDestinationIndex = 1
            if navigator.amount == 1 and Dimension == navigator.dim and not navigator[-1] then
                for n, dest in pairs(Destinations) do
                    local found = false
                    for target,_ in pairs(navigator) do
                        if dest.target == target then
                            currentDestinationIndex = equalTriggered and n % Length + 1 or minusTriggered and (n - 2 + Length) % Length + 1
                            found = true
                            break
                        end
                    end
                    if found then
                        break
                    end
                end
            end
            targetIndex = Destinations[currentDestinationIndex].target
        end
        if navigator.empty and toggleHeight then
            extraHUDStyle = extraHUDStyle or Options.ExtraHUDStyle
            Options.ExtraHUDStyle = 0
        end
        navigator = {empty = false, amount = 1, dim = Dimension}
        navigator[targetIndex] = true
        updateNavigator = true
    end
end)

GuidePost:AddCallback(ModCallbacks.MC_POST_NEW_LEVEL, function(self)
    if not navigator.empty then
        navigator = {empty = false, amount = 1, dim = Dimension}
        navigator[-1] = true
    end
end)