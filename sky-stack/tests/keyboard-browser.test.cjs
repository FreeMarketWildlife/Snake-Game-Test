const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SKY_TEST_BROWSER||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:820}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0});
  await page.route('**/game-v8-part3.txt*',async route=>{
   const response=await route.fetch(),source=await response.text();
   await route.fulfill({response,body:source.replace('restoreDynamicState(initialSave);',`restoreDynamicState(initialSave);window.keysTest={
    get state(){return {tool,tier:pickaxeTier,grab:temporaryGrabV52,gesture:!!gesture,x:cam.x,y:cam.y,pending:!!pickPendingV49}},
    setup(){resetKeyboardV52();stopPointerV52();cam.x=0;cam.y=0;cam.anim=false;cameraSpringActiveV24=false;pickaxeOwnedTier=2;equipPickV49(2);for(const k of ['dirt','wood','leaves','stone','deepslate','obsidian'])inv[k]=100;stone=true;deepslate=true;best=100;restingMiners.push({id:9001,level:1,gold:0});ui()},
    tick(t){cameraTickV24(t)},save:saveGame
   };`)});
  });
  const load=async()=>{await page.goto(process.env.SKY_TEST_URL||'http://127.0.0.1:8767/sky-stack/');await page.waitForFunction(()=>window.keysTest,null,{polling:100})};await load();
  await page.evaluate(()=>keysTest.setup());
  await page.locator('[data-tool=move]').click();await page.locator('[data-tool=pick]').click();
  assert.deepEqual(await page.evaluate(()=>[keysTest.state.tool,keysTest.state.tier,document.getElementById('pickaxeShop').open]),['pick',2,false]);
  await page.locator('[data-tool=pick]').click();assert.equal(await page.locator('#pickaxeShop').evaluate(e=>e.open),true);
  await page.locator('#equip-pick-1').click();await page.locator('[data-tool=wood]').click();await page.locator('[data-tool=pick]').click();
  assert.deepEqual(await page.evaluate(()=>[keysTest.state.tier,document.getElementById('pickaxeShop').open]),[1,false]);
  console.log('PASS first pick click equips last pick, second opens inventory');
  let time=0;
  const tick=async(ms=1000)=>{await page.evaluate(t=>keysTest.tick(t),time);for(let i=0;i<ms/20;i++){time+=20;await page.evaluate(t=>keysTest.tick(t),time)}};
  for(const [key,axis,sign] of [['d','x',1],['a','x',-1],['ArrowRight','x',1],['ArrowLeft','x',-1],['w','y',-1],['s','y',1],['ArrowUp','y',-1],['ArrowDown','y',1]]){
   const before=await page.evaluate(()=>keysTest.state);await page.keyboard.down(key);await tick(200);await page.keyboard.up(key);const after=await page.evaluate(()=>keysTest.state);assert.ok((after[axis]-before[axis])*sign>40,key+' failed to pan');
  }
  const before=await page.evaluate(()=>keysTest.state.x);await page.keyboard.down('d');await tick(1000);await page.keyboard.up('d');assert.ok(Math.abs(await page.evaluate(()=>keysTest.state.x)-before-360)<1);
  await tick(100);const stopped=await page.evaluate(()=>keysTest.state.x);await tick(300);assert.equal(await page.evaluate(()=>keysTest.state.x),stopped);
  console.log('PASS WASD/arrows, consistent panning speed and key release');
  await page.keyboard.press('1');assert.equal(await page.locator('#structuresPanel').evaluate(e=>e.open),true);
  for(const [key,tool] of [['2','move'],['3','pick'],['4','dirt'],['5','wood'],['6','leaves'],['7','stone'],['8','deepslate'],['9','obsidian'],['0','miner']]){await page.keyboard.press(key);assert.equal(await page.evaluate(()=>keysTest.state.tool),tool)}
  await page.keyboard.press('3');assert.equal(await page.locator('#pickaxeShop').evaluate(e=>e.open),false);await page.keyboard.press('3');assert.equal(await page.locator('#pickaxeShop').evaluate(e=>e.open),true);await page.keyboard.press('Escape');
  console.log('PASS all ten number-key toolbar mappings');
  await page.keyboard.press('5');await page.keyboard.down('Shift');assert.deepEqual(await page.evaluate(()=>[keysTest.state.tool,keysTest.state.grab]),['move',true]);
  await page.mouse.move(600,350);await page.mouse.down();await page.mouse.move(660,350,{steps:4});const dragged=await page.evaluate(()=>keysTest.state);assert.ok(dragged.gesture);
  await page.keyboard.up('Shift');assert.deepEqual(await page.evaluate(()=>[keysTest.state.tool,keysTest.state.gesture]),['wood',false]);await page.mouse.move(720,350,{steps:4});assert.equal(await page.evaluate(()=>keysTest.state.x),dragged.x);await page.mouse.up();
  await page.keyboard.press('3');await page.keyboard.down('Shift');await page.keyboard.down('ShiftRight');await page.keyboard.up('Shift');assert.equal(await page.evaluate(()=>keysTest.state.tool),'move');await page.keyboard.up('ShiftRight');assert.equal(await page.evaluate(()=>keysTest.state.tool),'pick');
  await page.keyboard.down('Shift');await page.keyboard.press('4');assert.equal(await page.evaluate(()=>keysTest.state.tool),'move');await page.keyboard.up('Shift');assert.equal(await page.evaluate(()=>keysTest.state.tool),'dirt');
  await page.keyboard.down('Shift');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.deepEqual(await page.evaluate(()=>[keysTest.state.tool,keysTest.state.grab,keysTest.state.gesture]),['dirt',false,false]);await page.keyboard.up('Shift');
  console.log('PASS temporary Grab, immediate drag cancellation, both Shift keys and focus-loss cleanup');
  await page.keyboard.press('F2');await page.locator('#devGold').fill('12');const toolBefore=await page.evaluate(()=>keysTest.state.tool);await page.keyboard.press('3');assert.equal(await page.locator('#devGold').inputValue(),'123');await page.keyboard.down('d');await tick(100);await page.keyboard.up('d');await page.keyboard.down('Shift');assert.equal(await page.evaluate(()=>keysTest.state.tool),toolBefore);await page.keyboard.up('Shift');await page.locator('#devClose').click();
  assert.deepEqual(errors,[]);console.log('PASS shortcuts leave form typing and modal controls alone');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
