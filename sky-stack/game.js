(() => {
'use strict';

const $=id=>document.getElementById(id),load=$('load');
if(!window.Matter){load.textContent='Physics failed to load';return}

const {Engine,World,Bodies,Body,Query,Sleeping}=Matter;
const c=$('game'),ctx=c.getContext('2d'),B=32,H=16,DIRT=6,DEPTH=34,TRANSITION=4;
const SAVE_KEY='skyStack.save.v1';
const LV2_COST=8;
const M={
  dirt:{taps:1,d:.0017,f:.74,r:.13,a:.012,col:['#98633a','#81502e']},
  stone:{taps:3,d:.0028,f:.88,r:.055,a:.009,col:['#777f89','#626a74']}
};

const inv={dirt:0,stone:0,gold:0};
const bs=new Set(),grid=new Map(),generated=new Set(),pointers=new Map(),miners=new Set();
const removedTerrain=new Set(),terrainDamage=new Map(),restingMiners=[];
const goldBursts=[];
const cam={x:0,y:-180,z:1,tx:0,ty:-180,anim:false};

let tool='pick',gesture=null,best=0,shape=false,stone=false,toastTimer,minerId=0,selectedMiner=null;
let pendingPlacement=null,restoring=false,resetting=false,lastSavedAt=0,deadMiners=0;
let overlapSuppressed=false;
try{overlapSuppressed=localStorage.getItem('skyStack.hideOverlapWarning')==='1'}catch{}

const eng=Engine.create({enableSleeping:true});
eng.gravity.y=1.05;eng.gravity.scale=.001;

let W,HH,DPR;
const key=(a,b)=>a+','+b,cell=v=>Math.floor(v/B),ctr=i=>i*B+H,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=n=>Number.isFinite(n)?n:0;

function resize(){W=innerWidth;HH=innerHeight;DPR=Math.min(devicePixelRatio||1,2);c.width=W*DPR;c.height=HH*DPR;c.style.width=W+'px';c.style.height=HH+'px'}
resize();addEventListener('resize',resize,{passive:true});
const w2s=(px,py)=>({x:(px-cam.x)*cam.z+W/2,y:(py-cam.y)*cam.z+HH/2});
const s2w=(px,py)=>({x:(px-W/2)/cam.z+cam.x,y:(py-HH/2)/cam.z+cam.y});

function hash01(x,y,salt=0){
  let n=Math.imul(x+salt*131,374761393)^Math.imul(y-salt*197,668265263);
  n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295
}

function terrainMaterial(cx,cy){
  const start=DIRT-Math.floor(TRANSITION/2);
  if(cy<start)return 'dirt';if(cy>=start+TRANSITION)return 'stone';
  const step=cy-start+1;return hash01(cx,cy)<step/(TRANSITION+1)?'stone':'dirt'
}

function goldAt(cx,cy){
  if(cy<1)return 0;
  const REGION=11,rx=Math.floor(cx/REGION),ry=Math.floor(cy/REGION);
  let bestInfluence=0,coreLuck=0;
  for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
    const gx=rx+ox,gy=ry+oy;
    if(hash01(gx,gy,71)>.38)continue;
    const centerX=gx*REGION+2+Math.floor(hash01(gx,gy,72)*(REGION-4));
    const centerY=gy*REGION+2+Math.floor(hash01(gx,gy,73)*(REGION-4));
    const dx=cx-centerX,dy=cy-centerY,d=Math.sqrt(dx*dx+dy*dy);
    let influence=0;
    if(d<=1.25)influence=.78;
    else if(d<=2.45)influence=.48;
    else if(d<=3.7)influence=.22;
    else if(d<=5.0)influence=.055;
    if(influence>bestInfluence){bestInfluence=influence;coreLuck=hash01(centerX,centerY,74)}
  }
  if(bestInfluence===0&&hash01(cx,cy,75)<.004)bestInfluence=.2;
  if(bestInfluence===0||hash01(cx,cy,76)>=bestInfluence)return 0;
  const richness=hash01(cx,cy,77);
  if(bestInfluence>.6&&coreLuck>.6&&richness>.86)return 3;
  if(bestInfluence>.4&&richness>.72)return 2;
  return 1
}

function readSave(){
  try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return null;const s=JSON.parse(raw);return s&&s.v===1?s:null}
  catch(e){console.warn('Save read failed',e);return null}
}

