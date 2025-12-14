--* 包装AddPriorityCallback和RemoveCallback，防止因回调函数报错导致游戏崩溃。
--对忏悔龙Repentogon不生效。
--控制台输入 lua Wrap() 启用安全包装，输入lua Unwrap() 关闭安全包装。
--重复输入该代码不会产生额外影响。多次Wrap、Unwrap不会额外生效。
--使用了debug调试库，可能会影响游戏性能。
l if not(REPENTOGON or CALLBACK_HOOKED)then local B,D,E,F,I,M,R,Y,A,G,S=require('debug'),{},{},'Function',Isaac,ModCallbacks,function(f)return function(...)local s,r=pcall(f,...)if s then return r end end end,true CALLBACK_HOOKED,G,S,A=Y,I.GetCallbacks,B.sethook function Wrap()if not A then for k,v in pairs(M)do for i,j in pairs(G(v))do local t,f=j[F]if not D[t]then f=R(t)D[t],E[f]=f,t end end end S(function(e)local i,a,b,p=B.getinfo(2,'f').func p=i==I.AddPriorityCallback and 4 or i==I.RemoveCallback and 3 if p then a=select(2,B.getlocal(2,p))if not D[a]then b=R(a)D[a],E[b],a=b,a,b end B.setlocal(2,p,a)end end,'c')end A=Y end function Unwrap()if A then S()for k,v in pairs(M)do for i,j in pairs(G(v))do local t=E[j[F]]if t then j[F]=t end end end D,E={},{}end A=false end end Wrap()