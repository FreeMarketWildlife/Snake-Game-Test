(() => {
'use strict';
const parts=[
  'game-v8-part0.txt?v=12',
  'game-v8-part1.txt?v=12',
  'game-v8-part2.txt?v=12',
  'game-v10-liquid.txt?v=12',
  'game-v10-liquid-fixes.txt?v=12',
  'game-v10-liquid-run.txt?v=12',
  'game-v8-part3.txt?v=12'
];
(async()=>{
  try{
    let src='';
    for(const url of parts){
      const r=await fetch(url,{cache:'no-store'});
      if(!r.ok)throw new Error('Could not load '+url);
      src+=await r.text();
    }
    (0,eval)(src);
  }catch(e){
    console.error('Sky Stack failed to load',e);
    const el=document.getElementById('load');
    if(el)el.textContent='Game failed to load — refresh to retry';
  }
})();
})();
