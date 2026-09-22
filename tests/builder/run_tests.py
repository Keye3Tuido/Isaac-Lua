#!/usr/bin/env python
"""构建器单元测试：用 fixtures/ 下的迷你数据验证新管线。

运行：python tests/builder/run_tests.py
覆盖：模板引用 / 参数默认值 / 列表参数 / 依赖（含 deps 输出字段） / 罗马数字编号 /
      名称（name 输出字段） / 说明无手工数字前缀（一律自动编号）与组装叠加 /
      块内参数（定义/展开/面板数据/缺默认值报错/占位符残留报错） /
      块头解析器（全角冒号/免引号/行内映射逗号并回/引号转义/标量归一/
      块标量/嵌套映射/普通注释误判/含模板标记的坏头硬报错） /
      缺分隔线报错 / 重复模板id报错 / 说明整段覆盖 / 未定义参数报错 /
      占位符未替换完全报错 / 空前置→框架注入（编号/region/深拷贝/依赖/展开，
      自写前置不注入） / main() 端到端 / verify_equivalence.py 的 PASS 与 FAIL /
      kb.json 结构化输出（build_kb_entries：注释/代码分栏、模板参数自包含） /
      分类编号（challenges c<编号> / utils u<编号>，两类目录可同号） /
      发布目录组装（build_site.py：必要资源一个不少、非必要文件一个不多） /
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

    def test_block_line_points_at_head(self):
        # 块的 line 必须指向源文件中该块的 '--[[' 起始行（两条分隔线骨架曾错用 s2 偏移）
        for e in self.entries:
            sub = "challenges" if e["isChallenge"] else "utils"
            path = os.path.join(FIX, "new", "lua", sub, e["fname"])
            lines = G._split_lines(open(path, encoding="utf-8").read())
            for b in e["blocks"]:
                self.assertEqual(lines[b["line"] - 1].strip(), "--[[",
                                 f"{e['fname']} 块{b['num']} line={b['line']}")

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
        b = self.ch["blocks"][3]  # P1 省略 → 回退模板默认 653；说明整段覆盖（不插值）
        self.assertEqual(b["final_code"],
                         "local ids={9} Isaac.Spawn(5,100,653,Vector.Zero,Vector.Zero,nil)")
        self.assertEqual(b["comment"], "使用道具{P1}。")
        self.assertEqual(b["values"], {"P1": 653, "P2": 9})

    def test_dependency_ok(self):
        b = self.ch["blocks"][4]  # 依赖: 基础设置、基础包装（字符串按 '、' 拆分，两块均在前）
        self.assertEqual(b["final_code"], "print(X+1)")

    def test_deps_field(self):
        all_files = G.build_all_files(self.entries)
        blocks = all_files["c1"]["blocks"]
        # 有 依赖 的块输出 deps 列表；无 依赖 的块不输出该键
        self.assertEqual(blocks[4]["deps"], ["基础设置", "基础包装"])
        for b in (blocks[0], blocks[1], blocks[5]):
            self.assertNotIn("deps", b)

    def test_name_field(self):
        all_files = G.build_all_files(self.entries)
        blocks = all_files["c1"]["blocks"]
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
        self.assertEqual(all_files["c1"]["blocks"][4]["comment"], "数据保存式依赖演示。")
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
        blk = all_files["c1"]["blocks"][5]
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
        blk = all_files["c1"]["blocks"][0]
        self.assertNotIn("tpl", blk)
        self.assertNotIn("values", blk)
        blk2 = all_files["c1"]["blocks"][2]
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
                         {"id", "key", "title", "fname", "isChallenge", "tags",
                          "source", "header", "blocks", "text", "code"})
        self.assertEqual(ch["source"], "isaac_code")
        self.assertEqual(ch["key"], "c1")           # 挑战锚点键
        self.assertEqual(ch["text"], G.clean_code(ch["code"]))
        self.assertTrue(ch["isChallenge"])
        util = next(e for e in self.kb if e["id"] == "U1")
        self.assertEqual(util["key"], "uU1")        # 工具锚点键
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


class TestFrameworkInjection(unittest.TestCase):
    """空前置 → 框架注入：前置区为空的挑战文件注入框架前置块（深拷贝），
    后置区追加框架的 random-string 引用块；自写前置块的文件不注入也不追加。"""

    @classmethod
    def setUpClass(cls):
        cls.entries, cls.registry = build_fixture("framework")
        cls.ch = next(e for e in cls.entries if e["fname"] == "1.空前置.lua")
        cls.own = next(e for e in cls.entries if e["fname"] == "2.自带前置.lua")
        cls.fw = next(e for e in cls.entries if e["fname"] == G.FRAMEWORK_FNAME)

    def test_injected_numbering_and_regions(self):
        # 注入前置 2 块（0、I），正文 1，文件自带重开 II，追加的 random-string III
        self.assertEqual([b["num"] for b in self.ch["blocks"]],
                         ["0", "I", "1", "II", "III"])
        self.assertEqual([b["region"] for b in self.ch["blocks"]],
                         ["pre", "pre", "body", "post", "post"])

    def test_injected_pre_blocks_expanded(self):
        b0, b1 = self.ch["blocks"][:2]
        self.assertEqual(b0["comment"], "框架前置甲。")
        self.assertEqual(b0["final_code"], "local FA=1")
        self.assertEqual(b1["comment"], "框架前置乙。")
        self.assertEqual(b1["final_code"], "print(FA)")

    def test_injected_blocks_are_deep_copies(self):
        # 深拷贝：注入块与框架条目的块不是同一对象，互不影响
        fw_pre = [b for b in self.fw["blocks"] if b["region"] == "pre"]
        self.assertIsNot(self.ch["blocks"][0]["meta"], fw_pre[0]["meta"])
        self.assertIsNot(self.ch["blocks"][0], fw_pre[0])

    def test_injected_deps_and_names(self):
        # 注入块内部的 名称/依赖 关系照常校验与输出
        all_files = G.build_all_files(self.entries)
        blocks = all_files["c1"]["blocks"]
        self.assertEqual(blocks[0]["name"], "框架甲")
        self.assertEqual(blocks[1]["deps"], ["框架甲"])

    def test_random_string_block_appended(self):
        b = self.ch["blocks"][-1]
        self.assertEqual(b["region"], "post")
        self.assertEqual(b["num"], "III")
        self.assertEqual(b["tpl"], "random-string-output")
        self.assertEqual(b["comment"], "输出随机字符串。")
        self.assertEqual(b["final_code"],
                         "Isaac.ConsoleOutput(tostring({}):match('%w%w%w%w$'))")

    def test_own_pre_blocks_not_injected(self):
        # 自写前置区的文件以文件为准：不注入前置，也不追加 random-string
        self.assertEqual([b["num"] for b in self.own["blocks"]], ["0", "1", "I"])
        self.assertEqual([b["region"] for b in self.own["blocks"]],
                         ["pre", "body", "post"])
        self.assertNotIn("random-string-output",
                         [b.get("tpl") for b in self.own["blocks"]])

    def test_framework_entry_parsed_with_regions(self):
        # 框架文件在 utils（非挑战）但按挑战骨架解析，带 region 与罗马编号
        self.assertFalse(self.fw["isChallenge"])
        self.assertEqual(self.fw["key"], "uTMPL")
        self.assertEqual([b["num"] for b in self.fw["blocks"]],
                         ["0", "I", "1", "II", "III"])
        self.assertEqual([b["region"] for b in self.fw["blocks"]],
                         ["pre", "pre", "body", "post", "post"])

    def test_kb_blocks_include_injection(self):
        kb = G.build_kb_entries(self.entries, self.registry)
        ch = next(e for e in kb if e["fname"] == "1.空前置.lua")
        self.assertEqual([b["num"] for b in ch["blocks"]],
                         ["0", "I", "1", "II", "III"])
        last = ch["blocks"][-1]
        self.assertEqual(last["tpl"], "random-string-output")
        self.assertEqual(last["code"],
                         "Isaac.ConsoleOutput(tostring({}):match('%w%w%w%w$'))")
        # 组装文本末尾：重开行 → random 行 → --.（块间空行不计）
        tail = [l for l in ch["code"].split("\n") if l.strip()]
        self.assertEqual(tail[-1], "--.")
        self.assertEqual(tail[-2],
                         "l Isaac.ConsoleOutput(tostring({}):match('%w%w%w%w$'))")
        self.assertEqual(tail[-3], "--III. 输出随机字符串。")
        self.assertEqual(tail[-4], "l print(\"restart\")")


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


class TestHeadParse(unittest.TestCase):
    """块头解析器（parse_head）：宽松写法 + 与 YAML 子集的兼容行为。"""

    def test_fullwidth_colon(self):
        # 全角冒号空格可有可无；半角冒号需后随空格或行尾
        h = G.parse_head(["模板：pause-on-focus-lost", "名称： 失焦暂停", "作为模板：true"])
        self.assertEqual(h, {"模板": "pause-on-focus-lost", "名称": "失焦暂停", "作为模板": True})

    def test_unquoted_slot_literal(self):
        # {P2} 开头的说明按字面字符串，不再是解析错误
        h = G.parse_head(["说明: {P2}失焦暂停功能"])
        self.assertEqual(h, {"说明": "{P2}失焦暂停功能"})

    def test_unquoted_text_with_fullwidth_punct(self):
        h = G.parse_head(["说明: 爆裂天火：每Burst(默认{P1})秒随机天降一颗爆裂火球。"])
        self.assertEqual(h, {"说明": "爆裂天火：每Burst(默认{P1})秒随机天降一颗爆裂火球。"})

    def test_flow_map_unquoted_commas(self):
        # 行内映射免引号值可含半角逗号（无冒号片段并回上一个值）
        h = G.parse_head(["参数定义:",
                          "  P1: {类型: 道具id列表, 默认: 87,229,233, 性质: 局部, 说明: 候选id列表}"])
        self.assertEqual(h["参数定义"]["P1"],
                         {"类型": "道具id列表", "默认": "87,229,233", "性质": "局部", "说明": "候选id列表"})

    def test_flow_map_quoted_compat(self):
        # 引号写法保持不变；双引号内 \n 解转义、单引号内 '' 解转义
        h = G.parse_head(['参数定义:',
                          '  P1: {类型: "描述", 默认: "如：a\\nb", 说明: \'it\'\'s\'}'])
        self.assertEqual(h["参数定义"]["P1"]["默认"], "如：a\nb")
        self.assertEqual(h["参数定义"]["P1"]["说明"], "it's")

    def test_scalar_coercion(self):
        h = G.parse_head(["参数:", "  P1: 85", "  P2: 1.5", "  P3: 1e3", "  P4: false", "  P5: '85'"])
        self.assertEqual(h["参数"],
                         {"P1": 85, "P2": 1.5, "P3": "1e3", "P4": False, "P5": "85"})

    def test_flow_list(self):
        self.assertEqual(G.parse_head(["依赖: [安全包装]"]), {"依赖": ["安全包装"]})
        self.assertEqual(G.parse_head(["依赖: 甲、乙"]), {"依赖": "甲、乙"})

    def test_block_scalar(self):
        h = G.parse_head(["说明: |-", "  第一行", "", "  第二行：含全角冒号", "参数定义:", "  P1: 5"])
        self.assertEqual(h["说明"], "第一行\n\n第二行：含全角冒号")
        self.assertEqual(h["参数定义"], {"P1": 5})

    def test_nested_map(self):
        h = G.parse_head(["参数定义:", "  P1:", "    类型: 布尔", "    默认: false"])
        self.assertEqual(h["参数定义"], {"P1": {"类型": "布尔", "默认": False}})

    def test_inline_comment(self):
        # 「 #」起至行尾为注释；引号内与紧邻文本的 # 不受影响
        h = G.parse_head(["模板: soul-spawn          # 省略 = 自定义代码",
                          "说明: 'C# 相关' # 尾注",
                          "名称: C#测试"])
        self.assertEqual(h, {"模板": "soul-spawn", "说明": "C# 相关", "名称": "C#测试"})

    def test_plain_comment_is_none(self):
        self.assertIsNone(G.parse_head(["这是一段注释", "第二行"]))
        self.assertIsNone(G.parse_head(["function MEC()", "  local t = {}", "end"]))
        self.assertIsNone(G.parse_head([]))

    def test_broken_head_with_marker_raises(self):
        # 含「作为模板/模板id」但结构不合法 → 硬报错，不再静默吞掉
        lines = ["--[[", "作为模板: true", "\t模板id: x", "]]"]
        with self.assertRaises(SystemExit) as cm:
            G._read_head(lines, 0, "t.lua")
        self.assertIn("无法解析", str(cm.exception))


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
                             {"id", "key", "title", "fname", "isChallenge", "tags",
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


class TestPublishBuild(unittest.TestCase):
    """发布目录组装（scripts/build_site.py）：必要资源一个不少，非必要文件一个不多。"""

    @classmethod
    def setUpClass(cls):
        cls._cwd = os.getcwd()
        os.chdir(REPO_ROOT)
        G.main()   # 先产出 index.html / kb.json（gitignore 产物），发布脚本依赖它们
        sys.path.insert(0, os.path.join(REPO_ROOT, "scripts"))
        import build_site as B
        cls.B = B
        cls.tmp = tempfile.mkdtemp(prefix="publish-test-")
        cls.out, cls.assets, cls.written = B.assemble(os.path.join(cls.tmp, "_site"))
        cls.problems, cls.unused = B.verify(cls.out)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)
        os.chdir(cls._cwd)

    def test_no_broken_references(self):
        self.assertEqual(self.problems, [])

    def test_divider_assets_published(self):
        # 回归锁：两张分隔图曾漏拷，导致线上「行间分隔线」消失
        self.assertIn("content-divider.webp", self.assets)
        self.assertIn("challenge-divider.webp", self.assets)

    def test_every_referenced_asset_published(self):
        # 发布目录里每个 assets/ 引用都真实存在（verify 的引用解析已覆盖，这里再独立断言一次）
        pub = {os.path.relpath(os.path.join(dp, fn), self.out).replace(os.sep, "/")
               for dp, _, fns in os.walk(self.out) for fn in fns}
        for name in self.assets:
            self.assertIn(f"assets/{name}", pub)

    def test_only_necessary_files_published(self):
        pub = {os.path.relpath(os.path.join(dp, fn), self.out).replace(os.sep, "/")
               for dp, _, fns in os.walk(self.out) for fn in fns}
        self.assertIn("index.html", pub)
        self.assertIn("kb.json", pub)
        self.assertIn("compressor/luaparse.js", pub)   # 由 node_modules 提供，不入库
        self.assertIn("compressor/fengari-web.js", pub)
        # 源码/测试/文档/依赖不得进入发布目录
        self.assertEqual([p for p in pub if p.endswith((".py", ".lua", ".md"))], [])
        self.assertEqual([p for p in pub if "node_modules/" in p], [])

    def test_no_unused_asset_in_repo(self):
        # 仓库 assets/ 里不得留下未被页面引用的资源
        self.assertEqual(self.unused, [])

    def test_missing_vendor_libs_without_npm(self):
        # 回归：缺第三方库分支曾写成 [c for _, cands in ...]（表达式变量名不存在），
        # 本机因 node_modules 已存在而走不到该分支，只在缺依赖的平台上炸 NameError。
        B = self.B
        orig_libs, orig_which = B.VENDOR_LIBS, B.shutil.which
        try:
            B.VENDOR_LIBS = [("compressor/nope.js", ["compressor/definitely-missing.js"])]
            B.shutil.which = lambda _name: None
            with self.assertRaises(SystemExit) as cm:
                B.ensure_compressor_deps()
            self.assertIn("未找到 npm", str(cm.exception))
            self.assertIn("nope.js", str(cm.exception))
        finally:
            B.VENDOR_LIBS, B.shutil.which = orig_libs, orig_which

    def test_missing_vendor_libs_after_install(self):
        # 安装命令跑完仍缺库时，同样要给出明确报错（覆盖 another 分支）
        B = self.B
        orig_libs, orig_which, orig_run = B.VENDOR_LIBS, B.shutil.which, B.subprocess.run
        try:
            B.VENDOR_LIBS = [("compressor/nope.js", ["compressor/definitely-missing.js"])]
            B.shutil.which = lambda _name: "/fake/npm"
            B.subprocess.run = lambda *a, **k: None
            with self.assertRaises(SystemExit) as cm:
                B.ensure_compressor_deps()
            self.assertIn("仍缺少", str(cm.exception))
        finally:
            B.VENDOR_LIBS, B.shutil.which, B.subprocess.run = orig_libs, orig_which, orig_run


class TestCategoryKeys(unittest.TestCase):
    """编号在两类目录内各自独立：challenges/1 与 utils/1 可共存（键 c1 / u1）。"""

    def _build(self, challenge_name, util_name):
        tmp = tempfile.mkdtemp(prefix="catkeys-")
        try:
            for sub in ("challenges", "utils"):
                os.makedirs(os.path.join(tmp, sub))
            with open(os.path.join(tmp, "challenges", challenge_name), "w", encoding="utf-8") as f:
                f.write(
                    "--甲\n\n"
                    "--===--\n--[[\n说明: 前置。\n]]\nl print(1)\n\n"
                    "--===--\n--[[\n说明: 正文。\n]]\nl print(2)\n\n"
                    "--===--\n--[[\n说明: 后置。\n]]\nl print(3)\n"
                )
            with open(os.path.join(tmp, "utils", util_name), "w", encoding="utf-8") as f:
                f.write("--[[\n说明: 工具。\n]]\nl print(4)\n")
            entries, _registry = G.build(tmp)   # 跑完整管线（含展开），build_all_files 依赖展开结果
            return entries, G.build_all_files(entries)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_same_number_in_both_categories(self):
        _entries, all_files = self._build("1.甲.lua", "1.乙.lua")
        self.assertEqual(set(all_files), {"c1", "u1"})
        self.assertEqual(all_files["c1"]["id"], "1")
        self.assertEqual(all_files["u1"]["id"], "1")
        self.assertTrue(all_files["c1"]["isChallenge"])
        self.assertFalse(all_files["u1"]["isChallenge"])

    def test_id_ending_in_l_digits_allowed(self):
        # util1 这类编号曾因「结尾 l+数字」被当成段锚点冲突而拒绝；改为「整串先当文件键」后放行
        _entries, all_files = self._build("util1.甲.lua", "util1.乙.lua")
        self.assertEqual(set(all_files), {"cutil1", "uutil1"})

    def test_duplicate_number_within_category_rejected(self):
        # 同目录内同号（1.甲.lua 与 1.乙.lua）仍必须报错，不能被静默覆盖
        tmp = tempfile.mkdtemp(prefix="dupcat-")
        try:
            os.makedirs(os.path.join(tmp, "challenges"))
            body = ("--甲\n\n--===--\n--[[\n说明: 前置。\n]]\nl print(1)\n\n"
                    "--===--\n--[[\n说明: 正文。\n]]\nl print(2)\n\n"
                    "--===--\n--[[\n说明: 后置。\n]]\nl print(3)\n")
            for name in ("1.甲.lua", "1.乙.lua"):
                with open(os.path.join(tmp, "challenges", name), "w", encoding="utf-8") as f:
                    f.write(body)
            with self.assertRaises(SystemExit) as cm:
                G.build_all_files(G.build(tmp)[0])
            self.assertIn("重复的文件编号", str(cm.exception))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    unittest.main(verbosity=2)