const initialSave=readSave();
if(initialSave){
  best=Math.max(0,finite(initialSave.best));shape=best>=5;stone=best>=10;
  inv.dirt=Math.max(0,Math.floor(finite(initialSave.inv?.dirt)));
  inv.stone=Math.max(0,Math.floor(finite(initialSave.inv?.stone)));
  inv.gold=Math.max(0,Math.floor(finite(initialSave.inv?.gold)));
  deadMiners=Math.max(0,Math.floor(finite(initialSave.deadMiners)));
  if(Array.isArray(initialSave.restingMiners))for(const r of initialSave.restingMiners)restingMiners.push({id:Math.max(1,Math.floor(finite(r.id))),level:clamp(Math.floor(finite(r.level)||1),1,2),gold:Math.max(0,Math.floor(finite(r.gold)))});
  if(Array.isArray(initialSave.removed))for(const k of initialSave.removed)if(typeof k==='string')removedTerrain.add(k);
  if(Array.isArray(initialSave.damage))for(const d of initialSave.damage)if(Array.isArray(d)&&typeof d[0]==='string'&&finite(d[1])>0)terrainDamage.set(d[0],Math.floor(d[1]));
  if(initialSave.cam){cam.x=finite(initialSave.cam.x);cam.y=finite(initialSave.cam.y);cam.tx=cam.x;cam.ty=cam.y}
}

function mk(px,py,m,o={}){
  const q=M[m],w=o.w||B-1,h=o.h||B-1;
  const z=Bodies.rectangle(px,py,w,h,{isStatic:!!o.static,density:q.d,friction:q.f,frictionStatic:Math.min(1,q.f+.1),restitution:q.r,frictionAir:q.a,chamfer:{radius:1.2},sleepThreshold:70});
  z.game={material:m,terrain:!!o.terrain,placed:!!o.placed,hits:o.hits||0,max:q.taps,cx:o.cx??null,cy:o.cy??null,w,h,cost:o.cost||1,born:performance.now()};
  if(o.angle)Body.setAngle(z,o.angle);if(o.velocity)Body.setVelocity(z,{x:finite(o.velocity.x),y:finite(o.velocity.y)});if(o.angularVelocity)Body.setAngularVelocity(z,finite(o.angularVelocity));
  bs.add(z);if(o.terrain)grid.set(key(o.cx,o.cy),z);World.add(eng.world,z);return z
}

function gen(ch){
  if(generated.has(ch))return;generated.add(ch);
  for(let cy=0;cy<DEPTH;cy++)for(let cx=ch*24;cx<ch*24+24;cx++){
    const k=key(cx,cy);if(removedTerrain.has(k))continue;
    const m=terrainMaterial(cx,cy),hits=terrainDamage.get(k)||0;mk(ctr(cx),ctr(cy),m,{static:true,terrain:true,cx,cy,hits})
  }
}
function ensureWorld(){const ch=Math.floor(cam.x/(24*B));for(let i=ch-2;i<=ch+2;i++)gen(i)}
ensureWorld();World.add(eng.world,Bodies.rectangle(0,(DEPTH+2)*B,1000000,B*2,{isStatic:true}));

function createMinerAt(x,y,o={}){
  const q=Bodies.rectangle(x,y,B*.66,B*.80,{density:.00125,friction:.88,frictionStatic:.95,restitution:.02,frictionAir:.025,chamfer:{radius:2},sleepThreshold:100});
  const id=Math.max(1,Math.floor(o.id||++minerId));minerId=Math.max(minerId,id);
  q.game={kind:'miner',level:clamp(Math.floor(o.level||1),1,2),gold:Math.max(0,Math.floor(o.gold||0)),id,dir:o.dir===-1?-1:1,nextMine:performance.now()+700+Math.random()*300,nextTurn:performance.now()+800+Math.random()*1200,pickUntil:0};
  if(o.angle)Body.setAngle(q,o.angle);if(o.velocity)Body.setVelocity(q,{x:finite(o.velocity.x),y:finite(o.velocity.y)});if(o.angularVelocity)Body.setAngularVelocity(q,finite(o.angularVelocity));
  miners.add(q);World.add(eng.world,q);return q
}
function ensureChunkAtX(x){const ch=Math.floor(x/(24*B));for(let i=ch-1;i<=ch+1;i++)gen(i)}

function restoreDynamicState(s){
  if(!s)return;restoring=true;
  if(Array.isArray(s.placed))for(const p of s.placed){if(!M[p.material])continue;ensureChunkAtX(finite(p.x));mk(finite(p.x),finite(p.y),p.material,{placed:true,w:Math.max(4,finite(p.w)||B-1),h:Math.max(4,finite(p.h)||B-1),cost:Math.max(1,Math.floor(finite(p.cost)||1)),hits:Math.max(0,Math.floor(finite(p.hits))),angle:finite(p.angle),velocity:{x:finite(p.vx),y:finite(p.vy)},angularVelocity:finite(p.av)})}
  if(Array.isArray(s.miners))for(const m of s.miners){ensureChunkAtX(finite(m.x));createMinerAt(finite(m.x),finite(m.y),{id:m.id,level:m.level,gold:m.gold,dir:m.dir,angle:finite(m.angle),velocity:{x:finite(m.vx),y:finite(m.vy)},angularVelocity:finite(m.av)})}
  const earned=minerCountAt(best),accounted=miners.size+restingMiners.length+deadMiners;
  for(let i=accounted;i<earned;i++)restingMiners.push({id:++minerId,level:1,gold:0});
  restingMiners.forEach(r=>minerId=Math.max(minerId,r.id||0));restoring=false
}

