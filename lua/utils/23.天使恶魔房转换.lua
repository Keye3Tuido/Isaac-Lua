--天使恶魔房转换。

--[[
作为模板: true
模板id: angel-devil-convert
说明: |-
  所有天使/恶魔房都转化为指定类型房间。P1=true、P2=false转化为天使房；P1=false、P2=true转化为恶魔房。
参数:
  P1: {类型: "布尔", 默认: "true", 性质: "局部", 说明: "InitializeDevilAngelRoom第1参"}
  P2: {类型: "布尔", 默认: "false", 性质: "局部", 说明: "InitializeDevilAngelRoom第2参"}
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_NEW_LEVEL,function()Game():GetLevel():InitializeDevilAngelRoom(P1,P2)end)
