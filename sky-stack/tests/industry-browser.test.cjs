const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.SKY_TEST_BROWSER?{executablePath:process.env.SKY_TEST_BROWSER}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0});
  await page.route('**/game-v8-part3.txt*',async route=>{
   const response=await route.fetch(),source=await response.text();
   const hook=`window.industryTest={inv,bs,grid,miners,eng,Engine,Body,oreAtV44,defs:ORE_DEFS_V44,materials:terrainMaterial,mk,harvest,mine,minerHit,createMinerAt,save:saveGame,step:stepIndustryV44,update:updateIndustryV44,build:buildFurnaceV44,start:startFurnaceV44,spatial:worldAudioSpatialV44,machines:worldMachinesV44,ui,
    get furnace(){return industryV44},get removed(){return removedTerrain},get resources(){return RESOURCE_DEFS_V44},render:()=>loop(performance.now()),
    view(x,y,z){cam.x=x;cam.y=y;cam.z=z},drawScene(){ctx.setTransform(DPR,0,0,DPR,0,0);bg();for(const z of bs)draw(z)},
    fixture(cx,cy){World.clear(eng.world,false);Engine.clear(eng);bs.clear();grid.clear();miners.clear();treeBlocksV41.clear();liquidSubV22.clear();removedTerrain.clear();terrainDamage.clear();stone=true;deepslate=true;const z=mk(ctr(cx),ctr(cy),terrainMaterial(cx,cy),{static:true,terrain:true,cx,cy});removedTerrain.add(key(cx,cy-1));return z},
    supply(){inv.stone=10;inv.wood=5;inv.coal=3;inv.ironOre=2;inv.copperOre=1;ui()}
   };`;
   await route.fulfill({response,body:source.replace('restoreDynamicState(initialSave);','restoreDynamicState(initialSave);'+hook)});
  });
  const url=process.env.SKY_TEST_URL||'http://127.0.0.1:8767/sky-stack/';
  const load=async()=>{await page.goto(url);await page.waitForFunction(()=>window.industryTest,null,{polling:100})};await load();
  const finds=await page.evaluate(()=>{
   const t=industryTest,found={};
   for(const k of Object.keys(t.resources))if(t.inv[k]!==0)throw Error('Old/new inventory default');
   for(let x=-70;x<70;x++)for(let y=0;y<64;y++){
    const m=t.materials(x,y),a=t.oreAtV44(x,y,m),b=t.oreAtV44(x,y,m);
    if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Nondeterministic ore');
    if(a){const d=t.defs[a.type];if(y<d.min||y>d.max||!d.materials.includes(m))throw Error('Invalid ore geology');found[a.type]??={x,y,type:a.type,amount:a.amount};}
   }
   return found;
  });assert.deepEqual(Object.keys(finds).sort(),['coal','copperOre','ironOre']);console.log('PASS deterministic deposits and geological depth rules');
  for(const deposit of Object.values(finds))for(const collector of ['player','miner']){
   await page.evaluate(({x,y,type,amount,collector})=>{
    const t=industryTest,z=t.fixture(x,y),material=z.game.material,base=t.inv[material],ore=t.inv[type];
    const worker=t.createMinerAt(z.position.x,z.position.y-32,{level:3});
    for(let i=0;i<z.game.max-1;i++)collector==='player'?t.mine(z.position):t.minerHit(worker,z);
    if(t.inv[type]!==ore)throw Error('Ore paid before break');
    collector==='player'?t.mine(z.position):t.minerHit(worker,z);
    if(t.bs.has(z)||t.inv[material]!==base+1||t.inv[type]!==ore+amount)throw Error('Bad base/ore payout '+collector+' '+type);
    t.harvest(z,collector,worker);if(t.inv[type]!==ore+amount)throw Error('Duplicate payout');
   },{...deposit,collector});
  }console.log('PASS manual hardness, miner eligibility, base + ore payouts and no double harvest');
  await page.evaluate(finds=>{const t=industryTest;let i=0;for(const {x,y} of Object.values(finds)){const z=i===0?t.fixture(x,y):t.mk((x+.5)*32,(y+.5)*32,t.materials(x,y),{static:true,terrain:true,cx:x,cy:y});t.removed.add(x+','+(y-1));t.Body.setPosition(z,{x:i++*40,y:0})}t.view(40,0,4);t.drawScene()},finds);
  await page.screenshot({path:'/tmp/sky-ore-markings.png'});
  await page.evaluate(()=>{const t=industryTest;t.supply();for(const k of ['ironIngot','copperIngot'])t.inv[k]=0});
  await page.locator('#industryOpen').click();await page.locator('#furnaceBuild').click();
  assert.equal(await page.evaluate(()=>industryTest.furnace.built),true);assert.equal(await page.evaluate(()=>industryTest.inv.stone),0);
  await page.locator('#furnaceProduce').click();
  assert.deepEqual(await page.evaluate(()=>[industryTest.inv.ironOre,industryTest.inv.coal,industryTest.inv.ironIngot]),[1,2,0]);
  await page.evaluate(()=>{industryTest.step(1500);industryTest.save()});
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('skyStack.save.v1')));await load();
  assert.equal(await page.evaluate(()=>industryTest.furnace.job.remaining),2500);
  for(const k of Object.keys(finds))assert.equal(await page.evaluate(k=>industryTest.inv[k],k),saved.inv[k]);
  await page.evaluate(()=>{const t=industryTest;t.step(2499);if(t.inv.ironIngot!==0)throw Error('Early output');t.step(1);if(t.inv.ironIngot!==1)throw Error('Missing ingot');t.save()});
  await load();assert.equal(await page.evaluate(()=>industryTest.inv.ironIngot),1);assert.equal(await page.evaluate(()=>industryTest.furnace.job),null);
  console.log('PASS furnace build, input reservation, exact output and mid-batch save/reload without duplicate inputs');
  await page.evaluate(()=>{const t=industryTest;t.furnace.auto=true;t.step(0);t.step(4000);if(t.inv.ironIngot!==2||t.furnace.job)throw Error('Auto did not stop for missing ore');t.inv.ironOre=1;t.step(0);if(!t.furnace.job)throw Error('Auto failed to resume');t.step(4000);if(t.inv.ironIngot!==3||t.furnace.job||t.inv.coal!==0)throw Error('Auto did not stop for fuel');t.furnace.auto=false;t.furnace.selected='copperIngot';t.inv.coal=1;t.start();t.furnace.paused=true;t.step(4000);if(t.inv.copperIngot!==0)throw Error('Pause failed');t.furnace.paused=false;t.step(4000);if(t.inv.copperIngot!==1)throw Error('Copper output failed');t.save()});
  console.log('PASS auto-repeat supply waiting/resume, fuel exhaustion, pause and copper recipe');
  await page.evaluate(()=>{
   const t=industryTest,outputs=[];
   for(const fps of [30,60,144]){Object.assign(t.furnace,{job:null,selected:'ironIngot',auto:true,paused:false});t.inv.ironOre=20;t.inv.coal=20;t.inv.ironIngot=0;t.start();for(let i=0;i<fps*20;i++)t.step(1000/fps);outputs.push(t.inv.ironIngot)}
   if(outputs.some(n=>n!==5))throw Error('Frame-dependent production: '+outputs);
   t.furnace.job=null;t.furnace.auto=false;t.inv.ironIngot=3;
  });console.log('PASS identical Furnace throughput at 30/60/144 FPS without audio');
  await page.evaluate(()=>{const t=industryTest;t.inv.coal=2;t.inv.ironOre=2;t.furnace.selected='ironIngot';t.start();t.update(0);t.update(1000000);if(t.furnace.job.remaining!==4000)throw Error('Stalled frame produced offline goods');t.save()});
  await page.locator('#industryOpen').click();await page.screenshot({path:'/tmp/sky-industry-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/sky-industry-mobile.png'});
  const box=await page.locator('#industryPanel').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390&&box.y>=0&&box.y+box.height<=844);
  assert.equal(await page.locator('[data-tool=coal]').count(),0);await page.locator('#industryClose').click();
  await page.evaluate(async()=>{await SkyAudio.ensure()});await page.waitForTimeout(3600);
  const audio=await page.evaluate(()=>__skyStackAudioDebug().automation);assert.ok(audio.events.some(e=>e.type==='furnace'));for(const e of audio.events){assert.equal(e.subdivision,0);assert.ok(e.chord.includes(e.midi+12));}
  console.log('PASS mobile Industry UI and live Furnace audio following song chords');
  await page.evaluate(()=>{const t=industryTest;t.view(0,0,1);if(t.spatial(0,0).gain!==1||t.spatial(0,0).pan!==0)throw Error('Center spatial');if(t.spatial(-100,0).pan>=0||t.spatial(100,0).pan<=0)throw Error('Stereo pan');if(t.spatial(0,100000).gain!==0)throw Error('Distant machine audible');const a=t.spatial(700,0).gain;t.view(0,0,.3);if(t.spatial(700,0).gain<=a)throw Error('Zoom ignored')});
  assert.deepEqual(errors,[]);console.log('PASS shared world attenuation, zoom and no runtime errors');
  // Legacy saves contain no new inventory/facility fields and must remain valid.
  await page.addInitScript(()=>{localStorage.setItem('skyStack.save.v1',JSON.stringify({v:1,inv:{dirt:7,gold:3},best:5,removed:['0,0']}))});await load();
  assert.equal(await page.evaluate(()=>industryTest.inv.dirt),7);assert.equal(await page.evaluate(()=>industryTest.inv.gold),3);
  assert.ok(await page.evaluate(()=>Object.keys(industryTest.resources).every(k=>industryTest.inv[k]===0)&&!industryTest.furnace.built));
  console.log('PASS legacy save migration defaults and retained original progress');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
