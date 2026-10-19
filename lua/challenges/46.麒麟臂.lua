--麒麟臂
--使用"掉落键"进行射击
--你可以只用单手进行游戏

--[[
说明: 按掉落键时，角色会向前方攻击
]]
l local a,g=Input,{}Isaac.AddCallback(g,13,function(h,b,d,c,e,f)b=b and b:ToPlayer()if b then f=function(x)return d>1 and x>0 or d<2 and x end h=b.ControllerIndex e=d>1 and a.GetActionValue or d<1 and a.IsActionPressed or a.IsActionTriggered if c==11 then for m=0,3 do if f(e(m,h))then return d>1 and 0 end end else b=b:GetData()h,e=f(e(c,h)),e(11,h)d=f(e)if c<4 and h and not d then b[g]=c+4 elseif c==(b[g]or 7)and d then return e end end end end)

--[[ 源代码
local Key={}
Isaac.AddCallback(Key,13,function(id, entity, hook, action, func, util)
    entity=entity and entity:ToPlayer()
    if entity then
        util=function(x)
            return hook>1 and x>0 or hook<2 and x
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