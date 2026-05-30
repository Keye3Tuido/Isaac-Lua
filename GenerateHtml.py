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

# ========== 公共样式 ==========
COMMON_CSS = """
* { box-sizing: border-box; }
:root{
  --bg:#f4f6fb; --panel:#ffffff; --panel-2:#f6f8fd; --panel-3:#eef1fa;
  --border:#e4e8f2; --text:#3b4252; --muted:#9aa3b8;
  --accent:#7c83f0; --accent-d:#5a62e0; --mint:#3ec9b0; --gold:#f6b352;
  --blue:#5cb8e6; --green:#5ccf9b; --purple:#a98cf0; --pink:#f48fb1; --coral:#f47e7e;
  --radius:18px; --radius-sm:12px;
  --shadow:0 14px 40px rgba(90,98,180,.14);
  --mono:'Cascadia Code','JetBrains Mono',Consolas,'Courier New',monospace;
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
    radial-gradient(900px 480px at 8% -10%, #ffe3ec 0%, transparent 56%),
    radial-gradient(820px 460px at 100% 0%, #e2ecff 0%, transparent 58%),
    radial-gradient(760px 500px at 50% 110%, #e4fbf3 0%, transparent 60%),
    radial-gradient(700px 420px at 90% 100%, #fff1da 0%, transparent 58%),
    var(--bg);
  background-attachment: fixed;
  -webkit-font-smoothing: antialiased;
}
@keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.container {
  max-width: 1080px;
  margin: auto;
  background: rgba(255,255,255,.82);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255,255,255,.7);
  padding: 30px 30px 26px;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  animation: rise .4s ease;
}
h1 {
  text-align: center;
  margin: 4px 0 4px;
  font-size: 2.05rem;
  letter-spacing: .04em;
  font-weight: 800;
  background: linear-gradient(90deg, #f47e7e, #a98cf0 45%, #5cb8e6 75%, #3ec9b0);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.subtitle { text-align: center; color: var(--muted); font-size: .9rem; margin-bottom: 18px; letter-spacing: .02em; }

/* 工具按钮 */
.tools { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin: 4px 0 18px; }
.tool-link {
  padding: 10px 20px; border-radius: 12px; text-decoration: none; font-weight: 700;
  color: #fff; background: linear-gradient(135deg, var(--purple), var(--accent-d));
  border: 1px solid rgba(255,255,255,.4);
  box-shadow: 0 6px 16px rgba(124,131,240,.34); transition: .18s;
}
.tool-link:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(124,131,240,.45); filter: brightness(1.05); }

/* 搜索框 */
.search-wrap { position: relative; max-width: 480px; margin: 0 auto 22px; }
.search-wrap::before {
  content: '🔍'; position: absolute; left: 15px; top: 50%; transform: translateY(-50%);
  opacity: .5; font-size: .9rem; pointer-events: none;
}
#searchInput {
  width: 100%; padding: 12px 16px 12px 42px; border-radius: 14px;
  border: 1px solid var(--border); background: #fff; color: var(--text);
  font-size: .95rem; outline: none; transition: .18s; font-family: var(--sans);
}
#searchInput::placeholder { color: var(--muted); }
#searchInput:focus { border-color: var(--accent); box-shadow: 0 0 0 4px rgba(124,131,240,.16); }

/* 分栏标题 */
.list-section { margin-bottom: 22px; }
.list-section:last-of-type { margin-bottom: 0; }
.list-label { display: flex; align-items: center; gap: 12px; margin: 0 2px 12px; color: var(--accent-d); font-weight: 700; font-size: 1.02rem; letter-spacing: .05em; }
.list-label .line { flex: 1; height: 1px; background: linear-gradient(90deg, var(--border), transparent); }
.list-label .list-count { flex: 0 0 auto; color: var(--accent-d); font-size: .82rem; font-weight: 600; font-family: var(--mono); background: var(--panel-3); border: 1px solid var(--border); padding: 2px 9px; border-radius: 999px; letter-spacing: 0; }

/* 文件卡片网格 */
.file-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(232px, 1fr)); gap: 11px; }
.file-row {
  --c:#7c83f0; --c2:#5cb8e6;
  position: relative; display: flex; align-items: center; gap: 12px;
  background: #fff; border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 11px 13px; overflow: hidden; transition: .18s;
}
/* 卡片按位置循环取色，避免单调 */
.file-row:nth-child(7n+1){ --c:#f47e7e; --c2:#f9a66c; }
.file-row:nth-child(7n+2){ --c:#f6a94c; --c2:#f6c94c; }
.file-row:nth-child(7n+3){ --c:#5ccf9b; --c2:#3ec9b0; }
.file-row:nth-child(7n+4){ --c:#5cb8e6; --c2:#6aa8f0; }
.file-row:nth-child(7n+5){ --c:#7c83f0; --c2:#9a8cf0; }
.file-row:nth-child(7n+6){ --c:#a98cf0; --c2:#c98cf0; }
.file-row:nth-child(7n+7){ --c:#f48fb1; --c2:#f47ea0; }
.file-row::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: linear-gradient(var(--c), var(--c2)); opacity: 0; transition: .18s;
}
.file-row:hover {
  transform: translateY(-2px); border-color: var(--c);
  background: color-mix(in srgb, var(--c) 7%, #fff);
  box-shadow: 0 10px 22px color-mix(in srgb, var(--c) 28%, transparent);
}
.file-row:hover::before { opacity: 1; }
.file-num {
  flex: 0 0 auto; min-width: 36px; height: 34px; padding: 0 9px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--c), var(--c2));
  color: #fff; font-weight: 700; font-size: .8rem; border-radius: 9px;
  font-family: var(--mono); box-shadow: 0 3px 9px color-mix(in srgb, var(--c) 40%, transparent);
}
.file-title { flex: 1; text-decoration: none; color: var(--text); font-weight: 600; font-size: .98rem; transition: .15s; }
.file-title::after { content: ''; position: absolute; inset: 0; }
.file-row:hover .file-title { color: var(--c); }
.no-result { text-align: center; color: var(--muted); padding: 26px; font-size: .95rem; }

/* 代码页 */
.code-area { display: flex; flex-direction: column; gap: 10px; margin-top: 6px; }
.section { border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; background: #fff; transition: .18s; box-shadow: 0 2px 8px rgba(90,98,180,.05); }
.section:hover { border-color: var(--accent); }
.section-header {
  display: flex; gap: 10px; align-items: flex-start; padding: 11px 14px;
  background: var(--panel-2); cursor: pointer; user-select: none; white-space: pre-wrap;
  font-weight: 600; line-height: 1.55; font-family: var(--mono); font-size: .9rem; transition: .15s;
}
.section-header.no-code { cursor: default; opacity: .75; }
.section-header:hover { background: var(--panel-3); }
.section .arrow { flex: 0 0 auto; color: var(--accent); transition: transform .18s; font-size: .78rem; margin-top: 3px; }
.section.collapsed .arrow { transform: rotate(-90deg); }
.section.collapsed .code-box { display: none; }
.code-box {
  display: grid; grid-template-columns: max-content 1fr;
  background: #f7f8fd; border: 0; border-top: 1px solid var(--border);
  overflow: auto; font-family: var(--mono); font-size: 13.5px; line-height: 1.65; padding: 10px 0;
}
.cell-ln { text-align: right; padding: 0 12px; color: #b4bcd0; user-select: none; border-right: 1px solid var(--border); min-height: 1.65em; transition: .12s; }
.cell-code { padding: 0 16px; white-space: pre-wrap; overflow-wrap: anywhere; min-height: 1.65em; color: #424a5e; transition: .12s; }
.code-box:hover .cell-ln { color: var(--accent-d); }
.code-box:hover .cell-code { color: #1f2533; background: rgba(124,131,240,.07); cursor: pointer; }

/* 按钮组 */
.button-group { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
.button-group button, .back-btn {
  padding: 10px 17px; border: none; border-radius: 12px; cursor: pointer;
  font-weight: 700; font-size: .9rem; font-family: var(--sans); transition: .18s; color: #fff;
}
.copy-btn { background: linear-gradient(135deg, var(--blue), #3a9fd6); box-shadow: 0 5px 13px rgba(92,184,230,.34); }
.download-btn { background: linear-gradient(135deg, var(--green), #36b886); box-shadow: 0 5px 13px rgba(92,207,155,.34); }
.back-btn {
  background: #fff; border: 1px solid var(--border); text-decoration: none;
  display: inline-block; color: var(--text);
}
.button-group button:hover, .back-btn:hover { transform: translateY(-2px); filter: brightness(1.04); }

.legend { font-size: 12px; color: var(--muted); margin-top: 12px; text-align: right; font-family: var(--mono); }

/* 联系方式 */
.contact { text-align: center; margin-top: 22px; color: var(--muted); font-size: .88rem; }
.contact a { color: var(--accent-d); text-decoration: none; margin-left: 6px; font-weight: 600; }
.contact a:hover { text-decoration: underline; }

/* 浮层 */
#toast {
  position: fixed; background: #3b4252; color: #fff; padding: 8px 14px; border-radius: 10px;
  box-shadow: var(--shadow); opacity: 0; transition: .2s;
  pointer-events: none; display: none; font-size: .85rem; z-index: 60;
}
.tooltip {
  position: absolute; background: #3b4252; color: #fff; padding: 5px 10px;
  border-radius: 8px; font-size: 12px;
  pointer-events: none; opacity: 0; transition: opacity .15s; z-index: 60;
}

/* 滚动条 */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #d4d9e8; border-radius: 6px; }
::-webkit-scrollbar-thumb:hover { background: #c0c7dc; }
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
        const COLORS = ["#e8590c","#d9480f","#c2255c","#a61e4d","#5f3dc4","#3b5bdb","#1971c2","#0c8599","#087f5b","#2b8a3e","#5c940d","#e67700","#9c36b5"];

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
