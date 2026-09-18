#!/usr/bin/env python
"""构建器单元测试：用 fixtures/ 下的迷你数据验证新管线。

运行：python tests/builder/run_tests.py
覆盖：模板引用 / 参数默认值 / 列表参数 / 依赖（含 deps 输出字段） / 罗马数字编号 /
      名称（name 输出字段） / 说明无手工数字前缀（一律自动编号）与组装叠加 /
      块内参数（定义/展开/面板数据/缺默认值报错/占位符残留报错） /
      缺分隔线报错 / 重复模板id报错 / 说明整段覆盖 / 未定义参数报错 /
      占位符未替换完全报错 / main() 端到端 / verify_equivalence.py 的 PASS 与 FAIL /
      kb.json 结构化输出（build_kb_entries：注释/代码分栏、模板参数自包含） /
      page.js mock 渲染（mock_render.js：依赖标记、块内参数面板、罗马锚点路由、
      显示无 -- 前缀、一律自动编号、名称标签、复制文本保持 --N. 前缀、块级搜索）。
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FIX = os.path.join(REPO_ROOT, "tests", "builder", "fixtures")
sys.path.insert(0, REPO_ROOT)

import GenerateHtml as G


def build_fixture(name):
    return G.build(os.path.join(FIX, name, "lua"))


def assert_systemexit(testcase, name, needle):
    with testcase.assertRaises(SystemExit) as cm:
        build_fixture(name)
    testcase.assertIn(needle, str(cm.exception))


class TestHappyPath(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.entries, cls.registry = build_fixture("new")
        cls.ch = next(e for e in cls.entries if e["isChallenge"])

    def test_template_registry(self):
        self.assertEqual(set(self.registry), {"tpl-basic", "tpl-param", "tpl-note"})
        t = self.registry["tpl-param"]
        self.assertEqual(t["body"], "local ids={P2} Isaac.Spawn(5,100,P1,Vector.Zero,Vector.Zero,nil)")
        self.assertEqual(t["params"]["P1"]["默认"], 653)
        self.assertEqual(t["params"]["P2"]["默认"], [1, 2])

    def test_numbering(self):
        # 前置 "0"、"I"（0 之后从 I 起），正文 "1".."4"，后置继前置续罗马数字（前置 2 块 → 后置 "II"）
        self.assertEqual([b["num"] for b in self.ch["blocks"]],
                         ["0", "I", "1", "2", "3", "4", "II"])

    def test_header_passthrough(self):
        self.assertEqual("\n".join(self.ch["header"]).strip("\n"),
                         "--迷你挑战甲\n--用于构建器夹具。")

    def test_template_reference(self):
        b = self.ch["blocks"][1]  # tpl-basic 无参引用
        self.assertEqual(b["final_code"], "local BASIC=true print(BASIC)")
        self.assertEqual(b["comment"], "基础安全包装。")
        self.assertEqual(b["tpl"], "tpl-basic")
        self.assertEqual(b["values"], {})

    def test_list_param_and_text_join(self):
        b = self.ch["blocks"][2]  # P1=700, P2=[3,34]
        self.assertEqual(b["final_code"],
                         "local ids={3,34} Isaac.Spawn(5,100,700,Vector.Zero,Vector.Zero,nil)")
        self.assertEqual(b["comment"], "生成道具700，数量3、34。")  # 进文本用 '、'
        self.assertEqual(b["values"], {"P1": 700, "P2": [3, 34]})

    def test_param_default_and_comment_override(self):
        b = self.ch["blocks"][3]  # P1 取默认 653；说明整段覆盖（不插值）
        self.assertEqual(b["final_code"],
                         "local ids={9} Isaac.Spawn(5,100,653,Vector.Zero,Vector.Zero,nil)")
        self.assertEqual(b["comment"], "使用道具{P1}。")
        self.assertEqual(b["values"], {"P1": 653, "P2": 9})

    def test_dependency_ok(self):
        b = self.ch["blocks"][4]  # 依赖: 基础设置、基础包装（字符串按 '、' 拆分，两块均在前）
        self.assertEqual(b["final_code"], "print(X+1)")

    def test_deps_field(self):
        all_files = G.build_all_files(self.entries)
        blocks = all_files["1"]["blocks"]
        # 有 依赖 的块输出 deps 列表；无 依赖 的块不输出该键
        self.assertEqual(blocks[4]["deps"], ["基础设置", "基础包装"])
        for b in (blocks[0], blocks[1], blocks[5]):
            self.assertNotIn("deps", b)

    def test_name_field(self):
        all_files = G.build_all_files(self.entries)
        blocks = all_files["1"]["blocks"]
        # YAML 头声明了 名称 的块输出 name 字段；未声明的块不输出该键
        self.assertEqual(blocks[0]["name"], "基础设置")
        self.assertEqual(blocks[1]["name"], "基础包装")
        for b in (blocks[2], blocks[3], blocks[4], blocks[5], blocks[6]):
            self.assertNotIn("name", b)

    def test_no_manual_digit_prefix(self):
        # 数据中无手工数字前缀：说明首行不允许「N. 」形式，页面显示一律由块编号自动叠加
        b = self.ch["blocks"][4]
        self.assertEqual(b["comment"], "数据保存式依赖演示。")
        self.assertNotRegex(b["comment"], r"^\d+\.(\s|$)")
        all_files = G.build_all_files(self.entries)
        self.assertEqual(all_files["1"]["blocks"][4]["comment"], "数据保存式依赖演示。")
        # 组装文本（控制台粘贴格式）仍照常叠加 --N. 前缀
        self.assertIn("--3. 数据保存式依赖演示。", G._assemble_raw(self.ch))

    def test_inline_param_block(self):
        b = self.ch["blocks"][5]  # 块内参数：P1 默认 653、P2 默认 2
        self.assertEqual(b["final_code"],
                         "for i=1,2 do Isaac.Spawn(5,100,653,Vector.Zero,Vector.Zero,nil) end")
        self.assertEqual(b["comment"], "块内生成道具653，循环2次。")
        self.assertEqual(b["values"], {"P1": 653, "P2": 2})
        self.assertNotIn("tpl", b)

    def test_inline_param_panel_data(self):
        # 面板数据契约：{num, comment, code, params, values, body, commentTpl}（无 tpl/tplDef）
        all_files = G.build_all_files(self.entries)
        blk = all_files["1"]["blocks"][5]
        self.assertEqual(blk["num"], "4")
        self.assertEqual(blk["body"],
                         "for i=1,P2 do Isaac.Spawn(5,100,P1,Vector.Zero,Vector.Zero,nil) end")
        self.assertEqual(blk["values"], {"P1": 653, "P2": 2})
        self.assertEqual(blk["params"]["P1"],
                         {"说明": "道具编号", "性质": "局部", "默认": 653, "类型": "道具id"})
        self.assertEqual(blk["params"]["P2"]["默认"], 2)
        self.assertEqual(blk["commentTpl"], "块内生成道具{P1}，循环{P2}次。")
        self.assertNotIn("tpl", blk)
        self.assertNotIn("tplDef", blk)

    def test_postfix_template_default_empty(self):
        b = self.ch["blocks"][6]  # tpl-note，P1 默认 ''
        self.assertEqual(b["final_code"], "local who='' print(who)")
        self.assertEqual(b["comment"], "角色专用重启。")

    def test_custom_block_has_no_tpl(self):
        all_files = G.build_all_files(self.entries)
        blk = all_files["1"]["blocks"][0]
        self.assertNotIn("tpl", blk)
        self.assertNotIn("values", blk)
        blk2 = all_files["1"]["blocks"][2]
        self.assertEqual(blk2["tpl"], "tpl-param")
        self.assertEqual(blk2["values"], {"P1": 700, "P2": [3, 34]})

    def test_templates_json_contract(self):
        out = G.build_templates_json(self.registry)
        self.assertIn("body", out["tpl-param"])
        self.assertEqual(out["tpl-param"]["params"]["P1"],
                         {"说明": "道具编号", "性质": "局部", "默认": 653, "类型": "道具id"})
        self.assertEqual(out["tpl-param"]["params"]["P2"]["默认"], [1, 2])

    def test_assemble_raw_layout(self):
        raw = G._assemble_raw(self.ch)
        self.assertIn("--0. 前置自定义代码。\nl local X=1 print(X)", raw)
        self.assertIn("--1. 生成道具700，数量3、34。\n"
                      "l local ids={3,34} Isaac.Spawn(5,100,700,Vector.Zero,Vector.Zero,nil)", raw)
        self.assertTrue(raw.startswith("--迷你挑战甲"))
        self.assertEqual(G.clean_code(raw).splitlines()[0], "--迷你挑战甲")


class TestKbEntries(unittest.TestCase):
    """kb.json 结构化输出：注释/代码分栏、模板参数自包含（可复现前端“双自定义”）。"""

    @classmethod
    def setUpClass(cls):
        cls.entries, cls.registry = build_fixture("new")
        cls.kb = G.build_kb_entries(cls.entries, cls.registry)

    def test_entry_shape(self):
        self.assertEqual(len(self.kb), 3)  # 1 挑战 + 2 工具
        ch = next(e for e in self.kb if e["id"] == "1")
        self.assertEqual(set(ch),
                         {"id", "title", "fname", "isChallenge", "tags",
                          "source", "header", "blocks", "text", "code"})
        self.assertEqual(ch["source"], "isaac_code")
        self.assertEqual(ch["text"], G.clean_code(ch["code"]))
        self.assertTrue(ch["isChallenge"])
        util = next(e for e in self.kb if e["id"] == "U1")
        self.assertFalse(util["isChallenge"])

    def test_blocks_self_contained(self):
        ch = next(e for e in self.kb if e["id"] == "1")
        blocks = ch["blocks"]
        self.assertEqual([b["num"] for b in blocks], ["0", "I", "1", "2", "3", "4", "II"])
        # 自定义块：无 tpl/tplDef/params/body，仅 num/comment/code
        b0 = blocks[0]
        self.assertEqual(b0["comment"], "前置自定义代码。")
        self.assertEqual(b0["code"], "local X=1 print(X)")
        self.assertNotIn("tpl", b0)
        self.assertNotIn("params", b0)
        # 模板引用块：自包含 body/commentTpl/params（下游可据此改参重替换）
        b2 = blocks[2]
        self.assertEqual(b2["tpl"], "tpl-param")
        self.assertEqual(b2["values"], {"P1": 700, "P2": [3, 34]})
        self.assertEqual(b2["body"], "local ids={P2} Isaac.Spawn(5,100,P1,Vector.Zero,Vector.Zero,nil)")
        self.assertEqual(b2["commentTpl"], "生成道具{P1}，数量{P2}。")
        self.assertEqual(b2["params"]["P1"]["默认"], 653)
        # 块内参数块：无 tpl/tplDef，但带 params/values/body/commentTpl
        b5 = blocks[5]
        self.assertNotIn("tpl", b5)
        self.assertNotIn("tplDef", b5)
        self.assertEqual(b5["body"], "for i=1,P2 do Isaac.Spawn(5,100,P1,Vector.Zero,Vector.Zero,nil) end")
        self.assertEqual(b5["commentTpl"], "块内生成道具{P1}，循环{P2}次。")

    def test_template_def_block(self):
        u = next(e for e in self.kb if e["id"] == "U1")
        tdef = next(b for b in u["blocks"] if b.get("tplDef") == "tpl-param")
        self.assertIn("body", tdef)
        self.assertEqual(tdef["params"]["P1"]["默认"], 653)
        self.assertEqual(tdef["commentTpl"], "生成道具{P1}，数量{P2}。")
        # 无参模板定义（tpl-basic）不带 params/body/commentTpl（无可自定义项）
        tbasic = next(b for b in u["blocks"] if b.get("tplDef") == "tpl-basic")
        self.assertNotIn("params", tbasic)


class TestErrors(unittest.TestCase):
    def test_missing_separator(self):
        assert_systemexit(self, "bad-nosep", "分隔线")

    def test_duplicate_template_id(self):
        assert_systemexit(self, "bad-dup", "模板id 重复")

    def test_undefined_param(self):
        assert_systemexit(self, "bad-param", "未在模板")

    def test_bad_dependency(self):
        assert_systemexit(self, "bad-dep", "不存在")

    def test_leftover_placeholder(self):
        assert_systemexit(self, "bad-leftover", "未替换完全")

    def test_inline_param_missing_default(self):
        assert_systemexit(self, "bad-inline-nodefault", "未定义默认值")

    def test_inline_param_leftover(self):
        assert_systemexit(self, "bad-inline-leftover", "未替换完全")


class TestMainEndToEnd(unittest.TestCase):
    def _run_main(self, page_js_text):
        tmp = tempfile.mkdtemp(prefix="builder-e2e-")
        old_cwd = os.getcwd()
        try:
            shutil.copytree(os.path.join(FIX, "new", "lua"), os.path.join(tmp, "lua"))
            shutil.copy(os.path.join(FIX, "site", "style.css"), os.path.join(tmp, "style.css"))
            with open(os.path.join(tmp, "page.js"), "w", encoding="utf-8") as f:
                f.write(page_js_text)
            os.chdir(tmp)
            G.main()
            with open("index.html", encoding="utf-8") as f:
                html = f.read()
            with open("kb.json", encoding="utf-8") as f:
                kb = json.load(f)
            return html, kb
        finally:
            os.chdir(old_cwd)
            shutil.rmtree(tmp, ignore_errors=True)

    def test_main_with_both_placeholders(self):
        with open(os.path.join(FIX, "site", "page.js"), encoding="utf-8") as f:
            page_js = f.read()
        html, kb = self._run_main(page_js)
        self.assertNotIn("__ALL_FILES__", html)
        self.assertNotIn("__ALL_TEMPLATES__", html)
        self.assertIn("tpl-param", html)  # 模板注册表已注入
        # kb.json 新 schema：文件级信息 + 结构化 blocks（注释/代码分栏、模板参数自包含）
        self.assertEqual(len(kb), 3)  # 1 挑战 + 2 工具
        for entry in kb:
            self.assertEqual(set(entry),
                             {"id", "title", "fname", "isChallenge", "tags",
                              "source", "header", "blocks", "text", "code"})
            self.assertEqual(entry["source"], "isaac_code")
            self.assertEqual(entry["text"], G.clean_code(entry["code"]))
        ch = next(e for e in kb if e["id"] == "1")
        self.assertIn("--0. 前置自定义代码。\nl local X=1 print(X)", ch["code"])

    def test_main_without_templates_placeholder(self):
        html, kb = self._run_main("const ALL_FILES = __ALL_FILES__;\n")
        self.assertNotIn("__ALL_FILES__", html)
        self.assertEqual(len(kb), 3)


class TestVerifyEquivalence(unittest.TestCase):
    SCRIPT = os.path.join(REPO_ROOT, "scripts", "verify_equivalence.py")
    NEW = os.path.join(FIX, "new", "lua")

    def _run(self, old_dir):
        return subprocess.run(
            [sys.executable, self.SCRIPT, "--old-dir", old_dir, "--new-dir", self.NEW],
            capture_output=True, text=True, encoding="utf-8",
        )

    def test_pass(self):
        r = self._run(os.path.join(FIX, "old", "lua"))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("PASS", r.stdout)
        self.assertNotIn("FAIL  ", r.stdout)  # 逐文件 FAIL 行（合计行的 "FAIL 0" 不算）

    def test_fail(self):
        r = self._run(os.path.join(FIX, "old-mismatch", "lua"))
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("FAIL", r.stdout)
        self.assertIn("首处差异", r.stdout)


class TestMockRender(unittest.TestCase):
    """page.js mock 渲染验证（Node + 最小 DOM 桩）；node 不可用时跳过。"""
    SCRIPT = os.path.join(REPO_ROOT, "tests", "builder", "mock_render.js")

    def test_mock_render(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("未找到 node，跳过 page.js mock 渲染验证")
        r = subprocess.run([node, self.SCRIPT], capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("全部通过", r.stdout)


if __name__ == "__main__":
    unittest.main(verbosity=2)
