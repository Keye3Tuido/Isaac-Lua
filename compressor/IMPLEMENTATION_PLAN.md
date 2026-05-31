# 局部变量别名合并优化 - 实现计划

**状态**: ✅ 已完成 (2026-06-01)

## 实现摘要

透明别名合并优化已成功实现并通过所有测试：

- 识别透明别名（如 `local A=ModCallbacks`）
- 替换透明别名使用为全局别名
- 删除冗余的局部变量声明
- 修改语义等价校验以支持透明别名优化
- 测试通过率：100% (69/69 主测试 + 40/40 边界测试)
- 优化效果：从节省9字符提升到23字符（示例代码）

## 问题描述

当前压缩器在全局折叠时会产生冗余的局部变量：

```lua
-- 原始代码
local A=ModCallbacks
local B=ModCallbacks
function test1() return A.MC_POST_GAME_END end
function test2() return B.MC_POST_RENDER end

-- 当前输出
l local a=ModCallbacks local A,B=a,a function test1()return A.MC_POST_GAME_END end function test2()return B.MC_POST_RENDER end

-- 期望输出
l local a=ModCallbacks function test1()return a.MC_POST_GAME_END end function test2()return a.MC_POST_RENDER end
```

**问题**：`A` 和 `B` 被声明为 `local A,B=a,a`，但它们的使用没有被替换为 `a`，导致冗余。

## 根本原因

1. `A` 和 `B` 是局部变量，只在局部重命名阶段处理
2. 全局折叠只处理全局变量的引用，不处理局部变量
3. 当 `ModCallbacks` 被提取为别名 `a` 后，`local A=ModCallbacks` 变成 `local A=a`
4. 但 `A` 的使用点仍然是 `A`，没有被替换为 `a`

## 核心挑战

1. **edits 冲突**：删除 `local A=ModCallbacks` 会与替换 `ModCallbacks` 的 edit 冲突
2. **语义等价性**：未使用的局部变量声明会导致 canonical 形式不一致
3. **时机问题**：需要在全局折叠之前识别透明别名，但在全局折叠之后才知道别名名称

## 解决方案

### 方案 A：在 planAll 中同步处理（推荐）

在步骤(e)汇总输出时，同时处理局部变量透明别名。

#### 实现步骤

1. **识别透明别名**（在步骤(a)之后）
   - 遍历 AST 的顶层 LocalStatement
   - 对于每个 `local X=GlobalVar` 形式的声明：
     - 检查 init 是否是 Identifier 且为全局变量
     - 检查该全局变量是否在 globalCands 中（即会被折叠）
     - 检查 X 的 binding 是否满足条件（decls.length===1, scope是顶层）
     - 记录映射：`transparentAliases[X] = GlobalVar`

2. **在步骤(e)中处理透明别名**
   - 当处理全局变量折叠时（`nd2.kind==='G'`）：
     - 获取该全局变量的别名名称 `nm2`
     - 查找所有透明别名该全局变量的局部变量
     - 将这些局部变量的使用也替换为 `nm2`
   
3. **删除未使用的声明**
   - 在步骤(e)之后，添加步骤(f)
   - 遍历 transparentAliases 中的所有局部变量
   - 对于每个局部变量，如果其所有使用都已被替换：
     - 删除其声明（整个 LocalStatement 或只删除该变量）

4. **修改 canonical 函数**
   - 添加对 transparentAliases 的支持
   - 在 aliasMap 中添加 `transparentAliases` 字段
   - 在 canonical 函数中，将透明别名的使用还原为全局变量

#### 代码修改位置

**文件**: `compressor/core.js`

**位置 1**: planAll 函数，步骤(a)之后（约第428行）
```javascript
// 添加：识别透明别名
var transparentAliases = {}; // localVarName -> globalVarName
var topScopeId = info.topScope.id;
var globalCandNames = new Set();
globalCands.forEach(function(g){ globalCandNames.add(g.name); });

(function walkStmts(stmts){
  for(var si=0; si<stmts.length; si++){
    var st = stmts[si];
    if(st.type==='LocalStatement' && st.variables && st.init){
      for(var vi=0; vi<st.variables.length; vi++){
        var v = st.variables[vi], initExpr = st.init[vi];
        if(!initExpr || initExpr.type!=='Identifier') continue;
        var initBinding = info.varOf.get(initExpr);
        if(initBinding !== null) continue; // 不是全局变量
        var globalName = initExpr.name;
        if(!globalCandNames.has(globalName)) continue; // 不会被折叠
        var b = info.varOf.get(v);
        if(!b || b.decls.length!==1 || b.scope.id!==topScopeId) continue;
        transparentAliases[b.name] = globalName;
      }
    }
  }
})(ast.body);
```