function saveGame(){
  if(resetting)return;
  try{
    const placed=[];for(const z of bs)if(z.game?.placed)placed.push({material:z.game.material,x:z.position.x,y:z.position.y,w:z.game.w,h:z.game.h,cost:z.game.cost,hits:z.game.hits||0,angle:z.angle,vx:z.velocity.x,vy:z.velocity.y,av:z.angularVelocity});
    const workerData=[];for(const q of miners)workerData.push({id:q.game.id,level:q.game.level,gold:q.game.gold,dir:q.game.dir,x:q.position.x,y:q.position.y,angle:q.angle,vx:q.velocity.x,vy:q.velocity.y,av:q.angularVelocity});
    const s={v:1,savedAt:Date.now(),best,inv:{dirt:inv.dirt,stone:inv.stone,gold:inv.gold},deadMiners,restingMiners,removed:[...removedTerrain],damage:[...terrainDamage.entries()],placed,miners:workerData,cam:{x:cam.x,y:cam.y}};
    localStorage.setItem(SAVE_KEY,JSON.stringify(s));lastSavedAt=performance.now()
  }catch(e){console.warn('Save failed',e)}
}
function saveSoon(){if(restoring)return;if(performance.now()-lastSavedAt>350)saveGame()}
setInterval(saveGame,2500);addEventListener('pagehide',saveGame);document.addEventListener('visibilitychange',()=>{if(document.hidden)saveGame()});

function toast(t,long=false){clearTimeout(toastTimer);$('toast').textContent=t;$('toast').classList.remove('hide');toastTimer=setTimeout(()=>$('toast').classList.add('hide'),long?3000:1300)}
function buildLimitAt(h){return h<5?1:Math.min(10,2+Math.floor(Math.max(0,h-5)/10))}
function buildLimit(){return buildLimitAt(best)}
function minerCountAt(h){return h<20?0:1+Math.floor((h-20)/10)}
function unlockedMiners(){return minerCountAt(best)}
function availableMiners(){return restingMiners.length}

function ui(){
  $('dc').textContent=inv.dirt;$('sc').textContent=inv.stone;$('gc').textContent=inv.gold;
  document.querySelector('[data-tool=dirt]').classList.toggle('empty',!inv.dirt);
  $('stoneSlot').classList.toggle('unlocked',stone);$('stoneSlot').classList.toggle('locked',!stone);
  const total=unlockedMiners(),available=availableMiners();$('mc').textContent=available;$('minerSlot').classList.toggle('unlocked',total>0);$('minerSlot').classList.toggle('locked',total===0);$('minerSlot').classList.toggle('empty',total>0&&available===0);
  $('mode').textContent='MAX '+buildLimit()+'×'+buildLimit()
}

function at(p){const a=Query.point([...bs],p);a.sort((a,b)=>(b.game?.born||0)-(a.game?.born||0));return a[0]}
function minerAt(p){return Query.point([...miners],p)[0]||null}
function wake(){for(const q of bs)if(q.game?.placed&&!q.isStatic){Sleeping.set(q,false);Body.setVelocity(q,{x:q.velocity.x,y:q.velocity.y+.001})}}
function goldBurst(x,y,n,stolen=false){goldBursts.push({x,y,n,stolen,born:performance.now()})}

function harvest(z,collector='player',miner=null){
  inv[z.game.material]+=z.game.cost||1;
  let gold=0;
  if(z.game.terrain){
    const k=key(z.game.cx,z.game.cy);gold=goldAt(z.game.cx,z.game.cy);grid.delete(k);removedTerrain.add(k);terrainDamage.delete(k);
    if(gold>0){
      goldBurst(z.position.x,z.position.y,gold,collector==='miner');
      if(collector==='miner'&&miner){miner.game.gold+=gold;toast('YOUR MINER FOUND GOLD...\nAND POCKETED IT 👀',true)}
      else{inv.gold+=gold;toast('★ GOLD! +'+gold+' ★',true)}
    }
  }
  bs.delete(z);World.remove(eng.world,z);wake();ui();saveSoon();return gold
}

function mine(p){
  const z=at(p);if(!z)return;if(z.game.material==='stone'&&!stone){toast('🔒 STONE LOCKED\nReach 10 m first!',true);return}
  z.game.hits++;z.game.flash=7;if(z.game.terrain)terrainDamage.set(key(z.game.cx,z.game.cy),z.game.hits);
  const broken=z.game.hits>=z.game.max;SkyAudio.hit(z.game.material,broken,z.game.hits);if(broken)harvest(z,'player');else saveSoon()
}

