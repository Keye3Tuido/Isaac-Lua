--逐帧操作：按帧序列操作实体。

--[[
作为模板: true
模板id: frame-operation
名称: 帧操作
说明: |-
  提供全局接口：FrameOp(EntityPlayer:player, string:operation, interger:frame ? nextFrame)
  在指定帧frame(缺省则默认取下一帧,取值需大于当前帧)，为player执行按键操作operation
  operation为字符串，可选字符有：
  - ‘a’ : 左移动
  - ‘d’ : 右移动
  - ‘w’ : 上移动
  - ‘s’ : 下移动
  - ‘j’ : 左射击
  - ‘l’ : 右射击
  - ‘i’ : 上射击
  - ‘k’ : 下射击
  - ‘e’ : 炸弹
  - ‘ ’ : 主动道具
  - ‘q’ : 卡牌
  - ‘;’ : 掉落
]]
l local c,d,e,n,a,b=GetPtrHash,Isaac,'adwsjlike q;',ModCallbacks.MC_INPUT_ACTION,{}b=d.GetFrameCount for i=1,#e do a[e:byte(i)]=i-1 end function FrameOp(i,e,j,k,l,h)if i and e and not Game():IsPaused()then j=j or 1+b()i,k=c(i),{}for i=1,#e do h=a[e:byte(i)]if h then k[h]=true end end if next(k)then l=function(m,e,h,a)m=j-b()if m<0 then d.RemoveCallback(k,n,l)elseif m==0 and e and i==c(e)and k[a]then return h~=InputHook.GET_ACTION_VALUE or 1 end end d.AddCallback(k,n,l)end end end

--[=[ 源代码

local Keys='adwsjlike q;'
local KeyMap={}
for i=1,#Keys do
    KeyMap[Keys:byte(i)]=i-1
end
function FrameOp(player, ops, frame, tab, cb, key)
    if player and ops and not Game():IsPaused()then
        frame = frame or 1+Isaac.GetFrameCount()
        player,tab=GetPtrHash(player),{}
        for i=1,#ops do
            key=KeyMap[ops:byte(i)]
            if key then
                tab[key]=true
            end
        end
        if next(tab)then
            cb = function(m,e,h,a)
                m=frame-Isaac.GetFrameCount()
                if m<0 then
                    Isaac.RemoveCallback(tab,ModCallbacks.MC_INPUT_ACTION,cb)
                elseif m==0 and e and GetPtrHash(e)==player and tab[a]then
                    return h~=InputHook.GET_ACTION_VALUE or 1
                end
            end
            Isaac.AddCallback(tab,ModCallbacks.MC_INPUT_ACTION,cb)
        end
    end
end

]=]
