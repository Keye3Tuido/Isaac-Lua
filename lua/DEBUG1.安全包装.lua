--1. Version 1: 使用debug调试库
-- 控制台输入 lua Wrap() 启用安全包装，输入lua Unwrap() 关闭安全包装。
--包装AddPriorityCallback、RemoveCallback、RunCallback、RunCallbackWithParam和GetCallbacks，防止因回调函数报错导致回调崩溃。
--开启包装时，GetCallbacks获取的回调函数均为被包装后的函数。
--对忏悔龙Repentogon不生效。
--重复输入该代码不会产生额外影响。多次Wrap、Unwrap不会额外生效。
--使用了debug调试库，可能会影响游戏性能。
l if not(REPENTOGON or _CBH)then local D,E,F,I,J,O,P,Y,W,A,B,C,G,H,K,L,Q,R=require'debug',{},'Function',Isaac,'Callback',{},pairs,true,{}_CBH,A,B,C,G,K,Q,R=Y,D.getlocal,D.setlocal,D.sethook,I.GetCallbacks,'Run'..J,function(i)for _,m in P(G(i))do local o=m[F]if not W[o]then m[F]=O[o]or R(o)end end end,function(f)local function r(...)local s={pcall(f,...)}if s[1]then return table.unpack(s,2)end end O[f],W[r]=r,f return r end L=function(i)_,i=A(3,i)if not E[i]then E[i]=Y Q(i)end end for _,i in P(ModCallbacks)do E[i]=Y end function Wrap()if not H then for i,_ in P(E)do Q(i)end C(function()local a=D.getinfo(2,'f').func if a==I['AddPriority'..J]then _,a=A(2,4)L(2)if not W[a]then B(2,4,O[a]or R(a))end elseif a==I['Remove'..J]then _,a=A(2,3)L(2)if not W[a]then B(2,3,O[a]or a)end elseif a==I[K]or a==I[K..'WithParam']or a==G then L(1)end end,'c')H=Y end end function Unwrap()if H then C()for i,_ in P(E)do for _,m in P(G(i))do m[F]=W[m[F]]or m[F]end end O,W,H={},{}end end end


--2. Version 2: 参考steam工坊模组：Mod Error Containers
-- 控制台输入lua MEC() 启用安全包装，输入lua DEMEC() 关闭安全包装。
-- 对忏悔龙Repentogon不生效。
-- 安全包装使用pcall包装了所有回调函数，并改写了Isaac.AddPriorityCallback和Isaac.RemoveCallback指针；无法覆盖局部缓存旧指针的情况。
--2.1 源代码
if not(REPENTOGON or _MEC)then
    _MEC = true
    local MECED = false
    local function wrapper(f)
        return function(...)
            local ret=table.pack(pcall(f,...))
            if ret[1]then return table.unpack(ret,2,ret.n)end
        end
    end
    local trans , count = {} , {}
    local function add(fn)
        local tfn = trans[fn] or wrapper(fn)
        trans[tfn] = fn
        trans[fn] = tfn
        count[fn] = (count[fn]or 0) + 1
        return tfn
    end
    local rawAdd , rawRem = Isaac.AddPriorityCallback , Isaac.RemoveCallback
    local function Add(mod,cid,priority,fn,param)
        rawAdd(mod,cid,priority,add(fn),param)
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
                    cb.Function = add(cb.Function)
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
------------------------------------
---2.2 压缩代码
l local g,a,b,h,d,e,i,c=table,Isaac,pairs,ModCallbacks,'AddPriorityCallback','RemoveCallback','GetCallbacks','Function'if not(REPENTOGON or _MEC)then _MEC=true local n,t,l,j,p=false,function(f)return function(...)local k=g.pack(pcall(f,...))if k[1]then return g.unpack(k,2,k.n)end end end,{},{}p=function(f)local k=l[f]or t(f)l[k]=f l[f]=k j[f]=(j[f]or 0)+1 return k end local q,o,u=a[d],a[e]u=function(f,k,m,r,s)q(f,k,m,p(r),s)end local function w(r,s,f)if j[f]then o(r,s,l[f])j[f]=j[f]-1 if 1>j[f]then local m={}for k,v in b(j)do if k~=f then m[k]=v end end j=m m={}for k,v in b(l)do if k~=f and v~=f then m[k]=v end end l=m end else o(r,s,f)end end function MEC()if not n then a[d]=u a[e]=w for _,k in b(h)do _=a[i](k)for _,f in b(_)do f[c]=p(f[c])end end n=true end end function DEMEC()if n then a[d]=q a[e]=o for _,k in b(h)do _=a[i](k)for _,f in b(_)do f[c]=l[f[c]]or f[c]end end l={}j={}n=false end end end

--.