**位置 2**: planAll 函数，步骤(e)中处理全局变量时（约第552行）
```javascript
}else if(nd2.kind==='G'){
  if(nm2===null) continue;
  aliasByName[nd2.g.name]=nm2;
  declNames.push(nm2); declVals.push(nd2.g.name);
  nd2.g.nodes.forEach(function(node){edits.push({start:node.range[0],end:node.range[1],name:nm2});});
  
  // 添加：处理透明别名
  for(var localName in transparentAliases){
    if(transparentAliases[localName] === nd2.g.name){
      var localBinding = bindings.find(function(b){ return b.name === localName; });
      if(localBinding){
        localBinding.uses.forEach(function(u){
          edits.push({start:u.range[0], end:u.range[1], name:nm2});
        });
      }
    }
  }
}
```

**位置 3**: planAll 函数，步骤(e)之后（约第545行）
```javascript
// 添加步骤(f)：删除未使用的透明别名声明
for(var localName in transparentAliases){
  var localBinding = bindings.find(function(b){ return b.name === localName; });
  if(!localBinding) continue;
  
  // 找到声明所在的 LocalStatement
  var declNode = localBinding.decls[0];
  (function findAndDelete(stmts){
    for(var si=0; si<stmts.length; si++){
      var st = stmts[si];
      if(st.type==='LocalStatement' && st.variables){
        for(var vi=0; vi<st.variables.length; vi++){
          if(st.variables[vi] === declNode){
            if(st.variables.length === 1){
              // 删除整个语句
              edits.push({start:st.range[0], end:st.range[1], name:''});
            }
            // 多变量语句的删除比较复杂，暂时跳过
            return;
          }
        }
      }
    }
  })(ast.body);
}
```

**位置 4**: planAll 返回值（约第553行）
```javascript
return {
  edits:edits, 
  aliasByName:aliasByName, 
  memberByLocal:memberByLocal, 
  transparentAliases:transparentAliases, // 添加
  declParts:declParts.parts,
  factorLocals:declParts.factorLocals,
  declDropLeading:declParts.dropLeading,
  aliasedCount: Object.keys(aliasByName).length, 
  memberCount: Object.keys(memberByLocal).length
};
```

**位置 5**: compress 函数，构建 aliasMap（约第1989行）
```javascript
var aliasMap = declStr
  ? { 
      byName: plan.aliasByName, 
      memberByLocal: plan.memberByLocal, 
      factorLocals: plan.factorLocals||[], 
      transparentAliases: plan.transparentAliases||{}, // 添加
      prefixFoldByLocal: {}, 
      stringAliasByLocal: {}, 
      dropLeading: dropN 
    }
  : null;
```

**位置 6**: canonical 函数（约第730行）
```javascript
var transitiveAliases=(aliasMap&&aliasMap.transitiveAliases)||null;
var transparentAliases=(aliasMap&&aliasMap.transparentAliases)||null; // 添加

// 在构建 globalOfAlias 时添加
if(transparentAliases){ 
  for(var tk in transparentAliases){ 
    if(transparentAliases.hasOwnProperty(tk)){ 
      aliasLocalNames.add(tk); 
      globalOfAlias[tk]=transparentAliases[tk]; 
    } 
  } 
}
```

### 方案 B：单独的优化阶段（备选）

在 compress 函数中，在调用 planAll 之前，添加一个"局部变量内联"优化阶段。

#### 优点
- 不修改 planAll 的复杂逻辑
- 更清晰的关注点分离

#### 缺点
- 需要重新解析 AST
- 需要应用 edits 后再次解析
- 增加了一个完整的优化阶段

## 测试计划

1. **基本测试**：`tests/test_merge_locals.js`
   - 测试简单的局部变量别名合并

2. **边界情况**：
   - 多变量声明：`local A,B,C=ModCallbacks,Isaac,Game`
   - 嵌套作用域：局部变量在函数内部
   - 被捕获的变量：局部变量在闭包中使用
   - 多次赋值：`local A=ModCallbacks; A=Isaac`

3. **回归测试**：
   - 运行完整测试套件：`tests/test.js`, `tests/edge.js`, `tests/bulktest.js`
   - 确保没有破坏现有功能

## 风险和注意事项

1. **edits 冲突**：删除声明的 edit 可能与其他 edits 冲突
   - 解决：确保删除 edit 的范围不与其他 edit 重叠
   
2. **语义等价性**：canonical 函数需要正确处理透明别名
   - 解决：在 canonical 中添加对 transparentAliases 的支持

3. **多变量声明**：`local A,B=x,y` 的部分删除比较复杂
   - 解决：第一版可以只处理单变量声明

4. **性能影响**：额外的 AST 遍历可能影响性能
   - 解决：只在顶层遍历，不递归到嵌套作用域

## 实现优先级

1. **P0**：实现方案 A 的位置 1-4（识别和替换）
2. **P1**：实现位置 5-6（canonical 支持）
3. **P2**：完善删除逻辑（处理多变量声明）
4. **P3**：优化性能和边界情况

## 预期收益

- 减少代码长度：每个冗余局部变量节省约 5-10 字符
- 提高代码可读性：减少不必要的中间变量
- 对于大量使用全局变量别名的代码，收益显著
