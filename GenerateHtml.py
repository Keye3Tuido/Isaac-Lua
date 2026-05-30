import os
import json
import html

# ========== 配置 ==========
SUBDIR = "pages"  # 子页输出目录
TITLE = "以撒代码挑战 - Keye3Tuido"

# ========== 文本清理 ==========
def clean_code(s):
    return "\n".join(
        l[2:] if l.startswith("l ") else l
        for l in s.splitlines()
    )

# ========== 收集并排序 Lua 文件 ==========
files = {
    f: {"raw": r, "cleaned": clean_code(r)}
    for f in sorted(
        (x for x in os.listdir('.') if x.endswith('.lua') and not x.startswith('$')),
        key=lambda x: (0, int(x.split('.')[0])) if x.split('.')[0].lstrip('-').isdigit() else (1, x)
    )
    for r in [open(f, encoding="utf-8").read()]
}

# ========== 主页条目 ==========
def file_num(f):
    """取文件编号（'.' 前的部分）。"""
    return f[:-4].split('.', 1)[0]

def is_challenge(f):
    """编号为非负整数的条目视为挑战。"""
    return file_num(f).isdigit()

def item(f):
    base = f[:-4]
    num, title = (base.split('.', 1) + [""])[:2]
    safe_title = html.escape(title, quote=True)
    return (
        f"<div class='file-row' data-search='{num} {safe_title}'>"
        f"<span class='file-num'>{num}</span>"
        f"<a href='{SUBDIR}/file_{num}.html' class='file-title'>{safe_title}</a>"
        f"</div>"
    )

# 分栏：挑战（编号为非负整数） / 其他
challenge_files = [f for f in files if is_challenge(f)]
other_files = [f for f in files if not is_challenge(f)]

challenge_links = "\n".join(item(f) for f in challenge_files)
other_links = "\n".join(item(f) for f in other_files)
challenge_count = len(challenge_files)
other_count = len(other_files)

# 其他栏：仅在存在条目时渲染（数目不硬编码）
other_section = (
    f"""
        <div class="list-section">
            <div class="list-label"><span>其他</span><span class="line"></span><span class="list-count">{other_count}</span></div>
            <div id="otherList" class="file-list">{other_links}</div>
        </div>"""
    if other_files else ""
)

