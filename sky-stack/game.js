(() => {
'use strict';
const parts=[0,1,2,3].map(i=>'game-v8-part'+i+'.txt?v=9');
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
