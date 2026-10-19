# 以撒控制台代码压缩器 LuaMin

> 把正常格式的 Lua 代码（带缩进/换行/注释/长变量名，可含 `l`/`lua` 控制台前缀）压成**单行、以 `l` 开头**的控制台命令。每一步都用真·Lua 5.3 解释器做语法校验、用归一化 AST 做语义等价校验，任一不通过就**拒绝输出并报错**。

## 快速开始

**浏览器使用**：双击打开 `index.html`，粘贴代码 → 点「压缩」→ 复制结果。

**Node.js 使用**：
```javascript
const luaparse = require('luaparse');
const fengari = require('./node_modules/fengari');
require('./core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

const result = LuaMin.compress(yourLuaCode);
console.log(result.output);  // l <压缩后的单行代码>
```

**特性**：
- ✓ 纯静态，`file://` 直接运行，无需服务器/构建/联网
- ✓ 每个优化阶段后都做语法+语义等价校验，**不等价则拒绝输出**
- ✓ 支持多段输入（每行可带 `l`/`lua` 前缀），自动合并为单段
- ✓ 测试语料全部位于 `compressor/tests2/`：固定语言形态、专项回归及可选 remote/bulk；不读取项目 `lua/` 业务目录

---

## 文档结构

> **第一部分**（本部分）：压缩器使用、实现原理、测试
> **第二部分**（后半部分）：人工压缩技巧深度剖析（成本模型、取舍、变种）——既是压缩器的设计依据，也可单独作为手写压缩的参考

---

# 第一部分　压缩器

### 代码架构（模块化设计，无需构建）

> 当前引擎为 **v2 透镜架构**（M1–M7 已完成）；唯一权威设计文档 = `docs/v2-architecture-plan.md`。

