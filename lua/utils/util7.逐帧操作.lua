--[[
作为模板: true
模板id: frame-operation
名称: 帧操作
说明: |-
  提供全局接口：FrameOp(EntityPlayer:player, string:operation)
  在下一帧，为player执行按键操作operation
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
l local b,k,d,l,a=Game,GetPtrHash,'adwsjlike q;',ModCallbacks.MC_INPUT_ACTION,{}for i=1,#d do a[d:byte(i)]=i-1 end function FrameOp(d,f,g,j,i)if d and f and not b():IsPaused()then g,d,j=b():GetFrameCount()+1,k(d),{}for i=1,#f do j[a[f:byte(i)]]=true end i=function(t,e,h,a)if h==InputHook.GET_ACTION_VALUE then t,h=1,0 else t,h=true,false end f=g-b():GetFrameCount()if f<0 then Isaac.RemoveCallback(j,l,i)elseif f==0 and e and d==k(e)then return j[a]and t or h end end Isaac.AddCallback(j,l,i)end end


--[=[ 源代码

local Keys='adwsjlike q;'
local KeyMap={}
for i=1,#Keys do
    KeyMap[Keys:byte(i)]=i-1
end
function FrameOp(player, ops, frame, tab, cb)
    if player and ops and not Game():IsPaused()then
        frame,player,tab=Game():GetFrameCount()+1,GetPtrHash(player),{}
        for i=1,#ops do
            tab[KeyMap[ops:byte(i)]]=true
        end
        cb = function(t,e,h,a)
            if h==InputHook.GET_ACTION_VALUE then
                t,h=1,0
            else
                t,h=true,false
            end
            ops=frame-Game():GetFrameCount()
            if ops<0 then
                Isaac.RemoveCallback(tab,ModCallbacks.MC_INPUT_ACTION,cb)
            elseif ops==0 and e and GetPtrHash(e)==player then
                return tab[a]and t or h
            end
        end
        Isaac.AddCallback(tab,ModCallbacks.MC_INPUT_ACTION,cb)
    end
end

]=]