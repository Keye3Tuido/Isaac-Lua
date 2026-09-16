// 公共测试辅助函数（tests/ 下各套件共享）
// removeComments: 词法级去除 Lua 源码中的注释；任何失败都原样返回源码。
// 此前该函数在 test.js / edge.js / realtest.js / remotetest.js / bulktest.js /
// snapshot.js / test_search_compare.js / benchmark_k.js / performance_probe.js /
// benchmark_bulk_search.js 中逐字/近逐字重复，此处统一抽取。
function removeComments(LuaMin, src){
  try{
    const tokens = LuaMin._lex(src);
    const commentRanges = [];
    for(let i=0; i<tokens.length; i++){
      if(tokens[i].type==='Comment'){
        commentRanges.push({start:tokens[i].start, end:tokens[i].end});
      }
    }
    if(commentRanges.length===0) return src;
    let out = src;
    for(let i=commentRanges.length-1; i>=0; i--){
      const r = commentRanges[i];
      out = out.slice(0, r.start) + out.slice(r.end);
    }
    return out;
  }catch(e){
    return src;
  }
}

module.exports = { removeComments };
