/* 内嵌脚本工具通用前端件（构建期内联；样式自注入，不触碰 style.css/page.js 之外）。
 * 工具唯一事实源 = scripts/tools/<id>.py（规格头驱动表单，参考实现直接在浏览器运行）。
 * 新增工具：tools/ 下加 <id>.py（规格头 + main() 读 sys.argv）+ lua 块头 内嵌脚本: [<id>]。
 * argv 约定：file/text 输入按规格顺序作位置参数（file 先写入 /tmp），number/select 作 --name value。 */
(function () {
    if (window.SCRIPT_TOOLBOX) return;

    var PYODIDE_VER = 'v0.26.4';
    var PYODIDE_LOCAL = 'assets/pyodide/'; // 项目内置，离线可用
    var PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/' + PYODIDE_VER + '/full/';
    var pyodideBase = null;
    function resolveBase() {
        if (pyodideBase) return Promise.resolve(pyodideBase);
        return fetch(PYODIDE_LOCAL + 'pyodide.js', { method: 'HEAD' }).then(function (r) {
            pyodideBase = r.ok ? PYODIDE_LOCAL : PYODIDE_CDN;
            return pyodideBase;
        }, function () {
            pyodideBase = PYODIDE_CDN;
            return pyodideBase;
        });
    }

    // ---- 样式（自注入，scoped 于脚本框） ----
    var css = ''
        + '.tool-launch{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}'
        + '.tool-launch-btn{font-size:12px;padding:3px 10px;border:1px solid #8a6d3b;border-radius:4px;background:#fff8e1;color:#7a5c1e;cursor:pointer}'
        + '.tool-launch-btn:hover{background:#ffefc0}'
        + '#scriptPanel{position:fixed;z-index:9999;width:min(560px,calc(100vw - 16px));background:#fffdf6;border:1px solid #b9a06a;border-radius:8px;box-shadow:0 8px 30px rgba(60,40,0,.35);font-size:13px}'
        + '.script-panel-head{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#f3e6c3;border-bottom:1px solid #b9a06a;border-radius:8px 8px 0 0;cursor:move;user-select:none;font-weight:600;color:#5a4413;touch-action:none}'
        + '.script-panel-close{border:none;background:none;font-size:18px;line-height:1;cursor:pointer;color:#7a5c1e}'
        + '.script-panel-close:hover{color:#b3261e}'
        + '.script-panel-tabs{display:flex;gap:4px;padding:6px 8px 0;border-bottom:1px solid #e4d5ae}'
        + '.script-tab{font-size:12px;padding:4px 10px;border:1px solid #d8c491;border-bottom:none;border-radius:6px 6px 0 0;background:#f8f0da;color:#6b5220;cursor:pointer}'
        + '.script-tab.active{background:#fffdf6;font-weight:600}'
        + '.script-panel-body{padding:10px;max-height:70vh;overflow:auto}'
        + '.script-pane{display:flex;flex-direction:column;gap:8px}'
        + '.script-field{display:flex;flex-direction:column;gap:3px;font-size:12px;color:#6b5220}'
        + '.script-field>span{font-weight:600}'
        + '.script-pane textarea{width:100%;box-sizing:border-box;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;padding:6px;border:1px solid #cbb57f;border-radius:4px;background:#fff;resize:vertical}'
        + '.script-pane input[type=text],.script-pane input[type=number]{padding:4px 6px;border:1px solid #cbb57f;border-radius:4px;font-size:12px}'
        + '.script-output{background:#fbfaf5;word-break:break-all}'
        + '.script-count{font-size:11px;color:#a08c5a;min-height:14px}'
        + '.script-status{font-size:12px;color:#8a6d3b;min-height:16px}'
        + '.script-dl{font-size:12px;color:#7a5c1e}';
    var st = document.createElement('style');
    st.id = 'scriptToolboxCss';
    st.textContent = css;
    document.head.appendChild(st);

    function manifest() { return window.__TOOLS_MANIFEST__ || []; }
    function sources() { return window.__TOOL_SOURCES__ || {}; }
    function specOf(id) {
        var list = manifest();
        for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
        return null;
    }

    // ---- Pyodide 运行时（懒加载，首用后缓存；失败/超时可重试） ----
    var pyodidePromise = null;
    function loadRuntime() {
        if (!pyodidePromise) {
            pyodidePromise = new Promise(function (resolve, reject) {
                var settled = false;
                var timer = setTimeout(function () {
                    if (settled) return;
                    settled = true;
                    pyodidePromise = null; // 下次运行重新尝试加载
                    reject(new Error('Pyodide 加载超时（30 秒），请检查网络后重试'));
                }, 30000);
                function fail(msg) {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    pyodidePromise = null; // 下次运行重新尝试加载
                    reject(new Error(msg));
                }
                var s = document.createElement('script');
                s.onerror = function () { fail('Pyodide 加载失败'); };
                resolveBase().then(function (base) {
                    s.src = base + 'pyodide.js';
                    s.onload = function () {
                        window.loadPyodide({ indexURL: base }).then(function (py) {
                            if (settled) return;
                            settled = true;
                            clearTimeout(timer);
                            resolve(py);
                        }, function () { fail('Pyodide 初始化失败'); });
                    };
                    document.head.appendChild(s);
                }, function () { fail('Pyodide 路径解析失败'); });
            });
        }
        return pyodidePromise;
    }

    function needsPillow(src) { return /^\s*(import|from)\s+PIL/gm.test(src); }

    // 在浏览器里跑真实 py 工具：file→/tmp 位置参数，number/select→--name value，text→位置参数
    function runTool(id, values, io) {
        var src = sources()[id];
        if (!src) return Promise.reject(new Error('缺少脚本源码：' + id));
        var spec = specOf(id) || { inputs: [] };
        return loadRuntime().then(function (py) {
            io.status('Python 运行时就绪');
            var chain = Promise.resolve();
            if (needsPillow(src)) {
                chain = chain.then(function () {
                    io.status('加载 Pillow（约 3 MB，仅首次需要）…');
                    var loading = py.loadPackage('pillow');
                    var timeout = new Promise(function (_, reject) {
                        setTimeout(function () { reject(new Error('Pillow 加载超时（90 秒），请重试')); }, 90000);
                    });
                    return Promise.race([loading, timeout]);
                });
            }
            return chain.then(function () {
                var argv = [id];
                var writes = Promise.resolve();
                (spec.inputs || []).forEach(function (inp) {
                    var v = values[inp.name];
                    if (v === undefined || v === null || v === '') return;
                    if (inp.type === 'file') {
                        (function (inp2, file) {
                            writes = writes.then(function () {
                                return file.arrayBuffer().then(function (buf) {
                                    var m = /\.[A-Za-z0-9]+$/.exec(file.name || '');
                                    var path = '/tmp/in_' + inp2.name + (m ? m[0] : '');
                                    py.FS.writeFile(path, new Uint8Array(buf));
                                    argv.push(path);
                                });
                            });
                        })(inp, v);
                    } else if (inp.type === 'number' || inp.type === 'select') {
                        argv.push('--' + inp.name, String(v));
                    } else {
                        argv.push(String(v));
                    }
                });
                return writes.then(function () {
                    var out = '';
                    py.setStdout({ batched: function (s) { out += s; io.status(s.trim().slice(-80) || '运行中…'); } });
                    py.setStderr({ batched: function (s) { out += s; } });
                    io.status('运行中…');
                    return py.runPythonAsync('__name__="__tool__"\n' + src)
                        .then(function () {
                            return py.runPythonAsync('import sys\nsys.argv=' + JSON.stringify(argv) + '\nmain()');
                        })
                        .then(function () { return out; });
                });
            });
        });
    }

    // ---- 规格驱动表单（输入/输出状态持久化到 sessionStorage，通用逻辑与具体工具无关） ----
    function loadState(id) {
        try { return JSON.parse(sessionStorage.getItem('scriptPanel.state.' + id) || 'null'); }
        catch (e) { return null; }
    }
    function saveState(id, state) {
        try { sessionStorage.setItem('scriptPanel.state.' + id, JSON.stringify(state)); }
        catch (e) { /* 忽略 */ }
    }

    function buildForm(pane, spec, io) {
        var saved = loadState(spec.id) || {};
        var savedV = saved.v || {};
        var pairs = [];
        (spec.inputs || []).forEach(function (inp) {
            var field = document.createElement('label');
            field.className = 'script-field';
            var lab = document.createElement('span');
            lab.textContent = inp.label || inp.name;
            field.appendChild(lab);
            var input;
            if (inp.type === 'text') {
                input = document.createElement('textarea');
                input.rows = 4;
                if (inp.placeholder) input.placeholder = inp.placeholder;
            } else if (inp.type === 'file') {
                input = document.createElement('input');
                input.type = 'file';
                if (inp.accept) input.accept = inp.accept;
            } else if (inp.type === 'number') {
                input = document.createElement('input');
                input.type = 'number';
                if (inp.default !== undefined) input.value = inp.default;
            } else if (inp.type === 'select') {
                input = document.createElement('select');
                (inp.options || []).forEach(function (o) {
                    var op = document.createElement('option');
                    op.value = o; op.textContent = o;
                    input.appendChild(op);
                });
            } else {
                input = document.createElement('input');
                input.type = 'text';
            }
            if (inp.type !== 'file' && savedV[inp.name] !== undefined) {
                input.value = savedV[inp.name];
            }
            field.appendChild(input);
            pane.appendChild(field);
            pairs.push({ inp: inp, input: input });
        });
        var values = {};
        pairs.forEach(function (p) {
            Object.defineProperty(values, p.inp.name, {
                get: function () {
                    if (p.inp.type === 'file') return p.input.files && p.input.files[0];
                    return p.input.value;
                }
            });
        });
        function persist() {
            var v = {};
            pairs.forEach(function (p) {
                if (p.inp.type !== 'file') v[p.inp.name] = p.input.value;
            });
            saveState(spec.id, { v: v, out: out.value });
        }
        pairs.forEach(function (p) {
            if (p.inp.type === 'file') return;
            p.input.addEventListener('input', persist);
            p.input.addEventListener('change', persist);
        });

        var runBtn = document.createElement('button');
        runBtn.className = 'copy-btn';
        runBtn.textContent = '运行';
        var count = document.createElement('div');
        count.className = 'script-count';
        var out = document.createElement('textarea');
        out.className = 'script-output';
        out.readOnly = true;
        out.rows = 8;
        out.placeholder = '输出（点击复制）';
        out.title = '点击复制全部输出';
        function refreshCount() {
            count.textContent = out.value ? '输出 ' + out.value.length + ' 字符' : '';
        }
        if (saved.out) { out.value = saved.out; }
        refreshCount();
        out.addEventListener('click', function () {
            if (!out.value) return;
            var done = function () { io.status('已复制 ' + out.value.length + ' 字符'); };
            var fallback = function () {
                out.select();
                try { document.execCommand('copy'); done(); } catch (e) { io.status('复制失败，请手动 Ctrl/Cmd+C'); }
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(out.value).then(done, fallback);
            } else {
                fallback();
            }
        });
        var dl = document.createElement('a');
        dl.className = 'script-dl';
        dl.textContent = '下载 ' + spec.id + '.py';
        dl.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(sources()[spec.id] || '');
        dl.download = spec.id + '.py';
        runBtn.onclick = function () {
            out.value = '';
            refreshCount();
            runBtn.disabled = true;
            io.status('启动中…');
            var p;
            try {
                p = runTool(spec.id, values, io);
            } catch (e) {
                p = Promise.reject(e);
            }
            Promise.resolve(p).then(function (text) {
                out.value = text;
                refreshCount();
                persist();
                io.status('完成，输出 ' + text.length + ' 字符');
            }, function (err) {
                out.value = '';
                refreshCount();
                persist();
                io.status('失败：' + (err && err.message ? err.message : String(err)));
            }).then(function () { runBtn.disabled = false; });
        };
        pane.append(runBtn, count, out, dl);
    }

    // ---- 悬浮面板（单例、可拖动、页签） ----
    var panel = { el: null, bar: null, body: null, tabs: {} };

    function ensurePanel() {
        if (panel.el) return;
        var el = document.createElement('div');
        el.id = 'scriptPanel';
        el.style.display = 'none';
        var head = document.createElement('div');
        head.className = 'script-panel-head';
        var title = document.createElement('span');
        title.textContent = '脚本工具';
        var closeBtn = document.createElement('button');
        closeBtn.className = 'script-panel-close';
        closeBtn.textContent = '×';
        closeBtn.onclick = function () {
            el.style.display = 'none';
            try { sessionStorage.setItem('scriptPanel.visible', '0'); } catch (e) { /* 忽略 */ }
        };
        head.append(title, closeBtn);
        var bar = document.createElement('div');
        bar.className = 'script-panel-tabs';
        var body = document.createElement('div');
        body.className = 'script-panel-body';
        el.append(head, bar, body);
        document.body.appendChild(el);

        var dragging = false, dx = 0, dy = 0;
        head.addEventListener('pointerdown', function (ev) {
            if (ev.target === closeBtn) return;
            dragging = true;
            var rect = el.getBoundingClientRect();
            dx = ev.clientX - rect.left;
            dy = ev.clientY - rect.top;
            head.setPointerCapture(ev.pointerId);
        });
        head.addEventListener('pointermove', function (ev) {
            if (!dragging) return;
            var W = el.offsetWidth;
            var x = Math.min(Math.max(ev.clientX - dx, -W + 60), window.innerWidth - 60);
            var y = Math.min(Math.max(ev.clientY - dy, 0), window.innerHeight - 40);
            el.style.left = x + 'px';
            el.style.top = y + 'px';
        });
        head.addEventListener('pointerup', function () { dragging = false; });

        panel.el = el; panel.bar = bar; panel.body = body;
    }

    function open(id) {
        var spec = specOf(id);
        if (!spec) { window.alert('未知工具：' + id); return; }
        ensurePanel();
        if (!panel.tabs[id]) {
            var btn = document.createElement('button');
            btn.className = 'script-tab';
            btn.textContent = spec.title || id;
            btn.onclick = function () { activate(id); };
            panel.bar.appendChild(btn);
            var pane = document.createElement('div');
            pane.className = 'script-pane';
            var status = document.createElement('div');
            status.className = 'script-status';
            var io = { status: function (s) { status.textContent = s; } };
            pane.appendChild(status);
            buildForm(pane, spec, io);
            panel.body.appendChild(pane);
            panel.tabs[id] = { btn: btn, pane: pane };
        }
        try {
            sessionStorage.setItem('scriptPanel.tools', JSON.stringify(Object.keys(panel.tabs)));
        } catch (e) { /* 忽略 */ }
        if (panel.el.style.display === 'none') {
            panel.el.style.display = 'block';
            try { sessionStorage.setItem('scriptPanel.visible', '1'); } catch (e) { /* 忽略 */ }
            if (!panel.el.style.left) {
                panel.el.style.left = Math.max(8, window.innerWidth - panel.el.offsetWidth - 24) + 'px';
                panel.el.style.top = '72px';
            }
        }
        activate(id);
    }

    function activate(id) {
        Object.keys(panel.tabs).forEach(function (k) {
            panel.tabs[k].btn.classList.toggle('active', k === id);
            panel.tabs[k].pane.style.display = k === id ? '' : 'none';
        });
    }

    window.SCRIPT_TOOLBOX = { open: open, runTool: runTool };

    // 页面重载后恢复已打开的工具页签与显隐状态（表单值与文件不恢复）
    try {
        var saved = JSON.parse(sessionStorage.getItem('scriptPanel.tools') || '[]');
        var wantHidden = sessionStorage.getItem('scriptPanel.visible') === '0';
        saved.forEach(function (id) { if (specOf(id)) open(id); });
        if (saved.length && wantHidden) panel.el.style.display = 'none';
    } catch (e) { /* 忽略 */ }
})();
