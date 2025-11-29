import os
import json


def clean_code(s):
    return "\n".join(
        l[2:] if l.startswith("l ") else l 
        for l in s.splitlines()
    )


# 收集并排序 Lua 文件
files = {
    f: {"raw": r, "cleaned": clean_code(r)}
    for f in sorted(
        (x for x in os.listdir('.') if x.endswith('.lua') and not x.startswith('$')),
        key=lambda x: int(x.split('.')[0]) if x.split('.')[0].isdigit() else float('inf')
    )
    for r in [open(f, encoding="utf-8").read()]
}


# 主页文件列表：序号在最左端，标题在右侧文本框
def item(f):
    base = f[:-4]
    num, title = (base.split('.', 1) + [""])[:2]
    return (
        f"<div class='file-row' data-search='{num} {title}'>"
        f"<span class='file-num'>{num}</span>"
        f"<a href='#' onclick=\"showFile('{f}')\" class='file-title'>{title}</a>"
        f"</div>"
    )


links = "\n".join(item(f) for f in files)

html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>以撒代码挑战 - Keye3Tuido</title>
    <style>
        body {{
            font-family: Consolas, sans-serif;
            background: #f5f7fa;
            margin: 20px;
        }}
        .container {{
            max-width: 1100px;
            margin: auto;
            background: #fff;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 0 10px #0001;
        }}
        h1 {{
            text-align: center;
            color: #2c3e50;
            margin-bottom: 12px;
        }}
        .file-list {{
            display: flex;
            flex-direction: column;
            gap: 6px;
        }}
        .file-row {{
            display: grid;
            grid-template-columns: 60px 1fr;
            align-items: center;
        }}
        .file-num {{
            text-align: center;
            color: #7f8c8d;
            font-weight: bold;
        }}
        .file-title {{
            padding: 8px;
            background: #ecf0f1;
            border-radius: 6px;
            text-decoration: none;
            color: #2c3e50;
            display: block;
        }}
        .file-title:hover {{
            background: #3498db;
            color: #fff;
        }}
        .code-box {{
            display: grid;
            grid-template-columns: max-content 1fr;
            background: #f8f9fa;
            border: 1px solid #ddd;
            border-radius: 5px;
            overflow: auto;
            font-size: 14px;
            line-height: 1.6;
        }}
        .col-ln, .col-code {{
            display: grid;
            grid-auto-rows: minmax(1.6em, auto);
        }}
        .col-ln {{
            text-align: right;
            padding: 12px 10px;
            color: #7f8c8d;
            user-select: none;
            border-right: 1px solid #e0e0e0;
        }}
        .col-code {{
            padding: 12px 15px;
            white-space: pre;
        }}
        .row.comment {{
            font-weight: 500;
        }}
        .col-ln .row:hover, .col-code .row:hover {{
            background: #eef;
            color: #3498db;
            cursor: pointer;
        }}
        .legend {{
            font-size: 12px;
            color: #7f8c8d;
            margin-top: 8px;
            text-align: right;
        }}
        .button-group {{
            display: flex;
            gap: 8px;
        }}
        .button-group button {{
            padding: 8px 12px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            transition: .15s;
        }}
        .copy-btn {{
            background: #3498db;
            color: #fff;
        }}
        .copy-btn:hover {{
            background: #2b82c6;
        }}
        .download-btn {{
            background: #2ecc71;
            color: #fff;
        }}
        .download-btn:hover {{
            background: #27b866;
        }}
        .back-btn {{
            background: #95a5a6;
            color: #fff;
        }}
        .back-btn:hover {{
            background: #7f8c8d;
        }}
        #toast {{
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #333;
            color: #fff;
            padding: 6px 10px;
            border-radius: 5px;
            opacity: 0;
            transition: .3s;
            pointer-events: none;
            display: none;
        }}
        #searchInput {{
            padding: 6px;
            width: 70%;
            border: 1px solid #ccc;
            border-radius: 5px;
            margin: 10px auto;
            display: block;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>以撒代码挑战</h1>
        <div id="home">
            <input id="searchInput" placeholder="搜索Lua文件..." oninput="handleSearch()">
            <div id="fileList" class="file-list">{links}</div>
        </div>
        <div id="detail" style="display:none;flex-direction:column;gap:10px;">
            <h2 id="fileTitle"></h2>
            <div class="code-box">
                <div class="col-ln" id="lineNumbers"></div>
                <div class="col-code" id="codeLines"></div>
            </div>
            <div class="legend"><span id="subLegend"></span></div>
            <div class="button-group">
                <button onclick="copyToClipboard()" class="copy-btn">复制到剪贴板</button>
                <button onclick="downloadLua()" class="download-btn">下载lua文件</button>
                <button onclick="showHome()" class="back-btn">返回主页</button>
            </div>
            <div id="toast"></div>
        </div>
    </div>
    <script>
        const files = {json.dumps(files, ensure_ascii=False)};
        const COLORS = ["#e74c3c", "#c0392b", "#d35400", "#e67e22", "#f39c12", "#2ecc71", 
                        "#27ae60", "#1abc9c", "#16a085", "#3498db", "#2980b9", "#9b59b6", "#8e44ad"];
        let currentFile = null;
        
        function isComment(l) {{
            if (l.startsWith("l ")) l = l.slice(2);
            return l.trim().startsWith("--");
        }}
        
        function showFile(n) {{
            home.style.display = 'none';
            detail.style.display = 'flex';
            fileTitle.textContent = n;
            subLegend.textContent = n + " - @Keye3Tuido";
            lineNumbers.innerHTML = codeLines.innerHTML = "";
            let p = null;
            files[n].raw.split('\\n').forEach((l, i) => {{
                lineNumbers.innerHTML += `<div class='row' onclick='copyLine(${{i}})'>${{i + 1}}</div>`;
                if (!l) {{
                    codeLines.innerHTML += "<div class='row'></div>";
                    p = null;
                }} else if (isComment(l)) {{
                    let c;
                    do c = COLORS[Math.floor(Math.random() * COLORS.length)];
                    while (c === p);
                    p = c;
                    codeLines.innerHTML += `<div class='row comment' style='color:${{c}}' onclick='copyLine(${{i}})'>${{l}}</div>`;
                }} else {{
                    codeLines.innerHTML += `<div class='row' onclick='copyLine(${{i}})'>${{l}}</div>`;
                    p = null;
                }}
            }});
            currentFile = n;
        }}
        
        function showHome() {{
            detail.style.display = 'none';
            home.style.display = 'block';
            currentFile = null;
        }}
        
        function copyLine(i) {{
            const l = codeLines.children[i]?.textContent;
            if (l) navigator.clipboard.writeText(l)
                .then(() => showToast("已复制第 " + (i + 1) + " 行"))
                .catch(e => showToast("复制失败:" + e));
        }}
        
        function copyToClipboard() {{
            if (currentFile) navigator.clipboard.writeText(files[currentFile].raw)
                .then(() => showToast("已复制代码到剪贴板"))
                .catch(() => showToast("复制失败"));
        }}
        
        function downloadLua() {{
            if (!currentFile) return;
            const num = currentFile.split('.')[0];
            const b = new Blob([files[currentFile].cleaned], {{type: 'text/plain'}});
            const a = document.createElement('a');
            a.href = URL.createObjectURL(b);
            a.download = 'code' + num + '.lua';
            a.click();
            URL.revokeObjectURL(a.href);
        }}
        
        function handleSearch() {{
            const t = searchInput.value.toLowerCase();
            for (const item of fileList.children)
                item.style.display = item.getAttribute('data-search').toLowerCase().includes(t) ? 'grid' : 'none';
        }}
        
        function showToast(m) {{
            toast.textContent = m;
            toast.style.display = 'block';
            toast.style.opacity = 1;
            setTimeout(() => {{
                toast.style.opacity = 0;
                toast.style.display = 'none';
            }}, 2000);
        }}
    </script>
</body>
</html>
"""

if __name__ == "__main__":
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("✅ 已生成index.html")