function rect(a,b,limit=Infinity){const ax=cell(a.x),ay=cell(a.y);let bx=cell(b.x),by=cell(b.y);if(Number.isFinite(limit)){bx=ax+clamp(bx-ax,-(limit-1),limit-1);by=ay+clamp(by-ay,-(limit-1),limit-1)}const minx=Math.min(ax,bx),maxx=Math.max(ax,bx),miny=Math.min(ay,by),maxy=Math.max(ay,by);return{minx,maxx,miny,maxy,nx:maxx-minx+1,ny:maxy-miny+1,cost:(maxx-minx+1)*(maxy-miny+1)}}
function bodiesIn(r){return Query.region([...bs],{min:{x:r.minx*B+2,y:r.miny*B+2},max:{x:(r.maxx+1)*B-2,y:(r.maxy+1)*B-2}}).filter(z=>z.game)}
function placementState(r){const hits=bodiesIn(r);return{terrain:hits.some(z=>z.game.terrain),placed:hits.some(z=>z.game.placed)}}
function hideOverlapWarning(){$('overlapWarn').classList.remove('show');$('overlapWarn').setAttribute('aria-hidden','true')}
function warnOverlap(commit){if(overlapSuppressed){commit();return}pendingPlacement=commit;$('overlapDont').checked=false;$('overlapWarn').classList.add('show');$('overlapWarn').setAttribute('aria-hidden','false');SkyAudio.ui()}
$('overlapPlace').addEventListener('click',e=>{e.stopPropagation();if($('overlapDont').checked){overlapSuppressed=true;try{localStorage.setItem('skyStack.hideOverlapWarning','1')}catch{}}const commit=pendingPlacement;pendingPlacement=null;hideOverlapWarning();SkyAudio.ui();if(commit)commit()});
$('overlapCancel').addEventListener('click',e=>{e.stopPropagation();pendingPlacement=null;hideOverlapWarning();SkyAudio.ui()});$('overlapWarn').addEventListener('pointerdown',e=>e.stopPropagation());
function attemptPlacement(r,commit){const state=placementState(r);if(state.terrain){toast('BLOCKED BY THE WORLD');return}if(state.placed){warnOverlap(commit);return}commit()}

function one(m,p){if(!inv[m])return toast('NO '+m.toUpperCase()+' — MINE SOME!');const r={minx:cell(p.x),maxx:cell(p.x),miny:cell(p.y),maxy:cell(p.y)};attemptPlacement(r,()=>{if(!inv[m])return toast('NO '+m.toUpperCase()+' — MINE SOME!');inv[m]--;mk(ctr(r.minx),ctr(r.miny),m,{placed:true});ui();SkyAudio.place(m,1);saveSoon()})}
function solid(m,a,b){const r=rect(a,b,buildLimit());if(r.cost===1)return one(m,b);if(inv[m]<r.cost)return toast('NEED '+r.cost+' '+m.toUpperCase());attemptPlacement(r,()=>{if(inv[m]<r.cost)return toast('NEED '+r.cost+' '+m.toUpperCase());inv[m]-=r.cost;mk((r.minx+r.maxx+1)*B/2,(r.miny+r.maxy+1)*B/2,m,{w:r.nx*B-1,h:r.ny*B-1,cost:r.cost,placed:true});ui();SkyAudio.place(m,r.cost);saveSoon()})}

function minerDropPoint(p){const halfW=B*.34,halfH=B*.42;let y=p.y;for(let i=0;i<10;i++){const hits=Query.region([...bs],{min:{x:p.x-halfW,y:y-halfH},max:{x:p.x+halfW,y:y+halfH}});if(!hits.length)return{x:p.x,y};y-=B}return{x:p.x,y}}
function placeMiner(p){
  if(unlockedMiners()<1)return toast('🔒 LEVEL 1 MINER UNLOCKS AT 20 m',true);
  if(availableMiners()<1)return toast('ALL YOUR MINERS ARE WORKING\nTap one to manage him.',true);
  restingMiners.sort((a,b)=>b.level-a.level);const data=restingMiners.shift();const drop=minerDropPoint(p);createMinerAt(drop.x,drop.y,{id:data.id,level:data.level,gold:data.gold,dir:Math.random()<.5?-1:1});ui();SkyAudio.ui();toast('LEVEL '+data.level+' MINER DEPLOYED ⛏');saveSoon()
}
function minerMaterial(q){return q.game.level===1?'dirt':'stone'}
function mineableNear(q){const r=B*1.18,m=minerMaterial(q);return Query.region([...bs],{min:{x:q.position.x-r,y:q.position.y-r},max:{x:q.position.x+r,y:q.position.y+r}}).filter(z=>z.game?.terrain&&z.game.material===m)}
function minerHit(q,target){target.game.hits++;target.game.flash=5;terrainDamage.set(key(target.game.cx,target.game.cy),target.game.hits);SkyAudio.hit(target.game.material,target.game.hits>=target.game.max,target.game.hits);if(target.game.hits>=target.game.max)harvest(target,'miner',q);else saveSoon()}
function updateMiners(now){
  for(const q of miners){
    const g=q.game;Sleeping.set(q,false);
    if(now>=g.nextTurn){g.dir=Math.random()<.5?-1:1;g.nextTurn=now+900+Math.random()*1700}
    if(now>=g.nextMine){const targets=mineableNear(q);if(targets.length){const target=targets[Math.floor(Math.random()*targets.length)],dx=target.position.x-q.position.x;if(Math.abs(dx)>4)g.dir=Math.sign(dx);g.pickUntil=now+240;minerHit(q,target)}g.nextMine=now+900+Math.random()*200}
    const desired=g.dir*.48,vx=clamp(q.velocity.x*.72+desired*.28,-.8,.8);Body.setVelocity(q,{x:vx,y:q.velocity.y})
  }
}

