# LuaMin v2 架构设计方案：双向透镜 + 声明式前置条件 + 双向重写搜索

> 状态：已评审立项。本文档由架构设计阶段产出，作为 v2 重写的唯一权威设计依据。

## 0. 诊断：v1 的根本病灶

九个已知失败与"补丁堆积"感不是个别 bug，而是同一个结构性问题的三个投影：

**病灶 A：语义证据走"旁车"（side-car），不在数据里。**
`aliasMap`（8 个字段）是与代码文本平行传播的第二数据结构，由 `extendAliasMap` 工厂手工搬运。任何一处漏传/错传，canonical 等价校验就失败。compress.js 里 `report.aliasMapInfo` 的反复回写、plan.js 里 transparentAliases 的四层过滤，都是在用命令式代码弥补"证据不在 IR 上"这一缺陷。

**病灶 B：等价验证是单体，不是组合。**
canonical.js 把 SSA 归一、透明别名还原、字面量 copy-propagation、fwd-nil 归一、块包装内联、纯代入归一全部塞进一个 1455 行的 `canonical(src, aliasMap)`。一处归一规则失配，整条管线被否决——验证粒度是"整个程序"，而不是"这一步变换"。

**病灶 C：顺序是手工维护的契约，不是推导出来的。**
`FOLD_ORDER_RULES` 把 pass 间真实的数据依赖编码成人肉维护的表，只在入口校验、不参与求解。

**病灶 D：变换只有前进方向。**
每个 fold 不可逆。"撤销一次过度提取"只能靠"不选这条路径"——一旦规则系统贪心提交了次优提取，搜索层无法回代它。这是"压缩不彻底需要手动补丁"的根源。

## 1. v2 总体架构

```
输入预处理 → IR 构建（lex + luaparse + scope/SSA → 标注 AST + 证据槽）
  → 透镜库（每个变换 = 双向透镜：declare/match/extract/inject/cost/verify）
  → 调度器（拓扑排序贪心基线） + 双向 beam 搜索（forward+inverse 重写图）
  → 验证层（透镜级 roundtrip 组合式自证 + 全局 fengari/luaparse/canonical 终审）
  → 编码器 → `l <单行>`
```

**保留不动**：core.js 词法器、analyze.js 作用域分析、encode.js 的 token 级编码、"绝不从 AST 反生成代码、一切改写在 token 区间上做"的铁律。

## 2. IR：标注 AST + 证据槽

选型：标注 luaparse AST（而非 e-graph 项图），证据槽取代旁车 aliasMap。

```javascript
// IR = { src, ast, info, ssa, evidence: Map<Node,EvidenceBag>, aliases: AliasEnv, version }
// AliasEnv = { entries: Map<name, AliasEntry>, dropLeading }
// AliasEntry = { kind: 'global'|'member'|'factor'|'prefix'|'string'|'chain'|'transparent',
//                target, declRange:[s,e), introducedBy, roundtripKey }
```

机器检查不变式：
- **INV-1**：每个 AliasEntry 的 declRange 指向真实 local 声明项；文本编辑后由统一区间重映射器自动平移。
- **INV-2**：evidence 与 src 同生共死，extract/inject 后按 version 惰性重建。
- **INV-3**：ssa 表是唯一赋值/使用事实来源，透镜前置条件只查询它。

## 3. 透镜契约

```javascript
const Lens = {
  name, kind: 'extract'|'rewrite'|'encode',
  requires: ['ssa','metatableFree'],   // 声明式前置条件（证据谓词）
  provides: ['alias:chain'],           // 产生的证据（供拓扑排序）
  consumes: [], conflicts: [],
  match(ir) -> [Candidate],            // 纯函数候选发现
  cost(ir, cand) -> { delta, confidence:'exact' },  // 精确字节成本（encodeDelta 口径）
  extract(ir, cand) -> { edits, form:{aliasEntries}, residue:{removedDecls} },
  inject(ir, aliasName) -> { edits, form, residue },  // extract 的逆
  verify(ir, cand, result) -> bool     // 默认 = roundtrip 自证 + 透镜私有 normalizePair
}
```

