# -*- coding: utf-8 -*-
"""验证 DrawImage 的矩形合并算法（Lua 版本的 Python 移植，逐行对照 minified 实现）"""
import random

def build_runs(pixels, W, H):
    """pixels: 行优先 [(r,g,b,a)...]，与 Lua 版同算法"""
    n = W * H
    rr = [p[0] for p in pixels]; gg = [p[1] for p in pixels]
    bb = [p[2] for p in pixels]; aa = [p[3] for p in pixels]
    key = [0] * n
    for k in range(n):
        a = aa[k]
        key[k] = 0 if a == 0 else ((rr[k] * 256 + gg[k]) * 256 + bb[k]) * 256 + a
    dn = [0] * n
    for x in range(W):
        run = 0
        for y in range(H - 1, -1, -1):
            k = y * W + x
            if key[k] != 0:
                run = run + 1 if (y < H - 1 and key[k] == key[k + W]) else 1
                dn[k] = run
            else:
                run = 0
                dn[k] = 0
    cov = [False] * n
    runs = []
    for y in range(H):
        for x in range(W):
            k = y * W + x
            hv = dn[k]
            if hv > 0 and not cov[k]:
                rw = 1
                while x + rw < W:
                    kk = k + rw
                    if cov[kk] or dn[kk] < hv or key[kk] != key[k]:
                        break
                    rw += 1
                for xx in range(x, x + rw):
                    for yy in range(y, y + hv):
                        cov[yy * W + xx] = True
                runs.append((x, y, rw, hv, key[k]))
    return runs, key

def unpack(key):
    al = key % 256; key //= 256
    bl = key % 256; key //= 256
    gl = key % 256
    return (key // 256, gl, bl, al)

def check(pixels, W, H, label):
    runs, key = build_runs(pixels, W, H)
    # 1) 矩形覆盖的并集必须恰好等于所有非透明像素，且无重叠
    covered = {}
    for (x, y, rw, hv, kk) in runs:
        color = unpack(kk)
        for xx in range(x, x + rw):
            for yy in range(y, y + hv):
                k = yy * W + xx
                assert k not in covered, f"{label}: overlap at {xx},{yy}"
                covered[k] = color
    for k, (r, g, b, a) in enumerate(pixels):
        if a == 0:
            assert k not in covered, f"{label}: transparent pixel rendered at {k}"
        else:
            assert covered.get(k) == (r, g, b, a), f"{label}: wrong/missing color at {k}"
    nvis = sum(1 for p in pixels if p[3] > 0)
    print(f"{label}: {W}x{H} 像素 {W*H}，非透明 {nvis}，矩形数 {len(runs)}，"
          f"渲染次数为逐像素的 {len(runs)/max(nvis,1)*100:.1f}%")
    return len(runs)

random.seed(42)
# 1. 纯色图 → 应合并为 1 个矩形
check([(10, 20, 30, 255)] * (16 * 16), 16, 16, "纯色")

# 2. 随机透明 + 少量颜色的噪声图
for W, H, ncol in [(128, 128, 8), (128, 128, 64), (64, 48, 4)]:
    px = [(random.randrange(256), random.randrange(256), random.randrange(256),
           0 if random.random() < 0.3 else 255) for _ in range(W * H)]
    for i in range(len(px)):  # 量化成少量颜色
        c = px[i]
        px[i] = ((c[0] // 32 * 32, c[1] // 32 * 32, c[2] // 32 * 32, c[3]))
    check(px, W, H, f"噪声{ncol}档量化")

# 3. 水平条纹 / 垂直条纹
px = [((255, 0, 0, 255) if (y // 4) % 2 == 0 else (0, 0, 255, 255))
      for y in range(32) for x in range(32)]
check(px, 32, 32, "水平条纹")
px = [((255, 0, 0, 255) if (x // 4) % 2 == 0 else (0, 0, 255, 255))
      for y in range(32) for x in range(32)]
check(px, 32, 32, "垂直条纹")

# 4. 全透明
check([(0, 0, 0, 0)] * 100, 10, 10, "全透明")

# 5. 单像素
check([(1, 2, 3, 255)], 1, 1, "单像素")

# 6. 像素画风格（大块同色 + 少量细节），模拟量化后实拍图
px = []
for y in range(128):
    for x in range(128):
        base = ((x // 16) * 16 % 256, (y // 16) * 16 % 256, 128, 255)
        if random.random() < 0.02:
            base = (0, 0, 0, 0)
        px.append(base)
check(px, 128, 128, "块色像素画")

print("全部通过")