function upgradeText(q){if(q.game.level===1)return 'UPGRADE TO LEVEL 2 · '+LV2_COST+' GOLD';return 'LEVEL 3 · LOCKED'}
function refreshMinerMenu(){
  if(!selectedMiner||!miners.has(selectedMiner))return;
  const g=selectedMiner.game;$('minerTitle').textContent='LEVEL '+g.level+' MINER';$('minerGold').textContent='POCKETED GOLD: '+g.gold;
  $('minerDesc').textContent=g.level===1?'He mines dirt and sends the dirt to you. Hidden gold goes in his pocket.':'He mines stone and sends the stone to you. Hidden gold still goes in his pocket.';
  $('minerUpgrade').textContent=upgradeText(selectedMiner);$('minerUpgrade').disabled=g.level>=2||inv.gold<LV2_COST;
  $('minerUpgradeHint').textContent=g.level===1?(inv.gold>=LV2_COST?'Spend '+LV2_COST+' gold to make him a stone specialist.':'Need '+LV2_COST+' gold. You have '+inv.gold+'.'):'A deeper material must be discovered before Level 3 exists.';
  $('minerKill').textContent='KILL MINER · CLAIM '+g.gold+' GOLD'
}
function openMinerMenu(q){if(!miners.has(q))return;selectedMiner=q;refreshMinerMenu();$('minerMenu').classList.add('show');$('minerMenu').setAttribute('aria-hidden','false');SkyAudio.ui()}
function closeMinerMenu(){selectedMiner=null;$('minerMenu').classList.remove('show');$('minerMenu').setAttribute('aria-hidden','true')}
$('minerBreak').addEventListener('click',e=>{e.stopPropagation();if(selectedMiner&&miners.has(selectedMiner)){const g=selectedMiner.game;restingMiners.push({id:g.id,level:g.level,gold:g.gold});World.remove(eng.world,selectedMiner);miners.delete(selectedMiner);toast('MINER IS TAKING A BREAK ☕');ui();saveSoon()}closeMinerMenu();SkyAudio.ui()});
$('minerKeep').addEventListener('click',e=>{e.stopPropagation();closeMinerMenu();SkyAudio.ui()});
$('minerUpgrade').addEventListener('click',e=>{e.stopPropagation();if(!selectedMiner||!miners.has(selectedMiner))return;const g=selectedMiner.game;if(g.level!==1)return;if(inv.gold<LV2_COST){toast('NEED '+LV2_COST+' GOLD');refreshMinerMenu();return}inv.gold-=LV2_COST;g.level=2;ui();refreshMinerMenu();SkyAudio.unlock();toast('★ LEVEL 2 MINER! ★\nSTONE SPECIALIST',true);saveSoon()});
$('minerKill').addEventListener('click',e=>{e.stopPropagation();if(!selectedMiner||!miners.has(selectedMiner))return;$('killGold').textContent=selectedMiner.game.gold;$('killModal').classList.add('show');$('killModal').setAttribute('aria-hidden','false');SkyAudio.ui()});
$('minerMenu').addEventListener('pointerdown',e=>e.stopPropagation());
$('killCancel').addEventListener('click',e=>{e.stopPropagation();$('killModal').classList.remove('show');$('killModal').setAttribute('aria-hidden','true');SkyAudio.ui()});
$('killConfirm').addEventListener('click',e=>{e.stopPropagation();if(selectedMiner&&miners.has(selectedMiner)){const loot=selectedMiner.game.gold;inv.gold+=loot;World.remove(eng.world,selectedMiner);miners.delete(selectedMiner);deadMiners++;ui();saveSoon();toast(loot?'MINER GONE. +'+loot+' GOLD 💰':'MINER GONE.',true)}$('killModal').classList.remove('show');$('killModal').setAttribute('aria-hidden','true');closeMinerMenu();SkyAudio.ui()});
$('killModal').addEventListener('pointerdown',e=>e.stopPropagation());