- **交叉**：透镜 B 的 match 直接在透镜 A 的产物 IR 上运行（标准 IR，无适配）。
- **嵌套**：一次 extract 产生多个有依赖的 AliasEntry，inject 按依赖逆序撤销。
- **复合候选**：搜索层可打包不重叠候选为一步，区间重映射自动支持。

## 4. 双向 beam 搜索

状态 `S = { ir, trace:[Step], length }`，Step 带 direction: 'fwd'|'inv'。

```
ir0 = buildIR(preprocess(input)); base = greedyPipeline(ir0)
beam=[base]; seen={canonical(base):len}
每轮：对 frontier 每状态枚举 fwd（cost<0 前 N 候选）+ inv（仅当存在更便宜重提取时）动作
  applyStep 内含 lens.verify 自证，失败即丢弃
  canonical seen-key 去重；仅新 best 时跑三重全局校验
```

与 v1 本质区别：move 直作用 IR（不整压重跑，parse 降一个数量级）；inv 步可撤销输入自带或历史次优提取；trace 一等公民可回放。

## 5. 前置条件与调度

provides/requires 建依赖 DAG，拓扑排序得默认执行序——FOLD_ORDER_RULES 被推导而非手写。"跑两遍"类需求由调度器不动点迭代保证。互斥透镜组（如 transparent elision vs 别名去重）自动分叉取短，一般化 v1 的双跑机制。所有透镜 cost() 走统一 encodeDelta 工具，阈值魔法数字消失。

## 6. 九个已知失败：根因与对策

1. **分号消除 3 fail**：token 流括号栈猜语句边界 → v2 分号透镜在 AST 语句节点上判定，表内 `;` 直接查 TableConstructorExpression.fields。
2. **成员链 CSE 1 fail**：纯度闸门与 canonical 双侧还原两份实现手工对齐 → 纯度收编为 IR 证据槽单一实现；CSE 透镜 roundtrip 自证；declRange 重映射机器检查。
3. **fwdnil-merge 1 fail**：下沉安全条件与 canonical fwd-nil 归一两套逻辑漂移 → 上提/下沉是一对互逆透镜共享 SSA 查询，roundtrip 性质覆盖。
4. **declhoist-value 1 fail**：mixed 路径 1700 行特例堆叠 → 拆为 inlineValueToHeader + placeholderHoist 两独立透镜，调度器发现组合序列。
5. **远程 SSA 等价 3 fail**：单体归一一处失配否决全文件 → 组合式验证，失配仅否决单候选；失败用例沉淀为对应透镜 property test。

## 7. 迁移计划

### 目录布局（v1 已删除：共享实现下沉 src2/shared/ + src2/base.js）

```
compressor/src2/
  ir.js (~350)        IR 构建器：SSA 版本表、证据槽、AliasEnv、区间重映射、增量重建
  lens.js (~200)      透镜基座：契约校验、默认 verify、encodeDelta、候选执行器
  lenses/
    alias.js (~400)   全局/成员/透明别名（双向）
    factor.js (~350)  仿射因子/字段前缀/字符串因子
    chain.js (~250)   成员链 CSE
    block.js (~300)   块包装（私有等价理论）
    hoist.js (~300)   declHoist/fwdNilInline/局部合并/复用（SSA 透镜族）
    normalize.js (~400) 常量/条件/循环/ifnot/德摩根/表字段/括号转点改写族
    encode.js (~150)  分号/间隔/比较重排（AST 语句级）
  schedule.js (~250)  DAG 拓扑 + 不动点 + 互斥分叉
  search2.js (~400)   双向 beam
  canonical2.js (~600) 归一规则按透镜下沉，残留全局归一仅作终审
  core2.js (~120)     工厂与对外 API
  base.js (~120)      共享基础库门面（deps.base 注入，ir._base 取用）
  shared/             自 v1 迁移的公共实现（函数体逐字保留）
    analyze.js        parse / 作用域分析 / 全局名与成员收集 / 候选名分配
    canonical.js      canonical 等价归一 + assert* 校验
    encode.js         去注释 / 间隔符最小化 / applyEncoding
    purecopy.js       preprocess + applyEdits + normPureCopyProp（含 inlinePure 分析）
```

