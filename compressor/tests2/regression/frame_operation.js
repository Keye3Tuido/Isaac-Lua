// tests2/regression/frame_operation.js — frame-operation 模板回归
// 覆盖：源码在 UI 默认选项（迭代收敛+无元表+搜索）下的压缩。
'use strict';
const { runCases } = require('./_v2harness');

const sourceCode = `local Keys='adwsjlike q;pt'
local KeyMap={}
for i=1,#Keys do
    KeyMap[Keys:byte(i)]=i-1
end
function FrameOp(ops, player, frame, tab, cb)
    if player and ops and not Game():IsPaused()then
        frame,player,tab=Game():GetFrameCount()+1,GetPtrHash(player),{}
        for i=1,#ops do
            tab[KeyMap[ops:byte(i)]]=true
        end
        cb = function(t,e,h,a)
            if h==InputHook.GET_ACTION_VALUE then
                t,h=1,0
            else
                t,h=true,false
            end
            ops=frame-Game():GetFrameCount()
            if ops<0 then
                Isaac.RemoveCallback(tab,ModCallbacks.MC_INPUT_ACTION,cb)
            elseif ops==0 and e and GetPtrHash(e)==player then
                return tab[a]and t or h
            end
        end
        Isaac.AddCallback(tab,ModCallbacks.MC_INPUT_ACTION,cb)
    end
end`;

const uiOpts = { iterate: true, noMetatable: true, search: true, beamWidth: 32 };

function run(){
  const res = runCases([
    {
      name: 'frame-operation/source',
      code: 'l ' + sourceCode,
      opts: uiOpts,
      maxLen: 950
    }
  ]);
  console.log('[frame_operation] pass', res.pass, ' fail', res.fail, ' pending', res.pending);
  return res;
}

module.exports = { name: 'frame_operation', run };
