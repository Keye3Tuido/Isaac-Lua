local Drop2Shoot = RegisterMod("Drop2Shoot", 1)
Drop2Shoot.version = 1.2
Drop2Shoot.Enabled = false

Isaac.ConsoleOutput('Drop2Shoot v'..Drop2Shoot.version..' - Keye3Tuido\n')

local ShootDirection = {}
Drop2Shoot:AddCallback(ModCallbacks.MC_POST_GAME_STARTED, function()
    ShootDirection = {}
end)

--------------------------------------------------------------------
local Direction={
    LEFT = 0,
    RIGHT = 1,
    UP = 2,
    DOWN = 3
}
Drop2Shoot.Move={
    [Direction.LEFT]=ButtonAction.ACTION_LEFT,
    [Direction.RIGHT]=ButtonAction.ACTION_RIGHT,
    [Direction.UP]=ButtonAction.ACTION_UP,
    [Direction.DOWN]=ButtonAction.ACTION_DOWN
}
Drop2Shoot.Shoot={
    [Direction.LEFT]=ButtonAction.ACTION_SHOOTLEFT,
    [Direction.RIGHT]=ButtonAction.ACTION_SHOOTRIGHT,
    [Direction.UP]=ButtonAction.ACTION_SHOOTUP,
    [Direction.DOWN]=ButtonAction.ACTION_SHOOTDOWN
}
Drop2Shoot:AddCallback(ModCallbacks.MC_INPUT_ACTION, function(self, entity, hook, action)
    if not self.Enabled then return end
    local player = entity and entity:ToPlayer()
    if player then
        local hash = GetPtrHash(player)
        local direction = ShootDirection[hash] or Direction.DOWN
        if self.Shoot[direction] == action and Input.IsActionPressed(ButtonAction.ACTION_DROP, player.ControllerIndex) then
            return hook == InputHook.GET_ACTION_VALUE and 1 or true
        end
    end
end)
--------------------------------------------------------------------
Drop2Shoot:AddCallback(ModCallbacks.MC_INPUT_ACTION, function(self, entity, hook, action)
    if not self.Enabled then return end
    local player = entity and entity:ToPlayer()
    if player then
        if action == ButtonAction.ACTION_DROP then
            for _,v in pairs(self.Move) do
                if Input.IsActionPressed(v, player.ControllerIndex) then
                    return hook == InputHook.GET_ACTION_VALUE and 0 or false
                end
            end
        end
    end
end)
--------------------------------------------------------------------

Drop2Shoot:AddCallback(ModCallbacks.MC_POST_PLAYER_RENDER, function(self, player)
    if not self.Enabled then return end
    local hash = GetPtrHash(player)
    if not Input.IsActionPressed(ButtonAction.ACTION_DROP, player.ControllerIndex) then
        ShootDirection[hash] = ShootDirection[hash] or Direction.DOWN
        for k,v in pairs(self.Move) do
            if Input.IsActionPressed(v, player.ControllerIndex) then
                ShootDirection[hash] = k
                break
            end
        end
    end
end)

--------------------------------------------------------------------
local font = Font()
font:Load('font/cjk/lanapixel.fnt')
local renderStr = 'Drop2Shoot'
local strWidth, baseHeight = font:GetStringWidth(renderStr), font:GetBaselineHeight()
local radius = Vector(strWidth/2, baseHeight/2)
local screenWidth, screenHeight, center, renderPos
function Drop2Shoot:Update()
    screenWidth, screenHeight = Isaac.GetScreenWidth(), Isaac.GetScreenHeight()
    center = Vector(screenWidth/2, screenHeight/2)
    renderPos = renderPos or Vector(center.X, screenHeight - baseHeight)
end
function Drop2Shoot:InBounds(pos)
    self:Update()
    return pos.X >= renderPos.X - radius.X and pos.X <= renderPos.X + radius.X
       and pos.Y >= renderPos.Y - radius.Y and pos.Y <= renderPos.Y + radius.Y
end
function Drop2Shoot:FixRenderPos()
    self:Update()
    renderPos = Vector(
        math.min(math.max(renderPos.X, radius.X), Isaac.GetScreenWidth() - radius.X),
        math.min(math.max(renderPos.Y, radius.Y), Isaac.GetScreenHeight() - radius.Y)
    )
end
local leftPressed,rightPressed,dragging = false,false,false
local alpha = 1
Drop2Shoot:AddCallback(ModCallbacks.MC_POST_RENDER, function(self)
    if not Options.MouseControl then
        local pos = Isaac.WorldToScreen(Input.GetMousePosition(true))
        Isaac.RenderText('o',pos.X-2.2,pos.Y-6.4,0,1,1,1)
    end
    local mpos = Isaac.WorldToScreen(Input.GetMousePosition(true))
    local kcolor = self.Enabled and KColor.Green or KColor.Red
    kcolor = KColor(kcolor.Red, kcolor.Green, kcolor.Blue, alpha)
    kcolor.Alpha = alpha
    if self:InBounds(mpos) then
        kcolor.Alpha = math.min(kcolor.Alpha + .01, 1)
        if Input.IsMouseBtnPressed(Mouse.MOUSE_BUTTON_LEFT) then
            if not leftPressed then
                leftPressed = true
            end
        else
            if leftPressed then
                self.Enabled = not self.Enabled
            end
            leftPressed = false
        end
    else
        kcolor.Alpha = math.max(kcolor.Alpha - .01, .3)
        leftPressed = false
    end
    alpha = kcolor.Alpha
    if Input.IsMouseBtnPressed(Mouse.MOUSE_BUTTON_RIGHT) then
        if self:InBounds(mpos) and not rightPressed then
            dragging = true
        end
        rightPressed = true
    else
        rightPressed = false
        dragging = false
    end
    
    if dragging then
        renderPos = mpos
    end
    self:FixRenderPos()
    
    if not Game():GetHUD():IsVisible() then return end
    font:DrawString(renderStr, renderPos.X - strWidth/2, renderPos.Y - baseHeight/2, kcolor, math.floor(.5+strWidth), true)
end)