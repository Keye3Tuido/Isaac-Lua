'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const luaRoot = path.join(projectRoot, 'lua');

function walkLuaFiles(dir, base, out) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkLuaFiles(abs, base, out);
    } else if (entry.isFile() && entry.name.endsWith('.lua')) {
      out.push({ abs, rel: path.relative(base, abs) });
    }
  }
  return out;
}

function listRepoLuaFiles() {
  return walkLuaFiles(luaRoot, luaRoot, []).sort((a, b) => a.rel.localeCompare(b.rel));
}

module.exports = { projectRoot, luaRoot, listRepoLuaFiles };