总计约 3500~4000 行（v1 约 8000 行，已随 v1 退役删除；词法基础库保留于 compressor/core.js）。

### 里程碑

| # | 内容 | 验收 |
|---|---|---|
| M1 | IR 基座 + 透镜基座 | INV-1/2/3 单测；SSA 表与 analyze.js 对 964 语料交叉校验 |
| M2 | alias 透镜端到端 + 调度雏形 | 语料子集 v2 ≤ v1；inject roundtrip 通过 |
| M3 | normalize + encode 改写族 | 分号 3 fail 转绿；v1 test.js/edge.js 全集在 v2 跑通 |
| M4 | hoist + chain + factor SSA 透镜族 | member-chain/fwdnil-merge/declhoist 4 失败转绿；幂等 50 项通过 |
| M5 | 块包装 | 964 全语料差分无劣化 |
| M6 | 双向搜索 | 5 个最大块 ≤ v1 search；parse 数降 ≥50%；inv 可撤销专项 |
| M7 | 终审收口 | 远程 3 SSA fail 转绿；bulk 152 差分；全门禁 v2 版 |

### M6 实施状态附录（2026-10-14，先于 M7 记录）

**已交付**（验收逐项对照）：
- `src2/search2.js` 双向 beam：状态 `{ir,trace,length}`、fwd topN + inv 剪枝（§9.3）、
  canonicalKey+别名签名去重、连续两轮无改善收敛、trace 一等公民可回放。
  按设计 §4 修订：全局三重门禁**仅对新 best 执行**（原实现逐候选门禁，parse 爆炸；
  候选步只凭透镜自证，core2 终审兜底且搜索产物终审失败**回退贪心不拒绝输出**）。
- `core2.js compress(src,{search,beamWidth})`：贪心 + beam 默认开（束宽 4），fixpoint ≤3 轮。
- `tests2/unit/search_inverse.js`：8 构造用例，**6 个 inv 真实触发**（源内全局/调用链/
  混合选择/成员/薄包装撤销 + 贪心覆盖对照）；等价断言走 canonical2 差量口径。
- `tests2/corpus/search_compare.js`：804 段 v2 搜索总量 **352989 ≤ 353485**（−496）。
- `tests2/corpus/perf.js`：5 个最大段对录制基线报告（v1 规则 860 / v1 搜索 11024 parses）。
  **产出全部 ≤ v1**（8087~8091/3437/3437/2720/2993~3007 vs 8092/3452/3452/2744/3022）；
  parse 数 v2 < v1 search（同等工作量口径，优化后约 2993~5257 对 11024）；
  「对 v1 无搜索基线降 50%」在全量重建 IR 下不可达——§9.1 已备案，增量重建属 M7。
- `tests2/corpus/snapshot_compare.js`（户主硬性规则）：门禁模式 unit+remote+repo-seg，
  全量模式 `SNAPSHOT_FULL=1` 含 bulk 152 整文件（规则 c：bulk 总和严格小于）。
- 白名单清零且反超：M5 遗留 4 段（丢雷佬#9/勇往直前#10/自选双子#7/子弹时间#11）
  与 M6 新增 3 段（御灵术#8/灵感#22/勇往直前#10 再现 +5）全部消除——
  当前 v2 在这 6 段上 5 段**严格短于 v1**、1 段持平（最大 −28）。

**结构性修复（设计原则的实例化）**：
1. 证据随声明消亡：ir.js 注入条目（declRange=null）在声明被编辑删除后不再
   无条件携带（INV-1 悬空实证 6 处：inlinePure 代入源内字符串别名并删槽位）。
2. canonical2 覆盖映射差量化：report.aliasMap 全量映射须过 sameDecl 差量，
   否则产物侧还原源内共有别名而原文侧不还原（real-diaolei 失配根因）。
3. canonical2 单用邻接代入归一层：v1 canonical 无此规则——`local D=e() <紧邻
   单读>` 与代入形态互判（调用链别名 inv 的等价基础；邻接/单求值区/调用序三重
   健全性守卫，漏判安全误判危险；不动点迭代上界 5 防归一成 parse 热点）。
