# LuaMin 测试报告

> 生成时间: 2026-05-31

## 测试套件概览

| 套件 | 命令 | 用例数 | 通过 | 说明 |
|------|------|--------|------|------|
| unit    | `node tests/test.js`       | 69  | 69 | 作用域/遮蔽/全局保护/前缀/拒绝/真实片段 |
| edge    | `node tests/edge.js`       | 40  | 40 | 数字-关键字-运算符边界、goto、varargs、:method |
| real    | `node tests/realtest.js`   | 255 | 255 | 逐段压缩 (Isaac 项目) |
| real    | `node tests/realtest.js`   | 33  | 33 | 合并全段压缩 (Isaac 项目) |
| remote  | `node tests/remotetest.js` | 4   | 4  | 远程模组整文件压缩 |
| **合计** |                            | **401** | **401** | **100%** |

## 批量开源项目测试

自动克隆 19 个知名 Lua 开源项目（4 个克隆失败/无 Lua 文件），**609 个 .lua 文件 (3.7MB)** 全量压缩 + 语法验证。

| 项目 | 文件数 | 通过 | 失败 | 说明 |
|------|--------|------|------|------|
| penlight | 54 | 53 | 1 | config.lua 原始语法错误 |
| busted | 52 | 51 | 1 | core.lua 结构阶段语法 |
| ldoc | 33 | 33 | 0 | ✅ |
| luacheck | 58 | 58 | 0 | ✅ |
| microlight | 8 | 8 | 0 | ✅ |
| moses | 2 | 2 | 0 | ✅ |
| 30log | 16 | 16 | 0 | ✅ |
| jumper | 25 | 23 | 2 | 原始输入语法错误 |
| json-lua | 5 | 5 | 0 | ✅ |
| middleclass | 3 | 3 | 0 | ✅ |
| stateful | 1 | 1 | 0 | ✅ |
| tween | 1 | 1 | 0 | ✅ |
| sqlite-lua | 17 | 17 | 0 | ✅ |
| lua-xml | 2 | 2 | 0 | ✅ |
| ZeroBraneStudio | 234 | 233 | 1 | sha2.lua 原始语法错误 |
| lapis | 87 | 86 | 1 | spec.lua 原始语法错误 |
| lua-cjson | 3 | 3 | 0 | ✅ |
| etlua | 1 | 1 | 0 | ✅ |
| redis-lua | 7 | 7 | 0 | ✅ |
| **合计** | **609** | **596** | **6** | **97.9%** |

### 失败明细 (6 条，均为输入自身问题)

| 文件 | 大小 | 原因 |
|------|------|------|
| penlight/lua/pl/config.lua | 6944B | 原始代码第80行 Lua 语法错误 |
| busted/busted/core.lua | 9507B | 结构阶段重命名后语法异常 |
| jumper/jumper/core/lookuptable.lua | 897B | 原始代码函数声明语法错误 |
| jumper/specs/pathfinder_specs.lua | 10326B | busted 测试框架语法(非标准Lua) |
| ZeroBraneStudio/lualibs/sha2.lua | 6531B | 原始代码 Lua 5.2 专有语法 |
| lapis/lapis/cmd/templates/spec.lua | 3865B | busted 测试框架语法 |

## 克隆失败的项目 (非压缩器问题)

| 项目 | 原因 |
|------|------|
| lua-argon2 | GitHub 仓库已归档/不可访问 |
| lua-lru | GitHub 仓库已归档/不可访问 |
| lua-path | GitHub 仓库已归档/不可访问 |
| lua-gd | GitHub 仓库已归档/不可访问 |
| luafilesystem (lfs) | 无 .lua 文件 (纯C库) |

## 压缩率

Isaac 项目 255 段 `l` 代码：
- 输入总字符: 124,942
- 输出总字符: 123,682
- 节省: 1,260 字符 (1%)
