--迷你挑战甲（旧版格式 · 不一致变体：第 3 块道具号不同）

--0. 前置自定义代码。
l local X=1 print(X)

--1. 基础安全包装。
l local BASIC=true print(BASIC)

--2. 生成道具。
l local ids={3,34} Isaac.Spawn(5,100,700,Vector.Zero,Vector.Zero,nil)

--3. 使用道具。
l local ids={9} Isaac.Spawn(5,100,654,Vector.Zero,Vector.Zero,nil)

--4. 依赖演示。
l print(X+1)

--5. 块内生成道具。
l for i=1,2 do Isaac.Spawn(5,100,653,Vector.Zero,Vector.Zero,nil) end

--6. 重启。
l local who='' print(who)