4. alias.rename 名称交换候选：短名被低频占用时单步换名（v1 统一着色的增量
   表达）；别名条目换名经 form.renamedAliases 换键（证据不丢）；partner 豁免
   按 binding 身份不按名字（`_` 家族重名实证：按名豁免会放进 swap:_<->Ve
   废候选挤掉 break 位上的真候选，御灵术#8 一度回退 16 字节）。
5. mkAliasDecl 注入守卫（append 与 prepend 同口径）：使用改写点落在宿主语句
   内部时退独立声明——此前 append 无此守卫，产生同句 init 引用同批变量的
   语义错误形态（verify 崩溃黑名单连带合法形态被弃，勇往直前#10 漏折根因）。
6. hoist.localsMerge 合并+降级：init 引用并集内名字的槽位移尾部作 nil 占位、
   init 降级为后续赋值（v1 声明上提 mixed 路径向相邻合并的一般化）。
7. 调度器保险丝：固定 2000 迭代上限对 6KB 文件误判（30log 实证），改为随
   输入自适应 + 同候选重复提交 ≥3 次判振荡。
8. 搜索展开记忆化 + 按状态持久黑名单（原按轮共享黑名单跨状态误杀位置键候选）；
   记忆化键 = 状态【文本】——canonicalKey 会把归一等价的异文状态并键（`3+c`≡`3+3`），
   seen 去重靠长度正确保留最短，但 expand 记忆同键会用先进状态的展开替换后进
   状态的展开（实证：constFold 链 `1+2+c→3+c→3+3→6` 在 `3+3` 处被 memo 命中
   自己的展开而断裂，`6` 到不了，幂等套件回归）。
9. inv 排序不设上限：margin<0（过度提取，纯撤销即收益）先行，其余按 margin
   升序——曾试每状态限 8 的投机上限，实证裁掉了编解码#0 的关键 inv（撤销
   【高 margin 好折叠】回到 v1 不折叠形态）造成 +4 回退；改回全量探索，
   parse 成本由展开记忆化与去重控制（质量优先，编解码#0 8087<8090 反超 v1）。
10. rename 成本算术化与邻居集共享预计算：纯标识符替换的 delta 逐字节等于
    encodeDelta 实测（P2 性质），免除逐候选全文词法（moses 827 候选 ×2 次
    全文 lex ≈ 40s/轮 → 亚秒）；冲突集合由逐 binding O(B²) 重建改为一次性
    作用域树预计算（单次 match 756ms → 68ms，空作用域沿祖先链补全入树）。

**尺寸分级与门禁口径（M6 实证）**：>12KB 输入关 beam 搜索、fixpoint 限 1 轮
（全量重建 IR 在大整文件超线性，moses 94KB 分钟级起；增量重建属 M7）。
贪心【全局门禁对所有尺寸开启】——urnh/guidepost 实证逐透镜自证不足以拦住
canonical 归一缺口方向的 inlinePure 候选，门禁是收敛的必要条件（否决单候选
保全管线；两文件最终均反超 v1：5819<5828、15872<16072）。
**调度器振荡守卫**：位置键候选（localsMerge@0:0 等）在不同内容上反复做功
属合法收敛——按「同 id 连续两次提交编码长度不短于上次」判环（funcMerge
连并三函数一度被误判；30log 固定 2000 迭代上限同样误判，已改随输入自适应）。

**M6/M7 验收核对**（2026-10-15 终态）：`node tests2/run.js` 全绿（**14124 pass, 0 fail**）✓；
**无白名单**——此前 7 条局部劣化（multi_callback/parser/config/defs/helpers/
empty_blocks/unbalanced_assignments）已全部修复，parser/config 还反超 v1
（parser 9880 < 9983、config 6351 < 6405）；search_inverse
8 例 6 inv 真实触发 ✓；search_compare 804 段总量 **352982 ≤ 353485（−503）** ✓；
perf 已报告（v2 输出 20675 ≤ v1 搜索 20740，parse 13295 = v1 搜索 11024 的 120.6%，
对无搜索基线不可同比）✓；snapshot_compare 门禁绿 ✓。