# ========== 公共样式（The Binding of Isaac 地下室风） ==========
COMMON_CSS = """
@import url('https://fonts.googleapis.com/css2?family=Pirata+One&family=VT323&display=swap');
* { box-sizing: border-box; }
:root{
  --bg:#0c0a08; --stone:#1b1410; --stone-2:#241a14; --stone-3:#30231a;
  --border:#3a2a1f; --border-2:#5a3f2c; --text:#e9ddc6; --muted:#9c8a70;
  --blood:#a31e1e; --blood-d:#7a1313; --blood-l:#cf3a2c;
  --gold:#d9a441; --gold-l:#f2c879; --rot:#7d8b3a; --poison:#4a8c6a;
  --bruise:#7a4a86; --rust:#c2622a; --flesh:#c98a86;
  --radius:14px; --radius-sm:9px;
  --shadow:0 22px 60px rgba(0,0,0,.7);
  --mono:'Cascadia Code','JetBrains Mono',Consolas,'Courier New',monospace;
  --hud:'VT323','Cascadia Code',monospace;
  --display:'Pirata One','Microsoft YaHei',serif;
  --sans:'Segoe UI',system-ui,-apple-system,'Microsoft YaHei',sans-serif;
}
html, body { height: 100%; }
body {
  font-family: var(--sans);
  color: var(--text);
  margin: 0;
  padding: 34px 18px 64px;
  min-height: 100%;
  background:
    radial-gradient(1100px 620px at 50% -16%, #4a1414 0%, transparent 60%),
    radial-gradient(760px 520px at 0% 100%, #2a1410 0%, transparent 58%),
    radial-gradient(760px 520px at 100% 100%, #1a1d12 0%, transparent 58%),
    repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 2px, transparent 2px 46px),
    repeating-linear-gradient(90deg, rgba(0,0,0,.22) 0 2px, transparent 2px 92px),
    var(--bg);
  background-attachment: fixed;
  -webkit-font-smoothing: antialiased;
}
/* 暗角 */
body::before {
  content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0;
  box-shadow: inset 0 0 220px 60px rgba(0,0,0,.85);
}
@keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes beat { 0%,100%{ transform: scale(1);} 12%{ transform: scale(1.22);} 24%{ transform: scale(1);} 36%{ transform: scale(1.16);} }
.container {
  position: relative; z-index: 1;
  max-width: 1080px;
  margin: auto;
  background:
    linear-gradient(180deg, rgba(48,35,26,.96), rgba(24,17,13,.97));
  border: 2px solid var(--border-2);
  padding: 32px 30px 26px;
  border-radius: var(--radius);
  box-shadow: var(--shadow), inset 0 0 0 2px rgba(0,0,0,.6), inset 0 0 60px rgba(0,0,0,.55);
  animation: rise .4s ease;
}
h1 {
  text-align: center;
  margin: 4px 0 4px;
  font-size: 2.5rem;
  letter-spacing: .06em;
  font-weight: 700;
  color: var(--blood-l);
  text-shadow: 0 0 2px #000, 2px 2px 0 #2a0a0a, 0 0 18px rgba(207,58,44,.55), 0 3px 0 #4a0e0e;
}
h1::before, h1::after { content: '\\2665'; color: var(--blood); margin: 0 .4em; font-size: .8em; vertical-align: .06em; text-shadow: 0 0 8px rgba(163,30,30,.8); display: inline-block; animation: beat 2.4s ease-in-out infinite; }
.subtitle { text-align: center; color: var(--muted); font-size: .9rem; margin-bottom: 18px; letter-spacing: .04em; font-family: var(--hud); font-size: 1.05rem; }

/* 工具按钮 */
.tools { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin: 4px 0 18px; }
.tool-link {
  padding: 10px 22px; border-radius: 10px; text-decoration: none; font-weight: 700;
  color: #1a0a0a; background: linear-gradient(180deg, var(--gold-l), var(--gold));
  border: 2px solid #8a5a1e; letter-spacing: .03em;
  box-shadow: 0 5px 0 #6e4716, 0 8px 16px rgba(0,0,0,.5); transition: .12s;
}
.tool-link:hover { transform: translateY(-2px); filter: brightness(1.08); box-shadow: 0 7px 0 #6e4716, 0 12px 22px rgba(0,0,0,.55); }
.tool-link:active { transform: translateY(3px); box-shadow: 0 2px 0 #6e4716, 0 4px 10px rgba(0,0,0,.5); }

/* 搜索框 */
.search-wrap { position: relative; max-width: 480px; margin: 0 auto 22px; }
.search-wrap::before {
  content: '🔍'; position: absolute; left: 15px; top: 50%; transform: translateY(-50%);
  opacity: .6; font-size: .9rem; pointer-events: none;
}
#searchInput {
  width: 100%; padding: 12px 16px 12px 42px; border-radius: 10px;
  border: 2px solid var(--border-2); background: #120c09; color: var(--text);
  font-size: .95rem; outline: none; transition: .18s; font-family: var(--sans);
  box-shadow: inset 0 2px 8px rgba(0,0,0,.6);
}
#searchInput::placeholder { color: var(--muted); }
#searchInput:focus { border-color: var(--blood); box-shadow: inset 0 2px 8px rgba(0,0,0,.6), 0 0 0 3px rgba(163,30,30,.28); }

/* 分栏标题 */
.list-section { margin-bottom: 24px; }
.list-section:last-of-type { margin-bottom: 0; }
.list-label { display: flex; align-items: center; gap: 12px; margin: 0 2px 13px; color: var(--gold-l); font-weight: 700; font-size: 1.1rem; letter-spacing: .08em; font-family: var(--display); }
.list-label::before { content: '\\2665'; color: var(--blood); font-size: .9em; }
.list-label .line { flex: 1; height: 2px; background: linear-gradient(90deg, var(--border-2), transparent); }
.list-label .list-count { flex: 0 0 auto; color: var(--gold-l); font-size: 1.1rem; font-weight: 600; font-family: var(--hud); background: #120c09; border: 1px solid var(--border-2); padding: 0 11px; border-radius: 999px; letter-spacing: .04em; }

/* 文件卡片网格（房间图标风） */
.file-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(232px, 1fr)); gap: 12px; }
.file-row {
  --c:#a31e1e; --c2:#cf3a2c;
  position: relative; display: flex; align-items: center; gap: 12px;
  background: linear-gradient(180deg, var(--stone-3), var(--stone)); border: 2px solid var(--border);
  border-radius: var(--radius-sm); padding: 11px 13px; overflow: hidden; transition: .15s;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,.5), 0 4px 10px rgba(0,0,0,.4);
}
/* 卡片按位置循环取色（地下室色板：血红/铁锈/腐绿/毒青/淤紫/金/血肉） */
.file-row:nth-child(7n+1){ --c:#a31e1e; --c2:#cf3a2c; }
.file-row:nth-child(7n+2){ --c:#b5611f; --c2:#d98a33; }
.file-row:nth-child(7n+3){ --c:#6e7d2e; --c2:#9bb04a; }
.file-row:nth-child(7n+4){ --c:#2f7d63; --c2:#46b08a; }
.file-row:nth-child(7n+5){ --c:#6b4080; --c2:#9a5fb0; }
.file-row:nth-child(7n+6){ --c:#b8902f; --c2:#e6c24a; }
.file-row:nth-child(7n+7){ --c:#a85a55; --c2:#c98a86; }
.file-row::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
  background: linear-gradient(var(--c2), var(--c)); opacity: .4; transition: .15s;
}
.file-row:hover {
  transform: translateY(-2px); border-color: var(--c2);
  background: linear-gradient(180deg, color-mix(in srgb, var(--c) 26%, var(--stone-3)), var(--stone));
  box-shadow: inset 0 0 0 1px rgba(0,0,0,.5), 0 0 16px color-mix(in srgb, var(--c2) 55%, transparent), 0 8px 18px rgba(0,0,0,.55);
}
.file-row:hover::before { opacity: 1; }
.file-num {
  flex: 0 0 auto; min-width: 38px; height: 36px; padding: 0 9px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(180deg, var(--c2), var(--c));
  color: #fff5e6; font-weight: 700; font-size: 1.1rem; border-radius: 8px;
  font-family: var(--hud); letter-spacing: .03em;
  border: 1px solid rgba(0,0,0,.45); box-shadow: 0 2px 0 rgba(0,0,0,.5), inset 0 1px 2px rgba(255,255,255,.25);
  text-shadow: 0 1px 2px rgba(0,0,0,.6);
}
.file-title { flex: 1; text-decoration: none; color: var(--text); font-weight: 600; font-size: .98rem; transition: .15s; text-shadow: 0 1px 2px rgba(0,0,0,.5); }
.file-title::after { content: ''; position: absolute; inset: 0; }
.file-row:hover .file-title { color: var(--gold-l); }
.no-result { text-align: center; color: var(--muted); padding: 26px; font-size: .95rem; font-family: var(--hud); font-size: 1.2rem; }

/* 代码页 */
.code-area { display: flex; flex-direction: column; gap: 10px; margin-top: 6px; }
.section { border: 2px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; background: var(--stone); transition: .15s; box-shadow: 0 4px 10px rgba(0,0,0,.4); }
.section:hover { border-color: var(--blood-d); }
.section-header {
  display: flex; gap: 10px; align-items: flex-start; padding: 11px 14px;
  background: linear-gradient(180deg, var(--stone-3), var(--stone-2)); cursor: pointer; user-select: none; white-space: pre-wrap;
  font-weight: 600; line-height: 1.55; font-family: var(--mono); font-size: .9rem; transition: .15s;
}
.section-header.no-code { cursor: default; opacity: .7; }
.section-header:hover { background: linear-gradient(180deg, #3a2a1e, var(--stone-3)); }
.section .arrow { flex: 0 0 auto; color: var(--gold); transition: transform .18s; font-size: .78rem; margin-top: 3px; }
.section.collapsed .arrow { transform: rotate(-90deg); }
.section.collapsed .code-box { display: none; }
.code-box {
  display: grid; grid-template-columns: max-content 1fr;
  background: #0e0a07; border: 0; border-top: 2px solid var(--border);
  overflow: auto; font-family: var(--mono); font-size: 13.5px; line-height: 1.65; padding: 10px 0;
}
.cell-ln { text-align: right; padding: 0 12px; color: #6a5640; user-select: none; border-right: 1px solid var(--border); min-height: 1.65em; transition: .12s; }
.cell-code { padding: 0 16px; white-space: pre-wrap; overflow-wrap: anywhere; min-height: 1.65em; color: #d8cbb2; transition: .12s; }
.code-box:hover .cell-ln { color: var(--gold); }
.code-box:hover .cell-code { color: #fff5e6; background: rgba(163,30,30,.1); cursor: pointer; }

/* 按钮组 */
.button-group { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
.button-group button, .back-btn {
  padding: 10px 18px; border: 2px solid rgba(0,0,0,.45); border-radius: 10px; cursor: pointer;
  font-weight: 700; font-size: .9rem; font-family: var(--sans); transition: .12s; color: #fff5e6;
  letter-spacing: .03em; text-shadow: 0 1px 2px rgba(0,0,0,.5);
}
.copy-btn { background: linear-gradient(180deg, var(--blood-l), var(--blood-d)); box-shadow: 0 5px 0 #520d0d, 0 8px 14px rgba(0,0,0,.45); }
.download-btn { background: linear-gradient(180deg, var(--gold-l), var(--gold)); color: #1a0a0a; text-shadow: none; box-shadow: 0 5px 0 #6e4716, 0 8px 14px rgba(0,0,0,.45); }
.back-btn {
  background: linear-gradient(180deg, var(--stone-3), var(--stone)); text-decoration: none;
  display: inline-block; color: var(--text); box-shadow: 0 5px 0 #120c09, 0 8px 14px rgba(0,0,0,.45);
}
.button-group button:hover, .back-btn:hover { transform: translateY(-2px); filter: brightness(1.08); }
.button-group button:active, .back-btn:active { transform: translateY(3px); }

.legend { font-size: 1rem; color: var(--muted); margin-top: 12px; text-align: right; font-family: var(--hud); letter-spacing: .04em; }

/* 联系方式 */
.contact { position: relative; z-index: 1; text-align: center; margin-top: 22px; color: var(--muted); font-size: .9rem; font-family: var(--hud); letter-spacing: .04em; }
.contact a { color: var(--gold-l); text-decoration: none; margin-left: 6px; font-weight: 600; }
.contact a:hover { color: var(--blood-l); text-decoration: underline; }

/* 浮层 */
#toast {
  position: fixed; background: #120c09; color: var(--text); padding: 9px 14px; border-radius: 9px;
  border: 2px solid var(--gold); box-shadow: var(--shadow); opacity: 0; transition: .2s;
  pointer-events: none; display: none; font-size: .85rem; z-index: 60; font-family: var(--hud); font-size: 1.05rem;
}
.tooltip {
  position: absolute; background: #120c09; color: var(--gold-l); padding: 5px 10px;
  border: 1px solid var(--border-2); border-radius: 7px; font-size: 12px; font-family: var(--hud);
  pointer-events: none; opacity: 0; transition: opacity .15s; z-index: 60;
}

/* 滚动条 */
::-webkit-scrollbar { width: 12px; height: 12px; }
::-webkit-scrollbar-track { background: #0e0a07; }
::-webkit-scrollbar-thumb { background: var(--border-2); border-radius: 6px; border: 2px solid #0e0a07; }
::-webkit-scrollbar-thumb:hover { background: var(--blood-d); }
"""

