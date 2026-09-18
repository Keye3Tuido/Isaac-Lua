#!/usr/bin/env python
"""构建站点并组装发布目录（默认 _site/）。

三条原则：
  1) 必要资源一个不少——资源清单从构建产物自动推导，逐个校验存在性，缺任何一项立即失败；
  2) 非必要资源一个不多——只写显式入口文件与推导出的资源，源码/测试/文档不进发布目录；
  3) 构建自足——缺 pyyaml、缺压缩器 node_modules 时自动补装，便于 EdgeOne / ESA 等
     只跑单条构建命令的平台（`python3 scripts/build_site.py`）。

用法：python scripts/build_site.py [--out _site]
"""
import argparse
import glob
import os
import re
import shutil
import subprocess
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, REPO_ROOT)

import GenerateHtml as G  # noqa: E402

# 发布目录根下的固定入口文件（仓库相对路径 == 发布目录相对路径）
ENTRY_FILES = [
    "index.html",       # GenerateHtml.py 构建产物
    "kb.json",          # GenerateHtml.py 构建产物（站点内 #kb 下载入口）
    "favicon.svg",
    "CNAME",            # GitHub Pages 自定义域
    "jszip.min.js",     # page.js 运行时动态加载（失败才回退 cdnjs）
]

# 压缩器页面入口（源码直接入库）
COMPRESSOR_ENTRIES = [
    "compressor/index.html",
    "compressor/core.js",
]

# 压缩器第三方库：从 node_modules 取，不入库（发布名 → 候选源，按序取第一个存在的）
VENDOR_LIBS = [
    ("compressor/luaparse.js",
     ["compressor/node_modules/luaparse/luaparse.js"]),
    ("compressor/fengari-web.js",
     ["compressor/node_modules/fengari-web/dist/fengari-web.js"]),
]

# 扫描这些产物/源文件来推导「必要资源」清单（构建后执行，index.html 已生成）
SCAN_FILES = ["index.html", "page.js", "style.css", "compressor/index.html", "compressor/core.js"]

# 发布目录里禁止出现的文件（防止源码/依赖误入）
FORBIDDEN_SUFFIXES = (".py", ".lua", ".md", ".pyc")
FORBIDDEN_NAMES = ("package.json", "package-lock.json", ".gitignore")

_ASSET_REF_RE = re.compile(r"assets/([A-Za-z0-9._-]+)")
# 引用路径（保留 ../ 前缀，供按所在目录解析）：../assets/x、assets/x
_ASSET_PATH_RE = re.compile(r"((?:\.\./)*assets/[A-Za-z0-9._-]+)")
_LOCAL_REF_RE = re.compile(r"""(?:src|href)\s*=\s*["']([^"']+)["']|loadScript\(\s*['"]([^'"]+)['"]""")


def _rel(path):
    """仓库相对路径（跨盘符时退回绝对路径，避免 Windows 上 relpath 抛错）。"""
    try:
        return os.path.relpath(path, REPO_ROOT).replace(os.sep, "/")
    except ValueError:
        return os.path.abspath(path).replace(os.sep, "/")


def _resolve_source(rel, candidates=None):
    """取第一个存在的候选源；都不存在返回 None。"""
    for cand in (candidates or [rel]):
        if os.path.isfile(os.path.join(REPO_ROOT, cand)):
            return cand
    return None


def _copy(src_rel, dest_path):
    src = os.path.join(REPO_ROOT, src_rel)
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    shutil.copyfile(src, dest_path)
    return _rel(dest_path)


def ensure_compressor_deps():
    """压缩器第三方库缺失时用 npm 安装（构建自足，平台无需单独配置安装命令）。"""
    missing = [c for _, cands in VENDOR_LIBS if _resolve_source(None, cands) is None]
    if not missing:
        return
    print(f"压缩器依赖缺失，安装中：npm ci（compressor/，缺少 {len(missing)} 项）")
    npm = shutil.which("npm")
    if not npm:
        raise SystemExit(
            "错误：未找到 npm，无法安装压缩器依赖。请先执行 npm ci（在 compressor/ 目录），"
            "或在平台构建配置里添加该安装命令。"
        )
    try:
        subprocess.run([npm, "--prefix", "compressor", "ci"], cwd=REPO_ROOT, check=True)
    except subprocess.CalledProcessError as exc:
        raise SystemExit(f"错误：npm ci（compressor/）失败（退出码 {exc.returncode}）。")
    still = [c for _, cands in VENDOR_LIBS if _resolve_source(None, cands) is None]
    if still:
        raise SystemExit(f"错误：安装后仍缺少第三方库：{still}")


def derived_assets():
    """从产物中推导站点必需的 assets/ 资源名集合。"""
    names = set()
    for rel in SCAN_FILES + sorted(_rel(p) for p in glob.glob(os.path.join(REPO_ROOT, "compressor", "src", "*.js"))):
        path = os.path.join(REPO_ROOT, rel)
        if not os.path.isfile(path):
            continue
        with open(path, encoding="utf-8") as f:
            names |= set(_ASSET_REF_RE.findall(f.read()))
    return names