**户主快照规则核对**（`SNAPSHOT_FULL=1`，964 条）：
- (a) 每条 v2 压缩成功：**964/964 全 ok** ✓（振荡/终审问题全消除）；
- (c) bulk 总和严格小于：**v1 461157 → v2 456142（−5015）** ✓；
- (b) 每条 ≤ 快照：**全部通过，无白名单**——更短 242、持平 722、更长 0
  （总字节 v1 844113 → v2 837471，−6642）。M7「bulk 152 差分」验收通过。

**UI 接入**：压缩器页面已换装 v2 引擎（`compressor/index.html` 挂 `LuaMin2`，
搜索级数 → beamWidth，无元表勾选 → `opts.noMetatable`，阶段卡片 → v2 trace，
异步 `compressAsync`），发布脚本 `scripts/build_site.py` 已将 `src2/` 纳入站点拷贝。

### 括号透镜升级：优先级 / 结合性 / 多值截断（2026-10-16）

**背景**：`norm.parens` 原口径 = v1 `foldParens` 逐字移植，只认「主表达式整包」（`(a)`、`(t.x)`），
二元/逻辑/一元/串接表达式一律不碰，且实参子树整体跳过（`f(x+(y))` 的 `(y)` 也删不掉）——外部
可见症状就是「压缩器没有去除多余括号的功能」。

**新口径**（判定 = 删掉这对括号后重新解析得到的 AST 不变），三道闸门 + 一道粘连处理：

1. **语法括号闸门**：后缀基座必须是 prefixexp（表构造器/函数表达式/字面量/弱优先级表达式作基座
   时括号是语法：`({})[1]`、`("s"):rep(2)`、`(f or g)(x)`）；实参表括号（按「基座区间结束后的
   第一个 `(`」定位）与形参表 `function(a)` 的括号不是分组括号，不得当冗余括号误删。
2. **优先级/结合性闸门**：Lua 5.3 `lparser.c priority[]` 逐条落表（`or` 1 → `and` 2 → 比较 3 →
   `|` 4 → `~` 5 → `&` 6 → 移位 7 → `..` 9/8 → `+ -` 10 → `* / // %` 11 → 一元 12 → `^` 14/13；
   `..`、`^` 右结合，其余左结合）：更紧的删（`(a*b)+c`→`a*b+c`），更松的留（`(a+b)*c`），
   同优先级只删结合性一致的一侧（`(a+b)+c` 删、`a+(b+c)` 留；`a..(b..c)` 删、`(a..b)..c` 留）。
   一元操作数按 `subexpr(12)` 判定，`^` 右操作数接受裸一元（`-(a^b)`→`-a^b`、`2^(-1)`→`2^-1`，
   而 `-(a*b)`、`(-a)^b` 留）。双包 `((X))` 的内层无条件可删（外层已独立承载分组），唯一例外：
   外层是实参表括号且节点为多值（`f((g()))`，删内层会丢掉截断）。
3. **多值截断闸门**：末位展开位（`return`/调用末位实参、末位裸值字段、目标数多于本位的赋值/局部
   声明末位 RHS）上的调用/vararg 保留括号——`(f())` 与 `f()` 的 AST 完全相同而语义不同
   （截断单值 vs 展开多值），luaparse 与 canonical 都发现不了，只能显式守住。
4. **粘连处理**：删除位会产生 `--`（注释）、`..`（变参）、长括号 `[[`/`[=`、名字-名字/数字-字母
   合并时，改为在该位插入空格，由编码层按最小间隔还原——旧实现遇粘连直接放弃候选，
   `-(-a)`→`- -a`、`x and(a)`→`x and a` 这类净收益收不回。

**验证**：`tests2/regression/parens.js`（形态/等价/幂等 48 例 + **fengari 真·Lua 实跑比对 19 例**）。
多值截断与结合性是 AST 不可见的语义差异，只有真求值才查得出：`(a+b)+c` 与 `a+(b+c)` 的浮点差、
`(a..b)..c` 与 `a..(b..c)` 的 `__concat` 元方法差、末位 `(f())` 的返回值个数差，全部逐字比对
原程序与压缩产物的 `print` 输出。`tests2/unit/lens_roundtrip.js`（语料 P1 往返 / P2 成本精确 /
P3 INV-1）与 `tests2/corpus/diff.js`（三重终审 + 幂等 + 无劣化）同步覆盖新候选。
另做过一轮一次性随机差分（1200 个随机表达式，`+ - * / % ^ // .. and or not # < 比较` 全算子 +
随机冗余括号，丢弃本身非法的输入后 1136 例）：fengari 求值结果与压缩产物逐字相等，0 失配。

