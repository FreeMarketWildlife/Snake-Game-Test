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
  await page.evaluate(async()=>{await SkyAudio.ensure();SkyMachines.update('test-forge',{type:'furnace',x:0,y:0,active:true});industryTest.view(0,0,1)});await page.waitForTimeout(3600);
  const audio=await page.evaluate(()=>__skyStackAudioDebug().automation);assert.ok(audio.events.some(e=>e.type==='furnace'));
  await page.evaluate(()=>{const t=industryTest;t.view(0,0,1);if(t.spatial(0,0).gain!==1||t.spatial(0,0).pan!==0)throw Error('Center spatial');if(t.spatial(-100,0).pan>=0||t.spatial(100,0).pan<=0)throw Error('Stereo pan');if(t.spatial(0,100000).gain!==0)throw Error('Distant machine audible');const a=t.spatial(700,0).gain;t.view(0,0,.3);if(t.spatial(700,0).gain<=a)throw Error('Zoom ignored')});
  assert.deepEqual(errors,[]);console.log('PASS shared world attenuation, zoom and no runtime errors');
  // Legacy saves contain no new inventory/facility fields and must remain valid.
  await page.addInitScript(()=>{localStorage.setItem('skyStack.save.v1',JSON.stringify({v:1,inv:{dirt:7,gold:3},best:5,removed:['0,0']}))});await load();
  assert.equal(await page.evaluate(()=>industryTest.inv.dirt),7);assert.equal(await page.evaluate(()=>industryTest.inv.gold),3);
  assert.ok(await page.evaluate(()=>Object.keys(industryTest.resources).every(k=>industryTest.inv[k]===0)&&!industryTest.furnace.built));
  console.log('PASS legacy save migration defaults and retained original progress');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