# ========== 主页 HTML ==========
html_index = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{TITLE}</title>
    <style>{COMMON_CSS}</style>
</head>
<body>
    <div class="container">
        <h1>以撒代码挑战</h1>
        <div class="subtitle">The Binding of Isaac · 自定义挑战代码合辑 · 共 {challenge_count} 项挑战</div>
        <div class="tools">
            <a href="compressor/index.html" class="tool-link">🛠 Lua 代码压缩器</a>
        </div>
        <div class="search-wrap">
            <input id="searchInput" placeholder="搜索 Lua 文件..." oninput="handleSearch()">
        </div>
        <div class="list-section">
            <div class="list-label"><span>挑战</span><span class="line"></span><span class="list-count">{challenge_count}</span></div>
            <div id="challengeList" class="file-list">{challenge_links}</div>
        </div>{other_section}
        <div id="noResult" class="no-result" style="display:none">没有匹配的文件</div>
    </div>
    <div class="contact">联系我<a href="https://k3t.site/?mail">@Keye3Tuido</a></div>
    <script>
        function handleSearch() {{
            const t = searchInput.value.toLowerCase();
            let shown = 0;
            document.querySelectorAll('.file-list').forEach(list => {{
                let listShown = 0;
                for (const item of list.children) {{
                    const match = item.getAttribute('data-search').toLowerCase().includes(t);
                    item.style.display = match ? '' : 'none';
                    if (match) listShown++;
                }}
                // 整栏（含标题）在无匹配时隐藏
                const section = list.closest('.list-section');
                if (section) section.style.display = listShown ? '' : 'none';
                shown += listShown;
            }});
            document.getElementById('noResult').style.display = shown ? 'none' : 'block';
        }}
    </script>
