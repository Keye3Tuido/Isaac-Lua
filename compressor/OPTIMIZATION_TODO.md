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

### 透明别名消解（阶段1.1，变量值追踪 + 别名替换）✓
- **对应原待办项 #1（跨声明变量值追踪）与 #2（别名替换优化）。**
- **实现位置**：`planAll`（结构规划阶段），而非后处理——这是前三次失败尝试得出的正确方向。
- **效果**：多回调测试用例 `test_multi_callback.js` 从 **204 → 186 字符**（压缩率 23.02% → 29.81%）。

**核心机制**：

1. **变量值追踪（溯源到最底层）**：在 `planAll` 内识别"透明别名" binding——单次声明、从不被赋值、其 init 为"从不被赋值的全局 G"或"另一个透明别名（链式溯源至 G）"的只读局部。链式别名（`local g=Global; local h=g`）通过迭代到不动点解析到最底层全局。

2. **按名归并的安全判定（防误判）**：一个名字 `N` 只有当【AST 中所有名为 `N` 的 binding】都是同一个全局 `G` 的透明别名时才会被消解（规则 R1）；且每条声明里只含 1 个透明别名变量、`#init==#vars` 位置对齐时才允许删除声明项（规则 R2）。

3. **别名替换 + 声明删除**：消解成功后，把所有 `M.XXX` 的使用点重定向到全局折叠别名（`M.XXX` → `b.XXX`），并删除 `M` 的声明项（处理首/中/尾位置、整条删除等情形）。被消解的目标全局强制折叠（`forceFoldGlobals`），保证重定向有目标。

4. **严格等价校验（非旁路）**：`canonical` 内置"透明别名归一"（copy-propagation 标准形）——把只读局部别名的读还原为对源全局的读、删除其声明。该归一对**两侧一致施加**且自动检测（无需传 aliasMap），因此外部校验脚本（`realtest`/`remotetest`/`bulktest`，原始侧不传别名映射）与压缩侧都收敛到同一标准形。**移除了旧版 `assertEquivalentAlias` 中"有透明别名就跳过语义校验"的危险旁路**。

5. **只缩短才提交（双流水线对比）**：消解在某些形态下反而更长（如三条完全相同的声明，保留共享别名 + 阶段1.10 去重更优）。遵循全局"只缩短才提交"原则，`compress` 跑两条流水线（启用/禁用 elision）取更短者；仅当启用版确实触发消解时才跑第二条对比，避免无谓开销。

- **测试状态**：`test 69/69`、`edge 40/40`、`test_incremental 3/3`、`test_transparent_elision 5/5`、`realtest 255/255 段 + 33/33 文件`、`remotetest 4/4` 全部通过且语义等价；`bulktest` 失败集与改动前**完全一致**（无新增回归）。
- **新增测试**：`tests/test_transparent_elision.js`。

---

### 智能声明合并（阶段1.7b 声明上提，待办 #3）✓
- **对应原待办项 #3（智能声明合并）。**
- **效果**：多回调用例 `test_multi_callback.js` 从 **186 → 177 字符**（压缩率 29.81% → 33.21%）；bulktest 全量**净省 1788 字节**且零回归。

**两步实现**：

1. **canonical 死前向声明归一（forward-nil elimination，奠基）**：识别 `local v=nil`（或缺省 init）后、`v` 在到达其【同块首次赋值】前从不被读（含闭包捕获、嵌套块读取）的"死前向声明"。canonical 归一时**删除该 nil 声明且不 bumpDef**，使首次赋值成为 v0——于是 `local v=nil ...(不读v)... v=e` 与 `...(不读v)... local v=e` 收敛同一标准形。健全性前提 P1–P5（单声明 / 同块 / 赋值为单或可拆多目标 / 区间不读 v / RHS 不读 v）。该归一对两侧一致施加，外部校验脚本（原始侧不传 aliasMap）也收敛。新增 `tests/test_canonical_fwdnil.js`（5 正例 + 6 负例，含"区间读 v""闭包捕获""自引用"等不可消除反例）。

2. **阶段 1.7b 声明上提变换**：把顶层块内、声明在别名头之后的局部变量上提到别名头（作为前向 nil 占位），并把其 `local X=v` 降级为赋值 `X=v`。多变量 `local A,T=v1,v2` 整体降级为多重赋值后，再跑一次多赋值拆分兑现尾值贴紧。借助上面的 forward-nil 归一，这类变换可被 canonical **严格验证**。三关闸门：只缩短 + 真·Lua 语法 + canonical 等价，任一不过回退。

- **测试状态**：全套件 + bulktest 596/602（与基线一致，零回归）。


---

## 未完成的优化需求

### 目标：多回调场景进一步优化
**改动前**：204 字符
**当前状态**：177 字符（透明别名消解 + 声明上提均已落地，见上文"已完成"）
**理想状态**：169 字符
**剩余差距**：8 字符（受 sound 性边界阻挡，见下文）

### 测试用例
```lua
// 改动前压缩结果（204字符）
l local a,b,c=Isaac,ModCallbacks,'AddCallback'a[c]({},b.XXX,func,arg)local A,M=a[c],b;A({},M.XXX,func,arg)local A,M,T=a[c],b,{}A(T,M.XXX,func,arg)local M,A=b,function(...)a[c]({},...)end;A(M.XXX,func,arg)

// 当前压缩结果（177字符，M 已消解 + 声明上提 A,T 到别名头）
l local a,b,c,A,T=Isaac,ModCallbacks,'AddCallback'a[c]({},b.XXX,func,arg)A=a[c];A({},b.XXX,func,arg)A=a[c]T={}A(T,b.XXX,func,arg)A=function(...)a[c]({},...)end;A(b.XXX,func,arg)

// 理想压缩结果（169字符）
l local a,b,c,T,A=Isaac,ModCallbacks,'AddCallback',{}A=a[c]a[c]({},b.XXX,func,arg)A({},b.XXX,func,arg)A(T,b.XXX,func,arg)A=function(...)a[c]({},...)end;A(b.XXX,func,arg)
```

