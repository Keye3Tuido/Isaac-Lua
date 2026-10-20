--鼠标位置显示。

--[[
作为模板: true
模板id: mouse-pos-show
说明: |-
  若未开启鼠标控制功能则显示鼠标位置。
]]
l Isaac.AddCallback({},2,function(p)if not Options.MouseControl then p=Isaac.WorldToScreen(Input.GetMousePosition(true))Isaac.RenderText('o',p.X-2.2,p.Y-6.4,0,1,1,1)end end)