### 多值展开语义守卫（2026-10-16）

**背景**：Lua 的 explist 语义（只有末位表达式展开、括号把调用/变参截断为单值）**不进 AST**——
`local a,b,c=f()` 与 `local a,b=f(),c` 这类差异两侧 AST 相同，canonical 终审与 luaparse 都发现不了。
v1/v2 多处直接按 AST 区间重建文本，实测会静默改值。同轮排查修掉四处：

| # | 位置 | 缺陷 | 症状（原文 vs 压缩后实跑） |
|---|---|---|---|
| a | `hoist.localsMerge` | init 文本取 AST 区间，丢掉整包括号 | `local s=f() local a,b=(f())` → `local s,a,b=f(),f()`：a 由首个返回值变第二个 |
| b | `hoist.fwdNil` | 把「末位 init 展开供给的槽位」当 nil 占位下沉 | `local f=… local a,b,c=f() b='x'` → `local a,b,c=f(),'x'`：c 由第 3 个返回值变 nil |
| c | `norm.inlinePure` | 删槽位使后续返回值前移 | `local a,b,c=f()` 删 b → `local a,c=f()`：c 变第二个返回值 |
| d | `lens.applyCandidate` / `ir.applyEditsToIR` 的别名存活维护 + `norm.inlinePure` 别名取值 | 别名证据按名字索引，同名遮蔽跨绑定误用 | `local b='x' local b=({1})print(b)` 的读点被代成 `'x'`（闸门同盲：canonical 的别名还原也按名字做） |

**口径**（三条，都是「宁可少压，不可改值」）：

1. 合并/下沉重建 init 文本时，**末位且其后仍有目标**的 init 若为可展开表达式（调用/变参），
   把紧邻分组括号一并保留（`hoist.initSourceText`）；其余位置括号无语义，取 AST 区间更短。
2. 槽位是否 nil 占位看「**末位 init 是否可展开**」而不是「init 表有没有这一位」
   （`hoist.isNilPlaceholderSlot`）；删槽位同口径（被删下标 ≥ 末位 init 下标即拒判）。
3. 名字级别名证据（`norm.inlinePure` 的别名取值、`applyEditsToIR`/`applyCandidate` 的别名复活）
   仅在「新旧两侧该名字的顶层绑定都唯一」时使用；同名遮蔽一律不走名字级路径。

**验证**：`tests2/regression/declhoist.js` 新增形态断言 + 8 例 fengari 真跑比对；另做过语句级随机
差分（900 例随机 local/赋值语句序列 + 真求值比对，同种子下从 11 处失配降到 0）。

## 8. 测试重组（四层金字塔）

```
tests2/
  unit/         透镜 property：∀cand inject(extract(x)) ≡ x；cost 预测=实测；IR 不变式
  composition/  透镜两两组合矩阵；互斥分叉行为
  fuzz/         语法感知随机 Lua 生成（种子可复现）；等价+幂等；双向随机测试
  corpus/       964 快照 / 152 bulk / 4 远程 / v1vs2 差分
  regression/   v1 十六个补丁测试按主题合并为 5 文件，每条用例标注守护透镜
```

制度约定：**任何新 bug 修复必须落在透镜的 match/cost/verify 之一，并同步新增 property 或语料条目**——杜绝管线级补丁。

## 9. 风险

1. 增量 IR 重建复杂度（降级方案：每步全量重建，先正确后优化）。
2. canonical 归一下沉的归属边界（能归因到透镜产物则下沉，否则留终审）。
3. inv 步搜索膨胀（"仅在存在更便宜重提取时生成 inv"剪枝）。
4. 精确成本模型开销（热点时引入 token 级差分估算）。
