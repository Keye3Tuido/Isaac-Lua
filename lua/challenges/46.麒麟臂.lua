--麒麟臂
--使用"掉落键"进行射击
--建议使用单人角色游玩（不要使用 雅各&以扫、遗骸 等角色）
--要求: 
--1. 禁止鼠标操作 (代码未关闭鼠标控制开关)
--2. 只使用左手进行游戏

--[[
说明：攻击键无法攻击
]]
l Isaac.AddCallback({},ModCallbacks.MC_INPUT_ACTION,function(i,p,h,a)i=Input p=p and p:ToPlayer()p=p and 3<a and a<8 and(h>1 and i.GetActionValue or h<1 and i.IsActionPressed or i.IsActionTriggered)(a,p.ControllerIndex)if p and(h<2 or p>0)then return h>1 and 0 end end)

--[[
说明: 按掉落键时，角色会向前方攻击
]]
l local a,g=Input,{}Isaac.AddCallback(g,13,function(h,b,d,c,e,f)b=b and b:ToPlayer()if b then f=function(x)return x and(d<2 or x>0)end h=b.ControllerIndex e=d>1 and a.GetActionValue or d<1 and a.IsActionPressed or a.IsActionTriggered if c==11 then for m=0,3 do if f(e(m,h))then return d>1 and 0 end end else b=b:GetData()h,e=f(e(c,h)),e(11,h)d=f(e)if c<4 and h and not d then b[g]=c+4 elseif c==(b[g]or 7)and d then return e end end end end)

--[[ 源代码
local Key={}
Isaac.AddCallback(Key,13,function(id, entity, hook, action, func, util)
    entity=entity and entity:ToPlayer()
    if entity then
        util=function(x)
            return x and (hook<2 or x>0)
        end
        id=entity.ControllerIndex
        func=hook>1 and Input.GetActionValue or hook<1 and Input.IsActionPressed or Input.IsActionTriggered
        if action==11 then
            for m=0,3 do
                if util(func(m,id)) then
                    return hook>1 and 0
                end
            end
        else
            entity=entity:GetData()
            id,func=util(func(action,id)),func(11,id)
            hook=util(func)
            if action<4 and id and not hook then
                entity[Key]=action+4
            elseif action==(entity[Key]or 7)and hook then
                return func
            end
        end
    end
end)
]]

--[[
模板: restart-game
]]