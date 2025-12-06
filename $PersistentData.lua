PersistentData=RegisterMod('PersistentData', 1)
PersistentData.tmp = {}    -- 临时数据
PersistentData._backup = {}    -- 备份数据
PersistentData.data = {}    -- 游戏数据
PersistentData.rewFlag = false    -- 发光沙漏标记
PersistentData.resetRewFlag = false    -- 重置rewFlag
PersistentData.inGame = false    -- 是否在游戏中
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
    if not self.inGame then
        self.inGame = true
        return
    end
    if self.rewFlag then
        if self.resetRewFlag then
            self.rewFlag = false
        end
        self.resetRewFlag = not self.resetRewFlag
    end
    if not self.rewFlag then
        self._backup = DeepCopy(self.tmp)
    end
end)    -- 进入新房间时备份数据
PersistentData:AddPriorityCallback(ModCallbacks.MC_USE_ITEM, CallbackPriority.IMPORTANT, function(self)
    self.tmp = DeepCopy(self._backup)
    self.rewFlag = true
    self.resetRewFlag = false
end, CollectibleType.COLLECTIBLE_GLOWING_HOUR_GLASS) -- 使用发光沙漏时恢复数据
PersistentData:AddPriorityCallback(ModCallbacks.MC_POST_GAME_STARTED, CallbackPriority.IMPORTANT, function(self, isContinued)
    self.rewFlag = false
    self.resetRewFlag = false
    if isContinued then
        self.tmp = DeepCopy(self._backup)
    else
        self.tmp = {}
        self._backup = {}
        self.data = {}
    end
    Isaac.RunCallback(ModCallbacks.MC_POST_NEW_ROOM)
end)    -- 继续游戏时恢复数据
PersistentData:AddPriorityCallback(ModCallbacks.MC_PRE_GAME_EXIT, CallbackPriority.IMPORTANT, function(self, shouldSave)
    if shouldSave then
        self._backup = DeepCopy(self.tmp)
    else
        self.data = {}
        self._backup = {}
    end
    self.tmp = {}
    self.rewFlag = false
    self.resetRewFlag = false
    self.inGame = false
end)    -- 游戏结束时清除数据，暂时退出游戏时备份数据
PersistentData:AddPriorityCallback(ModCallbacks.MC_POST_ENTITY_REMOVE, CallbackPriority.IMPORTANT, function(self, entity)
    self.tmp[self.Hash(entity)] = nil
end)    -- 实体被移除时清除数据

function PersistentData:GetData(entity)    -- 获取可被恢复的数据/可被恢复的实体的数据（兼容发光沙漏，实体移除时清除）获取数据时，先读取self.rewFlag，若self.rewFlag为true，则不更新数据
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
-- 1. 用于储存数据，无实际效果（兼容发光沙漏，不兼容rewind）
-- _Data()返回的数据兼容发光沙漏,_Data(entity)=entity:GetData(),_rew()返回当前是否处于rew状态（不更新数据）,_Pata()返回的数据仅在游戏结束时重置;rewind会触发游戏结束和游戏开始。
l local I,M,N,H,T,F,D,A=Isaac,ModCallbacks,'MC_POST_NEW_ROOM',function(e)return e.InitSeed end,true,false D,A={B={},D={},T={},R=F,C=F,G=F,M={}},function(S,...)I.AddPriorityCallback(D.M,S,CallbackPriority.IMPORTANT,...)end local function C(s)if type(s)=='table'then local c={}for k,v in pairs(s)do c[k]=C(v)end return c end return s end A(M.MC_USE_ITEM,function()D.T=C(D.B)D.R,D.C=T,F end,CollectibleType.COLLECTIBLE_GLOWING_HOUR_GLASS)A(M[N],function()if not D.G then D.G=T return end if D.R then if D.C then D.R=F end D.C=not D.C end if not D.R then D.B=C(D.T)end end)A(M.MC_POST_GAME_STARTED,function(_,c)D.R,D.C=F,F if c then D.T=C(D.B)else D.T,D.B,D.D={},{},{}end I.RunCallback(M[N])end)A(M.MC_PRE_GAME_EXIT,function(_,d)if d then D.B=C(D.T)else D.D,D.B={},{}end D.R,D.C,D.G,D.T=F,F,F,{}end)A(M.MC_POST_ENTITY_REMOVE,function(_,e)D.T[H(e)]=nil end)function _Data(e)if e then local k=H(e)D.T[k]=D.T[k]or{}return D.T[k]end return D.T end function _rew()return D.R end function _Pata()return D.D end

