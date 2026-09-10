const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.SKY_TEST_BROWSER?{executablePath:process.env.SKY_TEST_BROWSER}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:760}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0});
  await page.route('**/game-v8-part3.txt*',async route=>{
   const response=await route.fetch(),source=await response.text();
   const hook=`window.spiritTest={miners,bs,eng,Engine,Body,inv,ghosts:minerGhostsV42,spawn:createMinerAt,die:minerDieV42,revive:reviveGhostAtV42,
    tick:updateMinerLifeV42,updateMiners,exposure:minerExposureV42,save:saveGame,screen:w2s,open:openMinerMenu,mk,deaths:minerDeathsV43,
    get dead(){return deadMiners},get resting(){return restingMiners.length},get bursts(){return spiritBurstsV42},
    zoom(z){cam.z=z},tool(t){tool=t},
    reset(){World.clear(eng.world,false);Engine.clear(eng);bs.clear();grid.clear();miners.clear();minerGhostsV42.clear();spiritBurstsV42=[];spiritLastTickV42=null;liquidSubV22.clear();removedTerrain.clear();restingMiners.length=0;deadMiners=0;best=20;inv.gold=0;cam.x=0;cam.y=20;cam.z=2;gesture=null;ui()},
    fill(kind,head=true){liquidSubV22.clear();for(let y=head?-2:1;y<4;y++)for(let x=-3;x<4;x++)liquidSubPutV22(x,y,kind,1)},
    dry(){liquidSubV22.clear()},
    render(now){ctx.setTransform(DPR,0,0,DPR,0,0);bg();for(const q of miners)drawMiner(q,now);drawSpiritsV42(now)}
   };`;
   await route.fulfill({response,body:source.replace('restoreDynamicState(initialSave);','restoreDynamicState(initialSave);'+hook)});
  });
  const url=process.env.SKY_TEST_URL||'http://127.0.0.1:8767/sky-stack/';
  const load=async()=>{await page.goto(url);await page.waitForFunction(()=>window.spiritTest,null,{polling:100})};await load();
  await page.evaluate(()=>{
    const t=spiritTest;t.reset();const q=t.spawn(0,0,{id:910,level:2,gold:4});
    t.mk(0,32,'stone',{static:true,w:300,h:32});
    const block=t.mk(0,-100,'stone',{placed:true});t.Body.setVelocity(block,{x:0,y:11});
    for(let i=0;i<35;i++)t.Engine.update(t.eng,1000/60);
    if(t.miners.has(q)||!t.ghosts.has(910)||t.deaths.get(910)!==1)throw Error('Falling block failed to kill miner and count death');
    const ghost=t.ghosts.get(910);t.revive({x:ghost.x,y:ghost.y});
    const revived=[...t.miners][0];t.open(revived);
    if(!document.getElementById('minerGold').textContent.includes('DEATHS: 1'))throw Error('Death counter missing from UI');
    t.save();const saved=JSON.parse(localStorage.getItem('skyStack.save.v1'));
    if(!saved.minerLifeV42.deaths.some(([id,n])=>id===910&&n===1))throw Error('Death counter not saved');
    t.reset();
  });console.log('PASS actual falling-block impact, death count, revival UI and persistence');
  const results=await page.evaluate(()=>{
   const t=spiritTest,out=[],check=(ok,label)=>{if(!ok)throw Error(label);out.push(label)};
   let now=0;const step=(ms,hz=60)=>{for(let i=0;i<Math.ceil(ms/(1000/hz));i++){now+=1000/hz;t.tick(now)}};
   const reset=()=>{t.reset();now=0;t.tick(0)};
   reset();let q=t.spawn(0,16,{level:3,gold:7,id:44});t.fill('water',false);step(7000);
   check(t.miners.has(q)&&q.game.waterMsV42===0,'wading with a dry head does not drown a miner');
   t.fill('water');step(2500);check(t.miners.has(q)&&q.game.waterMsV42>2400,'submerged miner uses air before dying');
   t.dry();step(1500);check(q.game.waterMsV42===0,'air recovers after surfacing');
   t.fill('water');step(4900);check(t.miners.has(q),'miner survives just under five seconds underwater');step(150);
   check(!t.miners.has(q)&&t.ghosts.size===1&&t.dead===1,'drowning removes the body and creates one accounted ghost');
   let ghost=t.ghosts.get(44);check(ghost.level===3&&ghost.gold===7,'ghost retains miner identity, level, and pocketed gold');
   const start={x:ghost.x,y:ghost.y};step(1500);const x1=ghost.x;step(3000);
   check(ghost.y<start.y&&Math.abs(x1-start.x)>1&&Math.abs(ghost.x-x1)>1,'ghost drifts up with a slow horizontal sway');
   check(__skyStackAudioDebug().ghostMix>0,'visible ghosts activate the haunting music layer');
   t.save();
   return out;
  });for(const r of results)console.log('PASS '+r);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('skyStack.save.v1')));
  await load();
  assert.equal(await page.evaluate(()=>spiritTest.ghosts.size),1);assert.equal(await page.evaluate(()=>spiritTest.resting),0,'reload must not grant a duplicate replacement miner');
  assert.equal(await page.evaluate(()=>spiritTest.miners.size),0);assert.equal(await page.evaluate(()=>spiritTest.dead),1);
  assert.deepEqual(await page.evaluate(()=>[...spiritTest.ghosts.values()][0]),saved.minerLifeV42.ghosts[0]);
  console.log('PASS ghost persistence and miner accounting across reload');
  await page.evaluate(()=>{spiritTest.zoom(2);spiritTest.render(1000)});await page.screenshot({path:'/tmp/sky-miner-ghost.png'});
  let ghost=await page.evaluate(()=>[...spiritTest.ghosts.values()][0]);let point=await page.evaluate(g=>spiritTest.screen(g.x,g.y),ghost);
  await page.mouse.click(point.x,point.y);
  assert.equal(await page.evaluate(()=>spiritTest.ghosts.size),0);assert.equal(await page.evaluate(()=>spiritTest.dead),0);
  let revived=await page.evaluate(()=>{const q=[...spiritTest.miners][0];return{id:q.game.id,level:q.game.level,gold:q.game.gold,x:q.position.x,y:q.position.y,grace:q.game.reviveGraceV42}});
  assert.deepEqual([revived.id,revived.level,revived.gold,revived.x,revived.y],[ghost.id,3,7,ghost.x,ghost.y]);assert.ok(revived.grace>2000);
  await page.mouse.click(point.x,point.y);assert.equal(await page.evaluate(()=>spiritTest.miners.size),1,'double click cannot create duplicate revivals');
  await page.evaluate(()=>{document.getElementById('minerMenu').classList.remove('show');spiritTest.tick(0);spiritTest.tick(100);spiritTest.render(1100)});await page.screenshot({path:'/tmp/sky-miner-revive.png'});
  assert.ok(await page.evaluate(()=>spiritTest.bursts.some(b=>b.kind==='revive')));
  console.log('PASS click revival at the exact ghost position with preserved level/gold, grace, and a pixel burst');
  const more=await page.evaluate(()=>{
   const t=spiritTest,out=[],check=(ok,label)=>{if(!ok)throw Error(label);out.push(label)};
   for(const fps of [30,60,120]){
    t.reset();const q=t.spawn(0,16,{level:2,gold:3});t.fill('lava');t.tick(0);
    for(let now=1000/fps;now<=850;now+=1000/fps)t.tick(now);check(t.miners.has(q),'lava has a brief warning at '+fps+' FPS');
    for(let now=850+1000/fps;now<=1000;now+=1000/fps)t.tick(now);
    check(!t.miners.has(q)&&t.ghosts.size===1,'lava death works at '+fps+' FPS');
   }
   let g=[...t.ghosts.values()][0];t.revive(g);let q=[...t.miners][0];t.Body.setPosition(q,{x:0,y:16});let now=1000;
   for(let i=0;i<120;i++)t.tick(now+=1000/60);check(t.miners.has(q)&&q.game.fireMsV42===0,'revival grace prevents immediate repeat deaths');
   t.dry();for(let i=0;i<180;i++)t.tick(now+=1000/60);check(t.miners.has(q),'revived worker survives after escaping the hazard');
   t.reset();q=t.spawn(0,16,{level:3,gold:11});t.open(q);document.getElementById('minerKill').click();document.getElementById('killConfirm').click();
   check(t.inv.gold===11&&t.ghosts.size===1,'manual death also creates a ghost and claims gold once');
   g=[...t.ghosts.values()][0];check(g.gold===0,'claimed gold is removed from the ghost');t.revive(g);q=[...t.miners][0];
   check(q.game.gold===0&&t.inv.gold===11,'revival cannot duplicate claimed gold');
   t.reset();q=t.spawn(0,16,{level:2});t.fill('water');t.tick(0);for(let i=1;i<=150;i++)t.tick(i*1000/60);t.save();
   check(JSON.parse(localStorage.getItem('skyStack.save.v1')).minerLifeV42.living[0].water>2400,'partially depleted air is saved');
   return out;
  });for(const r of more)console.log('PASS '+r);
  await load();assert.ok(await page.evaluate(()=>[...spiritTest.miners][0].game.waterMsV42)>2400);console.log('PASS partially depleted air restores correctly');
  // A moving/cancelled gesture must not revive; a tap with the Move tool must.
  await page.evaluate(()=>{spiritTest.reset();const q=spiritTest.spawn(0,16,{level:1});spiritTest.die(q,'water');spiritTest.tool('move')});
  point=await page.evaluate(()=>{const g=[...spiritTest.ghosts.values()][0];return spiritTest.screen(g.x,g.y)});
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+60,point.y);await page.mouse.up();assert.equal(await page.evaluate(()=>spiritTest.ghosts.size),1);
  point=await page.evaluate(()=>{const g=[...spiritTest.ghosts.values()][0];return spiritTest.screen(g.x,g.y)});
  await page.evaluate(p=>{const c=document.getElementById('game');for(const type of ['pointerdown','pointercancel'])c.dispatchEvent(new PointerEvent(type,{pointerId:72,pointerType:'touch',clientX:p.x,clientY:p.y,bubbles:true,cancelable:true}))},point);
  assert.equal(await page.evaluate(()=>spiritTest.ghosts.size),1);await page.mouse.click(point.x,point.y);assert.equal(await page.evaluate(()=>spiritTest.ghosts.size),0);
  console.log('PASS tap-to-revive with Move selected, without accidental revival during drag/cancel');
  await page.evaluate(async()=>{await SkyAudio.ensure();SkyAudio.setGhostPresence(.8,.2);SkyAudio.spiritCue('death',.8,.2);SkyAudio.spiritCue('revive',.8,.2);SkyAudio.goldChaching();SkyAudio.hit('stone');SkyAudio.minerHit('stone',.7,0,true)});
  await page.waitForTimeout(1800);assert.ok(await page.evaluate(()=>__skyStackAudioDebug().spiritCues)>=2);
  assert.deepEqual(errors,[]);console.log('PASS real Web Audio ghost/revival cues and no runtime errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
