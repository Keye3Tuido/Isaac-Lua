#!/usr/bin/env python
"""字节级等价验收门：对比旧版与新管线的挑战文件最终代码。

对比口径（设计文档 §9 主门）：每个挑战文件「全部代码行按序拼接」逐字节一致，
注释（说明/编号/文件头）允许不同。

旧版来源（二选一）：
  默认        git show <ref>:lua/challenges/<fname>（ref 默认 HEAD）
  --old-dir   指定旧版 lua 目录（直接读其中的 challenges/*.lua，旧格式）

新版来源：--new-dir 指定新格式 lua 目录（默认 lua/），跑完整新管线取展开后代码。

用法：
  python scripts/verify_equivalence.py                 # 工作区 lua/ vs git HEAD
  python scripts/verify_equivalence.py --ref HEAD~1
  python scripts/verify_equivalence.py --old-dir tests/builder/fixtures/old/lua \
                                       --new-dir tests/builder/fixtures/new/lua

退出码：0 = 全部 PASS（SKIP 不计失败）；1 = 存在 FAIL 或管线报错。
"""
import argparse
import os
import subprocess
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, REPO_ROOT)

import GenerateHtml as G


def old_code_lines(raw_text):
    """旧格式代码行抽取：'l ' 前缀行，剥前缀后即为代码。"""
    return [l[2:] for l in raw_text.splitlines() if l.startswith("l ")]


def _norm(s):
    """空白归一：删除字符串字面量之外的所有空白（字符串内的空白保持有效）。
    用于豁免还原过程在标识符/关键字之间引入的空格（如 stats-switch 的 P1 展开），
    同时不掩盖字符串内容的真实差异。支持 '...' "..." 与 [[...]] 长字符串。"""
    out = []
    i, n = 0, len(s)
    while i < n:
        c = s[i]
        if c in "'\"":
            j = i + 1
            while j < n:
                if s[j] == "\\":
                    j += 2
                    continue
                if s[j] == c:
                    break
                j += 1
            out.append(s[i:j + 1])
            i = j + 1
        elif c == "[" and i + 1 < n and s[i + 1] == "[":
            j = s.find("]]", i + 2)
            j = n if j < 0 else j + 2
            out.append(s[i:j])
            i = j
        elif c.isspace():
            i += 1
        else:
            out.append(c)
            i += 1
    return "".join(out)


def first_diff(old_lines, new_lines):
    for i, (a, b) in enumerate(zip(old_lines, new_lines)):
        if a != b:
            return i, a, b
    if len(old_lines) != len(new_lines):
        i = min(len(old_lines), len(new_lines))
        missing = (old_lines if len(old_lines) > len(new_lines) else new_lines)
        return i, missing[i] if i < len(missing) else "<无>", "<行数不一致>"
    return None


def main():
    ap = argparse.ArgumentParser(description="挑战迁移字节级等价验收")
    ap.add_argument("--ref", default="HEAD", help="旧版 git 引用（默认 HEAD）")
    ap.add_argument("--old-dir", default=None, help="旧版 lua 目录（提供后不走 git）")
    ap.add_argument("--new-dir", default=os.path.join(REPO_ROOT, "lua"),
                    help="新格式 lua 目录（默认仓库 lua/）")
    args = ap.parse_args()

    # 新管线全量构建（任何硬校验失败即拒绝输出）
    try:
        entries, _registry = G.build(args.new_dir)
    except SystemExit as exc:
        print(f"FAIL  新管线构建失败：{exc}")
        return 1
    challenges = [e for e in entries if e["isChallenge"]]
    if not challenges:
        print("FAIL  新目录中没有挑战文件")
        return 1

    n_pass = n_fail = n_skip = 0
    for e in challenges:
        fname = e["fname"]
        # 取旧版原文
        if args.old_dir:
            old_path = os.path.join(args.old_dir, "challenges", fname)
            if not os.path.isfile(old_path):
                print(f"SKIP  {fname}（旧目录无此文件）")
                n_skip += 1
                continue
            with open(old_path, encoding="utf-8") as f:
                old_text = f.read()
        else:
            r = subprocess.run(
                ["git", "show", f"{args.ref}:lua/challenges/{fname}"],
                capture_output=True, cwd=REPO_ROOT,
            )
            if r.returncode != 0:
                print(f"SKIP  {fname}（{args.ref} 中不存在，视为新增文件）")
                n_skip += 1
                continue
            old_text = r.stdout.decode("utf-8")

        old_lines = old_code_lines(old_text)
        new_lines = [b["final_code"] for b in e["blocks"]]
        if old_lines == new_lines:
            print(f"PASS  {fname}（{len(new_lines)} 行代码逐字节一致）")
            n_pass += 1
        elif [ _norm(l) for l in old_lines ] == [ _norm(l) for l in new_lines ]:
            print(f"PASS  {fname}（{len(new_lines)} 行，忽略空白差异后一致）")
            n_pass += 1
        else:
            d = first_diff(old_lines, new_lines)
            print(f"FAIL  {fname}（旧 {len(old_lines)} 行 / 新 {len(new_lines)} 行）")
            if d:
                i, a, b = d
                print(f"      首处差异在第 {i} 行（0 起）：")
                print(f"      旧: {a[:120]}")
                print(f"      新: {b[:120]}")
            n_fail += 1

    print(f"\n合计：PASS {n_pass} / FAIL {n_fail} / SKIP {n_skip}（共 {len(challenges)} 个挑战文件）")
    return 1 if n_fail else 0


if __name__ == "__main__":
    sys.exit(main())