$('bar').addEventListener('click',e=>{
  e.stopPropagation();const b=e.target.closest('.slot[data-tool]');if(!b)return;const t=b.dataset.tool;
  if(t==='stone'&&!stone)return toast('🔒 STONE UNLOCKS AT 10 m',true);
  if(t==='miner'){if(unlockedMiners()<1)return toast('🔒 LEVEL 1 MINER UNLOCKS AT 20 m',true);if(availableMiners()<1)return toast('NO MINERS AVAILABLE\nWorking miners can be given a break.',true)}
  else if(t!=='pick'&&t!=='move'&&!inv[t])return toast('MINE '+t.toUpperCase()+' FIRST');
  tool=t;document.querySelectorAll('.slot').forEach(s=>s.classList.toggle('sel',s===b));SkyAudio.ui();ui()
});

$('tipBtn').onclick=e=>{e.stopPropagation();$('tips').classList.toggle('show');SkyAudio.ui()};
$('restartWorld').addEventListener('click',e=>{e.stopPropagation();$('tips').classList.remove('show');$('restartAgree').checked=false;$('restartConfirm').disabled=true;$('restartModal').classList.add('show');$('restartModal').setAttribute('aria-hidden','false');SkyAudio.ui()});
$('restartAgree').addEventListener('change',()=>{$('restartConfirm').disabled=!$('restartAgree').checked});
$('restartCancel').addEventListener('click',e=>{e.stopPropagation();$('restartModal').classList.remove('show');$('restartModal').setAttribute('aria-hidden','true');SkyAudio.ui()});
$('restartModal').addEventListener('pointerdown',e=>e.stopPropagation());
$('restartConfirm').addEventListener('click',e=>{e.stopPropagation();if(!$('restartAgree').checked)return;resetting=true;try{localStorage.removeItem(SAVE_KEY)}catch{}location.reload()});

function pos(e){const r=c.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
function pan(dx,dy){cam.anim=false;cam.x-=dx/cam.z;cam.y-=dy/cam.z}
c.addEventListener('pointerdown',e=>{e.preventDefault();$('tips').classList.remove('show');const s=pos(e);pointers.set(e.pointerId,s);const w=s2w(s.x,s.y);gesture={id:e.pointerId,start:s,last:s,a:w,b:w,moved:false,t:tool}});
c.addEventListener('pointermove',e=>{e.preventDefault();if(!gesture||gesture.id!==e.pointerId)return;const s=pos(e);gesture.b=s2w(s.x,s.y);if(Math.hypot(s.x-gesture.start.x,s.y-gesture.start.y)>8)gesture.moved=true;if((gesture.t==='move'||gesture.t==='pick')&&gesture.moved)pan(s.x-gesture.last.x,s.y-gesture.last.y);gesture.last=s});
function end(e){e.preventDefault();if(!gesture||gesture.id!==e.pointerId)return;const g=gesture;gesture=null;if(!g.moved){const worker=minerAt(g.b);if(worker){openMinerMenu(worker);return}}if(g.t==='move')return;if(g.t==='pick'){if(!g.moved)mine(g.b);return}if(g.t==='miner'){if(!g.moved)placeMiner(g.b);return}if(!g.moved)one(g.t,g.b);else if(shape)solid(g.t,g.a,g.b)}
c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end);

function topPoint(){let p=null;for(const q of bs)if(q.game?.placed){const y=Math.min(...q.vertices.map(v=>v.y));if(!p||y<p.y){const near=q.vertices.filter(v=>v.y<=y+1.5);p={x:near.reduce((s,v)=>s+v.x,0)/near.length,y}}}return p}
function meters(){const p=topPoint();return p?Math.max(0,Math.round(-Math.min(0,p.y)/B)):0}
function go(p){cam.tx=p.x;cam.ty=p.y;cam.anim=true}
function frontier(){const cx=cell(cam.x);let dug=false;for(let cy=0;cy<DEPTH;cy++){if(!grid.has(key(cx,cy)))dug=true;else if(dug||cy===0)return{x:ctr(cx),y:ctr(cy)}}return{x:ctr(cx),y:ctr(DEPTH-1)}}
$('top').onclick=()=>{const p=topPoint();go(p||{x:cam.x,y:-16});SkyAudio.ui()};$('down').onclick=()=>{go(frontier());SkyAudio.ui()};

