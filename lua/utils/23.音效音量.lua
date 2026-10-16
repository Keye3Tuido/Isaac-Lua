--音效音量：按音效id 批量调整音量，可在控制台改音量系数。

--[[
作为模板: true
模板id: sfx-volume-adjust
名称: 音效音量
说明: 音效{P1}的音量调整至{P3}。
参数定义:
  P1: {类型: 音效id列表, 默认: [182, 477], 性质: 局部, 说明: 需调整音量的音效id列表}
  P2: {类型: 数值, 默认: '.3', 性质: 局部, 说明: 音量系数，30%=.3}
  P3: {类型: 描述, 默认: "30%", 性质: 局部, 说明: "说明文本中的音量百分比显示值（30%=.3）"}
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function()for _,v in pairs{P1}do SFXManager():AdjustVolume(v,P2)end end)
