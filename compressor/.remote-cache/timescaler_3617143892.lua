local TimeMagic = RegisterMod("Time Magic", 1)
TimeMagic.Version = "1.1.0"

TimeMagic.GetRenderPos = function()
    return Vector(Isaac.GetScreenWidth()/2, 20)
end
TimeMagic.RenderSize = 0.5

TimeMagic.RenderTimeScale = 1.0
TimeMagic.GameTimeScale = 1.0
TimeMagic.LastRenderTime = Isaac.GetTime()
TimeMagic.LastGameTime = Isaac.GetTime()
TimeMagic.LastRenderFrame = Isaac.GetFrameCount()
TimeMagic.LastGameFrame = Game():GetFrameCount()
TimeMagic.RenderTimesPerSecond = 60
TimeMagic.GameTimesPerSecond = 30
TimeMagic.Counter = 0
TimeMagic.RenderPeriod = 1
TimeMagic.GamePeriod = 2        -- should be even number
TimeMagic.Period = math.max(TimeMagic.RenderPeriod, TimeMagic.GamePeriod)
TimeMagic.Period = TimeMagic.Period & 1 > 0 and TimeMagic.Period + 1 or TimeMagic.Period
TimeMagic:AddCallback(ModCallbacks.MC_POST_RENDER, function(self)
    self.Counter = self.Counter + 1
    
    if self.Counter % self.RenderPeriod == 0 then
        local currentRenderTime = Isaac.GetTime()
        local deltaRenderTime = currentRenderTime - self.LastRenderTime
        self.LastRenderTime = currentRenderTime

        local currentRenderFrame = Isaac.GetFrameCount()
        local deltaRenderFrames = currentRenderFrame - self.LastRenderFrame
        self.LastRenderFrame = currentRenderFrame
        self.RenderTimeScale = 1e3 * deltaRenderFrames / deltaRenderTime / self.RenderTimesPerSecond
    end
    
    if self.Counter % self.GamePeriod == 0 then
        local currentGameTime = Isaac.GetTime()
        local deltaGameTime = currentGameTime - self.LastGameTime
        self.LastGameTime = currentGameTime

        local currentGameFrame = Game():GetFrameCount()
        local deltaGameFrames = currentGameFrame - self.LastGameFrame
        self.LastGameFrame = currentGameFrame
        self.GameTimeScale = 1e3 * deltaGameFrames / deltaGameTime / self.GameTimesPerSecond
    end
    
    if self.Counter >= self.Period then
        self.Counter = 0
    end
end)

TimeMagic.TargetTimeScale = 1.0
function TimeMagic:SetTimeScale(scale)
    scale = scale and tonumber(scale) or 1.0
    scale = math.max(0, scale)
    self.TargetTimeScale = scale
end

TimeMagic.SpeedUpLock = false
TimeMagic.SpeedUpUpdateTimes = 1
function TimeMagic:SpeedUp()
    if self.SpeedUpLock then return end
    if Game():IsPaused() then return end
    if self.TargetTimeScale > 1.0 then
        if self.TargetTimeScale > self.GameTimeScale then
            self.SpeedUpUpdateTimes = self.SpeedUpUpdateTimes * 1.2
        elseif self.TargetTimeScale < self.GameTimeScale then
            self.SpeedUpUpdateTimes = math.max(.5, self.SpeedUpUpdateTimes/2)
        end
        self.SpeedUpLock = true
        for i = 1, math.floor(self.SpeedUpUpdateTimes) do
            Game():Update()
        end
        self.SpeedUpLock = false
    end
end

TimeMagic.SpeedDownUpdateTimes = 1
TimeMagic.SpeedDownLock = false
function TimeMagic:SpeedDown()
    if self.SpeedDownLock then return end
    if Game():IsPaused() then return end
    if self.TargetTimeScale < 1.0 then
        if self.TargetTimeScale < self.RenderTimeScale then
            self.SpeedDownUpdateTimes = self.SpeedDownUpdateTimes * 1.2
        elseif self.TargetTimeScale > self.RenderTimeScale then
            self.SpeedDownUpdateTimes = math.max(.5, self.SpeedDownUpdateTimes/2)
        end
        self.SpeedDownLock = true
        for i = 1, math.floor(self.SpeedDownUpdateTimes) do
            Isaac.GetRoomEntities()
        end
        self.SpeedDownLock = false
    end
end

TimeMagic:AddCallback(ModCallbacks.MC_POST_UPDATE, function(self)
    self:SpeedUp()
end)

TimeMagic:AddCallback(ModCallbacks.MC_POST_RENDER, function(self)
    self:SpeedDown()
end)
-----------------------------------------------------------------------------
local KeysTriggered = {
    Minus_Triggered = false,
    Plus_Triggered = false,
    Backspace_Triggered = false
}
local function IsKeyTriggered(key)
    for i=1, Game():GetNumPlayers()do
        local player = Game():GetPlayer(i-1)
        if Input.IsButtonTriggered(key, player.ControllerIndex) then
            return true
        end
    end
    return false
end
TimeMagic:AddCallback(ModCallbacks.MC_POST_RENDER, function(self)
    local Kp = KeysTriggered
    for k,v in pairs{Minus_Triggered = Keyboard.KEY_MINUS, Plus_Triggered = Keyboard.KEY_EQUAL, Backspace_Triggered = Keyboard.KEY_BACKSPACE}do
        Kp[k] = IsKeyTriggered(v)
    end
    if Kp.Backspace_Triggered then
        self.TargetTimeScale = 1.0
    elseif not (Kp.Minus_Triggered and Kp.Plus_Triggered) then
        if Kp.Minus_Triggered then
            self.TargetTimeScale = math.max(0.05, self.TargetTimeScale - 0.05)
        elseif Kp.Plus_Triggered then
            self.TargetTimeScale = self.TargetTimeScale + 0.1
        end
    end
    if self.TargetTimeScale ~= 1.0 then
        local SetText
        local SetColor
        if Game():IsPaused() then
            SetText = 'Paused'
            SetColor = {r=1, g=0, b=0, a=1}
        else
            SetText = string.format('Time Scale: %.2fx', self.TargetTimeScale)
            if self.TargetTimeScale < 1.0 then
                SetColor = {r=1, g=1, b=0, a=1}
            else
                SetColor = {r=0, g=1, b=1, a=1}
            end
        end
        local SetTextWidth = Isaac.GetTextWidth(SetText)
        local pos = self.GetRenderPos()
        local size = self.RenderSize
        Isaac.RenderScaledText(SetText, pos.X - (SetTextWidth * size) / 2, pos.Y, size, size, SetColor.r, SetColor.g, SetColor.b, SetColor.a)
    end
end)

-----------------------------------------------------------------------------

TimeScaler = {}
setmetatable(TimeScaler, {
    __index = {
        SetTimeScale = function(self, scale)
            TimeMagic:SetTimeScale(scale)
        end,
        GetRenderTimeScale = function(self)
            return TimeMagic.RenderTimeScale
        end,
        GetGameTimeScale = function(self)
            return TimeMagic.GameTimeScale
        end
    },
    __newindex = function()end,
    __tostring = function()return 'TimeScaler v'..TimeMagic.Version..' - Keye3Tuido\n' end,
    __metatable = false
})

Isaac.ConsoleOutput(tostring(TimeScaler))