### 已落地：智能声明合并（声明上提，原 #3）✓

见上文"已完成"区。多回调用例 186 → 177，bulktest 全量净省 1788 字节，零回归。

#### 探索记录（实测结论 + 落地后更新）

| 变换形态 | canonical 可验证？ | 状态 |
|---|---|---|
| `local A=v`（shadow 重声明）→ `A=v`（降级赋值） | ✅ | `foldReuse` 早已实现（单变量） |
| `local A,T=v1,v2`（A 是 shadow）→ 拆分降级 | ✅ 但全局净负 | 已试并**回退**：bulktest 净增 1670 字节，局部贪心收益不组合 |
| 前向声明为 nil：`local x,y=1 ... y=2` ≡ `local x=1 ... local y=2` | ✅ **现已可验证** | 已实现 canonical 死前向声明归一（P1–P5 + 多目标支持） |
| 声明上提（变量上提别名头 nil 占位 + 降级 local） | ✅ **现已可验证** | 阶段 1.7b 已落地，186→177，净省 1788 字节 |

#### 剩余 8 字（177 → 169）：受 sound 性边界阻挡，暂不实现

理想 169 相对当前 177 还差两处，都触及**冗余存储消除（redundant-store elimination）**：

1. 去掉重复的 `A=a[c]`（seg2 已 `A=a[c]`，seg3 又 `A=a[c]`，其间 `A` 未被改写）。
2. 把 `T={}` 的值直接放进别名头（`,T,A=...,{}`），而非 seg3 里 `T={}`。

**为何暂不做**：消除第二个 `A=a[c]` 需证明"重新求值 `a[c]` 与复用 A 中旧值等价"。但 `a[c]` 是**索引表达式**，理论上可能触发 `__index` 元方法副作用，**静态不可证纯**——因此对索引表达式做冗余存储消除**在一般情况下不 sound**。实测 `canonical(177 形) === canonical(173 形)` 返回 **false**（当前归一正确地拒绝判等）。理想 169 实际上隐含了"`a[c]` 为纯"这一**不可证假设**，属于"手写者凭语境知道安全、机器无法证明"的技巧——本压缩器的设计红线是"只做可机器证明等价的变换"，故不追求该 8 字。

**若将来要安全拿下这 8 字**，可行方向（需各自的等价护栏）：
- 仅对 **纯局部变量直读**（如 `A=x` 其中 x 是局部、非 index/call/member）做冗余存储消除——这类重新求值确定无副作用，可 sound 实现；index/call/member 一律排除。
- 值放进别名头需要"上提带初值"，而非仅 nil 占位——同样受求值时机前移的 sound 性约束（只有无副作用且无顺序依赖的初值才安全）。

---

## 失败的尝试总结（历史教训，已被后续方案吸收）

> 原 #1/#2 已由"透明别名消解"落地，#3 已由"声明上提 + canonical 死前向声明归一"落地。保留教训供后续冗余存储消除参考。

### 尝试1：阶段1.10.5 - 跨声明变量合并
**方法**：AST分析，识别多个声明中的重复变量并删除  
**失败原因**：
- 改变了变量的版本语义（Lua中每个`local`声明创建新的变量版本）
- 导致规范化等价性检查失败（NOT-EQUIV错误）
- 语法错误：删除变量后声明可能为空

> **正解**：消解只针对"从不被赋值的只读别名"（版本恒定，无版本语义问题）；声明项删除按位置精确计算 token 区间，整条变空时删除整条；`canonical` 内置双侧一致的 copy-propagation 归一来验证。

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

> **正解**：别名使用重定向通过 binding 的 `uses[].range` 生成 token 级替换；目标全局用 `forceFoldGlobals` 强制折叠以保证重定向有目标；落在被删声明项区间内的读予以跳过。

---

## 根本问题分析

### 为什么后处理方法失败？
1. **语义变化**：后处理阶段的字符串/AST操作容易改变Lua的变量语义
2. **版本问题**：Lua中每个`local`声明创建新版本，合并声明会改变版本
3. **等价性检查**：规范化过程会检测到语义变化并拒绝优化

### 正确的实现方向（已验证有效）
**必须在 planAll 阶段实现**，因为：
1. planAll阶段有完整的变量绑定信息（bindings, varOf）
2. 可以正确处理变量作用域和生命周期
3. 可以在生成edits时就考虑别名替换
4. 优化决策在规范化检查之前，可以保证语义等价

**等价校验的关键**：`canonical` 必须对压缩前/后**双侧一致**地施加同一套归一规则（这里是 copy-propagation 标准形），且能在不依赖外部传参的情况下自动检测——否则外部校验脚本（原始侧不传别名映射）会误报 NOT-EQUIV。

---

## 测试文件
- `compressor/tests/test_transparent_elision.js` - 透明别名消解专项测试（5 例：多回调/单别名/三相同/别名链/重新赋值）✓
- `compressor/tests/test_multi_callback.js` - 主要测试用例（204→186，理想 169）
- `compressor/tests/test_callback_pattern.js` - 简单回调模式测试
- `compressor/tests/test_field_repeat.js` - 字段重复访问测试

---

**创建时间**：2026-06-01  
**最近更新**：2026-06-01（透明别名消解落地，#1/#2 完成；剩 #3 智能声明合并）  
**状态**：部分完成（剩"智能声明合并"）