**词法基础库与共享模块**：
- `core.js` — Lua 5.3 词法器 + 粘连/引号安全判定 + `create(luaparse, fengari)` 词法上下文（含 fengari 真·Lua 语法校验器）
- `src2/shared/analyze.js` — AST 解析、作用域分析、全局/成员访问收集、元表纯度分析（`analyzeMetatableFree`）、候选名分配
- `src2/shared/canonical.js` — SSA 版本化归一 + 等价性验证（无别名 canonical 使用精确源码键控的有界 LRU 缓存）
- `src2/shared/encode.js` — 去注释、间隔符最小化、`applyEncoding`
- `src2/shared/purecopy.js` — 输入预处理（剥 `l`/`lua` 前缀）、`applyEdits` 编辑契约、纯代入归一（`normPureCopyProp`）
- `src2/base.js` — 门面工厂：把 core.js 与 shared/* 聚成统一门面（`_lex/_parse/_analyze/_canonical/_preprocess/_normPureCopyProp/removeComments/minimizeSpacing/applyEncoding/…`），经 `deps.base` 注入全引擎

**v2 透镜流水线（`src2/`）**：
- `src2/ir.js` — IR 构建器：parse + analyze + SSA 版本表层 + 证据槽（惰性、随版本失效）+ AliasEnv 别名证据环境
- `src2/lens.js` — 透镜基座：契约机器检查、`encodeDelta` 精确字节成本、默认 verify（roundtrip 自证）
- `src2/schedule.js` — 前置条件 DAG 拓扑 + 不动点调度（互斥分叉、全局门禁）
- `src2/canonical2.js` — 终审等价校验器（luaparse 双解析 + fengari 真·Lua 校验 + canonical 双侧差量还原比对）
- `src2/lenses/` — 透镜族：`alias.js`（全局/成员/透明/重命名）、`chain.js`（成员链 CSE）、`factor.js`（字符串/前缀/方法因子）、`hoist.js`（声明上提/合并/复用/前向 nil）、`normalize.js`（局部归一 pass 族）、`encode.js`（分号消除/比较重排/尾分隔符）、`block.js`（块包装）
- `src2/search2.js` — 双向 beam 搜索（extract/inject 互逆，canonical2 验证兜底）
- `src2/core2.js` — 工厂与对外 API（`LuaMin2.create` → `compress/compressOnce/compressAsync`，多阈值取短 + 负收益兜底）

**加载方式**：浏览器通过 `index.html` 依序加载 `core.js → src2/shared/* → src2/base.js → src2 其余模块`（自注册到 `window.__LuaMin2Modules`），Node.js 各模块直接 `require`。两条路径产出一致；`tests2/snapshot_v2.js --check` 提供字节级回归保护。`compress` 同步路径全程同步；浏览器端 `compressAsync` 宏任务分片让步以保持页面响应。

**UI 特性**：
- 搜索优化级数下拉框：0=关闭（只跑贪心不动点），1~32=beam search 束宽 K（越大搜得越深、越慢）
- 无元表模式勾选框：假定所有变量（含全局）无自定义 `__index`/`__newindex` 元表，放开成员链冗余消除的纯度闸门，允许更激进压缩
- 压缩阶段列表：按实际执行顺序展示每个阶段，可点开查看相对上一阶段的 diff（相邻阶段公共前缀/后缀裁剪，超大改动显示"diff 过大"提示而非整段红绿）
- 压缩期间徽标实时进度，按钮禁用防重复点击

**搜索层做什么**：贪心不动点（调度器逐候选"只缩短才提交"）做的是「可静态证明安全」的优化；搜索层（`search2`）在其上做**双向 beam 搜索**：从贪心终点反向撤销（inject）与正向抽取（extract）互逆探索，canonical2 终审兜底，无改善即回退。大输入（>12KB）走尺寸分级：关 beam 搜索、fixpoint 限 1 轮（贪心全局门禁所有尺寸全开）。

### 压缩流水线

> 下列阶段清单是各变换的**功能清单**（v2 透镜架构下同一批变换以透镜形式组织：
> alias/chain/factor/hoist/normalize/encode/block 透镜族 + 调度器不动点 + search2 双向 beam，
> 阶段边界与执行序由调度器 DAG 推导，权威描述见 `docs/v2-architecture-plan.md`）。

```
输入预处理（剥 l/lua 前缀、合并单段）
   ↓
真·Lua + luaparse 双重语法校验
   ↓
【阶段 1：结构优化】
1.1  统一规划：局部重命名 + 全局/成员折叠 + 仿射因子 + 透明别名消解
     ├─ 真·Lua 语法 ✓ + luaparse ✓ + AST 等价 ✓
1.1b 括号转点（obj["Field"] → obj.Field，关键词字段除外）
1.1c 只读内联（只读字面量/常量别名 copy-propagation + 死纯局部消除）
1.1c2 成员链冗余消除（重复的纯点访问链 base.f1.f2… 提取为局部别名；safe 模式要求 base 可证明无元表，无元表模式放开）
1.1d 常量折叠（整数 ±、字符串 ..、not 布尔；递归求值）
1.1d2 常量条件折叠（`if true/false then A else B end` → `A`/`B`，含局部时才保留 `do..end`）
1.1d2b 常量循环折叠（`while false do A end` → 删；`repeat A until true` → `A`（无局部）/`do A end`（有局部）；`repeat A until false` → `while 1 do A end`；条件位 `true` → `1`）
1.1d2c 早返回/早退出守卫折叠（函数体开头连续 `if c then return end` 或循环体开头连续 `if c then break end` 合并为 `if not(c1 or c2...) then <rest> end`，`or` 短路保持求值顺序）
1.1d2d 德摩根折叠（`not X or not Y` → `not(X and Y)`；`not X and not Y` → `not(X or Y)`，求值顺序/次数保持）
1.1d3 表字段合并（`local M={} M.X=v M.Y=w` → `local M={X=v,Y=w}`；字段值不得引用 M）
1.1e 布尔别名（true/false 提取别名）
1.1f 数字归一（0.X → .X）
1.1h 括号消除（按 Lua 5.3 优先级表 + 结合性 + 多值截断三闸门移除冗余圆括号；保留载荷分号 `;(`）
1.2  :method 折叠（base 为简单变量；优先注入已有 local 尾部，否则独立 local；只缩短才提交）
1.3  字段前缀折叠（obj.PREFIX_X 系列提取公共前缀因子；支持多级派生因子，按成本选最优拆分等级）
1.4  Safe call sugar: `f("x")` -> `f"x"`, `f({})` -> `f{}`
1.4b 字符串字面量内联（重复字符串提取别名，含 call sugar `a'X'` 参数）
1.4c 字符串公共前缀因子（多串共享前缀时迭代提取多级因子，含嵌套 `a..b..'UP'`）
1.4c3 点访问别名复用（字段名已有字符串别名时 `obj.Field` → `obj[alias]`，纯语法改写，写目标同样安全）
1.4d 块包装（重复语句块打包成薄函数：固定点任意位置、变化点作形参；散布重复也命中，texts 相同的多个变化点合并为同一形参，形参可多次出现但调用点须实参无调用/vararg，贪心取语句不重叠的最短分解）
1.5  local 合并（相邻 body local 并一条）
1.5b local function 合并（并入前条声明；函数体引用被并变量时退化为「先声明、后赋值」）
1.6  多重赋值拆分（非 local 多赋值 → 单赋值序列；编码层兑现节省）
1.6b if-not 二择（if not C then A else B → if C then B else A，省 not）
1.7  变量复用（活跃区间不交 → 共享名 + 省 local；含循环内丢弃变量 `_`；SSA 等价校验）
1.7b 声明上提（顶层局部上提到别名头作前向 nil 占位 + 降级 local；支持值粒度部分上提：不引用头部/同语句变量的纯访问链/字面量值直接并入头部值列表，仅引用头部变量的值走占位）
1.7c prefix 合并（声明上提完成后，别名头与紧邻 body local 合并省 local 关键字）
1.7c2 块包装(二次)（prefix 合并后重跑，捕获新暴露的重复块）
1.7d 尾值符号收尾（多值赋值 local 里把"以引号/花括号结尾"的纯字面量排到最后，省后续关键字前的空格）
   ↓
【阶段 2：编码优化】
1.8  去除注释
     ├─ 真·Lua 语法 ✓ + luaparse ✓ + AST 等价 ✓
1.9  间隔符最小化 + 单行化
     ├─ 真·Lua 语法 ✓ + luaparse ✓ + AST 等价 ✓
1.10 比较重排（a OP b ≡ b FLIP(OP) a，兑现贴关键字省 1 字）+ 间隔符最小化(二次)
Safety: text-based duplicate `local` deletion is disabled because syntax validity alone cannot prove equivalent scope or evaluation timing.
Generated aliases are capped against Lua 5.3's 200-active-local limit; over-limit candidates are rejected without aborting the pipeline.
   ↓
输出：'l ' + 结果
```

**每个折叠/合并/复用/拆分阶段都带"只缩短才提交"实测长度闸门**——不赚则跳过，确保单调优化。

### 多段输入处理

`preprocess(input)` 规则：
1. 按行拆分（`\r\n` / `\r` 归一为 `\n`）
2. 每行删除行首 `^[ \t]*(?:lua|l)[ \t]+`（前导空白 + `l`/`lua` + 至少一个空白）
3. 剥完前缀的各行用 `\n` 重新拼接，作为**一整段** Lua 处理
4. 编码层压成**一个物理行**，输出时统一加**一个** `l ` 前缀

字符串内部换行（长字符串 `[[...]]`）属于语义内容，全程保留。

### 已实现的自动优化技巧

**核心优化**（阶段 1.1 统一规划）：
- **局部变量最短化重命名** — 作用域图着色，按频次降序分配最短名；严格更短才换；回避关键字与全局名
- **高频全局折叠** — 多次出现且从不被赋值的全局（`Isaac`/`Game`/`pairs`…）提取 `local A,B=...`，按盈亏公式决定
- **透明别名合并** — 多个局部变量都是同一全局的别名时，统一替换为全局折叠别名并删除冗余声明
- **透明别名消解** — copy-propagation：只读、从不被赋值、init 溯源到全局的局部变量，其成员/调用使用重定向到源全局并删除声明；`canonical` 内置归一验证
- **成员字段折叠** — 高频 `obj.Field` → `obj[v]` + 提取 `v='Field'`（base 可为任意表达式，如 `i(e.Type)[1].InitSeed`；`.Field`→`[v]` 是纯文本改写，求值次数/顺序不变；别名声明同样支持注入已有 local 尾部）
- **仿射因子分解** — 折叠字符串别名值共享前缀/后缀（`ROOMSHAPE_*`）提取因子 `p='ROOMSHAPE_'`，其余写 `p..'1x1'`；迭代提取多因子
- **统一频次竞争** — 局部、全局、成员三类符号在同一频次表竞争最短名

**局部规范化**（阶段 1.1b~1.1h）：
- **括号转点** — `obj["Field"]` → `obj.Field`（关键词字段如 `t["end"]` 除外，避免非法语法）
- **只读内联** — 只读字面量/常量别名 copy-propagation（`local t=1000000` 读处还原为字面量）+ 死纯局部消除
- **成员链冗余消除（CSE）** — 把重复出现的**纯点访问链** `base.f1.f2…` 提取为局部别名（`print(t.a.b.c) print(t.a.b.c)` → `local v=t.a.b.c print(v) print(v)`）。安全性：safe 模式下要求 base 是可证明无 `__index`/`__newindex` 元表的局部（字面量表构造、从不重赋值/写成员/逃逸、全程无 `setmetatable`），深链逐级经字面量表构造；`noMetatable` 模式（opts）假定所有变量（含全局）无元表，只保留"从不写/重赋值"的稳定性要求。`canonical` 的整链别名（`chainAliasByLocal`）双侧还原验证等价。构造新 aliasMap 的折叠 pass 统一经 folds.js 的 `extendAliasMap` 工厂（8 字段全量携带 + 覆盖式修改），`chainAliasByLocal` 与 `transparentAliases` 的逐字传播由工厂结构性保证——不会因漏传导致 canonical 等价校验恒失败而永远不敢提交
- **尾值符号收尾** — 多值赋值 `local a,b='hello',1 …` 把以符号（引号/花括号）结尾的纯字面量值排到最后 → `local b,a=1,'hello'…`，使后续关键字前可省一个空格。仅重排纯字面量（求值顺序无关），`canonical` 的只读字面量别名归一验证等价
- **常量折叠** — 整数 `±`、字符串 `..`、`not` 布尔；**递归求值**折叠嵌套常量（`1+2*3` → `7` 一次到位，保证幂等）；折叠后必须更短才提交
- **常量条件折叠** — `if true/false then A else B end` → `A`/`B`（分支无局部声明时直接展开）；分支含局部声明时才用 `do..end` 包裹保留作用域；空分支直接删除；`canonical` 的 IfStatement 归一 + 空 Do 块展开验证等价
- **表字段合并** — `local M={} M.X=v M.Y=w` → `local M={X=v,Y=w}`（仅合并紧邻声明、字段值不引用 M 的点访问赋值）；`canonical` 的 `mergeTableFields` 归一验证等价
- **布尔别名** — `true`/`false` 提取别名
- **数字归一** — `0.X` → `.X` 等前导零消除
- **括号消除** — 判定口径「删掉这对括号后重新解析的 AST 不变」，三道闸门：
  ① **语法括号不删**——后缀基座必须是 prefixexp（`({})[1]`、`("s"):rep(2)`、`(function()end)()`、`(f or g)(x)` 的括号是语法），实参表 `f(x)`、形参表 `function(a)` 的括号同理；
  ② **优先级/结合性**——按 Lua 5.3 优先级表（`or` 1 → `and` 2 → 比较 3 → `|` 4 → `~` 5 → `&` 6 → 移位 7 → `..` 9 → `+ -` 10 → `* / // %` 11 → 一元 12 → `^` 14；`..`/`^` 右结合，其余左结合）判定括号是否承载分组：更紧的删（`(a*b)+c`→`a*b+c`、`(a<b)==c`→`a<b==c`），更松的留（`(a+b)*c`、`not(a and b)`），同优先级只删结合性一致的一侧（`(a+b)+c`→`a+b+c`、`(a/b)*c`→`a/b*c`，而 `a+(b+c)`/`a-(b-c)`/`a*(b/c)`/`(a..b)..c`/`(a^b)^c` 留，`a..(b..c)`→`a..b..c`、`a^(b^c)`→`a^b^c` 删）；一元操作数按 `subexpr(12)` 判定（`-(a^b)`→`-a^b`、`(-a)*b`→`-a*b`、`2^(-1)`→`2^-1`；`-(a*b)`、`(-a)^b` 留）；双包 `((X))` 的内层纯冗余，直接删；
  ③ **多值截断**——末位展开位（`return`/调用末位实参、末位裸值字段、目标数多于本位的赋值/局部声明末位 RHS）上，括号把调用/vararg 截断为单值：两侧 AST 完全相同而语义不同（luaparse 不记括号，canonical 也发现不了），一律保留（`return(f())`、`print((f()))`、`local a,b=(f())`、`local t={(f())}`、`local a,b=(...)`）；非末位不受影响（`print((f()),1)`→`print(f(),1)`）。
  删除位若会粘连（`-(-a)`→`--a`、`and(a)`→`anda`）则插入空格，由编码层按最小间隔还原（不牺牲压缩率）；载荷分号 `x=1;(h)(x)` 保护沿用 v1 口径

**增量优化**（阶段 1.2~1.7c）：
- **`:method` 折叠** — `obj:M(args)` → `obj[s](obj,args)` + `s='M'`（仅 base 为简单标识符；别名声明优先注入已有 local 尾部——先 dropLeading 头部 batched local，其次顶层首条普通 local（要求 init 数 ≥ 变量数、无 `local function` 初值、改写点不落在该语句内部），都无才退回独立 local；只缩短才提交）
- **字段前缀折叠** — `obj.PREFIX_X` 系列提取公共前缀因子 `U`，改写为 `obj[U..'rest']`；可注入现有 batched local 尾部。支持**多级派生因子**：候选前缀构成一棵树，在树上做 DP 选择最优抽取集合——子前缀可写成 `V=U..'seg'`（派生，声明后赋值，省去重复存储父前缀字符串），按成本选最优拆分等级（前缀太短或子分组太少时自动退回单级/不拆）
- **字符串字面量内联** — 重复字符串（`≥3` 字、`≥2` 次，不含 `'`/`\`/换行）提取别名 `u='X'` 注入 batched local，替换每处 `'X'` 为 `u`；不再限定标识符样字符，call sugar `a'X'` 的参数也纳入（改写为 `a(u)`）
- **字符串公共前缀因子** — 多串共享公共前缀时，迭代提取收益最大的公共前缀作因子（`'ACTION_SHOOT_UP'` 系列 → `a='ACTION_SHOOT_'` + `a..'UP'`）；支持**多级嵌套**：`'DATABASE_TABLE_X_COLUMN_NAME_1'` → `a..b..'NAME_1'`（`a='DATABASE_TABLE_'`、`b='X_COLUMN_'`），每级带盈亏闸门，不赚则跳过
- **块包装** — 重复出现的【语句块】（1~N 条顶层语句）打包成薄函数：`func(AAA,var1,BB,CCC()) DD() EE() var2()` ×N → `local function f(p1,p2)<块(p1,p2)>end` + `f(v1,v2)`。**固定点按文本一致判定、可位于任意位置**（如 `AAA`/`BB`/`CCC` 穿插在变化实参之间），**变化点（标识符/字面量）作形参**；按 shape 序列哈希找出**任意位置（不必连续相邻）**的重复块，多个候选按收益降序贪心取语句不重叠的一组。**texts 序列相同的多个变化点位置合并为同一形参**（同一实参在块里出现多次不重复计参），`canonical` 的「块包装内联」允许形参**多次出现**，但对出现多次的形参在调用点做**实参纯度守卫**（无调用/vararg 才内联，否则一次求值变多次会改语义）；仅收集顶层语句，避免跨作用域捕获嵌套局部；幂等
- **`local` 合并** — 相邻 `local A=x local B=y` → `local A,B=x,y`，省 `local ` 关键字；声明上提后额外一轮将别名头与紧邻 body local 合并（阶段 1.7c）
- **local function 合并** — 统一识别 `local function f()…end` 与 `local f=function()…end` 两种等价形态，按语义与长度选最短：函数体不引用被并变量时直接合并 `local a,f=1,function()…end`；**引用被并变量时**（如 `f` 读 `a`）退化为「先声明、后赋值」`local a,f=1 f=function()…end`（Lua 里 `local a,f=1,function()return a end` 的闭包读到的是外层 `a`=nil，语义会变；先声明后赋值则正确捕获新 `a`）。无前条 local 可并时保持原形态不强行拆成 `local f f=function()`（那样反而多出变量名与逗号）
- **多重赋值拆分** — 非 local 多重赋值安全条件下拆为单赋值序列；编码层每个非末值符号收尾兑现 1 字节省
- **if-not 二择** — `if not C then A else B end` → `if C then B else A end`，省 `not`（约 4 字）；`canonical` 内置归一验证
- **变量复用** — 活跃区间不交的局部共享名字，后者 `local` 降级为赋值；支持循环体内复用丢弃变量（如 `for _,k in pairs(..)` 的 `_`）；SSA 等价校验
- **声明上提** — 顶层局部上提到别名头作前向 nil 占位 + 原 `local` 降级为赋值；`canonical` 死前向声明归一验证。**值粒度部分上提（mixed 路径）**：对 `local g,h,i=V0,a.M1,a.M2` 这类混合声明按值分类——不引用头部/同语句声明变量、形态为纯访问链/字面量（不含拼接/调用/函数）的值（V0）直接并入头部值列表（`local a,g,...=X,V0`），仅引用头部变量的值对应的变量（h,i）前向 nil 占位、原地降级为赋值补齐（`h,i=a.M1,a.M2`）。与 foldFwdNilInline（下沉）收敛不打架：占位 RHS 必引用头部/同语句 binding（refsAnyBinding 拒绝沉回），inline 值非 nil 占位不参与下沉。mixed 语句限制：变量数 ≤4 且与头部（传递）相邻（inline 固定收益只是省一个 `local `，大语句对头部值列表结构扰动大、易干扰后续字符串/成员因子分解）。full（含 mixed）/legacy（纯占位旧行为）双候选分别过三重验证取更短者，保证不退旧收益
- **前向 nil 内联（声明下沉）** — 声明上提的逆变换：`local a,f,g=X f,g=Y,Z`（f,g 为 nil 占位）按位并回 `local a,f,g=X,Y,Z`；支持多目标赋值整体下沉（全部目标均为同条 local 的 nil 占位、赋值前不被读写、RHS 不引用同条 local 变量时整条并入），省 ` f,g=`；canonical fwdNil 归一验证
- **重复声明删除（禁用）** — 文本相同不能证明求值时机和副作用相同；安全模式保留重复 `local` 声明

**编码优化**（阶段 1.8~1.10）：
- **去注释** — 在所有重命名完成后删除全部注释
- **间隔符最小化 + 单行化** — 遵循真·Lua 5.3 词法，符号收尾处贴紧（`)then`/`}local`），数字/关键字边界保留空格（`168 do`/`1 and`）

### 关键实现细节

**词法与改写策略**：
- 间隔符最小化遵循真·Lua 5.3 词法：数字紧贴字母强制保留空格（`168 do`/`1 and`），符号收尾处贴紧（`)then`/`}local`）
- **绝不从 AST 反向生成代码**：luaparse 0.3.1 不保留括号，反生成会破坏多返回值截断/优先级语义。所有改写在**原始 token/字符区间**上做，AST 仅用于作用域分析与等价校验
- 重命名只动局部变量，短名分配回避所有被引用的全局名，杜绝"局部改成全局名导致捕获"
- 冒号方法的隐式 `self` 视作 pinned 局部：显式登记不可重命名的 `self` 绑定，防止被折叠到模块顶层或改名
- **多值展开语义（explist）不进 AST**：只有末位表达式展开、括号把调用/变参截断为单值——两侧 AST 可能完全相同，canonical 终审看不见。凡合并/下沉/删槽位重建 local 语句，必须按「末位 init 是否可展开」判定槽位语义（`hoist.isNilPlaceholderSlot`）并保留承载截断的括号（`hoist.initSourceText`）；名字级别名证据（取值/复活）只在顶层同名绑定唯一时使用，同名遮蔽一律走 binding 级路径

### 验证机制（每阶段三重保障）

1. **真·Lua 5.3 语法校验** — 用 fengari `load()`，与游戏内解释器一致，抓住畸形数字等边界 case
2. **luaparse 复核** — 再建一次 AST，确认可解析
3. **AST 语义等价（SSA 版本化归一）** — "局部变量被赋值后视作新逻辑变量"做 alpha 归一深比较，使变量复用、透明别名消解、死前向声明消除等优化可严格验证。归一覆盖：
   - `obj.F` ≡ `obj["F"]`、`obj:M()` ≡ `obj[m](obj)`、`obj:m'X'` ≡ `obj:m('X')`
   - `local a,b=...` ≡ 连续 `local`、`local function f` ≡ `local f=function`、`'X'` ≡ `"X"`
   - `obj[U..'X']` ≡ `obj.<P+X>`（因子还原）、`obj[u]` ≡ `obj.X`（字符串别名还原）
   - 别名局部赋值丢弃：派生因子 `V=U..'seg'`（别名局部被拼接赋值）与独立 `V='P+seg'` 同标准形
   - 块包装内联：`f(a1..aV)` ≡ 把形参替换为实参后的包装体语句块（`local function f(p1..pV)<块>end` 被识别为薄块包装后语句级内联展开、删除声明）
   - 安全多重赋值 ≡ 单赋值序列
   - **透明别名读 ≡ 源全局读**（copy-propagation 标准形，并删除别名声明）
   - **死前向声明消除**（`local v=nil ...(不读v)... v=e` ≡ `... local v=e`）
   - SSA id 按首次出现顺序重编号（alpha-归一标准形）
4. **优雅回退** — 任一阶段校验失败自动回退，绝不输出未验证代码

每步验证结果记录在 `report.steps`，构造过程记录在 `report.build`。

### 测试套件

**运行测试**：
```bash
npm test                            # v2 全量门禁：tests2/run.js = unit + corpus + regression
npm run test:snapshot               # v2 自身基线回归：tests2/snapshot_v2.js --check（变长/拒压即失败）
npm run test:baseline               # 重录 v2 基线（tests2/_baseline_v2.json；仅在明确接受时执行）
node tests2/unit/ir_invariants.js   # IR 不变量（INV-1/2/3）+ canonicalKey 全集校验
node tests2/unit/lens_roundtrip.js  # 透镜 extract/inject roundtrip 自证
node tests2/unit/schedule_topo.js   # 调度器 DAG 拓扑/互斥/不动点
node tests2/unit/search_inverse.js  # beam 搜索 inject 逆步真实触发
node tests2/unit/search_idempotency.js  # 搜索产物幂等固定点
node tests2/regression/basics.js    # 基础回归：作用域/遮蔽/全局保护/拒绝边界
node tests2/regression/idempotency.js   # 幂等：压缩结果再压必须不变 + 等价
node tests2/regression/declhoist.js     # 声明上提/前向 nil 回归
node tests2/regression/method_inject.js # 方法/成员注入形态 + 安全负例
node tests2/corpus/diff.js          # 固定语料：成功性 + canonical 等价 + 二次压缩不变长
node tests2/corpus/search_compare.js    # 固定语料：搜索结果不得劣于纯规则结果
node tests2/corpus/snapshot_compare.js  # v2 对 v1 历史快照逐条比对（SNAPSHOT_FULL=1 含 bulk）
node tests2/corpus/perf.js          # 确定性性能探针：top-5 大段的输出/parse 对录制基线
```

**基线与参照物**：
- `tests2/_snapshot.json` — **v1 历史基线**。unit/remote/bulk 项继续供 `snapshot_compare` 使用；既有 `repo-seg:` 项仅保留为历史数据，运行时永久忽略。
- `tests2/_baseline_v2.json` — v2 自身基线。默认只检查 unit；设置 `SNAPSHOT_FULL=1` 时再检查 tests2 下的 remote/bulk；既有 `repo-seg:` 项永久忽略。

**语料测试口径**：压缩器测试只能读取 `compressor/tests2/` 内的输入。固定语言形态位于 `tests2/fixtures/corpus.js`，专项缺陷最小化后放入 `tests2/regression/`；可选 remote/bulk 数据也只能位于 `tests2/` 下。禁止扫描或读取项目根目录 `lua/`，禁止通过 `GenerateHtml.py` 或导出脚本把业务代码动态转成测试语料。这样业务内容增删、模板展开和文件改名都不会改变压缩器测试数量、耗时或基线。

**注**：测试结果默认只输出到控制台；`.remote-cache/` 与 `_bulk_test_repos/` 是 tests2 下的可选本地测试数据，不入库。

### 已知边界

**设计原则**：只做"可机器证明等价"的技巧，全部带"只缩短才提交"实测闸门。

**具体限制**：
- **声明上提** — 仅顶层块内、别名头之后、不在循环体的局部；死前向声明归一验证。纯占位路径要求未被闭包捕获（成员链别名例外）；值粒度部分上提（mixed）额外要求：语句变量数 ≤4、与头部相邻、inline 值为纯访问链/字面量且引用隔离，被闭包捕获的占位变量由 canonical fwdNil 归一严格验证。不做**索引/调用表达式冗余存储消除**（如重复 `A=a[c]`），因重新求值可能触发 `__index` 副作用
- **透明别名消解** — 仅"只读、从不被赋值、init 溯源到全局"的局部；同名 binding 全部满足 + 单声明单别名才消解。`canonical` copy-propagation 双侧归一验证
- **变量复用** — 仅 SSA 版本化等价能确认时应用；循环体内可复用丢弃变量（如 `for _,k in pairs(..)` 的 `_`，其活跃区间在循环头结束）；跨复杂控制流保守判负则回退
- **多重赋值拆分** — 仅非 local 多重赋值；目标含索引/成员或目标耦合（`a,b=b,a`）时跳过
- **全局/成员折叠** — 仅从不被赋值的全局 / base 为简单标识符的方法调用；成员字段折叠（`obj.Field`→`obj[v]`）的 base 可为任意表达式，是否折叠由「只缩短才提交」实测闸门决定
- **字段前缀/字面量内联** — 跳过 `function obj.PREFIX_X()` 名字链（语法必须保持 `name(.name)*(:name)?` 形态）
- **字符串处理** — 长字符串 `[[...]]` 内部换行保留（语义内容）；长短字符串内容不归一（转义规则不同）
- **人工技巧** — 第二部分的跨段提全局、命名空间表等依赖语义判断，自动化易误伤，仅作参考

---

# 第二部分　以撒代码压缩技巧深度剖析

> 面向 `l <代码>` 控制台命令与 main.lua 构建的 Lua 代码压缩。剖析技巧用法、取舍、变种、联动，给出可计算成本模型。

## 0. 背景与目标函数

**执行方式决定一切约束。** 玩家把每段开头带 `l ` 的整行粘进游戏控制台。`l` 是控制台命令 `lua` 的简写：控制台默认不把输入当 Lua，必须以 `l`/`lua` 开头才会执行其后的内容。所以：

- **一行 = 一条 `l <整段Lua>` 命令，控制台一次只执行一行** → 这是"一个功能必须压成单物理行"的根本原因。
- `l ` 这 2 个字符是每段无法省的固定开销。
- 打包成 `main.lua` 时由游戏直接加载、不过控制台，`clean_code()` 把行首 `l ` 剥掉。

**目标函数**：最小化「`l ` 之后、到行尾」的**总字符数**——注意，这**包含变量命名与声明部分**。任何"别名/抽取"技巧都必须把**定义代价**算进总账。

**约束次序**：① 字符数最少（主）；② 不崩（次，靠 pcall 包装 + 匿名回调清理）；③ 可读性基本不在目标内。

**作用域特性**：每个编号段是独立片段，段间不共享 `local`。所有复用只能在单段内发生。

> **核心审阅原则**：用一个技巧前，先算「定义代价 + 每次使用代价 × 次数」与「不用技巧的原始代价」对比。省不下来就是**反向压缩**。下文凡涉及别名/抽取都给出盈亏平衡点。

## 第一节：间隔符号最小化（最基础、最易误解）

Lua 词法规则：**两个 token 之间，只有当「都是 名字/关键字/数字」类、直接相邻会被误读为一个 token 时，才必须加空格**；只要有一侧是符号（`( ) [ ] + - * / % < > = ~ , .` 等），符号本身就是分隔符。

### 1.1 括号与空格等价，不存在"多余括号"

```lua
if(A)then   -- i f ( A ) t h e n = 9 字
if A then   -- i f _ A _ t h e n = 9 字
```

两者**完全等长**：`(` `)` 各占 1 字，恰好替换了 `if`后、`then`前那两个**本来就省不掉**的空格。真正要做的是：**在符号已充当分隔符的地方，绝不再加空格**。

```lua
if a and b()then   -- 正确：b() 的 ) 充当分隔符，)then 无空格
-- 错误：if a and b() then（) then 多空格）/ if(a and b())then（多包一层 +2 字）
```

**所以「删多余括号」也要算账**：条件位这类**纯分组**括号删掉后省下的括号恰好被必需空格吃掉（`if(a)then` ≡ `if a then`，同为 9 字），压缩器对等长候选不提交。真正有净收益的是**删掉后不改变分组的括号**：

```lua
(a*b)+c   → a*b+c        (a+b)+c → a+b+c      a..(b..c) → a..b..c
a^(b^c)   → a^b^c        2^(-1)  → 2^-1       ((x))     → x
```

反过来，**承载分组**的括号必须留（`(a+b)*c`、`a+(b+c)`、`(a..b)..c`、`not(a and b)`）；**承载多值截断**的括号更必须留——`(f())` 在末位展开位上是「只取第一个返回值」，删掉就变成「展开全部返回值」（`print((f()))` vs `print(f())`），而两者 AST 完全相同，只能靠显式判定守住。

### 1.2 比较式重排，让"符号收尾"的操作数贴关键字（省空格）

`0then` 会被当"畸形数字"、`athen` 会被当一个标识符，所以 `0 then`、`a then` 的空格省不掉。但让 `)`/`]` 收尾的操作数贴 `then` 就能省。利用比较可交换、可翻转方向：

```lua
-- 原 if 5%s()>0 then (15) → 改 if 0<5%s()then (14)  省1
-- 原 if b()==a then (14)  → 改 if a==b()then (13)    省1
```

规律：把以 `)`/`]`/引号结尾的操作数放在靠近后续关键字一侧；以名字/数字结尾的放远侧；需要时翻转 `<`/`>`、交换 `==`/`~=` 两侧。

### 1.3 多值赋值的"尾值符号收尾"

末值以符号结尾，则它与下一条语句的关键字/名字之间不用空格：

```lua
f,s,g=1,'Challenge',Game()   -- 末值 Game() 以 ) 收尾 → ...Game()c=g[s] 无需空格
```

做多值赋值时主动把"以 `)`/`]`/`'...'`结尾"的值排到最后（如 `S[a],F(),'sst'`），再省一个空格。

### 1.4 能省的调用括号一律省

```lua
require'debug'   RegisterMod'x'   pairs{a,b}   SoundEffect['SOUND_'..v]
```

## 第二节：变量折叠（别名）的成本核算

### 2.1 折叠盈亏平衡——引用 < 2 次绝不折叠

总长度含声明，给只用一次的东西起别名一定只增不减。

- 函数别名（`G=Game`，约 +6 字定义；`Game()`=6 字、`G()`=3 字）：`6+3k < 6k → k≥3` 才划算。
- 别名"调用结果"（`local G=Game()` 复用对象）：盈亏点降到 **k≥2**。

按回调数 N 的临界写法：

| 回调数 N | 写法 | 总字数 |
|---|---|---|
| N=1 | 直接 `Isaac.AddCallback({},...)` | 35 |
| 1<N≤4 | `local A,M=Isaac.AddCallback,ModCallbacks` | 41+8N |
| 4≤N≤10 | 再共享一张表 `local A,M,T={}` | 45+7N |
| N≥10 | 包成函数 `local M,A=...function(...)Isaac.AddCallback({},...)end` | 65+5N |

### 2.2 方法名抽公共字符串的"动态核算"（最易反向压缩）

`x:Name()` 变成 `x[s](x)` / `x['Get'..B](x)`。设方法名长 `m`、调用 `k` 次、别名单字母：

```
直接 x:Name()  = k(m+4)
抽取 x[s](x)   = (m+5)+7k
抽取-直接 = m+5 + k(3-m)
```

令其 <0：`m=4`（`Kill`）需 k≥10（几乎不可能，纯亏）；`m=9`（`GetSprite`）需 k≥3；`m≥14` 需 k≥2。**短名抽取必亏。**

两个"必抽"场景（为逻辑而非省字）：① 方法名需动态拼接（`p['Get'..B]` 跨 Get/Add/Has/Remove 共享，声明成本摊薄）；② 同名方法在不同对象/分支间切换。

### 2.3 折叠位置（在哪个作用域声明）

- 多作用域都用 → 在共同(外层)作用域声明一次。
- 单作用域用 → 通常也并进外层那条批量 local（搭顺风车不额外花 `local`）。
- 单字母用尽时 → 才把单作用域变量放回它自己的作用域。
- 始终优先想办法省掉 `local`（最典型：在参数列表里声明，见 3.2）。

## 第三节：声明与赋值技巧

### 3.1 前向声明（占位 + 延迟赋值）实现互递归

```lua
local D,E,F,...,A,B,C=require'debug',{},'Function',...        -- 第一批：登记
_CBH,A,B,C=Y,D.getlocal,...,function(i)...end,function(f)...end -- 第二批：填真值并互引
```

让闭包把同级局部当 upvalue 捕获、实现互相引用。这是满屏"值的数量不够被赋 nil"警告的来源——**故意为之**。

#### 3.1a 因子声明能否前向合一？字符级精算

考虑这种结构（来自仿射因子分解）：
```lua
local az='ROOMSHAPE_' local f,...,D,...,O=RoomShape,...,az..'1x1',...,az..'LBR'
```

直觉上想合一成一条 local 用前向声明节省一个 `local ` 关键字：
```lua
local f,...,az,D,...,O=RoomShape,...,'ROOMSHAPE_'   -- D~O 自动 nil
D=az..'1x1' E=az..'IH' ... O=az..'LBR'
```

但实测发现这反而**变长**。设因子被派生引用 K 次、单字母派生名长度为 1，字符级差账：

- 省去独立 `local az='F' `：约 |F|+11 字
- `,az` 进 names + `,'F'` 进 values：|F|+5 字
- 删除 K 处 `,az..'X'`，加 K 条独立赋值 `D=az..'X' `（含段间分隔）：每处净增约 2 字

**B − A = 2K − 6**

| K | B − A | 结论 |
|---|---|---|
| 1 | −4 | 合一更短 4 字 |
| 2 | −2 | 合一更短 2 字 |
| 3 | 0 | 打平 |
| 4 | +2 | 独立更短 2 字 |
| 12 | +18 | 独立更短 18 字 |

**临界点 K=3**。但 `buildDeclParts` 的因子分解门槛本就要求多次重复才有正收益（典型 K≥4），所以**因子分解能触发的场景，独立 local 几乎总是最优**。前向合一仅在 K=1 或 K=2 时省字，而那种数量通常根本不会触发因子提取——两个机制覆盖的区间几乎不交叠。

3.1 真正的用武之地是**结构上必须**前向声明的场景（互递归、闭包 upvalue 共捕获），不是为了省 `local ` 关键字。

### 3.2 在参数列表里声明（省 local）

```lua
function(s,p,g,c,f)f,s,g=1,'Challenge',Game()...  -- 5 个形参里只有 p 是真参，其余全是免费局部
```

代价：形参语义被破坏，但在"一段一抛"里可接受。是省 `local` 的主力。

### 3.3 多值赋值赋 nil（省字 / 复位）

```lua
local a,b,c=1,2   -- c 自动 nil
a,b=nil           -- b 复位，比 a,b=nil,nil 短
```

### 3.4 字符串常量化成员名 + 词根二次派生

```lua
B='Collectible'  p['Get'..B](p,i)  p['Add'..B](...)  C[B..'s'](C)
P='Position'     O=P..'Offset'     e[P]  e[O]
```

### 3.5 布尔 / 哨兵常量别名

```lua
Y=true ... return Y      -- true(4)→Y(1)，≥2 次回本
local N ... b=N          -- N 始终 nil 当 false 哨兵（仅纯布尔判定，勿取长度/索引）
```

## 第四节：控制流与表达式技巧

### 4.1 `if not` 二择 → 去 not + 交换分支体

```lua
-- 原 if not c then A else B end → 改 if c then B else A end  省 not(4字含空格)
```

单分支 `if not f then return end` 不能套（无 else）。

> 此技巧已纳入自动压缩器（阶段 1.6b），见第一部分。

### 4.2 `pairs` 优先于 `ipairs`（效果无关时）

顺序无关时用 `pairs`(5) 省 1 字。

### 4.3 `and`/`or` 三元 + `table.unpack` 归一

```lua
c,n=table.unpack(type(i)=='table'and i or{i,1})   -- {id} 与 {id,n} 统一解包；a 不能为 false/nil
```

### 4.4 位运算 / 取模替代多重比较

```lua
~4&c   0<f&(D.A|D.B)   e[I]%#C+1   i|G==s|G
```

科学计数法省字：`9e9`/`1e3`/`1e-3`/`1<<37`。

## 第五节：变量复用（单段内）

| 技巧 | 写法 | 要点 |
|---|---|---|
| 形参当 scratch | `function(a,p,b)b='Parent'a=p[b]...p[b]=a` | 省 local |
| 一名多义 | `function(p,f,v,s)...p,f=Game():GetItemPool()` | 前一用途须已结束 |
| 字符串双义 | `P='Position' O=P..'Offset'` | 既取值又当词根 |
| 方法名变量化 | `Re='Remove' e[Re](e)` | 仅当复用≥2 次且过 2.2 核算 |
| 多重赋值交换 | `N[i],N[p]=N[p],N[i]`；`G,E,O=c,r,..(r-E)` | 免临时变量；右侧先求值 |
| `_` 多场景 | `function(_,p)`；`for _=1,n do`；`_,i=A(3,i)` | 同名承担所有"不关心" |
| 句柄表合一 | `T={M={}}` 同时当 mod 句柄 + 数据表 `T[hash]` | 键空间不冲突即安全 |

## 第六节：命名空间表（绕过局部上限 + 闭包只捕获一个 upvalue）

```lua
local D={B={},D={},T={},R=F,C=F,G=F,M={},W={}}   -- 状态全挂字段
```

三重收益：① 绕过局部变量/upvalue 数量上限；② 多闭包只捕获 `D` 一个 upvalue；③ 整表快照一行搞定（`D.B=C(D.T)` 深拷贝）。代价：`D.R` 比裸局部多 2 字。"多状态 + 多闭包"专用，单状态反亏。

## 第七节：健壮性"重型"基础设施

- **安全包装**：`debug.sethook` 拦截 `AddCallback`，把每个回调包进 `pcall`；`O`(原→包装)、`W`(包装→原) 两表互查防重复包装；`if not(REPENTOGON or _CBH)` 在 Repentogon 环境跳过。
- **清理匿名回调**（`CLM()`）：删掉无 `Mod.Name` 的匿名注册，防反复粘贴污染。
- **数据持久化**：命名空间表 + 深拷贝快照，兼容发光沙漏/rewind。

## 第八节：速查决策表 + 审阅口诀

| 想做 | 用技巧 | 回本/适用条件 |
|---|---|---|
| 消除空格 | 1.1/1.2/1.3 间隔符最小化 | 总是；比较式重排让 `)`收尾贴关键字 |
| 省调用括号 | 1.4 | 单字符串/表实参 |
| 对象/枚举别名 | 2.1 | 函数别名 k≥3；结果别名 k≥2 |
| 方法名抽字符串 | 2.2 | `m+5+k(3-m)<0`；或动态拼名必抽 |
| 省 local | 3.2 参数列表声明 | 总是优先 |
| 互递归闭包 | 3.1 前向声明 | 需互引时必用 |
| 廉价 nil | 3.3 多值赋值 | 复位/前向声明 |
| 多状态+多闭包 | 6 命名空间表 | 状态≥4 或 闭包≥3 |
| 二择分支 | 4.1 去 not 换体 | 有 else 时 |
| 遍历 | 4.2 pairs | 顺序无关 |

**通用口诀**：
1. 每个空格都问"能不能靠符号收尾消掉"（重排比较式、调整赋值尾值）。
2. 每个别名都问"它被用了几次、省的够不够付声明"——`l` 后含命名总长，少于盈亏点就是反向压缩。
3. 每个方法名变量都跑 `m+5+k(3-m)<0`，短名少调一律不抽。

## 附录：linter 报错的统一解释（均不影响游戏内运行）

- `该表达式不能作为语句`：行首 `l ` 是控制台 `lua` 命令前缀，非合法 Lua 语法；打包时 `clean_code()` 剥掉。
- `由于值的数量不够被赋值为 nil`：前向声明/多值赋值故意为之。
- `未定义的全局变量 Isaac/Game/...`：游戏运行时注入的全局，静态分析看不到。
- `重定义局部变量`：段与段独立，同名 `local` 互不影响。
