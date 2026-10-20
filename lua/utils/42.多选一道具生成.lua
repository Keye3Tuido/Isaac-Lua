--多选一道具生成。

--[[
作为模板: true
模板id: multi-choice-spawn
说明: |-
  每开启新游戏时，在初始房间根据玩家人数n，生成n组多选一道具{P2}
参数:
  P1: {类型: "道具id列表", 默认: "87,229,233", 性质: "局部", 说明: "每组多选一的候选道具id列表"}
  P2: {类型: "描述", 默认: "(87-洛基的角,229-萌死戳的肺,233-小小星球)", 性质: "局部", 说明: "说明文本中的候选道具描述"}
]]
l local V,g,N=Vector,{P1}Isaac.AddCallback({},15,function(_,c)local n,x,y=Game():GetNumPlayers()if not c then x,y=(720-#g*80)/2,(640-n*80)/2 for i=1,n do for j=1,#g do Isaac.Spawn(5,100,g[j],V(x+80*(j-1),y),V.Zero,N):ToPickup().OptionsPickupIndex=i end y=y+80 end end end)
