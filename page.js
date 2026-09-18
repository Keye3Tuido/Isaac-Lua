// ========== DATA（由 Python 构建时注入） ==========
const ALL_FILES = __ALL_FILES__;
const TEMPLATES = __ALL_TEMPLATES__;

// ALL_FILES 条目结构：{id,title,fname,isChallenge,header:[注释行...],blocks:[{num,comment,code,region?,deps?,name?} 或
//   {…,tpl,values}（模板引用）或 {…,tplDef}（模板定义）或 {…,params,values,body,commentTpl}（块内参数）]}
// num 为字符串编号：挑战前置 0、I、II…，正文 1、2、3…，后置继前置续罗马数字；utils 为整数序号
// TEMPLATES 结构：{模板id:{body:"含P1..Pn的代码",说明:"含{P1}插值槽的说明",params:{P1:{说明,性质,默认}}}}
for (const id in ALL_FILES) {
    if (!ALL_FILES[id].id) ALL_FILES[id].id = id;
}

// 前端派生 cleaned：与 Python 端 clean_code 逐字节等价
// （splitlines + 逐行剥掉 "l " 前缀 + "\n" join；\r\n 归一为 \n，单个结尾换行被吸收）
function cleanCode(s) {
    const lines = s.split(/\r\n|\r|\n/);
    if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
    return lines.map(l => l.startsWith('l ') ? l.slice(2) : l).join('\n');
}

// ========== 模板参数引擎（与构建期同一算法） ==========
// 值进代码用 "," 连接，进文本（说明插值）用 "、" 连接
function fmtCode(v) { return Array.isArray(v) ? v.join(',') : String(v); }
function fmtText(v) { return Array.isArray(v) ? v.join('、') : String(v); }

// 输入框文本 → 参数值：基线是列表则按 ,/，/、 拆分为列表，否则为标量字符串
function parseParamInput(text, baseline) {
    if (Array.isArray(baseline)) {
        return text.split(/[,，、]/).map(s => s.trim()).filter(s => s !== '');
    }
    return text;
}

// token 边界替换：P1 仅作为完整标识符匹配；字符串、行注释、块注释内的同名文本不替换；
// `--[[ 注释 ]]代码` 同行内联形式中注释段跳过、注释后的代码正常替换
function replaceTokens(body, values) {
    let out = '', i = 0;
    const n = body.length;
    while (i < n) {
        const ch = body[i];
        // 注释：--[[ 块注释 ]] 与 -- 行注释
        if (ch === '-' && body[i + 1] === '-') {
            if (body[i + 2] === '[' && body[i + 3] === '[') {
                const end = body.indexOf(']]', i + 4);
                const stop = end === -1 ? n : end + 2;
                out += body.slice(i, stop); i = stop; continue;
            }
            let j = body.indexOf('\n', i);
            if (j === -1) j = n;
            out += body.slice(i, j); i = j; continue;
        }
        // 字符串：'...' "..." [[...]]
        if (ch === '"' || ch === "'") {
            let j = i + 1;
            while (j < n && body[j] !== ch) { if (body[j] === '\\') j++; j++; }
            j = Math.min(j + 1, n);
            out += body.slice(i, j); i = j; continue;
        }
        if (ch === '[' && body[i + 1] === '[') {
            const end = body.indexOf(']]', i + 2);
            const stop = end === -1 ? n : end + 2;
            out += body.slice(i, stop); i = stop; continue;
        }
        // 标识符：完整 token 匹配才替换
        if (/[A-Za-z_]/.test(ch)) {
            let j = i + 1;
            while (j < n && /[A-Za-z0-9_]/.test(body[j])) j++;
            const tok = body.slice(i, j);
            out += Object.prototype.hasOwnProperty.call(values, tok) ? values[tok] : tok;
            i = j; continue;
        }
        out += ch; i++;
    }
    return out;
}

// 说明文本插值：{P1} 插值槽，未定义的槽原样保留
function interpolate(text, values) {
    return text.replace(/\{(P\d+)\}/g, (m, k) =>
        Object.prototype.hasOwnProperty.call(values, k) ? values[k] : m);
}

// 模板块的说明模板（含 {P1} 插值槽）：兼容 说明/desc/comment 三种键名；缺失时退回构建期插值结果
function tplCommentSource(tplDef) {
    return tplDef['说明'] || tplDef.desc || tplDef.comment || null;
}

// ========== 百度统计埋点（未配置统计时 window._hmt 不存在，全部为静默空操作） ==========
function tjPage() {
    if (window._hmt) window._hmt.push(['_trackPageview', location.pathname + location.hash]);
}
function tjEvent(action, label) {
    if (!window._hmt) return;
    window._hmt.push(['_trackEvent', 'challenge', action, label || '']);
    // 事件分析是付费功能：同步发虚拟 PV，让关键行为在免费版「受访页面」报表可见（/event/ 前缀便于区分）
    // search 量太大不转 PV，避免淹没受访页面报表
    if (action !== 'search') window._hmt.push(['_trackPageview', '/event/' + action + (label ? '/' + label : '')]);
}

