--忽略演示夹具
--块头把 注释 写成 true 的代码块必须在构建期被整体丢弃。

--[[
说明: 第一块。
]]
l print(1)

--[[
注释: true
说明: 被忽略的块（说明与代码都不进产物）。
名称: 被注释掉的块
草稿: 未写完的键也不影响构建（整块不参与诊断）
]]
l DEADGLOBAL=1

--[[
模板: tpl-basic
]]

--[[
注释: false
说明: 显式 false 照常编译。
名称: 活全局
]]
l LIVEGLOBAL=1

--[[
说明: 依赖演示。
依赖: 活全局
]]
l print(LIVEGLOBAL)

--[[
模板: restart-game
]]