</body>
</html>
"""

# ========== 子页生成函数（下载模组文件：codeXX.zip，内含 main.lua） ==========
def generate_file_page(fname, raw, cleaned):
    num, title = (fname[:-4].split('.', 1) + [""])[:2]
    safe_title = html.escape(title, quote=True)
    safe_fname = html.escape(fname, quote=True)

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{safe_title} - 以撒代码挑战</title>
    <style>{COMMON_CSS}</style>
    <!-- 引入 JSZip，用于生成 zip -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
</head>
<body>
    <div class="container">
        <h1>{safe_title}</h1>
        <div class="button-group">
            <button onclick="copyAll(event)" class="copy-btn">复制到剪贴板</button>
            <button onclick="downloadZip(event)" class="download-btn">下载模组文件</button>
            <a href="../index.html" class="back-btn">返回主页</a>
        </div>
        <br>
        <div class="code-area" id="codeArea"></div>
        <div class="legend"><span id="subLegend">{safe_fname} - @Keye3Tuido</span></div>
        <div class="button-group">
            <button onclick="copyAll(event)" class="copy-btn">复制到剪贴板</button>
            <button onclick="downloadZip(event)" class="download-btn">下载模组文件</button>
            <a href="../index.html" class="back-btn">返回主页</a>
        </div>
        <div id="toast"></div>
        <div id="hoverTip" class="tooltip"></div>
    </div>
    <script>
        const FILE = {json.dumps({"raw": raw, "cleaned": cleaned}, ensure_ascii=False)};
        const NUM = "{num}";  // 文件编号用于命名 zip
        const TITLE_NAME = "{safe_title}";  // 用于 metadata.xml
        const COLORS = ["#cf3a2c","#e8704a","#d98a33","#e6c24a","#9bb04a","#6fc08a","#46b08a","#5fa8d6","#9a7fd0","#c98a86","#e08aa0","#d96a4a","#b8902f"];

        const codeArea = document.getElementById('codeArea');
        const toast = document.getElementById('toast');
        const hoverTip = document.getElementById('hoverTip');

        function isComment(l) {{
            if (l.startsWith("l ")) l = l.slice(2);
            return l.trim().startsWith("--");
        }}
        function isBlank(l) {{ return l.trim() === ""; }}

        let prevColor = null;
        function pickColor() {{
            let c;
            do c = COLORS[Math.floor(Math.random() * COLORS.length)];
            while (c === prevColor);
            prevColor = c;
            return c;
        }}

        function bindHover(el, charCount) {{
            el.onmouseenter = (e) => showHoverTip(e.clientX, e.clientY, charCount);
            el.onmousemove = (e) => showHoverTip(e.pageX, e.pageY, charCount);
            el.onmouseleave = hideHoverTip;
        }}

        // 构建代码框（行号 + 代码，单一网格保证换行后对齐），点击复制整块代码
        function buildCodeBox(codeLines) {{
            const box = document.createElement('div');
            box.className = 'code-box';

            const blockText = codeLines.map(it => it.text).join('\\n');
            box.onclick = (e) => copyBlock(blockText, codeLines.length, e);
            bindHover(box, blockText.length);

            codeLines.forEach(item => {{
                const ln = document.createElement('div');
                ln.className = 'cell-ln';
                ln.textContent = item.no;
                box.appendChild(ln);

                const code = document.createElement('div');
                code.className = 'cell-code';
                code.textContent = item.text;
                box.appendChild(code);
            }});

            return box;
        }}

        function render() {{
            codeArea.innerHTML = "";
            const lines = FILE.raw.split('\\n');
            const n = lines.length;
            let i = 0;

            while (i < n) {{
                while (i < n && isBlank(lines[i])) i++;   // 跳过段间空行
                if (i >= n) break;

                const header = [];
                while (i < n && isComment(lines[i])) {{ header.push(lines[i]); i++; }}

                const codeLines = [];
                while (i < n && !isComment(lines[i])) {{
                    if (!isBlank(lines[i])) codeLines.push({{ no: i + 1, text: lines[i] }});
                    i++;
                }}

                const section = document.createElement('div');
                section.className = 'section';

                const head = document.createElement('div');
                head.className = 'section-header';

                if (codeLines.length) {{
                    const arrow = document.createElement('span');
                    arrow.className = 'arrow';
                    arrow.textContent = '▼';
                    head.appendChild(arrow);
                }}

                const text = document.createElement('span');
                text.className = 'header-text';
                if (header.length) {{
                    header.forEach((c, k) => {{
                        const span = document.createElement('span');
                        span.style.color = pickColor();
                        span.textContent = c;
                        text.appendChild(span);
                        if (k < header.length - 1) text.appendChild(document.createTextNode('\\n'));
                    }});
                }} else {{
                    text.textContent = '代码';
                }}
                head.appendChild(text);
                section.appendChild(head);

                if (codeLines.length) {{
                    section.classList.add('collapsed');          // 默认折叠
                    head.onclick = () => section.classList.toggle('collapsed');
                    section.appendChild(buildCodeBox(codeLines));
                }} else {{
                    head.classList.add('no-code');
                }}

                codeArea.appendChild(section);
            }}
        }}

        function showToastAt(m, x, y) {{
            toast.textContent = m;
            toast.style.display = 'block';
            const offset = 12;
            let left = x + offset, top = y + offset;
            toast.style.left = left + 'px';
            toast.style.top = top + 'px';
            toast.style.opacity = 1;
            const rect = toast.getBoundingClientRect();
            if (rect.right > innerWidth) toast.style.left = Math.max(0, x - rect.width - offset) + 'px';
            if (rect.bottom > innerHeight) toast.style.top = Math.max(0, y - rect.height - offset) + 'px';
            setTimeout(() => {{ toast.style.opacity = 0; toast.style.display = 'none'; }}, 5000);
        }}

        function copyBlock(text, count, e) {{
            if (!text) return;
            navigator.clipboard.writeText(text)
                .then(() => showToastAt("已复制该代码块（" + count + " 行，" + text.length + " 字符）", e.clientX, e.clientY))
                .catch(err => showToastAt("复制失败: " + err, e.clientX, e.clientY));
        }}

        function copyAll(e) {{
            navigator.clipboard.writeText(FILE.raw)
                .then(() => showToastAt("已复制代码到剪贴板", e.clientX, e.clientY))
                .catch(() => showToastAt("复制失败", e.clientX, e.clientY));
        }}

        // 下载模组文件：生成 codeXX.zip，内含 main.lua 和 metadata.xml
        async function downloadZip(e) {{
            try {{
                const filename = "code" + NUM + ".zip";
                const zip = new JSZip();

                // 添加 main.lua
                zip.file("main.lua", FILE.cleaned);

                // 添加 metadata.xml
                const metadata = `
                    <metadata>
                        <name>code${{NUM}}-${{TITLE_NAME}}</name>
                        <directory>code${{NUM}}</directory>
                        <description/>
                        <version>1.0</version>
                        <visibility/>
                    </metadata>`;
                zip.file("metadata.xml", metadata.trim());

                // 生成并下载 zip
                const blob = await zip.generateAsync({{ type: "blob" }});
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = filename;
                a.click();
                URL.revokeObjectURL(a.href);

                showToastAt("已下载模组文件; 将文件解压至游戏mods目录下即可进行游戏", e.clientX, e.clientY);
            }} catch (err) {{
                showToastAt("下载失败: " + err, e.clientX, e.clientY);
            }}
        }}
        
        function showHoverTip(x, y, charCount) {{
            hoverTip.textContent = "点击以复制该代码块（" + charCount + " 字符）";
            hoverTip.style.left = (x + 12) + "px";
            hoverTip.style.top = (y + 12) + "px";
            hoverTip.style.display = "block";
            hoverTip.style.opacity = 1;
        }}

        function hideHoverTip() {{
            hoverTip.style.opacity = 0;
            hoverTip.style.display = 'none';
        }}

        render();
    </script>
    <div class="contact">联系我<a href="https://k3t.site/?mail">@Keye3Tuido</a></div>
</body>
</html>
"""

# ========== 主程序：输出主页与子页到目录 ==========
if __name__ == "__main__":
    # 生成主页
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html_index)
    print("已生成 index.html")

    # 创建子页目录
    os.makedirs(SUBDIR, exist_ok=True)

    # 生成子页
    for fname, content in files.items():
        num = fname.split('.')[0]
        page_html = generate_file_page(fname, content["raw"], content["cleaned"])
        out_path = os.path.join(SUBDIR, f"file_{num}.html")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(page_html)
        print(f"已生成子页面 {out_path}")