// ========== DOM 引用 ==========
const listView = document.getElementById('listView');
const detailView = document.getElementById('detailView');
const detailTitle = document.getElementById('detailTitle');
const subLegend = document.getElementById('subLegend');
const codeArea = document.getElementById('codeArea');
const toast = document.getElementById('toast');
const hoverTip = document.getElementById('hoverTip');
const searchInput = document.getElementById('searchInput');
const challengeSection = document.getElementById('challengeSection');
const otherSection = document.getElementById('otherSection');
const searchSection = document.getElementById('searchSection');
const searchList = document.getElementById('searchList');
const searchCount = document.getElementById('searchCount');
const noResult = document.getElementById('noResult');

// ========== 状态 ==========
let currentFileId = null;
// 当前详情页各代码块的实时状态（模板面板当前值），复制/下载由此现场生成内容
let currentBlocks = [];

// ========== 路由 ==========
function route() {
    const hash = location.hash;
    if (hash === '#kb') { downloadKb(); return; }   // #kb → 下载知识库 kb.json
    if (!hash || hash === '#') { showListView(); return; }
    // 锚点：s<编号>（数字或罗马数字，如 s0/s1/sI/sV；兼容旧负编号）或 l<行号>
    const m = hash.match(/^#c(.+?)(s(?:-?\d+|[IVXLCDM]+)|l\d+)?$/);
    if (!m || !ALL_FILES[m[1]]) { showListView(); return; }
    const fileId = m[1], secId = m[2] || null;
    // 同文件只滚动，不同文件完整渲染
    if (fileId === currentFileId) {
        if (secId) scrollToSection(secId);
    } else {
        showDetailView(fileId, secId);
    }
}

// #kb → 下载知识库 kb.json
function downloadKb() {
    const a = document.createElement('a');
    a.href = 'kb.json';
    a.download = 'kb.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    tjEvent('download_kb');
    showListView();
}

window.addEventListener('hashchange', function() {
    route();
    tjPage();   // hash 路由切换不会产生新 PV，手动上报（含 #kb 下载入口）
});
window.addEventListener('DOMContentLoaded', function() {
    buildListUI();
    route();
    prewarmShortProbe();
    if (location.hash) tjPage();   // 从分享链接直达详情时，补记带 hash 的 PV
});

// ========== 列表视图 ==========
function buildListUI() {
    const challengeIds = [], otherIds = [];
    for (const id in ALL_FILES) {
        (ALL_FILES[id].isChallenge ? challengeIds : otherIds).push(id);
    }
    challengeIds.sort((a, b) => (a | 0) - (b | 0));
    otherIds.sort();

    document.getElementById('challengeCount').textContent = challengeIds.length;
    document.getElementById('otherCount').textContent = otherIds.length;
    document.getElementById('totalChallenges').textContent =
        String(challengeIds.length).padStart(2, '0') + ' CHALLENGES';
    document.getElementById('totalOthers').textContent =
        String(otherIds.length).padStart(2, '0') + ' FILES';

    document.getElementById('challengeList').innerHTML = challengeIds.map(buildFileRow).join('');

    const otherList = document.getElementById('otherList');
    otherSectionVisible = otherIds.length > 0;
    if (otherSectionVisible) {
        otherSection.style.display = '';
        otherList.innerHTML = otherIds.map(buildFileRow).join('');
    } else {
        otherSection.style.display = 'none';
    }

    buildSearchIndex();
}

function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildFileRow(id) {
    const f = ALL_FILES[id];
    var title = escapeHtml(f.title);
    return '<div class="file-row" data-search="' + id + ' ' + title + '">'
        + '<span class="file-num' + (id.length > 2 ? ' long' : '') + '">' + id + '</span>'
        + '<a href="#c' + id + '" class="file-title">' + title + '</a>'
        + '</div>';
}

function showListView() {
    detailView.style.display = 'none';
    listView.style.display = '';
    document.body.className = 'home-page';
    currentFileId = null;
    currentBlocks = [];
    document.title = '以撒代码挑战 - Keye3Tuido';
    window.scrollTo(0, 0);
}

// ========== 详情视图 ==========
function showDetailView(fileId, secId) {
    listView.style.display = 'none';
    detailView.style.display = '';
    document.body.className = 'challenge-page';
    currentFileId = fileId;

    const f = ALL_FILES[fileId];
    detailTitle.textContent = f.title;
    subLegend.textContent = f.fname + ' - @Keye3Tuido';
    document.title = f.title + ' - 以撒代码挑战';

    // 「其他」类（lua/utils）页面不提供整页复制和模组下载
    document.getElementById('copyCodeBtn').style.display = f.isChallenge ? '' : 'none';
    document.getElementById('downloadBtn').style.display = f.isChallenge ? '' : 'none';
    // 只剩 2 个按钮时加 utils-group 类，让它们在原 4 列网格中居中
    document.getElementById('buttonGroup').classList.toggle('utils-group', !f.isChallenge);

    renderSections(f);
    if (secId) scrollToSection(secId);
    else window.scrollTo(0, 0);
}

// 在当前页面内滚动到指定条目（不重建 DOM）
function scrollToSection(secId) {
    const target = document.getElementById(secId);
    if (!target) return;
    target.classList.remove('collapsed');
    const g = target.closest('.region-group');
    if (g) g.classList.remove('collapsed');
    requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

// 详情页渲染：文件头注释块 + 每块（编号注释头 comment + 代码行 code）
// 组装规则（复制全部/下载 zip 同此）：header 各行 + 每块 comment\ncode，部分之间空一行
function renderSections(f) {
    codeArea.innerHTML = '';
    currentBlocks = [];
    const seen = new Set();  // 已用的条目编号，避免重复 id
    const header = f.header || [];
    const blocks = f.blocks || [];
    let line = 1;            // 组装文本中的 1-based 行号（用于行号列与 l<行号> 锚点）

    // 文件头：按空行分段，每段一个无代码条目（与旧版逐段排版一致）
    let group = [], groupStart = 1;
    const flushGroup = () => {
        if (!group.length) return;
        appendCommentSection(group, 'l' + groupStart);
        group = [];
    };
    for (let k = 0; k < header.length; k++) {
        if (header[k].trim() === '') { flushGroup(); groupStart = k + 2; }
        else { if (!group.length) groupStart = k + 1; group.push(header[k]); }
    }
    flushGroup();
    if (header.length) line = header.length + 2;   // header 占 1..h，空行 h+1，首块注释在 h+2

    // 区域分组：前置/后置代码各收进一个可折叠组（默认折叠），正文块平铺
    const REGION_LABELS = { pre: '前置代码', post: '后置代码' };
    let regionGroup = null, regionKey = null;
    const openRegionGroup = (region) => {
        const g = document.createElement('div');
        g.className = 'region-group collapsed region-' + region;
        const gh = document.createElement('div');
        gh.className = 'region-header';
        const arrow = document.createElement('span');
        arrow.className = 'arrow';
        arrow.textContent = '▼';
        const label = document.createElement('span');
        label.className = 'region-title';
        label.textContent = REGION_LABELS[region];
        const count = document.createElement('span');
        count.className = 'region-count';
        gh.appendChild(arrow);
        gh.appendChild(label);
        gh.appendChild(count);
        gh.onclick = () => g.classList.toggle('collapsed');
        g.appendChild(gh);
        g._countEl = count;
        g._count = 0;
        codeArea.appendChild(g);
        return g;
    };

    for (const block of blocks) {
        const region = block.region || 'body';
        if (region !== regionKey) {
            regionKey = region;
            regionGroup = (region === 'body') ? null : openRegionGroup(region);
        }
        const commentLines = block.comment ? String(block.comment).split('\n') : [];

        // 编号条目用 s<编号>；未编号/重复编号的用首行注释行号 l<行号>，
        // 行号天然唯一且可从源码直接推算，不依赖前面条目的数量
        // num 兼容字符串编号（"0"/"I"/"II"… 与正文的 "1"/"2"…）及 utils 的整数序号
        const entryNum = (block.num !== undefined && block.num !== null) ? String(block.num) : null;
        let secId;
        if (entryNum !== null && !seen.has(entryNum)) {
            secId = 's' + entryNum;
            seen.add(entryNum);
        } else {
            secId = 'l' + line;
        }

        // 参数面板定义两条路径（并列）：
        // ① 模板引用块：tpl 存在且模板注册表中有定义（缺失时按普通块渲染）
        // ② 块内参数块：无 tpl 但自带 params/body（values 为默认值，commentTpl 为含 {Pn} 插值槽的说明原文）
        const regDef = block.tpl && TEMPLATES[block.tpl] ? TEMPLATES[block.tpl] : null;
        const inlineDef = (!regDef && !block.tpl && block.params && block.body !== undefined && block.body !== null)
            ? { body: block.body, params: block.params, '说明': (block.commentTpl !== undefined ? block.commentTpl : null) }
            : null;
        const tplDef = regDef || inlineDef;
        const state = makeBlockState(block, tplDef);

        const section = document.createElement('div');
        section.className = 'section';
        section.id = secId;

        const head = document.createElement('div');
        head.className = 'section-header';

        const arrow = document.createElement('span');
        arrow.className = 'arrow';
        arrow.textContent = '▼';
        head.appendChild(arrow);

        const text = document.createElement('span');
        text.className = 'header-text';
        setHeaderText(text, displayComment(state));
        head.appendChild(text);
        state.headerTextEl = text;

        // 模板标记：定义=红，引用=绿，自定义无标记
        if (block.tplDef) {
            const badge = document.createElement('span');
            badge.className = 'tpl-badge tpl-def';
            badge.textContent = '模板·' + block.tplDef;
            head.appendChild(badge);
        } else if (block.tpl) {
            const badge = document.createElement('span');
            badge.className = 'tpl-badge tpl-ref';
            badge.textContent = '模板·' + block.tpl;
            head.appendChild(badge);
        }

        // 代码名称标签：YAML 头声明了 名称 的块在模板徽标旁显示（蓝灰中性色，与红/绿标区分）
        if (block.name) {
            const tag = document.createElement('span');
            tag.className = 'name-badge';
            tag.textContent = block.name;
            head.appendChild(tag);
        }

        section.appendChild(head);

        const codeLines = state.getCode().split('\n').map((t, k) => ({ no: line + commentLines.length + k, text: 'l ' + t }));
        const box = buildCodeBox(codeLines, secId, state);
        state.codeBoxEl = box;
        state.codeStartLine = line + commentLines.length;

        // 参数面板：代码框上方，仅模板引用块/块内参数块有参数时出现
        if (tplDef) {
            const panel = buildParamPanel(state);
            if (panel) section.appendChild(panel);
        }

        // 依赖标记：section-header 下方、参数面板下方、代码框上方
        if (block.deps && block.deps.length) {
            const dep = document.createElement('div');
            dep.className = 'dep-note';
            dep.textContent = '依赖：' + block.deps.join('、');
            section.appendChild(dep);
        }

        section.classList.add('collapsed');
        head.onclick = () => {
            section.classList.toggle('collapsed');
            history.replaceState(null, null, '#c' + currentFileId + secId);
            if (!section.classList.contains('collapsed') && state.autosizeAll) state.autosizeAll();
        };
        section.appendChild(box);
        state.sectionEl = section;

        (regionGroup || codeArea).appendChild(section);
        if (regionGroup) {
            regionGroup._count++;
            regionGroup._countEl.textContent = regionGroup._count + ' 条';
        }
        line += commentLines.length + codeLines.length + 1;   // 块与块之间空一行
    }
}

// 无代码的纯注释条目（文件头分段）
function appendCommentSection(commentLines, secId) {
    const section = document.createElement('div');
    section.className = 'section';
    section.id = secId;
    const head = document.createElement('div');
    head.className = 'section-header no-code';
    const text = document.createElement('span');
    text.className = 'header-text';
    setHeaderText(text, commentLines.join('\n'));
    head.appendChild(text);
    section.appendChild(head);
    codeArea.appendChild(section);
}

function setHeaderText(el, comment) {
    el.textContent = comment || '代码';
}

// 页面显示用：编号注释「N. 首行」（不带 -- 前缀；罗马编号同形「I. 首行」）
// 说明一律由构建器编号自动叠加块编号（数据中不允许手工数字前缀）
function displayComment(state) {
    const c = String(state.getComment() || '');
    if (state.block.num === undefined || state.block.num === null) return c;
    const lines = c.split('\n');
    lines[0] = state.block.num + '. ' + lines[0];
    return lines.join('\n');
}
// 复制全部/下载 zip 组装文本用：控制台粘贴格式「--N. 首行」，
// 与构建产物 _assemble_raw 口径一致，不随页面显示格式改动
function rawComment(state) {
    const c = String(state.getComment() || '');
    if (state.block.num === undefined || state.block.num === null) return c;
    const lines = c.split('\n');
    lines[0] = '--' + state.block.num + '. ' + lines[0];
    // 续行补 '--' 前缀（空续行为 '--'），与 _assemble_raw 口径一致，保证 zip 的 main.lua 合法
    return lines.map((l, k) => k === 0 ? l : '--' + l).join('\n');
}
function withLPrefix(code) {
    return String(code).split('\n').map(l => 'l ' + l).join('\n');
}

// ========== 代码块实时状态（模板参数面板的单一事实来源） ==========
function makeBlockState(block, tplDef) {
    const state = {
        block, tplDef,
        modified: false,
        inputs: {},      // Pn -> 输入框当前字符串
        baselines: {},   // Pn -> 构建期值（标量或列表）
        params: [],      // 有序参数名
        getComment() {
            if (!tplDef || !state.modified) return block.comment || '';
            const src = tplCommentSource(tplDef);
            if (src === null) return block.comment || '';
            const textValues = {};
            for (const p of state.params) textValues[p] = fmtText(parseParamInput(state.inputs[p], state.baselines[p]));
            return interpolate(src, textValues);
        },
        getCode() {
            if (!tplDef || !state.modified) return block.code;   // 未改动时与构建产物逐字节一致
            const codeValues = {};
            for (const p of state.params) codeValues[p] = fmtCode(parseParamInput(state.inputs[p], state.baselines[p]));
            return replaceTokens(tplDef.body, codeValues);
        },
    };
    if (tplDef) {
        const values = block.values || {};
        const defs = tplDef.params || {};
        const names = Object.keys(defs);
        // 模板未定义但引用方给了值的参数也一并展示（防御性）
        for (const p in values) if (names.indexOf(p) === -1) names.push(p);
        names.sort((a, b) => (parseInt(a.slice(1), 10) || 0) - (parseInt(b.slice(1), 10) || 0));
        state.params = names;
        for (const p of names) {
            const baseline = p in values ? values[p] : (defs[p] ? defs[p]['默认'] : '');
            state.baselines[p] = baseline;
            state.inputs[p] = fmtCode(baseline);
        }
    }
    currentBlocks.push(state);
    return state;
}

// 面板输入即时生效：说明插值 + 代码 token 替换同步重渲染，并给出"已修改"提示
function onParamInput(state) {
    if (state.inputEls) for (const p of state.params) state.inputs[p] = state.inputEls[p].value;
    state.modified = state.params.some(p => state.inputs[p] !== fmtCode(state.baselines[p]));
    if (state.headerTextEl) setHeaderText(state.headerTextEl, displayComment(state));
    if (state.codeBoxEl) {
        fillCodeBox(state.codeBoxEl, state.getCode().split('\n').map((t, k) => ({ no: state.codeStartLine + k, text: 'l ' + t })));
    }
    if (state.sectionEl) state.sectionEl.classList.toggle('tpl-modified', state.modified);
    if (state.panelEl) state.panelEl.classList.toggle('modified', state.modified);
}

// ========== 参数面板（3 列 N 行：参数名+性质 | 参数说明 | 输入框） ==========
function buildParamPanel(state) {
    if (!state.params.length) return null;
    const tplDef = state.tplDef;
    const defs = tplDef.params || {};

    const panel = document.createElement('div');
    panel.className = 'tpl-panel';
    panel.onclick = e => e.stopPropagation();

    const title = document.createElement('div');
    title.className = 'tpl-panel-title';
    // 模板引用块带模板id；块内参数块（无 tpl）标题固定为「自定义参数」
    title.textContent = state.block.tpl ? '模板参数 · ' + state.block.tpl : '自定义参数';
    panel.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'tpl-grid';
    state.inputEls = {};

    for (const p of state.params) {
        const def = defs[p] || {};

        const name = document.createElement('span');
        name.className = 'tpl-name';
        name.textContent = p;
        if (def['性质']) {
            const scope = document.createElement('em');
            scope.className = 'tpl-scope' + (def['性质'] === '全局' ? ' global' : '');
            scope.textContent = def['性质'];
            name.appendChild(scope);
        }
        grid.appendChild(name);

        const desc = document.createElement('span');
        desc.className = 'tpl-desc';
        desc.textContent = def['说明'] || '';
        grid.appendChild(desc);

        const input = document.createElement('textarea');
        input.className = 'tpl-input';
        input.rows = 1;
        input.value = state.inputs[p];
        input.setAttribute('aria-label', '参数 ' + p + (def['说明'] ? '：' + def['说明'] : ''));
        input.spellcheck = false;
        // 自动换行 + 按内容行数动态拉伸，避免长值编辑时看不清
        const autosize = () => {
            input.style.height = 'auto';
            input.style.height = Math.max(30, input.scrollHeight + 2) + 'px';
        };
        input.addEventListener('input', () => { autosize(); onParamInput(state); });
        state.inputEls[p] = input;
        grid.appendChild(input);
        requestAnimationFrame(autosize);
    }

    // 展开折叠区块时重算输入框高度（collapsed 时 scrollHeight=0 会定格在最小值）
    state.autosizeAll = () => {
        if (!state.inputEls) return;
        for (const p in state.inputEls) {
            const el = state.inputEls[p];
            el.style.height = 'auto';
            el.style.height = Math.max(30, el.scrollHeight + 2) + 'px';
        }
    };

    panel.appendChild(grid);
    state.panelEl = panel;
    return panel;
}

// ========== 代码渲染 ==========
function buildCodeBox(codeLines, secId, state) {
    const box = document.createElement('div');
    box.className = 'code-box';
    box.onclick = e => {
        const text = state ? withLPrefix(state.getCode()) : codeLines.map(it => it.text).join('\n');
        copyBlock(text, text.split('\n').length, e);
    };
    box.oncontextmenu = e => { e.preventDefault(); copyShareLink(e, '#c' + currentFileId + secId); };
    bindHover(box, codeLines.reduce((s, it) => s + it.text.length + 1, 0));
    fillCodeBox(box, codeLines);
    return box;
}

function fillCodeBox(box, codeLines) {
    box.innerHTML = '';
    codeLines.forEach(item => {
        const ln = document.createElement('div');
        ln.className = 'cell-ln';
        ln.textContent = item.no;
        box.appendChild(ln);
        const code = document.createElement('div');
        code.className = 'cell-code';
        code.textContent = item.text;
        box.appendChild(code);
    });
}

function bindHover(el, charCount) {
    el.onmouseenter = e => showHoverTip(e.clientX, e.clientY, charCount);
    el.onmousemove = e => showHoverTip(e.clientX, e.clientY, charCount);
    el.onmouseleave = hideHoverTip;
}

// 复制全部 / 下载 zip 用的当前全文：文件头 + 各块（面板当前值现场生成），部分之间空一行
function currentRawText() {
    const f = ALL_FILES[currentFileId];
    if (!f) return '';
    const parts = [];
    const header = f.header || [];
    if (header.length) parts.push(header.join('\n'));
    let prevRegion = null;
    for (const st of currentBlocks) {
        // 区域切换处插入分隔线，与构建产物 _assemble_raw / kb.json 口径一致
        const region = st.block.region || null;
        if (region && region !== prevRegion) {
            parts.push('--===--');
            prevRegion = region;
        }
        const c = rawComment(st);
        parts.push((c ? c + '\n' : '') + withLPrefix(st.getCode()));
    }
    return parts.join('\n\n');
}

// ========== 分享链接（短链探测） ==========
const SHORT_LINK_BASES = {
    'isaac.keye3tuido.site': 'https://k3t.site/isaac',
    'isaaclua.keye3tuido.site': 'https://k3t.site/isaaclua',
    'rep.keye3tuido.site': 'https://k3t.site/rep'
};

const shortProbeCache = {}; // baseUrl -> 探测中的 Promise 或已确定的布尔值

function shareHash() {
    const h = location.hash;
    if (h && h.indexOf('#c') === 0) return h;
    return currentFileId ? '#c' + currentFileId : '';
}

function shortShareBase() {
    return SHORT_LINK_BASES[location.hostname] || null;
}

// 探测短链接可达性（HEAD，不下载页面内容）：先标准跨域请求看状态码（能识别 404/500）；被 CORS 拦截时退回 no-cors 探测
function probeShortBase(baseUrl) {
    if (shortProbeCache[baseUrl] !== undefined) return Promise.resolve(shortProbeCache[baseUrl]);
    if (typeof fetch !== 'function') { shortProbeCache[baseUrl] = false; return Promise.resolve(false); }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);
    const head = { method: 'HEAD', cache: 'no-store', redirect: 'follow', signal: ctrl.signal };
    const done = fetch(baseUrl, head)
        .then(res => res.ok || res.status < 400, () =>
            fetch(baseUrl, Object.assign({ mode: 'no-cors' }, head)).then(() => true, () => false))
        .then(ok => { clearTimeout(timer); shortProbeCache[baseUrl] = ok; return ok; });
    shortProbeCache[baseUrl] = done; // 探测进行中先缓存 Promise，避免重复探测
    return done;
}

// 页面打开时预热探测，点击复制时直接复用缓存结果
function prewarmShortProbe() {
    const base = shortShareBase();
    if (base) probeShortBase(base);
}

// 分享链接：短链可 fetch 则用短链，否则回退当前实际链接；hashOverride 用于指定分享的条目 hash
function copyShareLink(e, hashOverride) {
    const hash = hashOverride !== undefined ? hashOverride : shareHash();
    const actual = location.origin + location.pathname + location.search + hash;
    const base = shortShareBase();
    if (!base) return copyTextWithToast(actual, '已复制链接到剪贴板', e);
    return probeShortBase(base).then(ok =>
        copyTextWithToast(ok ? base + hash : actual, '已复制链接到剪贴板', e)
    );
}

// ========== 复制 ==========
function legacyCopyText(text) {
    const textarea = document.createElement('textarea');
    const previousFocus = document.activeElement;
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.setAttribute('aria-hidden', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '0';
    textarea.style.top = '0';
    textarea.style.width = '1px';
    textarea.style.height = '1px';
    textarea.style.padding = '0';
    textarea.style.border = '0';
    textarea.style.opacity = '0';
    textarea.style.fontSize = '16px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    let copied = false;
    let error = null;
    try {
        copied = typeof document.execCommand === 'function' && document.execCommand('copy');
    } catch (err) {
        error = err;
    } finally {
        document.body.removeChild(textarea);
        if (previousFocus && typeof previousFocus.focus === 'function') {
            try { previousFocus.focus({ preventScroll: true }); } catch (_) { previousFocus.focus(); }
        }
    }

    return copied
        ? Promise.resolve()
        : Promise.reject(error || new Error('Clipboard API unavailable'));
}

function writeClipboard(text) {
    if (window.isSecureContext && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        return navigator.clipboard.writeText(text).catch(() => legacyCopyText(text));
    }
    return legacyCopyText(text);
}

function eventPoint(e) {
    const touch = e && ((e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]));
    let x = touch ? touch.clientX : e && e.clientX;
    let y = touch ? touch.clientY : e && e.clientY;
    if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) {
        const target = e && e.currentTarget;
        const rect = target && typeof target.getBoundingClientRect === 'function' ? target.getBoundingClientRect() : null;
        x = rect ? rect.left + rect.width / 2 : innerWidth / 2;
        y = rect ? rect.top + rect.height / 2 : innerHeight / 2;
    }
    return { x, y };
}

