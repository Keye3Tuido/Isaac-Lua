--鼠标生成网格。

--[[
作为模板: true
模板id: grid-spawn-at-mouse
说明: |-
  强制在鼠标位置生成指定类型、变种、状态的障碍物。
  需要在控制台指定 TYPE,VARIANT,STATE的值，如在控制台输入 lua TYPE,VARIANT,STATE=18,2,1 后，再输入下面的指令，会在鼠标位置生成一个打开的会员商店门。
]]
l local c,d,a,r,b=Isaac,Vector,Input.GetMousePosition(true),Game():GetRoom()b=c.WorldToScreen(a)a=r:IsMirrorWorld()and d(a.X-2*c.ScreenToWorldDistance(b-c.WorldToRenderPosition(d(320,240))).X,a.Y)or a r:RemoveGridEntity(r:GetGridIndex(a),0,false)r:Update()a=c.GridSpawn(TYPE,0,a,true)if a then a:SetVariant(VARIANT)a:Init(a.Desc.SpawnSeed)a.State=STATE end
