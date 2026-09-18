#!/usr/bin/env python
"""导出「构建期替换后的最终代码」逐块片段，供压缩器测试使用。

压缩测试必须针对**用户实际粘贴的最终代码**（与站点 / kb.json 同一口径），而不是仓库
文件里的原始 `l ` 行：模板引用块在源文件里根本没有代码行（代码由构建期从模板展开），
模板定义块则带 `Pn` 占位——裸占位不是合法 Lua 语句，会被「真·Lua 语法校验」拒绝。

输出 compressor/tests/_repo_segments.json（gitignore，测试运行时按需生成）：
  {"lua/challenges/1.御灵术.lua": ["<块0代码>", "<块1代码>", ...], ...}
键为仓库相对路径（与 `_snapshot.json` 的 repo-seg 键前缀一致），值为按构建器块顺序排列的
默认参数替换后代码，每块一条。
"""
import json
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, REPO_ROOT)

import GenerateHtml as G  # noqa: E402

OUT_REL = os.path.join("compressor", "tests", "_repo_segments.json")


def collect_segments():
    entries, _registry = G.build(G.LUA_DIR)
    out = {}
    for e in entries:
        rel = "lua/" + ("challenges" if e["isChallenge"] else "utils") + "/" + e["fname"]
        out[rel] = [b["final_code"] for b in e["blocks"]]
    return out


def main():
    os.chdir(REPO_ROOT)
    segs = collect_segments()
    with open(OUT_REL, "w", encoding="utf-8") as f:
        json.dump(segs, f, ensure_ascii=False, indent=1)
    total = sum(len(v) for v in segs.values())
    print(f"已导出 {len(segs)} 个文件 / {total} 段（默认参数替换后的最终代码）→ {OUT_REL}")


if __name__ == "__main__":
    main()
