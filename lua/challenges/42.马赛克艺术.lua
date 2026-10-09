--马赛克艺术
--限定角色: 以撒
--禁用图鉴
--禁用道具贴图类模组
--简要说明:
--道具和饰品的贴图被替换为马赛克版本，其中的黑色像素会被掏空



--[[
模板: force-character
参数:
  P1: PlayerType.PLAYER_ISAAC
]]

--[[
模板: force-give-items
参数:
  P1: "'c402','c619'"
  P2: "道具402(混沌)和道具619(长子权)"
]]

--[[
模板: pixel-factory
名称: 像素工厂
]]

--[[
说明: 加载并处理饰品和道具贴图，生成马赛克风格的图像，存储到_ItemSprites全局表当中
名称: 贴图资源初始化
]]
l local t,a,g,b,o,p,q=ModCallbacks,Isaac,Vector,'Green','Blue','GfxFileName','Idle'local h,k,l,m,n=a.GetItemConfig,a.RemoveCallback,t.MC_POST_RENDER,t.MC_POST_UPDATE,a.AddCallback _ItemSprites=nil local A,B,C,D,T,r,s=h():GetCollectibles().Size-1,h():GetTrinkets().Size-1,{},{},{}r=function(s)s=string.format('Loading Collectibles: %d/%d, Trinkets: %d/%d',math.min(#C,A),A,math.min(#D,B),B)a.RenderText(s,a.GetScreenWidth()/2-a.GetTextWidth(s)/2,a.GetScreenHeight()/2,1,1,1,1)if#C>=A and#D>=B then k(T,l,r)end end s=function(c,d,e,f)c=h()e=Sprite()if#C<A then e:Load'gfx/005.100_collectible.anm2'for _=1,9 do f=#C+1 d=c:GetCollectible(f)C[f]={}if d then e:ReplaceSpritesheet(1,d[p])e:LoadGraphics()e:SetFrame(q,0)for i=-16,16,4 do C[f][i]={}for j=-38,-6,4 do d=e:GetTexel(g(i,j),g.Zero,1,1)C[f][i][j]=Color(d.Red,d[b],d[o],.1<d.Red+d[b]+d[o]and d.Alpha or 0)end end end end return end if#D<B then e:Load'gfx/005.350_trinket.anm2'for _=1,9 do f=#D+1 d=c:GetTrinket(f)D[f]={}if d then e:ReplaceSpritesheet(0,d[p])e:LoadGraphics()e:SetFrame(q,0)for i=-16,16,4 do D[f][i]={}for j=-23,9,4 do d=e:GetTexel(g(i,j),g.Zero,1,0)D[f][i][j]=Color(d.Red,d[b],d[o],.1<d.Red+d[b]+d[o]and d.Alpha or 0)end end end end return end _ItemSprites={Collectibles=C,Trinkets=D}k(T,m,s)a.ExecuteCommand'restart'end n(T,m,s)n(T,l,r)

--[[
说明: 道具贴图不显示，换用马赛克风格贴图
依赖: 贴图资源初始化
]]
l local f,b,a,d,e,P,Q='MC_POST_PICKUP_',Vector,ModCallbacks,PickupVariant.PICKUP_COLLECTIBLE,Isaac.AddCallback,MakePixel()P.Scale=b(4,4)Q=function(s,p)s=p:GetSprite()s:ReplaceSpritesheet(1,'gfx/items/pick ups/pickup_018_megabattery.png')s:LoadGraphics()end e({},a[f..'INIT'],Q,d)e({},a[f..'UPDATE'],Q,d)e({},a[f..'RENDER'],function(s,p,o,c)c=_ItemSprites if c then s=p.SubType if s==0 then p:Remove()return end o=o+Isaac.WorldToRenderPosition(p.Position)s=c.Collectibles[s]for i=-16,16,4 do for j=-38,-6,4 do P.Color=s[i][j]P:Render(o+b(i,j))end end end end,d)

--[[
说明: 饰品贴图不显示，换用马赛克风格贴图
依赖: 贴图资源初始化
]]
l local b,a,d,e,P=Vector,ModCallbacks,PickupVariant.PICKUP_TRINKET,Isaac.AddCallback,MakePixel()P.Scale=b(4,4)e({},a.MC_POST_PICKUP_INIT,function(s,p)s=p:GetSprite()s:ReplaceSpritesheet(0,'gfx/items/pick ups/pickup_018_megabattery.png')s:LoadGraphics()end,d)e({},a.MC_POST_PICKUP_RENDER,function(s,p,o,c)c=_ItemSprites if c then o=o+Isaac.WorldToRenderPosition(p.Position)s=c.Trinkets[p.SubType]for i=-16,16,4 do for j=-23,9,4 do P.Color=s[i][j]P:Render(o+b(i,j))end end end end,d)

--[[
模板: seed-fixed
说明: 彩蛋种子:永远致盲
参数: 
  P1: 'SeedEffect.SEED_PERMANENT_CURSE_BLIND'
]]

--[[
模板: restart-as-character
参数:
  P1: PlayerType.PLAYER_ISAAC
]]

--[[
模板: clean-globals
参数:
  P1: "'_ItemSprites'"
依赖: 贴图资源初始化
]]