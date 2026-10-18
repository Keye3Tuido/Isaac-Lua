--麒麟臂
--使用"掉落键"进行射击
--你可以只用单手进行游戏

--[[
说明: 按掉落键时，角色会向前方攻击
]]
l Isaac.AddCallback({},13,function(b,e,h,a,c)e=e and e:ToPlayer()if e then c=e.ControllerIndex b=h>1 and Input.GetActionValue or h<1 and Input.IsActionPressed or Input.IsActionTriggered if a==11 then for m=0,3 do e=b(m,c)if h>1 and e>0 or h<2 and e then return h>1 and 0 end end else c=b(11,c)if a==({4,6,5,7})[e:GetHeadDirection()+1]and(h>1 and c>0 or h<2 and c)then return c end end end end)

--[[
模板: restart-game
]]