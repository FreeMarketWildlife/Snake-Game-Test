const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.SKY_TEST_BROWSER?{executablePath:process.env.SKY_TEST_BROWSER}:{})});
 try{
 const page=await browser.newPage({viewport:{width:1000,height:760}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.requestAnimationFrame=()=>0});
 await page.route('**/game-v8-part3.txt*',async route=>{
  const response=await route.fetch(),source=await response.text();
  const hook=`window.pickTest={
   get tier(){return pickaxeTier},get gold(){return inv.gold},get counts(){return {...inv}},get camera(){return {...cam}},
   goldTo(n){inv.gold=n;ui()},screen:w2s,save:saveGame,
   reset(n=5,material='dirt',hits=1){gesture=null;World.clear(eng.world,false);Engine.clear(eng);bs.clear();grid.clear();miners.clear();removedTerrain.clear();terrainDamage.clear();inv.dirt=0;inv.stone=0;stone=true;cam.x=80;cam.y=48;cam.z=1;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){const z=Bodies.rectangle((x+.5)*B,(y+.5)*B,B,B,{isStatic:true});z.game={terrain:true,material,cx:x,cy:y,w:B,h:B,max:hits,hits:0};bs.add(z);grid.set(key(x,y),z)}
    ui()
   },remaining(){return [...bs].filter(z=>z.game.terrain).map(z=>({x:z.game.cx,y:z.game.cy,hits:z.game.hits}))},
   paint(a,b){const g={t:'pick',a,b,moved:true};pickaxeDragV39(g,0);return g}
  };`;
  await route.fulfill({response,body:source.replace('restoreDynamicState(initialSave);','restoreDynamicState(initialSave);'+hook)});
 });
 const url=process.env.SKY_TEST_URL||'http://127.0.0.1:8767/sky-stack/';
 const load=async()=>{await page.goto(url);await page.waitForFunction(()=>window.pickTest,null,{polling:100})};await load();
 const point=async(x,y)=>page.evaluate(([x,y])=>pickTest.screen(x,y),[x,y]);
 const tap=async(x,y)=>{const p=await point(x,y);await page.mouse.click(p.x,p.y)};
 assert.equal(await page.evaluate(()=>pickTest.tier),0);
 await page.evaluate(()=>pickTest.reset());await tap(16,16);
 assert.equal(await page.evaluate(()=>pickTest.counts.dirt),1,'basic pick mines one block');
 await page.evaluate(()=>pickTest.reset());let a=await point(16,16);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(a.x+120,a.y,{steps:6});await page.mouse.up();
 assert.equal(await page.evaluate(()=>pickTest.counts.dirt),0,'basic drag pans instead of mining');
 console.log('PASS basic stone pick retains single-block mining and drag-to-pan');
 await page.evaluate(()=>pickTest.goldTo(4));await page.locator('#pickaxeUpgrade').click();assert.ok(await page.locator('#pickaxeBuy').isDisabled());await page.locator('#pickaxeClose').click();
 for(const [tier,cost,size] of [[1,5,2],[2,20,3],[3,50,4]]){
  await page.evaluate(n=>pickTest.goldTo(n),cost);await page.locator('#pickaxeUpgrade').click();await page.locator('#pickaxeBuy').click();
  assert.equal(await page.evaluate(()=>pickTest.tier),tier);assert.equal(await page.evaluate(()=>pickTest.gold),0);
  await page.evaluate(()=>pickTest.reset());await tap(size===2?16:48,size===2?16:48);
  assert.equal(await page.evaluate(()=>pickTest.counts.dirt),size*size,`${size} by ${size} footprint`);
  assert.equal(await page.evaluate(()=>pickTest.remaining().length),25-size*size);
  await page.evaluate(()=>pickTest.save());await load();assert.equal(await page.evaluate(()=>pickTest.tier),tier,'tier persists on reload');
  console.log(`PASS tier ${tier}, ${cost}-gold purchase, ${size}×${size} footprint, and save restoration`);
 }
 await page.locator('#pickaxeUpgrade').click();assert.ok(await page.locator('#pickaxeBuy').isDisabled());assert.equal(await page.locator('#pickaxeShop button').count(),2,'no downgrade action');await page.locator('#pickaxeClose').click();
 await page.evaluate(()=>pickTest.reset(12));const before=await page.evaluate(()=>pickTest.camera);a=await point(48,48);const b=await point(240,48);
 await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y);await page.mouse.up();
 assert.ok(await page.evaluate(()=>pickTest.counts.dirt)>=40,'fast drag fills intervening brush cells');
 assert.deepEqual(await page.evaluate(()=>pickTest.camera),before,'upgraded mining does not pan');
 console.log('PASS drag interpolation, fixed camera, max tier and no downgrade');
 await page.evaluate(()=>pickTest.reset(5,'stone',3));a=await point(48,16);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(a.x+12,a.y);await page.waitForTimeout(1100);await page.mouse.up();
 assert.ok(await page.evaluate(()=>pickTest.counts.stone)>0,'holding after a drag repeats swings on hard blocks');
 await page.evaluate(()=>pickTest.reset(5,'bedrock',Infinity));await tap(48,48);assert.equal(await page.evaluate(()=>pickTest.remaining().length),25,'bedrock stays protected');
 console.log('PASS repeated swings and bedrock protection');
 // Cancellation clears a stroke; touch pinch must continue to consume both pointers.
 await page.evaluate(()=>pickTest.reset());a=await point(48,48);
 await page.evaluate(p=>{const c=document.getElementById('game');for(const type of ['pointerdown','pointercancel'])c.dispatchEvent(new PointerEvent(type,{pointerId:99,pointerType:'touch',clientX:p.x,clientY:p.y,bubbles:true,cancelable:true}))},a);
 assert.equal(await page.evaluate(()=>pickTest.counts.dirt),0);
 await page.evaluate(p=>{const c=document.getElementById('game');for(const [type,id,dx] of [['pointerdown',91,0],['pointerdown',92,80],['pointermove',92,110],['pointerup',91,0],['pointerup',92,110]])c.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:p.x+dx,clientY:p.y,bubbles:true,cancelable:true}))},a);
 assert.equal(await page.evaluate(()=>pickTest.counts.dirt),0,'pinching does not mine');
 console.log('PASS cancellation and two-finger pinch safety');
 await page.setViewportSize({width:390,height:844});await page.locator('#pickaxeUpgrade').click();await page.screenshot({path:'/tmp/sky-pickaxe-mobile.png'});
 const bounds=await page.locator('#pickaxeShop').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);
 assert.deepEqual(errors,[]);console.log('PASS mobile upgrade panel and no runtime errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