function copyTextWithToast(text, successMessage, e) {
    const point = eventPoint(e);
    return writeClipboard(text)
        .then(() => showToastAt(successMessage, point.x, point.y))
        .catch(err => showToastAt('复制失败: ' + (err && err.message ? err.message : err), point.x, point.y));
}

function copyBlock(text, count, e) {
    if (!text) return;
    return copyTextWithToast(text, '已复制该代码块（' + count + ' 行，' + text.length + ' 字符）', e);
}

function copyAllCode(e) {
    const f = ALL_FILES[currentFileId];
    if (!f) return;
    tjEvent('copy_code', currentFileId);
    return copyTextWithToast(currentRawText(), '已复制代码到剪贴板', e);
}

function copyLink(e) {
    // 按钮始终复制文件级链接 #cN，不依赖地址栏 hash（多条展开时 hash 可能指向最后点击的条目）
    tjEvent('copy_link', currentFileId);
    return copyShareLink(e, '#c' + currentFileId);
}

// ========== 下载 ZIP ==========
let jsZipPromise;
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error('script load failed: ' + src));
        document.head.appendChild(script);
    });
}
function ensureJsZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (!jsZipPromise) {
        // 本地优先（vendor 在仓库根目录的 jszip.min.js），失败时回退 cdnjs
        jsZipPromise = loadScript('jszip.min.js')
            .catch(() => loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'))
            .then(() => {
                if (!window.JSZip) throw new Error('JSZip load failed');
                return window.JSZip;
            });
    }
    return jsZipPromise;
}