def assemble(out_dir):
    out = os.path.abspath(out_dir)
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(os.path.join(out, "assets"))
    os.makedirs(os.path.join(out, "compressor", "src"))

    written = []
    # ① 固定入口
    for rel in ENTRY_FILES:
        if not os.path.isfile(os.path.join(REPO_ROOT, rel)):
            raise SystemExit(f"错误：缺少必需入口文件 {rel}")
        written.append(_copy(rel, os.path.join(out, rel)))
    # ② 压缩器入口与源码
    for rel in COMPRESSOR_ENTRIES + sorted(_rel(p) for p in glob.glob(os.path.join(REPO_ROOT, "compressor", "src", "*.js"))):
        if not os.path.isfile(os.path.join(REPO_ROOT, rel)):
            raise SystemExit(f"错误：缺少必需文件 {rel}")
        written.append(_copy(rel, os.path.join(out, rel)))
    # ③ 第三方库（源自 node_modules）
    for dest_rel, cands in VENDOR_LIBS:
        src_rel = _resolve_source(None, cands)
        if src_rel is None:
            raise SystemExit(f"错误：缺少第三方库 {dest_rel}（候选源都不存在：{cands}）")
        written.append(_copy(src_rel, os.path.join(out, dest_rel)))
    # ④ 自动推导的资源
    assets = sorted(derived_assets())
    for name in assets:
        src_rel = f"assets/{name}"
        if not os.path.isfile(os.path.join(REPO_ROOT, src_rel)):
            raise SystemExit(f"错误：页面引用了资源 {src_rel}，但仓库中不存在")
        written.append(_copy(src_rel, os.path.join(out, "assets", name)))
    return out, assets, written


def verify(out):
    """发布目录自检：引用可解析、无源码泄漏、无多余资源。"""
    problems = []

    # ① 每个本地引用都必须能在发布目录内解析到
    for dirpath, _dirnames, filenames in os.walk(out):
        for fn in filenames:
            if not fn.endswith((".html", ".js", ".css")):
                continue
            full = os.path.join(dirpath, fn)
            with open(full, encoding="utf-8") as f:
                text = f.read()
            refs = [m.group(1) or m.group(2) for m in _LOCAL_REF_RE.finditer(text)]
            refs += _ASSET_PATH_RE.findall(text)
            for ref in refs:
                if not ref or ref.startswith(("http://", "https://", "//", "data:", "#", "mailto:")):
                    continue
                if "node_modules/" in ref:   # 页面里保留的本地兜底路径，发布目录不需要
                    continue
                target = os.path.normpath(os.path.join(os.path.dirname(full), ref.split("?")[0]))
                if not os.path.exists(target):
                    problems.append(f"{_rel(full)} 引用的 {ref} 在发布目录中不存在")

    # ② 不得混入源码/依赖/文档
    for dirpath, dirnames, filenames in os.walk(out):
        for d in list(dirnames):
            if d == "node_modules":
                problems.append(f"发布目录混入 node_modules：{_rel(os.path.join(dirpath, d))}")
        for fn in filenames:
            if fn.endswith(FORBIDDEN_SUFFIXES) or fn in FORBIDDEN_NAMES:
                problems.append(f"发布目录混入非发布文件：{_rel(os.path.join(dirpath, fn))}")

    # ③ 仓库 assets/ 中未被引用的资源（.md/.txt 视为说明文档，不计入）
    published = {os.path.relpath(os.path.join(dp, fn), out).replace(os.sep, "/")
                 for dp, _, fns in os.walk(os.path.join(out, "assets")) for fn in fns}
    assets_dir = os.path.join(REPO_ROOT, "assets")
    repo_assets = {f"assets/{fn}" for fn in os.listdir(assets_dir)
                   if os.path.isfile(os.path.join(assets_dir, fn))
                   and not fn.lower().endswith((".md", ".txt"))}
    unused = sorted(repo_assets - published)

    return problems, unused


def main():
    ap = argparse.ArgumentParser(description="构建站点并组装发布目录")
    ap.add_argument("--out", default="_site", help="发布目录（默认 _site/，已 gitignore）")
    args = ap.parse_args()

    os.chdir(REPO_ROOT)

    # 1) 构建站点（GenerateHtml.py 自带 pyyaml 自举）
    G.main()
    # 2) 压缩器依赖自足
    ensure_compressor_deps()
    # 3) 组装 + 自检
    out, assets, written = assemble(args.out)
    problems, unused = verify(out)

    print()
    print(f"发布目录：{_rel(out)}（{len(written)} 个文件，其中资源 {len(assets)} 个）")
    print("  资源：" + "、".join(assets))
    if unused:
        print(f"  提示：仓库 assets/ 中有 {len(unused)} 个未被引用的文件（未发布）：{unused}")
    if problems:
        for p in problems:
            print(f"FAIL  {p}")
        raise SystemExit(f"发布自检失败：{len(problems)} 项")

    size = sum(os.path.getsize(os.path.join(dp, fn))
               for dp, _, fns in os.walk(out) for fn in fns)
    print(f"  自检通过：引用全部可解析，无源码泄漏（{size / 1024:.1f} KB）")


if __name__ == "__main__":
    main()