function nextMinerMilestone(){if(best<20)return 20;return 20+(Math.floor((best-20)/10)+1)*10}
function quest(){
  if(best<5){$('questTitle').textContent='Reach 5 m';$('questSub').textContent='Unlock 2×2 solid building';return}
  if(best<10){$('questTitle').textContent='Reach 10 m';$('questSub').textContent='Unlock STONE mining';return}
  const goals=[],lim=buildLimit();if(lim<10){const h=5+(lim-1)*10;goals.push({h,title:'Reach '+h+' m',sub:'Unlock '+(lim+1)+'×'+(lim+1)+' building'})}
  const mh=nextMinerMilestone();goals.push({h:mh,title:'Reach '+mh+' m',sub:'Unlock +1 Level 1 miner'});goals.sort((a,b)=>a.h-b.h);$('questTitle').textContent=goals[0].title;$('questSub').textContent=goals[0].sub
}
function progress(){
  const m=meters();$('height').textContent=m+' m';
  if(m>best){
    const old=best,oldLim=buildLimitAt(old),oldMinerCount=minerCountAt(old);best=m;
    if(old<5&&best>=5){shape=true;toast('★ 5 m! SOLID BUILDING UNLOCKED! ★\nDrag up to 2×2.',true);SkyAudio.unlock()}
    if(old<10&&best>=10){stone=true;toast('★ 10 m! STONE UNLOCKED! ★',true);SkyAudio.unlock()}
    if(buildLimit()>oldLim&&old>=5){toast('★ BUILD SIZE UPGRADED! ★\nMAX '+buildLimit()+'×'+buildLimit(),true);SkyAudio.unlock()}
    const gained=minerCountAt(best)-oldMinerCount;if(gained>0){for(let i=0;i<gained;i++)restingMiners.push({id:++minerId,level:1,gold:0});toast('★ MINER UNLOCKED! ★\n+'+gained+' LEVEL 1 MINER'+(gained>1?'S':'')+' ⛏',true);SkyAudio.unlock()}
    ui();quest();saveSoon()
  }
}