function escapeXml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function downloadZip(e) {
    const f = ALL_FILES[currentFileId];
    if (!f) return;
    await ensureJsZip();
    try {
        const filename = 'code' + currentFileId + '.zip';
        const zip = new JSZip();
        // zip 用清理后代码（剥 "l " 前缀），内容为面板当前值现场生成
        zip.file('main.lua', cleanCode(currentRawText()));
        var safeTitle = escapeXml(f.title);
        var safeId = escapeXml(currentFileId);
        const metadata = '\n            <metadata>\n                <name>code' + safeId + '-' + safeTitle + '</name>\n                <directory>code' + safeId + '</directory>\n                <description/>\n                <version>1.0</version>\n                <visibility/>\n            </metadata>';
        zip.file('metadata.xml', metadata.trim());
        const blob = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        tjEvent('download_mod', currentFileId);
        showToastAt('已下载模组文件; 将文件解压至游戏mods目录下即可进行游戏', e.clientX, e.clientY);
    } catch (err) {
        showToastAt('下载失败: ' + err, e.clientX, e.clientY);
    }
}

// ========== Toast / Tooltip ==========
let toastTimer;
function showToastAt(m, x, y) {
    clearTimeout(toastTimer);
    if (toast.parentNode !== document.body) document.body.appendChild(toast);
    toast.textContent = m;
    toast.style.display = 'block';
    toast.style.visibility = 'hidden';
    toast.style.opacity = 0;
    const offset = 14, pad = 8;
    const rect = toast.getBoundingClientRect();
    let left = x + offset, top = y + offset;
    if (left + rect.width > innerWidth - pad) left = x - rect.width - offset;
    if (top + rect.height > innerHeight - pad) top = y - rect.height - offset;
    left = Math.max(pad, Math.min(left, innerWidth - rect.width - pad));
    top = Math.max(pad, Math.min(top, innerHeight - rect.height - pad));
    toast.style.left = left + 'px';
    toast.style.top = top + 'px';
    toast.style.visibility = 'visible';
    toast.style.opacity = 1;
    toastTimer = setTimeout(() => { toast.style.opacity = 0; toast.style.display = 'none'; }, 2200);
}

