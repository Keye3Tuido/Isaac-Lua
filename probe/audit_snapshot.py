# 合辑逐块审核用基线/断言脚本：
# 仅用 lua/utils/0.实用代码合辑.lua 构建（隔离其他 agent 的挑战文件），
# 捕获每个块的 comment/final_code/params 展开产物。
# 用法：python probe/audit_snapshot.py dump   -> 写基线 probe/audit_baseline.json
#       python probe/audit_snapshot.py check  -> 与基线逐字节比对
import json
import os
import shutil
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import GenerateHtml as G  # noqa: E402

SRC = os.path.join(ROOT, "lua", "utils", "0.实用代码合辑.lua")
BASELINE = os.path.join(ROOT, "probe", "audit_baseline.json")


def snapshot():
    tmp = tempfile.mkdtemp()
    try:
        os.makedirs(os.path.join(tmp, "utils"))
        shutil.copy(SRC, os.path.join(tmp, "utils", "0.实用代码合辑.lua"))
        entries = G.collect_lua_entries(tmp)
        registry = G._register_templates(entries)
        for e in entries:
            for b in e["blocks"]:
                G._expand_block(e, b, registry)
            G._validate_deps(e)
        blocks = []
        for b in entries[0]["blocks"]:
            m = b["meta"]
            blocks.append({
                "num": b["num"],
                "模板id": str(m.get("模板id")) if m.get("模板id") else None,
                "模板": str(m.get("模板")) if m.get("模板") else None,
                "comment": b["comment"],
                "final_code": b["final_code"],
                "values": {k: (v if not isinstance(v, list) else list(v))
                           for k, v in (b.get("values") or {}).items()},
            })
        templates = {tid: {"body": t["body"], "说明": t["说明"],
                           "params": {pn: dict(pd) for pn, pd in t["params"].items()}}
                     for tid, t in registry.items()}
        return {"blocks": blocks, "templates": templates}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "check"
    cur = snapshot()
    if mode == "dump":
        with open(BASELINE, "w", encoding="utf-8") as f:
            json.dump(cur, f, ensure_ascii=False, indent=1)
        print(f"已写基线 {BASELINE}：{len(cur['blocks'])} 块，{len(cur['templates'])} 模板")
        return 0
    with open(BASELINE, encoding="utf-8") as f:
        base = json.load(f)
    bad = 0
    if len(base["blocks"]) != len(cur["blocks"]):
        print(f"FAIL 块数变化 {len(base['blocks'])} -> {len(cur['blocks'])}")
        bad += 1
    for bb, cb in zip(base["blocks"], cur["blocks"]):
        # 铁律：默认值展开/插值结果（comment/final_code）逐字节一致；
        # 参数元数据（性质/说明标注）允许修正，不参与比对
        for key in ("comment", "final_code", "模板id", "模板"):
            if bb.get(key) != cb.get(key):
                print(f"FAIL 块{cb['num']} ({cb.get('模板id') or cb.get('模板')}) 字段 {key} 变化:")
                print(f"  旧: {bb.get(key)!r}")
                print(f"  新: {cb.get(key)!r}")
                bad += 1
    print("PASS 全部块展开产物逐字节一致" if bad == 0 else f"FAIL 共 {bad} 处不一致")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
