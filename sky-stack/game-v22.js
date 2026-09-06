(() => {
'use strict';

const coreParts=[
  'game-v8-part0.txt?v=22',
  'game-v8-part1.txt?v=22',
  'game-v8-part2.txt?v=22'
];
const liquidParts=[
  'game-v10-liquid.txt?v=22',
  'game-v10-liquid-fixes.txt?v=22',
  'game-v13-liquid-visibility.txt?v=22',
  'game-v14-liquid-guarantee.txt?v=22',
  'game-v15-liquid-diagnostic.txt?v=22',
  'game-v17-liquid-tuning.txt?v=22',
  'game-v17-seedfix.txt?v=22',
  'game-v18-terraria-liquid.txt?v=22',
  'game-v19-liquid-flow.txt?v=22',
  'game-v20-liquid-surface.txt?v=22',
  'game-v21-liquid-render.txt?v=22',
  'game-v22-liquid-engine.txt?v=22'
];
const tailUrl='game-v8-part3.txt?v=22';

async function read(url){
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok)throw new Error('Could not load '+url+' ('+r.status+')');
  return r.text();
}

(async()=>{
  try{
    let core='';
    for(const url of coreParts)core+=await read(url);

    let liquid='';
    for(const url of liquidParts)liquid+=await read(url);

    let tail=await read(tailUrl);
    tail=tail.replace(/^\s*\}\);\s*/, '');

    const src=core+'\n});\n'+liquid+'\n'+tail;
    (0,eval)(src);
  }catch(e){
    console.error('Sky Stack failed to load',e);
    const el=document.getElementById('load');
    if(el)el.textContent='Game failed to load — refresh to retry';
  }
})();
})();
