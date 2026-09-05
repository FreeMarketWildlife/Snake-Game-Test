(() => {
'use strict';

const coreParts=[
  'game-v8-part0.txt?v=16',
  'game-v8-part1.txt?v=16',
  'game-v8-part2.txt?v=16'
];
const liquidParts=[
  'game-v10-liquid.txt?v=16',
  'game-v10-liquid-fixes.txt?v=16',
  'game-v13-liquid-visibility.txt?v=16',
  'game-v14-liquid-guarantee.txt?v=16',
  'game-v15-liquid-diagnostic.txt?v=16'
];
const tailUrl='game-v8-part3.txt?v=16';

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

    // part 2 intentionally ends inside the toolbar click callback and the old
    // part 3 begins by closing it. Liquid modules used to be inserted between
    // those two pieces, which accidentally placed the entire liquid system
    // inside the toolbar callback. Close that callback FIRST, then install the
    // liquid system at the actual game scope.
    let tail=await read(tailUrl);
    tail=tail.replace(/^\s*\}\);\s*/, '');

    // Keep the on-screen diagnostic accurate for this repaired build.
    liquid=liquid.replace("var SKY_BUILD='v15';","var SKY_BUILD='v16';");

    const src=core+'\n});\n'+liquid+'\n'+tail;
    (0,eval)(src);
  }catch(e){
    console.error('Sky Stack failed to load',e);
    const el=document.getElementById('load');
    if(el)el.textContent='Game failed to load — refresh to retry';
  }
})();
})();
