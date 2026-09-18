// 临时冒烟：用真实构建产物 index.html 内嵌的 page.js + 真实数据跑最小 DOM 渲染
// 用法：node smoke_real.js <repoRoot>
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const REPO = process.argv[2];

const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
// index.html 以 CRLF 写出；页面含多个 <script>（百度统计在前），取含 ALL_FILES 的主脚本块
const blocks = [...html.matchAll(/<script>\r?\n([\s\S]*?)\r?\n\s*<\/script>/g)].map(x => x[1]);
const src = blocks.find(s => s.includes('const ALL_FILES'));
if (!src) { console.error('FAIL 未能从 index.html 提取主脚本'); process.exit(1); }

function makeEl(tag) {
    const el = {
        tagName: (tag || 'div').toUpperCase(), children: [], parentNode: null,
        style: {}, attributes: {}, listeners: {}, textContent: '', value: '',
        _classes: new Set(),
    };
    Object.defineProperty(el, 'className', {
        get() { return [...el._classes].join(' '); },
        set(v) { el._classes = new Set(String(v).split(/\s+/).filter(Boolean)); },
    });
    Object.defineProperty(el, 'innerHTML', {
        get() { return el._html || ''; },
        set(v) { el._html = v; if (v === '') el.children = []; },
    });
    el.classList = {
        add: (...cs) => cs.forEach(c => el._classes.add(c)),
        remove: (...cs) => cs.forEach(c => el._classes.delete(c)),
        contains: c => el._classes.has(c),
        toggle: (c, force) => {
            const want = force === undefined ? !el._classes.has(c) : !!force;
            want ? el._classes.add(c) : el._classes.delete(c);
            return want;
        },
    };
    el.appendChild = child => { child.parentNode = el; el.children.push(child); return child; };
    el.setAttribute = (k, v) => { el.attributes[k] = String(v); };
    el.getAttribute = k => (k in el.attributes ? el.attributes[k] : null);
    el.addEventListener = (ev, fn) => { (el.listeners[ev] = el.listeners[ev] || []).push(fn); };
    el.dispatch = (ev, arg) => (el.listeners[ev] || []).forEach(fn => fn(arg));
    el.closest = sel => {
        const cls = sel.replace(/^\./, '');
        let p = el.parentNode;
        while (p) { if (p._classes && p._classes.has(cls)) return p; p = p.parentNode; }
        return null;
    };
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 10, height: 10 });
    el.scrollIntoView = () => {};
    return el;
}
function walk(el, out) {
    out = out || [];
    for (const c of el.children) { out.push(c); walk(c, out); }
    return out;
}

const named = {};
for (const id of ['listView', 'detailView', 'detailTitle', 'subLegend', 'codeArea', 'toast', 'hoverTip',
    'copyCodeBtn', 'downloadBtn', 'buttonGroup', 'challengeCount', 'otherCount',
    'totalChallenges', 'totalOthers', 'challengeList', 'otherList', 'otherSection',
    'noResult', 'searchInput']) {
    named[id] = makeEl('div');
    named[id].id = id;
}
const bodyEl = makeEl('body');
bodyEl.appendChild(named.listView);
bodyEl.appendChild(named.detailView);
named.detailView.appendChild(named.codeArea);

const sandbox = {
    console,
    document: {
        body: bodyEl,
        createElement: tag => makeEl(tag),
        getElementById: id => named[id] || walk(bodyEl).find(e => e.id === id) || null,
        querySelectorAll: () => [],
        addEventListener: () => {},
    },
    location: { hash: '', hostname: 'localhost', protocol: 'http:', pathname: '/', search: '', origin: 'http://localhost' },
    history: { replaceState: () => {} },
    navigator: {},
    addEventListener: () => {},
    scrollTo: () => {},
    requestAnimationFrame: fn => fn(),
    innerWidth: 1024, innerHeight: 768,
    setTimeout, clearTimeout,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'embedded-page.js' });

let failures = 0;
function check(label, cond) {
    if (cond) { console.log('PASS  ' + label); }
    else { failures++; console.log('FAIL  ' + label); }
}
function findById(id) { return walk(bodyEl).find(e => e.id === id) || null; }
function findByClass(root, cls) { return walk(root).filter(e => e._classes.has(cls)); }

// 全文件扫描统计（真实数据契约）
const ALL_FILES = vm.runInContext('ALL_FILES', sandbox);
let namedBlocks = 0, totalBlocks = 0;
for (const id in ALL_FILES) for (const b of ALL_FILES[id].blocks) { totalBlocks++; if (b.name) namedBlocks++; }
check('真实数据含 name 字段的块（>0）', namedBlocks > 0);
console.log('      （共 ' + totalBlocks + ' 块，其中 ' + namedBlocks + ' 块带 name）');

// 挑一个带 名称 的挑战页渲染：12.永远迷失（前置块 名称: 安全包装/清理回调）
vm.runInContext("showDetailView('12')", sandbox);
const badges = findByClass(named.codeArea, 'name-badge');
check('详情页渲染出 name-badge（≥2）', badges.length >= 2);
if (badges.length) check('首个名称标签文本为「安全包装」', badges[0].textContent === '安全包装');
// 编号注释头 = 代码块的 section-header（排除 no-code 的元信息分段，元信息原样直通保留 --）
const heads = findByClass(named.codeArea, 'header-text')
    .filter(h => !(h.parentNode && h.parentNode._classes.has('no-code')));
check('编号注释头均无 -- 前缀', heads.length > 0 && heads.every(h => !h.textContent.startsWith('--')));
check('存在「N. 」编号注释头', heads.some(h => /^\d+\. /.test(h.textContent)));
check('存在罗马「I. 」编号注释头', heads.some(h => /^I\. /.test(h.textContent)));
const raw = vm.runInContext('currentRawText()', sandbox);
check('复制文本保留 --0. 前缀', raw.includes('--0. '));
check('复制文本保留 l 前缀代码行', /\nl \S/.test(raw));

console.log(failures ? `\n合计 ${failures} 项失败` : '\n真实数据冒烟全部通过');
process.exit(failures ? 1 : 0);
