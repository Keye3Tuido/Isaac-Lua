--麒麟臂
--使用"掉落键"进行射击!
--你可以只用单手进行游戏

--[[
说明: 按住掉落键时，角色会向着移动的方向攻击
]]
l local a,h,b,n,d,e=Input,{},GetPtrHash,Isaac.AddCallback,'ControllerIndex'e=a.IsActionPressed n(h,13,function(i,f,j,k,l,g)f=f and f:ToPlayer()if f then i=f:GetData()i[h]=i[h]or{}l=f[d]if j>1 then g=a.GetActionValue else g=j<1 and e or a.IsActionTriggered end if k==11 then for m=0,3 do if g(m,l)then return j==2 and 0 end end elseif(i[h][b(f)]or 3)+4==k and g(11,l)then return j~=2 or 1 end end end)n(h,32,function(g,f,i)i=f[d]if not e(11,i)then g=f:GetData()g[h]=g[h]or{}for m=0,3 do if e(m,i)then g[h][b(f)]=m return end end end end,0)

--[[
模板: restart-game
]]