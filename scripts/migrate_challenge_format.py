#!/usr/bin/env python
"""一次性迁移（模板代码系统架构重构，2026-09）：40 个挑战文件删除前置 5 块
与对应的一条分隔线，从「元信息/SEP/前置/SEP/正文/SEP/后置」变为
「元信息/SEP/正文/SEP/重开」的两分隔线格式。前置 5 块改由构建器从
lua/utils/TMPL.挑战代码框架.lua 注入，random-string 块由框架后置追加。
TMPL 文件本身的移动与合辑模板注册为手工步骤，不在本脚本内。"""
import os

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CH = os.path.join(REPO, "lua", "challenges")
SEP = "--===--"


def main():
    done = 0
    for fname in sorted(os.listdir(CH)):
        if not fname.endswith(".lua") or fname.startswith("TMPL"):
            continue
        path = os.path.join(CH, fname)
        with open(path, encoding="utf-8") as f:
            lines = f.read().split("\n")
        sep = [i for i, l in enumerate(lines) if l.strip() == SEP]
        if len(sep) != 3:
            raise SystemExit(f"错误：{fname} 分隔线条数 {len(sep)} != 3，未迁移。")
        new = lines[:sep[0]] + lines[sep[1]:]
        with open(path, "w", encoding="utf-8", newline="") as f:
            f.write("\n".join(new))
        done += 1
        print(f"迁移 {fname}")
    print(f"合计迁移 {done} 个挑战文件")


if __name__ == "__main__":
    main()
