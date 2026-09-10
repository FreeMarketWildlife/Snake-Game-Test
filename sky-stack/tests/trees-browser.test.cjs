const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.SKY_TEST_BROWSER?{executablePath:process.env.SKY_TEST_BROWSER}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:760}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0});
  await page.route('**/game-v8-part3.txt*',async route=>{
   const response=await route.fetch(),source=await response.text();
   const hook=`window.treeTest={bs,inv,miners,treeBlocksV41,treeChunksV41,eng,Engine,Body,mine,save:saveGame,update:updateTreesV41,plant:plantTreeV41,screen:w2s,render:()=>loop(performance.now()),
    seed:seedTreeChunkV41,top:topInfo,
    reset(){World.clear(eng.world,false);Engine.clear(eng);bs.clear();grid.clear();miners.clear();treeBlocksV41.clear();treeChunksV41.clear();removedTerrain.clear();terrainDamage.clear();treeLastTickV41=null;inv.wood=0;inv.leaves=0;cam.x=0;cam.y=-120;cam.z=1;
     for(let x=-10;x<=10;x++)mk(ctr(x),ctr(0),'dirt',{static:true,terrain:true,cx:x,cy:0});treeChunksV41.add(0)
    },ground:()=>grid.get(key(0,0)),get tier(){return pickaxeTier}
   };`;
   await route.fulfill({response,body:source.replace('restoreDynamicState(initialSave);','restoreDynamicState(initialSave);'+hook)});
  });
  const url=process.env.SKY_TEST_URL||'http://127.0.0.1:8767/sky-stack/';
  const load=async()=>{await page.goto(url);await page.waitForFunction(()=>window.treeTest,null,{polling:100})};await load();
  await page.evaluate(()=>treeTest.render());await page.screenshot({path:'/tmp/sky-trees-desktop.png'});
  const results=await page.evaluate(()=>{
   const t=treeTest,out=[],check=(ok,label)=>{if(!ok)throw Error(label);out.push(label)};
   let now=0;const step=n=>{for(let i=0;i<n;i++){now+=1000/60;t.Engine.update(t.eng,1000/60);t.update(now)}};
   check(t.treeBlocksV41.size>0,'surface trees generate in the assembled game');
   const groups=new Map();for(const z of t.treeBlocksV41){const id=z.game.treeId;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(z)}
   check([...groups.values()].every(a=>new Set(a.filter(z=>z.game.material==='wood').map(z=>z.position.x)).size===1&&a.every(z=>z.game.w<=32)),'every tree trunk is exactly one block wide');
   check([...groups.values()].every(a=>a.filter(z=>z.game.material==='leaves').some(z=>z.position.x!==a[0].position.x)),'tree canopies branch out beyond the trunk');
   check(t.top()===null,'natural trees do not count as player tower height');
   t.reset();t.plant(0,5);const blocks=[...t.treeBlocksV41],cut=blocks.find(z=>z.game.material==='wood'&&z.game.treeCy===-3);
   t.mine(cut.position);check(cut.game.hits===1,'wood takes two hits');t.mine(cut.position);
   const below=blocks.filter(z=>z.game.material==='wood'&&z.game.treeCy>-3),above=blocks.filter(z=>z.game.material==='wood'&&z.game.treeCy<-3);
   check(t.inv.wood===1&&!t.bs.has(cut),'chopping collects a wood block');
   check(below.every(z=>z.isStatic&&z.game.attached),'the stump below a cut stays attached');
   check(above.every(z=>!z.isStatic&&!z.game.attached),'every log above a cut becomes a dynamic physics body');
   check(above.every(z=>Number.isFinite(z.mass)&&z.mass>0&&Number.isFinite(z.inertia)),'released wood retains valid mass and inertia');
   const positions=above.map(z=>({...z.position}));step(150);
   check(above.every((z,i)=>Math.abs(z.position.y-positions[i].y)>10&&Math.abs(z.angle)>.1),'upper logs fall and tip over under actual gravity');
   check([...t.treeBlocksV41].every(z=>z.game.material!=='leaves'),'unsupported leaves decay within a few seconds');
   check(t.inv.leaves===0,'decayed leaves do not create free inventory');
   check(below.every(z=>z.isStatic),'the remaining stump survives the fall');
   const fallen=above[0];t.mine(fallen.position);t.mine(fallen.position);check(t.inv.wood===2,'fallen logs remain mineable');
   t.reset();now=0;t.plant(0,4);const leaf=[...t.treeBlocksV41].find(z=>z.game.material==='leaves');t.mine(leaf.position);
   check(t.inv.leaves===1,'leaf blocks can be collected manually');
   const root=[...t.treeBlocksV41].find(z=>z.game.treeCy===-1);t.mine(root.position);t.mine(root.position);step(25);t.save();
   const saved=JSON.parse(localStorage.getItem('skyStack.save.v1'));
   check(saved.treesV41.blocks.some(r=>r.attached===false),'falling log state is saved');
   check(saved.treesV41.blocks.some(r=>r.material==='leaves'&&r.decay>0&&r.decay<2000),'leaf decay progress is saved');
   return out;
  });for(const r of results)console.log('PASS '+r);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('skyStack.save.v1')));
  await load();
  assert.equal(await page.evaluate(()=>treeTest.inv.wood),saved.inv.wood);assert.equal(await page.evaluate(()=>treeTest.inv.leaves),1);
  const restored=await page.evaluate(()=>[...treeTest.treeBlocksV41].filter(z=>z.game.treeId==='tree:0').map(z=>({cy:z.game.treeCy,x:z.position.x,y:z.position.y,attached:z.game.attached,decay:z.game.decay})));
  const savedTree0=saved.treesV41.blocks.filter(z=>z.treeId==='tree:0');assert.equal(restored.length,savedTree0.length);for(const r of restored){const was=savedTree0.find(z=>z.cy===r.cy&&Math.abs(z.x-r.x)<.01);assert(was,'restored tree block coordinate missing');assert.equal(r.attached,was.attached);assert.equal(r.decay,was.decay);assert.equal(r.x,was.x);assert.equal(r.y,was.y)}
  console.log('PASS wood, leaves, fallen positions, and decay timers restore without duplicates');
  await page.evaluate(()=>{
   const t=treeTest;t.reset();t.plant(0,3);t.mine(t.ground().position);
   if([...t.treeBlocksV41].some(z=>z.game.material==='wood'&&z.isStatic))throw Error('Removing soil did not release the tree');
   for(const z of [...t.treeBlocksV41]){for(let hit=0;hit<2&&t.bs.has(z);hit++)t.mine(z.position)}
   t.save();
  });await load();
  assert.equal(await page.evaluate(()=>[...treeTest.treeBlocksV41].filter(z=>z.game.treeId==='tree:0').length),0);
  await page.evaluate(()=>treeTest.seed(0));assert.equal(await page.evaluate(()=>[...treeTest.treeBlocksV41].filter(z=>z.game.treeId==='tree:0').length),0);
  console.log('PASS trees fall when soil is removed and harvested trees stay removed after reload');
  await page.evaluate(()=>{treeTest.reset();treeTest.inv.wood=3;treeTest.inv.leaves=3;treeTest.render()});
  for(const [material,x] of [['wood',-112],['leaves',-80]]){
   await page.locator('[data-tool='+material+']').click();const p=await page.evaluate(([x,y])=>treeTest.screen(x,y),[x,-240]);await page.mouse.click(p.x,p.y);
   assert.equal(await page.evaluate(m=>treeTest.inv[m],material),2);
   assert.equal(await page.evaluate(m=>[...treeTest.bs].filter(z=>z.game.placed&&z.game.material===m).length,material),1);
  }
  await page.evaluate(()=>{for(let i=0;i<180;i++)treeTest.update(i*1000/60);treeTest.save()});await load();
  assert.equal(await page.evaluate(()=>[...treeTest.bs].filter(z=>z.game.placed&&z.game.material==='leaves').length),1);
  console.log('PASS toolbar placement and persistence for wood and leaves; placed leaves do not decay');
  await page.setViewportSize({width:390,height:844});await page.locator('[data-tool=leaves]').scrollIntoViewIfNeeded();await page.evaluate(()=>treeTest.render());await page.screenshot({path:'/tmp/sky-trees-mobile.png'});
  const box=await page.locator('[data-tool=leaves]').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);
  assert.deepEqual(errors,[]);console.log('PASS mobile toolbar access and no game runtime errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
