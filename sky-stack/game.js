(() => {
'use strict';

const $=id=>document.getElementById(id),load=$('load');
if(!window.Matter){load.textContent='Physics failed to load';return}

const{Engine,World,Bodies,Body,Query,Sleeping}=Matter;
const c=$('game'),ctx=c.getContext('2d'),B=32,H=16,DIRT=6,DEPTH=34,TRANSITION=4;
const M={
  dirt:{taps:1,d:.0017,f:.74,r:.13,a:.012,col:['#98633a','#81502e']},
  stone:{taps:3,d:.0028,f:.88,r:.055,a:.009,col:['#777f89','#626a74']}
};

const inv={dirt:0,stone:0},bs=new Set(),grid=new Map(),generated=new Set(),pointers=new Map(),miners=new Set();
const cam={x:0,y:-180,z:1,tx:0,ty:-180,anim:false};

let tool='pick',gesture=null,best=0,shape=false,stone=false,toastTimer,minerId=0,selectedMiner=null;
let pendingPlacement=null;
let overlapSuppressed=false;
try{overlapSuppressed=localStorage.getItem('skyStack.hideOverlapWarning')==='1'}catch{}

const eng=Engine.create({enableSleeping:true});
eng.gravity.y=1.05;
eng.gravity.scale=.001;

let W,HH,DPR;
const key=(a,b)=>a+','+b,cell=v=>Math.floor(v/B),ctr=i=>i*B+H,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function resize(){
  W=innerWidth;HH=innerHeight;DPR=Math.min(devicePixelRatio||1,2);
  c.width=W*DPR;c.height=HH*DPR;c.style.width=W+'px';c.style.height=HH+'px'
}
resize();
addEventListener('resize',resize,{passive:true});

const w2s=(px,py)=>({x:(px-cam.x)*cam.z+W/2,y:(py-cam.y)*cam.z+HH/2});
const s2w=(px,py)=>({x:(px-W/2)/cam.z+cam.x,y:(py-HH/2)/cam.z+cam.y});

function hash01(x,y){
  let n=Math.imul(x,374761393)^Math.imul(y,668265263);
  n=Math.imul(n^(n>>>13),1274126177);
  return ((n^(n>>>16))>>>0)/4294967295;
}

function terrainMaterial(cx,cy){
  const start=DIRT-Math.floor(TRANSITION/2);
  if(cy<start)return 'dirt';
  if(cy>=start+TRANSITION)return 'stone';
  const step=cy-start+1;
  const stoneChance=step/(TRANSITION+1);
  return hash01(cx,cy)<stoneChance?'stone':'dirt';
}

function mk(px,py,m,o={}){
  const q=M[m],w=o.w||B-1,h=o.h||B-1;
  const z=Bodies.rectangle(px,py,w,h,{
    isStatic:!!o.static,density:q.d,friction:q.f,frictionStatic:Math.min(1,q.f+.1),
    restitution:q.r,frictionAir:q.a,chamfer:{radius:1.2},sleepThreshold:70
  });
  z.game={
    material:m,terrain:!!o.terrain,placed:!!o.placed,hits:0,max:q.taps,
    cx:o.cx??null,cy:o.cy??null,w,h,cost:o.cost||1,born:performance.now()
  };
  bs.add(z);
  if(o.terrain)grid.set(key(o.cx,o.cy),z);
  World.add(eng.world,z);
  return z
}

function gen(ch){
  if(generated.has(ch))return;
  generated.add(ch);
  for(let cy=0;cy<DEPTH;cy++){
    for(let cx=ch*24;cx<ch*24+24;cx++){
      mk(ctr(cx),ctr(cy),terrainMaterial(cx,cy),{static:true,terrain:true,cx,cy})
    }
  }
}

function ensureWorld(){
  const ch=Math.floor(cam.x/(24*B));
  for(let i=ch-2;i<=ch+2;i++)gen(i)
}
ensureWorld();
World.add(eng.world,Bodies.rectangle(0,(DEPTH+2)*B,1000000,B*2,{isStatic:true}));

function toast(t,long=false){
  clearTimeout(toastTimer);
  $('toast').textContent=t;
  $('toast').classList.remove('hide');
  toastTimer=setTimeout(()=>$('toast').classList.add('hide'),long?3000:1300)
}

function buildLimitAt(h){return h<5?1:Math.min(10,2+Math.floor(Math.max(0,h-5)/10))}
function buildLimit(){return buildLimitAt(best)}
function minerCountAt(h){return h<20?0:1+Math.floor((h-20)/10)}
function unlockedMiners(){return minerCountAt(best)}
function availableMiners(){return Math.max(0,unlockedMiners()-miners.size)}

function ui(){
  $('dc').textContent=inv.dirt;
  $('sc').textContent=inv.stone;
  document.querySelector('[data-tool=dirt]').classList.toggle('empty',!inv.dirt);
  $('stoneSlot').classList.toggle('unlocked',stone);
  $('stoneSlot').classList.toggle('locked',!stone);
  const total=unlockedMiners(),available=availableMiners();
  $('mc').textContent=available;
  $('minerSlot').classList.toggle('unlocked',total>0);
  $('minerSlot').classList.toggle('locked',total===0);
  $('minerSlot').classList.toggle('empty',total>0&&available===0);
  $('mode').textContent='MAX '+buildLimit()+'×'+buildLimit()
}

function at(p){
  const a=Query.point([...bs],p);
  a.sort((a,b)=>(b.game?.born||0)-(a.game?.born||0));
  return a[0]
}

function minerAt(p){
  const a=Query.point([...miners],p);
  return a[0]||null
}

function wake(){
  for(const q of bs){
    if(q.game?.placed&&!q.isStatic){
      Sleeping.set(q,false);
      Body.setVelocity(q,{x:q.velocity.x,y:q.velocity.y+.001})
    }
  }
}

function remove(z){
  inv[z.game.material]+=z.game.cost||1;
  if(z.game.terrain)grid.delete(key(z.game.cx,z.game.cy));
  bs.delete(z);
  World.remove(eng.world,z);
  wake();
  ui()
}

function mine(p){
  const z=at(p);
  if(!z)return;
  if(z.game.material==='stone'&&!stone){
    toast('🔒 STONE LOCKED\nReach 10 m first!',true);
    return
  }
  z.game.hits++;
  z.game.flash=7;
  const broken=z.game.hits>=z.game.max;
  SkyAudio.hit(z.game.material,broken,z.game.hits);
  if(broken)remove(z)
}

function rect(a,b,limit=Infinity){
  const ax=cell(a.x),ay=cell(a.y);
  let bx=cell(b.x),by=cell(b.y);
  if(Number.isFinite(limit)){
    bx=ax+clamp(bx-ax,-(limit-1),limit-1);
    by=ay+clamp(by-ay,-(limit-1),limit-1)
  }
  const minx=Math.min(ax,bx),maxx=Math.max(ax,bx),miny=Math.min(ay,by),maxy=Math.max(ay,by);
  return{minx,maxx,miny,maxy,nx:maxx-minx+1,ny:maxy-miny+1,cost:(maxx-minx+1)*(maxy-miny+1)}
}

function bodiesIn(r){
  return Query.region([...bs],{
    min:{x:r.minx*B+2,y:r.miny*B+2},
    max:{x:(r.maxx+1)*B-2,y:(r.maxy+1)*B-2}
  }).filter(z=>z.game)
}

function placementState(r){
  const hits=bodiesIn(r);
  return{terrain:hits.some(z=>z.game.terrain),placed:hits.some(z=>z.game.placed)}
}

function hideOverlapWarning(){
  $('overlapWarn').classList.remove('show');
  $('overlapWarn').setAttribute('aria-hidden','true')
}

function warnOverlap(commit){
  if(overlapSuppressed){commit();return}
  pendingPlacement=commit;
  $('overlapDont').checked=false;
  $('overlapWarn').classList.add('show');
  $('overlapWarn').setAttribute('aria-hidden','false');
  SkyAudio.ui()
}

$('overlapPlace').addEventListener('click',e=>{
  e.stopPropagation();
  if($('overlapDont').checked){
    overlapSuppressed=true;
    try{localStorage.setItem('skyStack.hideOverlapWarning','1')}catch{}
  }
  const commit=pendingPlacement;
  pendingPlacement=null;
  hideOverlapWarning();
  SkyAudio.ui();
  if(commit)commit()
});

$('overlapCancel').addEventListener('click',e=>{
  e.stopPropagation();
  pendingPlacement=null;
  hideOverlapWarning();
  SkyAudio.ui()
});
$('overlapWarn').addEventListener('pointerdown',e=>e.stopPropagation());

function attemptPlacement(r,commit){
  const state=placementState(r);
  if(state.terrain){toast('BLOCKED BY THE WORLD');return}
  if(state.placed){warnOverlap(commit);return}
  commit()
}

function one(m,p){
  if(!inv[m])return toast('NO '+m.toUpperCase()+' — MINE SOME!');
  const r={minx:cell(p.x),maxx:cell(p.x),miny:cell(p.y),maxy:cell(p.y)};
  attemptPlacement(r,()=>{
    if(!inv[m])return toast('NO '+m.toUpperCase()+' — MINE SOME!');
    inv[m]--;
    mk(ctr(r.minx),ctr(r.miny),m,{placed:true});
    ui();
    SkyAudio.place(m,1)
  })
}

function solid(m,a,b){
  const r=rect(a,b,buildLimit());
  if(r.cost===1)return one(m,b);
  if(inv[m]<r.cost)return toast('NEED '+r.cost+' '+m.toUpperCase());
  attemptPlacement(r,()=>{
    if(inv[m]<r.cost)return toast('NEED '+r.cost+' '+m.toUpperCase());
    inv[m]-=r.cost;
    mk((r.minx+r.maxx+1)*B/2,(r.miny+r.maxy+1)*B/2,m,{w:r.nx*B-1,h:r.ny*B-1,cost:r.cost,placed:true});
    ui();
    SkyAudio.place(m,r.cost)
  })
}

function minerDropPoint(p){
  const halfW=B*.34,halfH=B*.42;
  let y=p.y;
  for(let i=0;i<10;i++){
    const hits=Query.region([...bs],{min:{x:p.x-halfW,y:y-halfH},max:{x:p.x+halfW,y:y+halfH}});
    if(!hits.length)return{x:p.x,y};
    y-=B
  }
  return{x:p.x,y}
}

function placeMiner(p){
  if(unlockedMiners()<1)return toast('🔒 LEVEL 1 MINER UNLOCKS AT 20 m',true);
  if(availableMiners()<1)return toast('ALL YOUR MINERS ARE WORKING\nTap one to give him a break.',true);
  const drop=minerDropPoint(p);
  const q=Bodies.rectangle(drop.x,drop.y,B*.66,B*.80,{
    density:.00125,friction:.88,frictionStatic:.95,restitution:.02,frictionAir:.025,
    chamfer:{radius:2},sleepThreshold:100
  });
  q.game={
    kind:'miner',level:1,id:++minerId,dir:Math.random()<.5?-1:1,
    nextMine:performance.now()+700+Math.random()*300,
    nextTurn:performance.now()+800+Math.random()*1200,
    pickUntil:0
  };
  miners.add(q);
  World.add(eng.world,q);
  ui();
  SkyAudio.ui();
  toast('LEVEL 1 MINER DEPLOYED ⛏')
}

function mineableNear(q){
  const r=B*1.18;
  return Query.region([...bs],{
    min:{x:q.position.x-r,y:q.position.y-r},
    max:{x:q.position.x+r,y:q.position.y+r}
  }).filter(z=>z.game?.terrain&&z.game.material==='dirt')
}

function updateMiners(now){
  for(const q of miners){
    const g=q.game;
    Sleeping.set(q,false);
    if(now>=g.nextTurn){
      g.dir=Math.random()<.5?-1:1;
      g.nextTurn=now+900+Math.random()*1700
    }
    if(now>=g.nextMine){
      const targets=mineableNear(q);
      if(targets.length){
        const target=targets[Math.floor(Math.random()*targets.length)];
        const dx=target.position.x-q.position.x;
        if(Math.abs(dx)>4)g.dir=Math.sign(dx);
        g.pickUntil=now+240;
        remove(target)
      }
      g.nextMine=now+900+Math.random()*200
    }
    const desired=g.dir*.48;
    const vx=clamp(q.velocity.x*.72+desired*.28,-.8,.8);
    Body.setVelocity(q,{x:vx,y:q.velocity.y})
  }
}

function openMinerMenu(q){
  if(!miners.has(q))return;
  selectedMiner=q;
  $('minerMenu').classList.add('show');
  $('minerMenu').setAttribute('aria-hidden','false');
  SkyAudio.ui()
}

function closeMinerMenu(){
  selectedMiner=null;
  $('minerMenu').classList.remove('show');
  $('minerMenu').setAttribute('aria-hidden','true')
}

$('minerBreak').addEventListener('click',e=>{
  e.stopPropagation();
  if(selectedMiner&&miners.has(selectedMiner)){
    World.remove(eng.world,selectedMiner);
    miners.delete(selectedMiner);
    toast('MINER IS TAKING A BREAK ☕');
    ui()
  }
  closeMinerMenu();
  SkyAudio.ui()
});

$('minerKeep').addEventListener('click',e=>{
  e.stopPropagation();
  closeMinerMenu();
  SkyAudio.ui()
});
$('minerMenu').addEventListener('pointerdown',e=>e.stopPropagation());

$('bar').addEventListener('click',e=>{
  e.stopPropagation();
  const b=e.target.closest('.slot[data-tool]');
  if(!b)return;
  const t=b.dataset.tool;
  if(t==='stone'&&!stone)return toast('🔒 STONE UNLOCKS AT 10 m',true);
  if(t==='miner'){
    if(unlockedMiners()<1)return toast('🔒 LEVEL 1 MINER UNLOCKS AT 20 m',true);
    if(availableMiners()<1)return toast('ALL YOUR MINERS ARE WORKING\nTap one to give him a break.',true)
  }else if(t!=='pick'&&t!=='move'&&!inv[t]){
    return toast('MINE '+t.toUpperCase()+' FIRST')
  }
  tool=t;
  document.querySelectorAll('.slot').forEach(s=>s.classList.toggle('sel',s===b));
  SkyAudio.ui();
  ui()
});

$('tipBtn').onclick=e=>{
  e.stopPropagation();
  $('tips').classList.toggle('show');
  SkyAudio.ui()
};

function pos(e){
  const r=c.getBoundingClientRect();
  return{x:e.clientX-r.left,y:e.clientY-r.top}
}

function pan(dx,dy){
  cam.anim=false;
  cam.x-=dx/cam.z;
  cam.y-=dy/cam.z
}

c.addEventListener('pointerdown',e=>{
  e.preventDefault();
  $('tips').classList.remove('show');
  const s=pos(e);
  pointers.set(e.pointerId,s);
  const w=s2w(s.x,s.y);
  gesture={id:e.pointerId,start:s,last:s,a:w,b:w,moved:false,t:tool}
});

c.addEventListener('pointermove',e=>{
  e.preventDefault();
  if(!gesture||gesture.id!==e.pointerId)return;
  const s=pos(e);
  gesture.b=s2w(s.x,s.y);
  if(Math.hypot(s.x-gesture.start.x,s.y-gesture.start.y)>8)gesture.moved=true;
  if((gesture.t==='move'||gesture.t==='pick')&&gesture.moved)pan(s.x-gesture.last.x,s.y-gesture.last.y);
  gesture.last=s
});

function end(e){
  e.preventDefault();
  if(!gesture||gesture.id!==e.pointerId)return;
  const g=gesture;
  gesture=null;
  if(!g.moved){
    const worker=minerAt(g.b);
    if(worker){openMinerMenu(worker);return}
  }
  if(g.t==='move')return;
  if(g.t==='pick'){
    if(!g.moved)mine(g.b);
    return
  }
  if(g.t==='miner'){
    if(!g.moved)placeMiner(g.b);
    return
  }
  if(!g.moved)one(g.t,g.b);
  else if(shape)solid(g.t,g.a,g.b)
}
c.addEventListener('pointerup',end);
c.addEventListener('pointercancel',end);

function topPoint(){
  let p=null;
  for(const q of bs){
    if(q.game?.placed){
      const y=Math.min(...q.vertices.map(v=>v.y));
      if(!p||y<p.y){
        const near=q.vertices.filter(v=>v.y<=y+1.5);
        p={x:near.reduce((s,v)=>s+v.x,0)/near.length,y}
      }
    }
  }
  return p
}

function meters(){
  const p=topPoint();
  return p?Math.max(0,Math.round(-Math.min(0,p.y)/B)):0
}

function go(p){cam.tx=p.x;cam.ty=p.y;cam.anim=true}

function frontier(){
  const cx=cell(cam.x);
  let dug=false;
  for(let cy=0;cy<DEPTH;cy++){
    if(!grid.has(key(cx,cy)))dug=true;
    else if(dug||cy===0)return{x:ctr(cx),y:ctr(cy)}
  }
  return{x:ctr(cx),y:ctr(DEPTH-1)}
}

$('top').onclick=()=>{
  const p=topPoint();
  go(p||{x:cam.x,y:-16});
  SkyAudio.ui()
};
$('down').onclick=()=>{go(frontier());SkyAudio.ui()};

function nextMinerMilestone(){
  if(best<20)return 20;
  return 20+(Math.floor((best-20)/10)+1)*10
}

function quest(){
  if(best<5){
    $('questTitle').textContent='Reach 5 m';
    $('questSub').textContent='Unlock 2×2 solid building';
    return
  }
  if(best<10){
    $('questTitle').textContent='Reach 10 m';
    $('questSub').textContent='Unlock STONE mining';
    return
  }
  const goals=[];
  const lim=buildLimit();
  if(lim<10){
    const h=5+(lim-1)*10;
    goals.push({h,title:'Reach '+h+' m',sub:'Unlock '+(lim+1)+'×'+(lim+1)+' building'})
  }
  const mh=nextMinerMilestone();
  goals.push({h:mh,title:'Reach '+mh+' m',sub:'Unlock +1 Level 1 miner'});
  goals.sort((a,b)=>a.h-b.h);
  const g=goals[0];
  $('questTitle').textContent=g.title;
  $('questSub').textContent=g.sub
}

function progress(){
  const m=meters();
  $('height').textContent=m+' m';
  if(m>best){
    const old=best,oldLim=buildLimitAt(old),oldMinerCount=minerCountAt(old);
    best=m;
    if(old<5&&best>=5){
      shape=true;
      toast('★ 5 m! SOLID BUILDING UNLOCKED! ★\nDrag up to 2×2.',true);
      SkyAudio.unlock()
    }
    if(old<10&&best>=10){
      stone=true;
      toast('★ 10 m! STONE UNLOCKED! ★',true);
      SkyAudio.unlock()
    }
    if(buildLimit()>oldLim&&old>=5){
      toast('★ BUILD SIZE UPGRADED! ★\nMAX '+buildLimit()+'×'+buildLimit(),true);
      SkyAudio.unlock()
    }
    const gained=minerCountAt(best)-oldMinerCount;
    if(gained>0){
      toast('★ MINER UNLOCKED! ★\n+'+gained+' LEVEL 1 MINER'+(gained>1?'S':'')+' ⛏',true);
      SkyAudio.unlock()
    }
    ui();
    quest()
  }
}

function bg(){
  const alt=Math.max(0,-cam.y/(B*12)),t=clamp(alt/10,0,1);
  const mix=(a,b)=>`rgb(${a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(',')})`;
  const sky=ctx.createLinearGradient(0,0,0,HH);
  sky.addColorStop(0,mix([142,216,255],[17,26,55]));
  sky.addColorStop(1,mix([209,239,255],[55,74,108]));
  ctx.fillStyle=sky;
  ctx.fillRect(0,0,W,HH);

  const groundY=w2s(0,0).y;
  const deepY=w2s(0,DEPTH*B).y;
  if(groundY<HH){
    const earth=ctx.createLinearGradient(0,groundY,0,Math.max(groundY+1,deepY));
    earth.addColorStop(0,'#4c3020');
    earth.addColorStop(.16,'#422b1e');
    earth.addColorStop(.30,'#3a302a');
    earth.addColorStop(.43,'#303034');
    earth.addColorStop(.62,'#272b31');
    earth.addColorStop(1,'#171b22');
    ctx.fillStyle=earth;
    ctx.fillRect(0,Math.max(0,groundY),W,HH-Math.max(0,groundY))
  }

  ctx.fillStyle='#72b552';
  ctx.fillRect(0,groundY-5*cam.z,W,6*cam.z)
}

function cracks(z,sw,sh){
  if(z.game.max<=1||z.game.hits<=0)return;
  const n=Math.ceil(z.game.hits/z.game.max*4);
  const paths=[
    [[-.1,-.5],[-.02,-.2],[-.18,0],[.03,.15]],
    [[-.5,.05],[-.25,0],[-.1,.2],[-.22,.42]],
    [[.5,-.2],[.25,-.1],[.1,.08],[.3,.25]],
    [[.1,.5],[.05,.25],[-.08,.1],[.08,-.05]]
  ];
  ctx.strokeStyle='#222b35';
  ctx.lineWidth=Math.max(1,1.5*cam.z);
  for(let i=0;i<n;i++){
    ctx.beginPath();
    paths[i].forEach((p,j)=>j?ctx.lineTo(p[0]*sw,p[1]*sh):ctx.moveTo(p[0]*sw,p[1]*sh));
    ctx.stroke()
  }
}

function draw(z){
  const s=w2s(z.position.x,z.position.y),sw=z.game.w*cam.z,sh=z.game.h*cam.z;
  if(s.x+sw/2<0||s.x-sw/2>W||s.y+sh/2<0||s.y-sh/2>HH)return;
  ctx.save();
  ctx.translate(s.x,s.y);
  ctx.rotate(z.angle);
  ctx.fillStyle=M[z.game.material].col[0];
  ctx.fillRect(-sw/2,-sh/2,sw,sh);
  ctx.fillStyle=M[z.game.material].col[1];
  ctx.fillRect(-sw/2,sh/2-Math.max(2,3*cam.z),sw,Math.max(2,3*cam.z));
  cracks(z,sw,sh);
  if(z.game.flash>0){
    ctx.strokeStyle='#fff3a0';
    ctx.lineWidth=3;
    ctx.strokeRect(-sw/2+2,-sh/2+2,sw-4,sh-4);
    z.game.flash--
  }
  ctx.restore()
}

function drawMiner(q,now){
  const s=w2s(q.position.x,q.position.y),w=B*.66*cam.z,h=B*.80*cam.z;
  if(s.x+w<0||s.x-w>W||s.y+h<0||s.y-h>HH)return;
  const flip=q.game.dir<0?-1:1;
  ctx.save();
  ctx.translate(s.x,s.y);
  ctx.rotate(q.angle);
  ctx.scale(flip,1);
  ctx.lineWidth=Math.max(1,2*cam.z);
  ctx.strokeStyle='#243247';

  ctx.fillStyle='#26384b';
  ctx.fillRect(-w*.30,h*.27,w*.22,h*.18);
  ctx.fillRect(w*.08,h*.27,w*.22,h*.18);

  ctx.fillStyle='#3c75a6';
  ctx.fillRect(-w*.34,-h*.05,w*.68,h*.36);
  ctx.strokeRect(-w*.34,-h*.05,w*.68,h*.36);

  ctx.fillStyle='#f0b78d';
  ctx.fillRect(-w*.29,-h*.35,w*.58,h*.34);
  ctx.strokeRect(-w*.29,-h*.35,w*.58,h*.34);

  ctx.fillStyle='#f0c84c';
  ctx.fillRect(-w*.36,-h*.46,w*.72,h*.14);
  ctx.fillRect(-w*.27,-h*.54,w*.54,h*.11);
  ctx.strokeRect(-w*.36,-h*.46,w*.72,h*.14);

  ctx.fillStyle='#243247';
  const eye=Math.max(1,2.1*cam.z);
  ctx.fillRect(w*.02,-h*.22,eye,eye);
  ctx.fillRect(w*.18,-h*.22,eye,eye);

  if(now<q.game.pickUntil){
    ctx.strokeStyle='#5c3d2b';
    ctx.lineWidth=Math.max(2,2.2*cam.z);
    ctx.beginPath();ctx.moveTo(w*.25,-h*.03);ctx.lineTo(w*.62,-h*.42);ctx.stroke();
    ctx.strokeStyle='#9aa1aa';
    ctx.lineWidth=Math.max(2,2.5*cam.z);
    ctx.beginPath();ctx.moveTo(w*.43,-h*.46);ctx.lineTo(w*.73,-h*.33);ctx.stroke()
  }
  ctx.restore()
}

function preview(){
  if(!gesture||!M[gesture.t]||!shape||!gesture.moved)return;
  const r=rect(gesture.a,gesture.b,buildLimit());
  const a=w2s(r.minx*B,r.miny*B),w=r.nx*B*cam.z,h=r.ny*B*cam.z;
  ctx.globalAlpha=.35;
  ctx.fillStyle=M[gesture.t].col[0];
  ctx.fillRect(a.x,a.y,w,h);
  ctx.globalAlpha=1;
  ctx.fillStyle='#fff';
  ctx.font='900 12px ui-monospace';
  ctx.fillText(r.nx+'×'+r.ny+' · '+r.cost,a.x+5,a.y+16)
}

function loop(now){
  Engine.update(eng,16.67);
  updateMiners(now||performance.now());
  if(cam.anim){
    cam.x+=(cam.tx-cam.x)*.12;
    cam.y+=(cam.ty-cam.y)*.12;
    if(Math.abs(cam.tx-cam.x)<.3&&Math.abs(cam.ty-cam.y)<.3)cam.anim=false
  }
  ensureWorld();
  progress();
  ctx.setTransform(DPR,0,0,DPR,0,0);
  bg();
  for(const z of bs)draw(z);
  for(const q of miners)drawMiner(q,now||performance.now());
  preview();
  requestAnimationFrame(loop)
}

ui();
quest();
load.remove();
toast('MINE DIRT. BUILD UP.');
requestAnimationFrame(loop);
})();