function showHoverTip(x, y, charCount) {
    if (hoverTip.parentNode !== document.body) document.body.appendChild(hoverTip);
    hoverTip.textContent = '左键复制代码，右键复制链接';
    hoverTip.style.display = 'block';
    hoverTip.style.visibility = 'hidden';
    const rect = hoverTip.getBoundingClientRect();
    const offset = 12, pad = 6;
    let left = x + offset, top = y + offset;
    if (left + rect.width > innerWidth - pad) left = x - rect.width - offset;
    if (top + rect.height > innerHeight - pad) top = y - rect.height - offset;
    hoverTip.style.left = Math.max(pad, left) + 'px';
    hoverTip.style.top = Math.max(pad, top) + 'px';
    hoverTip.style.visibility = 'visible';
    hoverTip.style.opacity = 1;
}

function hideHoverTip() {
    hoverTip.style.opacity = 0;
    hoverTip.style.display = 'none';
}

// ========== 返回列表 ==========
function goBackToList(e) {
    e.preventDefault();
    history.replaceState(null, null, location.pathname);
    route();
}

// ========== 列表搜索 ==========
// 搜索索引：文件级（编号/标题） + 块级（编号/说明/模板id/名称）记录，构建一次、搜索时复用
let searchIndex = [];
let otherSectionVisible = false;
function buildSearchIndex() {
    searchIndex = [];
    for (const id in ALL_FILES) {
        const f = ALL_FILES[id];
        searchIndex.push({
            fileId: id, title: f.title || '', num: '', secId: '',
            kind: 'file', comment: '', tpl: '', name: '',
        });
        for (const b of (f.blocks || [])) {
            const num = (b.num !== undefined && b.num !== null) ? String(b.num) : '';
            searchIndex.push({
                fileId: id, title: f.title || '', num, secId: num ? ('s' + num) : '',
                kind: 'block',
                comment: b.comment || '',
                tpl: b.tpl || b.tplDef || '',
                name: b.name || '',
            });
        }
    }
}

