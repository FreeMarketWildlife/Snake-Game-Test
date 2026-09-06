(() => {
'use strict';

const coreParts=[
  'game-v8-part0.txt?v=27',
  'game-v8-part1.txt?v=27',
  'game-v8-part2.txt?v=27'
];
const liquidParts=[
  'game-v10-liquid.txt?v=27',
  'game-v10-liquid-fixes.txt?v=27',
  'game-v13-liquid-visibility.txt?v=27',
  'game-v14-liquid-guarantee.txt?v=27',
  'game-v15-liquid-diagnostic.txt?v=27',
  'game-v17-liquid-tuning.txt?v=27',
  'game-v17-seedfix.txt?v=27',
  'game-v18-terraria-liquid.txt?v=27',
  'game-v19-liquid-flow.txt?v=27',
  'game-v20-liquid-surface.txt?v=27',
  'game-v21-liquid-render.txt?v=27',
  'game-v22-liquid-engine.txt?v=27'
];
const cameraUrl='game-v24-camera-bounce.txt?v=27';
const gridUrl='game-v25-grid-toggle.txt?v=27';
const zoomUrl='game-v26-zoom-input.txt?v=27';
const minerUrl='game-v27-miner-ai-rhythm.txt?v=27';
const tailUrl='game-v8-part3.txt?v=27';

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

    const camera=await read(cameraUrl);
    const grid=await read(gridUrl);
    const zoom=await read(zoomUrl);
    const miner=await read(minerUrl);
    const marker='restoreDynamicState(initialSave);';
    if(!tail.includes(marker))throw new Error('v27 insertion marker missing');
    tail=tail.replace(marker,camera+'\n'+grid+'\n'+zoom+'\n'+miner+'\n'+marker);

    const src=core+'\n});\n'+liquid+'\n'+tail;
    (0,eval)(src);
  }catch(e){
    console.error('Sky Stack failed to load',e);
    const el=document.getElementById('load');
    if(el)el.textContent='Game failed to load — refresh to retry';
  }
})();
})();
