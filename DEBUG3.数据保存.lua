PersistentData=RegisterMod('PersistentData', 1)
PersistentData.tmp = {}    -- 临时数据
PersistentData._backup = {}    -- 备份数据
PersistentData.data = {}    -- 游戏数据
PersistentData.rewFlag = false    -- 发光沙漏标记
PersistentData.resetRewFlag = false    -- 重置rewFlag
PersistentData.inGame = false    -- 是否在游戏中
PersistentData.ExitFrame = nil    -- 退出游戏的帧数
PersistentData._rewindTable = {}    -- 可被恢复的数据表
function PersistentData.Hash(entity)
    return entity.InitSeed
end
local function DeepCopy(source)
    if type(source) == "table" then
        local copy = {}
        for k, v in pairs(source) do
            copy[k] = DeepCopy(v)
        end
        return copy
    end
    return source
end

PersistentData:AddPriorityCallback(ModCallbacks.MC_POST_NEW_ROOM, CallbackPriority.IMPORTANT, function(self)
    if self.inGame then
        if self.rewFlag then
            if self.resetRewFlag then
                self.rewFlag = false
            end
            self.resetRewFlag = not self.resetRewFlag
        end
        if not self.rewFlag then
            self._rewindTable = DeepCopy(self._backup)
            self._backup = DeepCopy(self.tmp)
        end
    end
end)    -- 进入新房间时备份数据

function PersistentData:Rewind()    -- 恢复数据
    self.tmp = DeepCopy(self._backup)
    self.rewFlag = true
    self.resetRewFlag = false
end
PersistentData:AddPriorityCallback(ModCallbacks.MC_USE_ITEM, CallbackPriority.IMPORTANT, PersistentData.Rewind, CollectibleType.COLLECTIBLE_GLOWING_HOUR_GLASS) -- 使用发光沙漏时恢复数据
PersistentData:AddPriorityCallback(ModCallbacks.MC_POST_GAME_STARTED, CallbackPriority.IMPORTANT, function(self, isContinued)
    self.inGame = true
    self.rewFlag = false
    self.resetRewFlag = false
    if isContinued then
        if self.ExitFrame == Isaac.GetFrameCount() then -- rewind触发
            self._backup = DeepCopy(self._rewindTable)
            self:Rewind()
            Isaac.RunCallback(ModCallbacks.MC_POST_NEW_ROOM)
        else
            self._backup = DeepCopy(self.tmp)
        end
    else
        self.tmp = {}
        self._backup = {}
        self.data = {}
    end
end)    -- 继续游戏时恢复数据
PersistentData:AddPriorityCallback(ModCallbacks.MC_PRE_GAME_EXIT, CallbackPriority.IMPORTANT, function(self, shouldSave)
    self.ExitFrame = shouldSave and Isaac.GetFrameCount()
    if not shouldSave then
        self.data = {}
        self._backup = {}
        self.tmp = {}
    end
    self.rewFlag = false
    self.resetRewFlag = false
    self.inGame = false
end)    -- 游戏结束时清除数据，暂时退出游戏时备份数据
PersistentData:AddPriorityCallback(ModCallbacks.MC_POST_ENTITY_REMOVE, CallbackPriority.IMPORTANT, function(self, entity)
    self.tmp[self.Hash(entity)] = nil
end)    -- 实体被移除时清除数据

function PersistentData:_rew()    -- 当前是否处于rew状态（不要更新数据）
    return self.rewFlag or not self.inGame
end

function PersistentData:GetData(entity)    -- 获取可被恢复的数据/可被恢复的实体的数据（兼容发光沙漏、rewind，实体移除时清除）获取数据时，先读取self.rewFlag or not self.inGame，若为true，则不更新数据
    if entity then
        local key = self.Hash(entity)
        self.tmp[key] = self.tmp[key] or {}
        return self.tmp[key]
    end
    return self.tmp
end

function PersistentData:GameData()  -- 获取游戏数据（结束游戏时清空）
    return self.data
end

------------------------------------------------------------------------------------------------------------------------
--1. 用于储存数据，无实际效果。
-- _Data()返回的表兼容发光沙漏和rewind（可回溯）,_Data(entity)=entity:GetData()（可回溯）,_rew()返回当前是否处于rew状态（不要更新表中的数据）,_Pata()返回的数据仅在游戏结束时重置（不回溯）。
l local B,I,M,H,T,F,A,C,D,R,S='MC_POST_NEW_ROOM',Isaac,ModCallbacks,function(e)return e.InitSeed end,true,false A,C,R,S,D=function(S,...)I.AddPriorityCallback(D.M,S,CallbackPriority.IMPORTANT,...)end,function(s)if type(s)=='table'then local c={}for k,v in pairs(s)do c[k]=C(v)end return c end return s end,function()D.R,D.C,D.T=T,F,C(D.B)end,I.GetFrameCount,{B={},D={},T={},R=F,C=F,G=F,M={},W={}}A(M.MC_USE_ITEM,R,CollectibleType.COLLECTIBLE_GLOWING_HOUR_GLASS)A(M[B],function()if D.G then if D.R then if D.C then D.R=F end D.C=not D.C end if not D.R then D.W=C(D.B)D.B=C(D.T)end end end)A(M.MC_POST_GAME_STARTED,function(_,c)D.R,D.C,D.G=F,F,T if c then if D.E==S()then D.B=C(D.W)R()I.RunCallback(M[B])else D.B=C(D.T)end else D.T,D.B,D.D={},{},{}end end)A(M.MC_PRE_GAME_EXIT,function(_,d)D.E=d and S()if not d then D.D,D.B,D.T={},{},{}end D.R,D.C,D.G=F,F,F end)A(M.MC_POST_ENTITY_REMOVE,function(_,e)D.T[H(e)]=nil end)function _Data(e)if e then local k=H(e)D.T[k]=D.T[k]or{}return D.T[k]end return D.T end function _rew()return D.R or not D.G end function _Pata()return D.D end