--小夜灯光锥方向模拟：模拟道具"小夜灯"锥形光柱的中线朝向（API 无法直接读取，只能按规则模拟）。
--规则：
--1. 进入新房间时不重置方向：光柱角度与转向侧跨房间保留，全由按键决定（因此刚进入房间时方向可能错误）。
--2. 目标朝向由按下的移动方向键合成：单键取四向角度（右 0、下 90、左 180、上 270，顺时针为正），
--   相邻双键取 45° 斜向（如左上 = 225°）；相反方向键抵消视为无按键，此时退回 GetAimDirection() 的向量角。
--   任意移动键按住时中线开始/继续转向；全部松开则转向停止（再按下时从当前角度继续）。
--   转向速度为"限速逼近"：每帧转角 = min(45, 剩余角度 × 0.325)。前段以 45 度/帧匀速转，剩余约 138 度后按指数比例收尾。
--3. 开始转向时若初始夹角 >= 180°（正对），转向的一侧与上一次转向的一侧相反（初始为 +1）；
--   通过把当前角度向对方侧微推 0.01° 破平角，之后逼近自然沿该侧进行。
--接口：GetNightLightDirection(player) → Vector，模拟光柱中线的单位方向向量。
--用法：控制台直接粘贴下方这一条 l 行，无需其他依赖。

--[[
作为模板: true
模板id: simulate-night-light
名称: 夜灯光锥方向模拟
说明: |-
  提供全局接口GetNightLightDirection(player)
  返回 Vector：模拟小夜灯光柱中线的单位方向向量（API 无法直接读取，按规则模拟）。
  (进入新房间时方向可能出错)
]]
l local b,c,g,h,i,j,l=ButtonAction,math,'ACTION_RIGHT','ACTION_LEFT','ACTION_DOWN','ACTION_UP',function(a)return(a%360+360)%360 end local function m(d)d=l(d)if d>180 then d=d-360 end return d end local function k(p,a)return Input.IsActionPressed(a,p.ControllerIndex)end local function o(p)local x,y=(k(p,b[g])and 1 or 0)-(k(p,b[h])and 1 or 0),(k(p,b[i])and 1 or 0)-(k(p,b[j])and 1 or 0)if x~=0 or y~=0 then return l(c.deg(c.atan(y,x)))end x=p.GetAimDirection y=x and x(p)if y and(y.X~=0 or y.Y~=0)then return l(c.deg(c.atan(y.Y,y.X)))end return nil end local function n(p)local d=p:GetData()if not d.NL then d.NL={a=0,s=1,t=nil}end return d.NL end function GetNightLightDirection(p)return Vector(1,0):Rotated(n(p).a)end Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(_,p)local d,f,a=n(p),k(p,b[h])or k(p,b[g])or k(p,b[j])or k(p,b[i]),o(p)if a and f then if d.t==nil or.01<=c.abs(m(d.t-a))then local x=m(a-d.a)if x>=180 then d.s=-d.s d.a=l(d.a+d.s*.01)end if x~=0 then d.t=a end end end if d.t and f then local x,e=m(d.t-d.a)e=x*.325 if e>45 then e=45 elseif e<-45 then e=-45 end d.a=l(d.a+e)if x>.5 then d.s=1 elseif x<-.5 then d.s=-1 end if.5>c.abs(m(d.t-d.a))then d.a=d.t d.t=nil end end end,0)

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
-- 进入新房间时不重置方向：角度与转向侧跨房间保留，全由按键决定
--（因此刚进入房间时方向可能错误，直到按下移动键转向为止）
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

-- 规则：任意移动键按住时开始/继续转向；全部松开则转向停止
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
                -- 初始夹角 180° 及以上（正对）时，转向的一侧与上一次转向的一侧相反；
                -- 微推 0.01° 破平角，之后逼近自然沿该侧进行
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
end,0)
]]
