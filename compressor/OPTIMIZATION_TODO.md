# 压缩优化待完成任务

## 已完成并验证的改动 ✓

### 阶段1.10：重复声明删除
- **实现方式**：后处理阶段，使用正则表达式识别完全相同的`local`声明
- **效果**：callback模式压缩率从13.82%提升到33.18%
- **测试状态**：所有69个测试通过
- **提交哈希**：193b7d6

**示例**：
```lua
-- 压缩前（3个重复声明）
local A,M=Isaac.AddCallback,ModCallbacks A({},M.MC_POST_UPDATE,func1)
local A,M=Isaac.AddCallback,ModCallbacks A({},M.MC_POST_RENDER,func2)
local A,M=Isaac.AddCallback,ModCallbacks A({},M.MC_POST_NEW_ROOM,func3)

-- 压缩后（删除2个重复声明）
local A,M=Isaac.AddCallback,ModCallbacks A({},M.MC_POST_UPDATE,func1)A({},M.MC_POST_RENDER,func2)A({},M.MC_POST_NEW_ROOM,func3)
```

---

## 未完成的优化需求

### 目标：多回调场景进一步优化
**当前状态**：204字符  
**目标状态**：169字符  
**需要节省**：35字符

### 测试用例
```lua
// 当前压缩结果（204字符）
l local a,b,c=Isaac,ModCallbacks,'AddCallback'a[c]({},b.XXX,func,arg)local A,M=a[c],b;A({},M.XXX,func,arg)local A,M,T=a[c],b,{}A(T,M.XXX,func,arg)local M,A=b,function(...)a[c]({},...)end;A(M.XXX,func,arg)

// 期望压缩结果（169字符）
l local a,b,c,T,A=Isaac,ModCallbacks,'AddCallback',{}A=a[c]a[c]({},b.XXX,func,arg)A({},b.XXX,func,arg)A(T,b.XXX,func,arg)A=function(...)a[c]({},...)end;A(b.XXX,func,arg)
```

### 需要实现的三个优化

#### 1. 跨声明变量值追踪
**问题**：多个声明中存在相同的变量初始化，但当前无法识别
```lua
local A,M=a[c],b     -- M=b
local A,M,T=a[c],b,{}  -- M=b（重复）
local M,A=b,function(...) -- M=b（重复）
```

**需求**：
- 创建变量值追踪表，维护每个变量在其所在域、当前生命周期/阶段指代的实际值
- 每次求实际值时溯源到最底层
- 识别`M=b`在不同声明中的等价性

#### 2. 别名替换优化
**问题**：识别到`M=b`后，应该将所有`M.XXX`替换为`b.XXX`
```lua
A({},M.XXX,func,arg)  -- 应替换为 A({},b.XXX,func,arg)
```

**需求**：
- 在变量使用点进行别名展开
- 将间接引用替换为直接引用
- 减少中间变量的声明需求

#### 3. 智能声明合并
**问题**：删除重复变量后，需要合并多个声明
```lua
local a,b,c=Isaac,ModCallbacks,'AddCallback'
local A,M=a[c],b      -- M重复，删除后只剩A
local A,M,T=a[c],b,{}  -- M重复，删除后剩A,T
local M,A=b,function(...) -- M重复，删除后只剩A
```

**期望结果**：
```lua
local a,b,c,T,A=Isaac,ModCallbacks,'AddCallback',{}
-- A在后续被重新赋值，T只在第一次使用
```

**需求**：
- 识别部分重叠的变量（不是完全相同的声明）
- 提取首次出现的变量到第一个声明
- 处理后续重新赋值的情况
- 保持语义等价性

---

## 失败的尝试总结

### 尝试1：阶段1.10.5 - 跨声明变量合并
**方法**：AST分析，识别多个声明中的重复变量并删除  
**失败原因**：
- 改变了变量的版本语义（Lua中每个`local`声明创建新的变量版本）
- 导致规范化等价性检查失败（NOT-EQUIV错误）
- 语法错误：删除变量后声明可能为空

### 尝试2：阶段1.11 - 重复表达式提取
**方法**：正则表达式识别重复的成员访问（如`b.XXX`），提取为局部变量  
**失败原因**：
- 插入位置计算错误，导致语法错误
- 成本收益计算不准确
- 与现有优化阶段冲突

### 尝试3：planAll中的别名替换
**方法**：在优化规划阶段跟踪localAliasBindings，在edits中替换别名使用  
**失败原因**：
- 实现依赖不存在的AST节点属性
- 没有正确处理变量作用域和生命周期
- 对压缩结果无影响

---

## 根本问题分析

### 为什么后处理方法失败？
1. **语义变化**：后处理阶段的字符串/AST操作容易改变Lua的变量语义
2. **版本问题**：Lua中每个`local`声明创建新版本，合并声明会改变版本
3. **等价性检查**：规范化过程会检测到语义变化并拒绝优化

### 正确的实现方向
**必须在planAll阶段实现**，因为：
1. planAll阶段有完整的变量绑定信息（bindings, varOf）
2. 可以正确处理变量作用域和生命周期
3. 可以在生成edits时就考虑别名替换
4. 优化决策在规范化检查之前，可以保证语义等价

### 用户的关键建议
> "你应该创建一个表，维护你使用的变量在其**所在域**，当前**生命周期/阶段**指代的实际值，每次求实际值时应当溯源到最底层；每次表有变化时，合并可以合并的变量"

**解读**：
- 需要在planAll中创建变量值追踪系统
- 追踪每个变量在不同阶段的实际值（溯源到最底层）
- 动态维护可合并的变量集合
- 在生成edits时应用合并和替换

---

## 下一步实现建议

### 阶段1：变量值追踪系统
在planAll函数中添加：
```javascript
var varValueMap = new Map(); // binding -> 实际值（溯源后）
var varAliasChain = new Map(); // binding -> 源binding（如果是别名）
```

### 阶段2：别名展开
在生成edits时：
```javascript
// 对于每个变量使用，检查是否可以展开为更直接的引用
if (varAliasChain.has(binding)) {
  var source = varAliasChain.get(binding);
  // 替换为源变量
}
```

### 阶段3：声明合并
在收集所有变量值后：
```javascript
// 识别可以合并到第一个声明的变量
// 生成合并后的声明
// 删除后续重复的变量声明
```

---

## 测试文件
- `compressor/tests/test_multi_callback.js` - 主要测试用例（204→169字符）
- `compressor/tests/test_callback_pattern.js` - 简单回调模式测试
- `compressor/tests/test_field_repeat.js` - 字段重复访问测试

---

**创建时间**：2026-06-01  
**状态**：待实现
