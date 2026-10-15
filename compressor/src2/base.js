/* ===================================================================
 * LuaMin v2 part: base — 共享基础库门面
 * 聚合 core.js 词法工具与 src2/shared/ 四个安装器模块（analyze / canonical /
 * encode / purecopy），create({luaparse, fengari}) 返回统一门面，供 ir / lens /
 * canonical2 / 各透镜与 tests2 复用：
 *   词法：_lex _needSpace _canSingleQuote _needsSepAfter _unquoteShort KEYWORDS
 *   分析：_parse _analyze _collectTakenNames _createNameAllocator _collectGlobalNames
 *         collectMemberAccess analyzeMetatableFree
 *   等价：_canonical assertParses assertEquivalent assertEquivalentAlias
 *   编码：removeComments minimizeSpacing applyEncoding
 *   其他：_preprocess _normPureCopyProp _applyEdits luaValidate
 *
 * 加载方式（与 src2 其他 part 相同的双目标模式）：
 *  - 浏览器：index.html 先引入 core.js 与 src2/shared/*.js 再引入本文件。
 *  - Node：require 本文件；core.js 与 shared/* 在此静态 require。
 * =================================================================== */
(function(root){
  'use strict';

  var analyzePart = null, canonicalPart = null, encodePart = null, purecopyPart = null;
  if(typeof module !== 'undefined' && module.exports){
    analyzePart = require('./shared/analyze.js');
    canonicalPart = require('./shared/canonical.js');
    encodePart = require('./shared/encode.js');
    purecopyPart = require('./shared/purecopy.js');
  }else if(root.__LuaMin2Modules){
    analyzePart = root.__LuaMin2Modules['shared/analyze'];
    canonicalPart = root.__LuaMin2Modules['shared/canonical'];
    encodePart = root.__LuaMin2Modules['shared/encode'];
    purecopyPart = root.__LuaMin2Modules['shared/purecopy'];
  }

  // create({luaparse, fengari}) -> 共享基础库门面（幂等造价低廉；调用侧通常缓存一份）
  function create(deps){
    deps = deps || {};
    if(!deps.luaparse) throw new Error('LuaMin base.create 需要 luaparse 实例');
    if(typeof module !== 'undefined' && module.exports && !root.LuaMin) require('../core.js');
    if(!root.LuaMin) throw new Error('base.js: 需要 core.js（LuaMin 词法基础库）已加载');
    if(!analyzePart || !canonicalPart || !encodePart || !purecopyPart)
      throw new Error('base.js: shared 模块未加载（analyze/canonical/encode/purecopy）');
    var core = root.LuaMin.create(deps.luaparse, deps.fengari);
    // 共享上下文：先放词法器与配置项，随后各安装器把自己的函数挂上来（与安装器约定一致）。
    var C = {
      KEYWORDS: core.KEYWORDS,
      lex: core.lex,
      needSpace: core.needSpace,
      isDigit: core.isDigit,
      isHex: core.isHex,
      isNameStart: core.isNameStart,
      isNamePart: core.isNamePart,
      isSpace: core.isSpace,
      unquoteShort: core.unquoteShort,
      canSingleQuote: core.canSingleQuote,
      needsSepAfter: core.needsSepAfter,
      luaValidate: core.luaValidate,
      luaparse: deps.luaparse,
      fengari: deps.fengari || null
    };
    // 安装序：analyze（parse/作用域）→ canonical（依赖 parse/analyze）→ encode → purecopy。
    analyzePart.install(C);
    canonicalPart.install(C);
    encodePart.install(C);
    purecopyPart.install(C);

    return {
      KEYWORDS: core.KEYWORDS,
      luaValidate: core.luaValidate,
      // 词法工具
      _lex: core.lex,
      _needSpace: core.needSpace,
      _canSingleQuote: core.canSingleQuote,
      _needsSepAfter: core.needsSepAfter,
      _unquoteShort: core.unquoteShort,
      // 语法/作用域分析
      _parse: C.parse,
      _analyze: C.analyze,
      _collectTakenNames: C.collectTakenNames,
      _createNameAllocator: C.createNameAllocator,
      _collectGlobalNames: C.collectGlobalNames,
      collectMemberAccess: C.collectMemberAccess,
      analyzeMetatableFree: C.analyzeMetatableFree,
      // 等价归一与校验
      _canonical: C.canonical,
      assertParses: C.assertParses,
      assertEquivalent: C.assertEquivalent,
      assertEquivalentAlias: C.assertEquivalentAlias,
      // 编码
      removeComments: C.removeComments,
      minimizeSpacing: C.minimizeSpacing,
      applyEncoding: C.applyEncoding,
      // 预处理 / 纯代入归一 / 编辑应用
      _preprocess: C.preprocess,
      _normPureCopyProp: C.normPureCopyProp,
      _applyEdits: C.applyEdits
    };
  }

  var api = { create: create };
  root.LuaMinBase = api;
  root.__LuaMin2Modules = root.__LuaMin2Modules || {};
  root.__LuaMin2Modules['base'] = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
