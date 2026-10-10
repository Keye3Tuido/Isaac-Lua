--小夜灯光锥方向模拟：模拟道具"小夜灯"锥形光柱的中线朝向（API 无法直接读取，只能按规则模拟）。
--进房时对准当前移动方向；移动方向键合成目标朝向（双键取 45° 斜向，无键退回 GetAimDirection），
--按住即转向、全停即止；每帧转 min(45, 剩余×0.325)（前段匀速、末段指数收尾）；正对时转向侧与上次相反。

--[[
作为模板: true
模板id: simulate-night-light
名称: 夜灯光锥方向模拟
说明: |-
  提供全局接口GetNightLightDirection(player)
  返回 Vector：模拟小夜灯光柱中线的单位方向向量。
]]
l local b,c,g,h,j,k,l,m,q,n=ButtonAction,math,Isaac,ModCallbacks,'ACTION_RIGHT','ACTION_LEFT','ACTION_DOWN','ACTION_UP',function(a)return(a%360+360)%360 end,'AddCallback'local function r(d)d=q(d)if d>180 then d=d-360 end return d end local function o(p,a)return Input.IsActionPressed(a,p.ControllerIndex)end local function t(p)local x,y=(o(p,b[j])and 1 or 0)-(o(p,b[k])and 1 or 0),(o(p,b[l])and 1 or 0)-(o(p,b[m])and 1 or 0)if x~=0 or y~=0 then return q(c.deg(c.atan(y,x)))end x=p.GetAimDirection y=x and x(p)if y and(y.X~=0 or y.Y~=0)then return q(c.deg(c.atan(y.Y,y.X)))end return nil end local function s(p)local d=p:GetData()if not d.NL then d.NL={a=0,s=1,t=nil}end return d.NL end function GetNightLightDirection(p)return Vector(1,0):Rotated(s(p).a)end g[n]({},h.MC_POST_NEW_ROOM,function()for i=0,Game():GetNumPlayers()-1 do local p=g.GetPlayer(i)local d,a=s(p),t(p)if a then d.a=a end d.t=nil end end)g[n]({},h.MC_POST_PLAYER_UPDATE,function(_,p)local d,f,a=s(p),o(p,b[k])or o(p,b[j])or o(p,b[m])or o(p,b[l]),t(p)if a and f then if d.t==nil or.01<=c.abs(r(d.t-a))then local x=r(a-d.a)if x>=180 then d.s=-d.s d.a=q(d.a+d.s*.01)end if x~=0 then d.t=a end end end if d.t and f then local x,e=r(d.t-d.a)e=x*.325 if e>45 then e=45 elseif e<-45 then e=-45 end d.a=q(d.a+e)if x>.5 then d.s=1 elseif x<-.5 then d.s=-1 end if.5>c.abs(r(d.t-d.a))then d.a=d.t d.t=nil end end end)

--以下为可读多行源代码，已注释化，仅保留作参考。
--[[ 可读源代码（非 YAML 头）
local function norm360(a)
    return (a % 360 + 360) % 360
end

-- 归一化到 (-180, 180]：正值表示目标在顺时针一侧
local function normDelta(d)
    d = norm360(d)
    if d > 180 then d = d - 360 end
    return d
end

local function isPressed(p, action)
    return Input.IsActionPressed(action, p.ControllerIndex)
end

-- 目标方向角度：移动方向键合成（单键四向，相邻双键 45° 斜向，相反键抵消）；
-- 无按键时退回 GetAimDirection() 的向量角；都取不到返回 nil
local function getTargetAngle(p)
    local x = (isPressed(p, ButtonAction.ACTION_RIGHT) and 1 or 0)
            - (isPressed(p, ButtonAction.ACTION_LEFT) and 1 or 0)
    local y = (isPressed(p, ButtonAction.ACTION_DOWN) and 1 or 0)
            - (isPressed(p, ButtonAction.ACTION_UP) and 1 or 0)
    if x ~= 0 or y ~= 0 then
        return norm360(math.deg(math.atan(y, x)))
    end
    local f = p.GetAimDirection
    local v = f and f(p)
    if v and (v.X ~= 0 or v.Y ~= 0) then
        return norm360(math.deg(math.atan(v.Y, v.X)))
    end
    return nil
end

-- 状态挂在角色实体上：a=当前角度, s=上一次转向侧(+1/-1), t=转向目标角度(nil=未在转向)
local function getState(p)
    local d = p:GetData()
    if not d.NL then
        d.NL = { a = 0, s = 1, t = nil }
    end
    return d.NL
end

function GetNightLightDirection(p)
    return Vector(1, 0):Rotated(getState(p).a)
end

-- 规则 1：进入新房间，中线直接对准当前目标方向
Isaac.AddCallback({}, ModCallbacks.MC_POST_NEW_ROOM, function()
    for i = 0, Game():GetNumPlayers() - 1 do
        local p = Isaac.GetPlayer(i)
        local st = getState(p)
        local a = getTargetAngle(p)
        if a then
            st.a = a
        end
        st.t = nil -- 新房间内不继承上一房间的转向
    end
end)

-- 规则 2、3：任意移动键按住时开始/继续转向；全部松开则转向停止
-- 转向模型：限速逼近，每帧转角 = min(45, 剩余角度 × 0.325)，前段匀速、末段指数收尾
Isaac.AddCallback({}, ModCallbacks.MC_POST_PLAYER_UPDATE, function(_, p)
    local st = getState(p)
    local moving = isPressed(p, ButtonAction.ACTION_LEFT)
              or isPressed(p, ButtonAction.ACTION_RIGHT)
              or isPressed(p, ButtonAction.ACTION_UP)
              or isPressed(p, ButtonAction.ACTION_DOWN)
    local a = getTargetAngle(p)

    if a and moving then
        -- 目标方向变化（或未在转向）时重定目标
        if st.t == nil or math.abs(normDelta(st.t - a)) >= 0.01 then
            local x = normDelta(a - st.a)
            if x >= 180 then
                -- 规则 3：正对时取与上一次相反的转向侧，微推 0.01° 破平角
                st.s = -st.s
                st.a = norm360(st.a + st.s * 0.01)
            end
            if x ~= 0 then
                st.t = a
            end
        end
    end

    if st.t and moving then
        local x = normDelta(st.t - st.a)
        local e = x * 0.325
        if e > 45 then e = 45 elseif e < -45 then e = -45 end
        st.a = norm360(st.a + e)
        if x > 0.5 then st.s = 1 elseif x < -0.5 then st.s = -1 end
        if math.abs(normDelta(st.t - st.a)) < 0.5 then
            st.a = st.t
            st.t = nil
        end
    end
end)
]]
