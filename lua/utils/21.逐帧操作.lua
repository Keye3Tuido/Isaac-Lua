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
l local c,d,f,e,n,a=GetPtrHash,Game,Isaac,'adwsjlike q;',ModCallbacks.MC_INPUT_ACTION,{}for i=1,#e do a[e:byte(i)]=i-1 end function FrameOp(i,k,j,l,m)if i and k and not d():IsPaused()then j=j or 1+d():GetFrameCount()i,l=c(i),{}for i=1,#k do l[a[k:byte(i)]]=true end m=function(t,e,h,a)if h==InputHook.GET_ACTION_VALUE then t,h=1,0 else t,h=true,false end k=j-d():GetFrameCount()if k<0 then f.RemoveCallback(l,n,m)elseif k==0 and e and i==c(e)then return l[a]and t or h end end f.AddCallback(l,n,m)end end

--[=[ 源代码

local Keys='adwsjlike q;'
local KeyMap={}
for i=1,#Keys do
    KeyMap[Keys:byte(i)]=i-1
end
function FrameOp(player, ops, frame, tab, cb)
    if player and ops and not Game():IsPaused()then
        frame = frame or 1+Game():GetFrameCount()
        player,tab=GetPtrHash(player),{}
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
