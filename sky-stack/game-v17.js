(() => {
'use strict';

const coreParts=[
  'game-v8-part0.txt?v=17',
  'game-v8-part1.txt?v=17',
  'game-v8-part2.txt?v=17'
];
const liquidParts=[
  'game-v10-liquid.txt?v=17',
  'game-v10-liquid-fixes.txt?v=17',
  'game-v13-liquid-visibility.txt?v=17',
  'game-v14-liquid-guarantee.txt?v=17',
  'game-v15-liquid-diagnostic.txt?v=17',
  'game-v17-liquid-tuning.txt?v=17',
  'game-v17-seedfix.txt?v=17'
];
const tailUrl='game-v8-part3.txt?v=17';

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

    // part 2 ends inside the toolbar click callback; close it before installing
    // any liquid modules so their startup code runs at the actual game scope.
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
