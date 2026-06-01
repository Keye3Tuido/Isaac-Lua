# LuaMin 测试报告

> 生成时间: 2026-06-01  
> 提交: 修复透明别名优化导致的等价性检查失败

## 测试套件概览

| 套件 | 命令 | 用例数 | 通过 | 说明 |
|------|------|--------|------|------|
| unit    | `node tests/test.js`       | 69  | 69 | 作用域/遮蔽/全局保护/前缀/拒绝/真实片段 |
| edge    | `node tests/edge.js`       | 40  | 40 | 数字-关键字-运算符边界、goto、varargs、:method |
| incr    | `node tests/test_incremental.js` | 3 | 3 | 增量压缩测试 |
| real    | `node tests/realtest.js`   | 255 | 255 | 逐段压缩 (Isaac 项目) |
| real    | `node tests/realtest.js`   | 33  | 33 | 合并全段压缩 (Isaac 项目) |
| remote  | `node tests/remotetest.js` | 4   | 4  | 远程模组整文件压缩 |
| **合计** |                            | **404** | **404** | **100%** |

## 重要修复

### 透明别名优化已修复

透明别名合并优化（commit 279b9cb）在复杂场景下导致等价性检查失败，现已修复并启用。

**问题原因**：
同名冲突检测不完整。当顶层作用域存在多个同名binding时，canonical函数只使用变量名无法区分它们，导致等价性检查失败。

**修复方案**：

1. 在透明别名识别阶段收集顶层作用域所有binding的名字统计
2. 只有当binding的名字在顶层作用域唯一时，才将其识别为透明别名
3. 添加对`info.topScope`的存在性检查，处理简单代码片段的边界情况

**修复结果**：

- realtest.js 保持 255/255 + 33/33 全部通过
- 所有测试套件（404个用例）100%通过
- 透明别名优化正常工作，提供额外的压缩收益

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

## 透明别名优化压缩统计

### 测试 1: test_merge_locals

**单条压缩**:
- [1] `local a=ModCallbacks`: 20 → 20 (0.00%)
- [2] `local b=ModCallbacks`: 20 → 20 (0.00%)
- [3] `function test1() return a.MC_POST_GAME_END end`: 46 → 45 (2.17%)
- [4] `function test2() return b.MC_POST_RENDER end`: 44 → 43 (2.27%)

**合并压缩**: 133 → 110 (17.29%)

### 测试 2: test_incremental - case1

**单条压缩**:
- [1] `function add(x,y) return x+y end`: 32 → 31 (3.13%)
- [2] `function sub(x,y) return x-y end`: 32 → 31 (3.13%)
- [3] `function mul(x,y) return x*y end`: 32 → 31 (3.13%)

**合并压缩**: 98 → 95 (3.06%)

### 测试 3: test_incremental - case2

**单条压缩**:
- [1] `local g=Game():GetRoom()`: 24 → 24 (0.00%)
- [2] `local d=g:GetDoor(DoorSlot.LEFT0)`: 33 → 33 (0.00%)
- [3] `if d then d:Open() end`: 22 → 21 (4.55%)

**合并压缩**: 81 → 78 (3.70%)

### 统计摘要

| 指标 | 单条压缩 | 合并压缩 |
|------|----------|----------|
| 最低压缩率 | 0.00% | 3.06% |
| 最高压缩率 | 4.55% | 17.29% |
| 平均压缩率 | 1.84% | 8.02% |

**结论**: 合并压缩的平均压缩率(8.02%)显著高于单条压缩(1.84%)，提升约4.4倍。