// 把查询词在文本中高亮（先转义再匹配，输出已转义 HTML）
function highlightHtml(text, query) {
    if (!query) return escapeHtml(text);
    const esc = escapeHtml(text);
    const q = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
        return esc.replace(new RegExp(q, 'gi'), m => '<mark>' + m + '</mark>');
    } catch (_) {
        return esc;
    }
}

// 取包含查询词的一段文本（关键字前后各截若干字符），供“关键字匹配”栏展示
function matchSnippet(text, query) {
    const low = text.toLowerCase();
    const idx = low.indexOf(query);
    if (idx === -1) {
        const cut = text.length > 80 ? text.slice(0, 80) + '…' : text;
        return highlightHtml(cut, query);
    }
    const start = Math.max(0, idx - 18);
    const end = Math.min(text.length, idx + query.length + 42);
    const head = start > 0 ? '…' : '';
    const tail = end < text.length ? '…' : '';
    return head + highlightHtml(text.slice(start, end), query) + tail;
}

// 单条搜索结果 → 两栏行：左 = 文件标题，右 = 关键字匹配
function renderSearchRow(r, t) {
    const link = '<a class="search-file" href="#c' + r.fileId + r.secId + '">'
        + '<span class="search-file-num">' + escapeHtml(r.fileId) + '</span>'
        + '<span class="search-file-title">' + escapeHtml(r.title) + '</span></a>';
    let match;
    if (r.kind === 'file') {
        // 文件级：命中编号则展示编号，否则展示标题
        match = r.fileId.toLowerCase().indexOf(t) !== -1
            ? '编号 ' + highlightHtml(r.fileId, t)
            : highlightHtml(r.title, t);
    } else if (r.comment && r.comment.toLowerCase().indexOf(t) !== -1) {
        match = matchSnippet(r.comment, t);
    } else if (r.tpl && r.tpl.toLowerCase().indexOf(t) !== -1) {
        match = '模板·' + highlightHtml(r.tpl, t);
    } else if (r.name && r.name.toLowerCase().indexOf(t) !== -1) {
        match = '名称 ' + highlightHtml(r.name, t);
    } else {
        match = matchSnippet(r.comment || r.tpl || r.name || '', t);
    }
    return '<div class="search-row">' + link + '<span class="search-match">' + match + '</span></div>';
}

