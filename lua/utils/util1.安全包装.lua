--安全包装：防止因回调函数报错导致回调崩溃。共两个版本——v1 使用 debug 调试库，v2 参考 steam 工坊模组 Mod Error Containers（MEC 版）。
--当前 39 个挑战的段 0 均使用 v2（模板 safe-wrap-mec）。

--[[
作为模板: true
模板id: safe-wrap-cbh
说明: 控制台输入 lua Wrap() 启用安全包装，输入 lua Unwrap() 关闭安全包装。包装 AddPriorityCallback、RemoveCallback、RunCallback、RunCallbackWithParam 和 GetCallbacks，防止因回调函数报错导致回调崩溃。开启包装时，GetCallbacks 获取的回调函数均为被包装后的函数。对忏悔龙 Repentogon 不生效。重复输入该代码不会产生额外影响，多次 Wrap、Unwrap 不会额外生效。Version 1：使用了 debug 调试库，可能会影响游戏性能。
]]
l if not(REPENTOGON or _CBH)then local D,E,F,I,J,O,P,Y,W,A,B,C,G,H,K,L,Q,R=require'debug',{},'Function',Isaac,'Callback',{},pairs,true,{}_CBH,A,B,C,G,K,Q,R=Y,D.getlocal,D.setlocal,D.sethook,I.GetCallbacks,'Run'..J,function(i)for _,m in P(G(i))do local o=m[F]if not W[o]then m[F]=O[o]or R(o)end end end,function(f)local function r(...)local s={pcall(f,...)}if s[1]then return table.unpack(s,2)end end O[f],W[r]=r,f return r end L=function(i)_,i=A(3,i)if not E[i]then E[i]=Y Q(i)end end for _,i in P(ModCallbacks)do E[i]=Y end function Wrap()if not H then for i,_ in P(E)do Q(i)end C(function()local a=D.getinfo(2,'f').func if a==I['AddPriority'..J]then _,a=A(2,4)L(2)if not W[a]then B(2,4,O[a]or R(a))end elseif a==I['Remove'..J]then _,a=A(2,3)L(2)if not W[a]then B(2,3,O[a]or a)end elseif a==I[K]or a==I[K..'WithParam']or a==G then L(1)end end,'c')H=Y end end function Unwrap()if H then C()for i,_ in P(E)do for _,m in P(G(i))do m[F]=W[m[F]]or m[F]end end O,W,H={},{}end end end

--[[
作为模板: true
模板id: safe-wrap-mec
说明: 控制台输入 lua MEC() 启用安全包装，输入 lua DEMEC() 关闭安全包装。Version 2：参考 steam 工坊模组 Mod Error Containers。安全包装使用 pcall 包装了所有回调函数，并改写了 Isaac.AddPriorityCallback 和 Isaac.RemoveCallback 指针；无法覆盖局部缓存旧指针的情况。对忏悔龙 Repentogon 不生效。
]]
l local a,b,g,d,e,h,c=Isaac,pairs,ModCallbacks,'AddPriorityCallback','RemoveCallback','GetCallbacks','Function'if not(REPENTOGON or _MEC)then _MEC=true local m,s,j,i,o=false,function(f,l)return function(...)local k=table.pack(pcall(f,...))if k[1]then return table.unpack(k,2,k.n)end a.ConsoleOutput(string.format('Error:%s@%s\n',l and l.Name or'Anonymous',k[2]))end end,{},{}o=function(f,l)local k=j[f]or s(f,l)j[k]=f j[f]=k i[f]=(i[f]or 0)+1 return k end local p,n,t=a[d],a[e]t=function(f,k,l,q,r)p(f,k,l,o(q,f),r)end local function u(q,r,f)if i[f]then n(q,r,j[f])i[f]=i[f]-1 if 1>i[f]then local l={}for k,v in b(i)do if k~=f then l[k]=v end end i=l l={}for k,v in b(j)do if k~=f and v~=f then l[k]=v end end j=l end else n(q,r,f)end end function MEC()if not m then a[d]=t a[e]=u for _,k in b(g)do _=a[h](k)for _,f in b(_)do f[c]=o(f[c],f.Mod)end end m=true end end function DEMEC()if m then a[d]=p a[e]=n for _,k in b(g)do _=a[h](k)for _,f in b(_)do f[c]=j[f[c]]or f[c]end end j={}i={}m=false end end end

--以下为 v2（safe-wrap-mec）的可读多行源代码，已注释化，仅保留作参考。
--[[ 可读源代码（非 YAML 头）
if not(REPENTOGON or _MEC)then
    _MEC = true
    local MECED = false
    local function wrapper(f,mod)
        return function(...)
            local ret=table.pack(pcall(f,...))
            if ret[1]then return table.unpack(ret,2,ret.n)end
            Isaac.ConsoleOutput(string.format('Error:%s@%s\n',mod and mod.Name or'Anonymous',ret[2]))
        end
    end
    local trans , count = {} , {}
    local function add(fn,mod)
        local tfn = trans[fn] or wrapper(fn,mod)
        trans[tfn] = fn
        trans[fn] = tfn
        count[fn] = (count[fn]or 0) + 1
        return tfn
    end
    local rawAdd , rawRem = Isaac.AddPriorityCallback , Isaac.RemoveCallback
    local function Add(mod,cid,priority,fn,param)
        rawAdd(mod,cid,priority,add(fn,mod),param)
    end
    local function Rem(mod,cid,fn)
        if count[fn]then
            rawRem(mod,cid,trans[fn])
            count[fn] = count[fn] - 1
            if count[fn] < 1 then
                local tmptable = {}
                for k,v in pairs(count)do
                    if k~=fn then
                        tmptable[k]=v
                    end
                end
                count = tmptable
                tmptable = {}
                for k,v in pairs(trans)do
                    if k~=fn and v~=fn then
                        tmptable[k]=v
                    end
                end
                trans = tmptable
            end
        else
            rawRem(mod,cid,fn)
        end
    end
    function MEC()
        if not MECED then
            Isaac.AddPriorityCallback = Add
            Isaac.RemoveCallback = Rem
            for _,cid in pairs(ModCallbacks)do
                local cbs = Isaac.GetCallbacks(cid)
                for _,cb in pairs(cbs)do
                    cb.Function = add(cb.Function, cb.Mod)
                end
            end
            MECED = true
        end
    end
    function DEMEC()
        if MECED then
            Isaac.AddPriorityCallback = rawAdd
            Isaac.RemoveCallback = rawRem
            for _,cid in pairs(ModCallbacks)do
                local cbs = Isaac.GetCallbacks(cid)
                for _,cb in pairs(cbs)do
                    cb.Function = trans[cb.Function]or cb.Function
                end
            end
            trans = {}
            count = {}
            MECED = false
        end
    end
end
]]