function bg(){const alt=Math.max(0,-cam.y/(B*12)),t=clamp(alt/10,0,1),mix=(a,b)=>`rgb(${a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(',')})`;const sky=ctx.createLinearGradient(0,0,0,HH);sky.addColorStop(0,mix([142,216,255],[17,26,55]));sky.addColorStop(1,mix([209,239,255],[55,74,108]));ctx.fillStyle=sky;ctx.fillRect(0,0,W,HH);const groundY=w2s(0,0).y,deepY=w2s(0,DEPTH*B).y;if(groundY<HH){const earth=ctx.createLinearGradient(0,groundY,0,Math.max(groundY+1,deepY));earth.addColorStop(0,'#4c3020');earth.addColorStop(.16,'#422b1e');earth.addColorStop(.30,'#3a302a');earth.addColorStop(.43,'#303034');earth.addColorStop(.62,'#272b31');earth.addColorStop(1,'#171b22');ctx.fillStyle=earth;ctx.fillRect(0,Math.max(0,groundY),W,HH-Math.max(0,groundY))}ctx.fillStyle='#72b552';ctx.fillRect(0,groundY-5*cam.z,W,6*cam.z)}
function cracks(z,sw,sh){if(z.game.max<=1||z.game.hits<=0)return;const n=Math.ceil(z.game.hits/z.game.max*4),paths=[[[-.1,-.5],[-.02,-.2],[-.18,0],[.03,.15]],[[-.5,.05],[-.25,0],[-.1,.2],[-.22,.42]],[[.5,-.2],[.25,-.1],[.1,.08],[.3,.25]],[[.1,.5],[.05,.25],[-.08,.1],[.08,-.05]]];ctx.strokeStyle='#222b35';ctx.lineWidth=Math.max(1,1.5*cam.z);for(let i=0;i<n;i++){ctx.beginPath();paths[i].forEach((p,j)=>j?ctx.lineTo(p[0]*sw,p[1]*sh):ctx.moveTo(p[0]*sw,p[1]*sh));ctx.stroke()}}
function draw(z){const s=w2s(z.position.x,z.position.y),sw=z.game.w*cam.z,sh=z.game.h*cam.z;if(s.x+sw/2<0||s.x-sw/2>W||s.y+sh/2<0||s.y-sh/2>HH)return;ctx.save();ctx.translate(s.x,s.y);ctx.rotate(z.angle);ctx.fillStyle=M[z.game.material].col[0];ctx.fillRect(-sw/2,-sh/2,sw,sh);ctx.fillStyle=M[z.game.material].col[1];ctx.fillRect(-sw/2,sh/2-Math.max(2,3*cam.z),sw,Math.max(2,3*cam.z));cracks(z,sw,sh);if(z.game.flash>0){ctx.strokeStyle='#fff3a0';ctx.lineWidth=3;ctx.strokeRect(-sw/2+2,-sh/2+2,sw-4,sh-4);z.game.flash--}ctx.restore()}
function drawMiner(q,now){
  const s=w2s(q.position.x,q.position.y),w=B*.66*cam.z,h=B*.80*cam.z;if(s.x+w<0||s.x-w>W||s.y+h<0||s.y-h>HH)return;const flip=q.game.dir<0?-1:1;
  ctx.save();ctx.translate(s.x,s.y);ctx.rotate(q.angle);ctx.scale(flip,1);ctx.lineWidth=Math.max(1,2*cam.z);ctx.strokeStyle='#243247';ctx.fillStyle='#26384b';ctx.fillRect(-w*.30,h*.27,w*.22,h*.18);ctx.fillRect(w*.08,h*.27,w*.22,h*.18);ctx.fillStyle=q.game.level===1?'#3c75a6':'#6956a8';ctx.fillRect(-w*.34,-h*.05,w*.68,h*.36);ctx.strokeRect(-w*.34,-h*.05,w*.68,h*.36);ctx.fillStyle='#f0b78d';ctx.fillRect(-w*.29,-h*.35,w*.58,h*.34);ctx.strokeRect(-w*.29,-h*.35,w*.58,h*.34);ctx.fillStyle=q.game.level===1?'#f0c84c':'#e9dd63';ctx.fillRect(-w*.36,-h*.46,w*.72,h*.14);ctx.fillRect(-w*.27,-h*.54,w*.54,h*.11);ctx.strokeRect(-w*.36,-h*.46,w*.72,h*.14);ctx.fillStyle='#243247';const eye=Math.max(1,2.1*cam.z);ctx.fillRect(w*.02,-h*.22,eye,eye);ctx.fillRect(w*.18,-h*.22,eye,eye);
  if(q.game.gold>0){ctx.fillStyle='#ffd84f';ctx.beginPath();ctx.arc(-w*.35,h*.13,Math.max(2,w*.12),0,Math.PI*2);ctx.fill();ctx.stroke()}
  if(now<q.game.pickUntil){ctx.strokeStyle='#5c3d2b';ctx.lineWidth=Math.max(2,2.2*cam.z);ctx.beginPath();ctx.moveTo(w*.25,-h*.03);ctx.lineTo(w*.62,-h*.42);ctx.stroke();ctx.strokeStyle='#9aa1aa';ctx.lineWidth=Math.max(2,2.5*cam.z);ctx.beginPath();ctx.moveTo(w*.43,-h*.46);ctx.lineTo(w*.73,-h*.33);ctx.stroke()}
  ctx.restore()
}
function drawGoldBursts(now){
  for(let i=goldBursts.length-1;i>=0;i--){const g=goldBursts[i],age=(now-g.born)/1000;if(age>1.25){goldBursts.splice(i,1);continue}const s=w2s(g.x,g.y),rise=age*28,alpha=1-age/1.25;ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle='#ffd84f';ctx.strokeStyle='#7b5516';ctx.lineWidth=2;ctx.beginPath();ctx.arc(s.x,s.y-rise,Math.max(4,7*cam.z),0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#fff7bd';ctx.font='900 10px ui-monospace';ctx.fillText((g.stolen?'POCKETED ':'+')+g.n,s.x+10,s.y-rise+3);ctx.restore()}
}
function preview(){if(!gesture||!M[gesture.t]||!shape||!gesture.moved)return;const r=rect(gesture.a,gesture.b,buildLimit()),a=w2s(r.minx*B,r.miny*B),w=r.nx*B*cam.z,h=r.ny*B*cam.z;ctx.globalAlpha=.35;ctx.fillStyle=M[gesture.t].col[0];ctx.fillRect(a.x,a.y,w,h);ctx.globalAlpha=1;ctx.fillStyle='#fff';ctx.font='900 12px ui-monospace';ctx.fillText(r.nx+'×'+r.ny+' · '+r.cost,a.x+5,a.y+16)}
function loop(now){Engine.update(eng,16.67);updateMiners(now||performance.now());if(cam.anim){cam.x+=(cam.tx-cam.x)*.12;cam.y+=(cam.ty-cam.y)*.12;if(Math.abs(cam.tx-cam.x)<.3&&Math.abs(cam.ty-cam.y)<.3)cam.anim=false}ensureWorld();progress();ctx.setTransform(DPR,0,0,DPR,0,0);bg();for(const z of bs)draw(z);for(const q of miners)drawMiner(q,now||performance.now());drawGoldBursts(now||performance.now());preview();requestAnimationFrame(loop)}

restoreDynamicState(initialSave);
ui();quest();load.remove();toast(initialSave?'SAVE RESTORED 💾':'MINE DIRT. BUILD UP.');requestAnimationFrame(loop);
})();