let searchTjTimer;
function handleSearch() {
    const t = searchInput.value.trim().toLowerCase();
    // 防抖上报搜索词（截断防超长）；空串不报
    clearTimeout(searchTjTimer);
    if (t) searchTjTimer = setTimeout(() => tjEvent('search', t.slice(0, 50)), 800);

    // 空查询：恢复“挑战 / 其他”两栏文件列表
    if (!t) {
        if (searchSection) searchSection.style.display = 'none';
        if (challengeSection) challengeSection.style.display = '';
        if (otherSection) otherSection.style.display = otherSectionVisible ? '' : 'none';
        if (noResult) noResult.style.display = 'none';
        return;
    }

    // 命中：文件级只比编号/标题；块级只比说明/模板id/名称（避免搜文件编号时泛滥出全部块）
    const matches = searchIndex.filter(r => {
        if (r.kind === 'file') {
            return r.fileId.toLowerCase().indexOf(t) !== -1 ||
                r.title.toLowerCase().indexOf(t) !== -1;
        }
        return r.comment.toLowerCase().indexOf(t) !== -1 ||
            r.tpl.toLowerCase().indexOf(t) !== -1 ||
            r.name.toLowerCase().indexOf(t) !== -1;
    });

    if (challengeSection) challengeSection.style.display = 'none';
    if (otherSection) otherSection.style.display = 'none';
    if (searchSection) {
        searchSection.style.display = matches.length ? '' : 'none';
        if (searchList) searchList.innerHTML = matches.map(r => renderSearchRow(r, t)).join('');
        if (searchCount) searchCount.textContent = matches.length;
    }
    if (noResult) noResult.style.display = matches.length ? 'none' : 'block';
}
