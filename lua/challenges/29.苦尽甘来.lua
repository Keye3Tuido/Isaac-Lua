--苦尽甘来
--禁用角色：堕化该隐

--[[
说明: 从道具池抽取道具时，大部分道具按照品质从低到高抽取；(1/SHUFFLE)*100%的道具会被插入到道具池底部。
名称: 道具池洗牌
参数:
  P1: {类型: 数值, 默认: 8, 性质: 全局, 说明: "全局变量SHUFFLE，道具池质量洗牌档位（默认8）"}
]]
l SHUFFLE=P1;local f,Z=Isaac f.AddCallback({},ModCallbacks.MC_PRE_GET_COLLECTIBLE,function(a,z,y,x,b,c,d,e,g,h)if not Z then b=f.GetItemConfig()a=Game():GetItemPool()d='GetCollectible'g={}h=Game():GetSeeds():GetStartSeed()for i=0,10 do e=b[d..'s'](b).Size if i<10 then repeat e=e-1 c=b[d](b,e)if c then if not g[e]then g[e]=e~h for j=1,4 do g[e]=g[e]~(g[e]<<((j<<1)+1))~(g[e]>>(((j+1)<<1)+1))end g[e]=g[e]%math.max(1,SHUFFLE)end if c.Quality>i%5 or i<5 and 1>g[e]then a:AddRoomBlacklist(e)end end until e<0 and not c end Z=true c=b[d](b,a[d](a,z,y,x))e=c.ID Z=nil a:ResetRoomBlacklist()if CollectibleType.COLLECTIBLE_BREAKFAST~=e then return e end end end end)

--[[
模板: restart-game
]]
