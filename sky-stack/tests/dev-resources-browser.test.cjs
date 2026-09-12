const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SKY_TEST_BROWSER||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/game-v8-part3.txt*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('restoreDynamicState(initialSave);',`restoreDynamicState(initialSave);window.resourceTest={inv,save:saveGame,ui,pay:payIndustryV44,one,craft:craftWorkshopV46,start:startStructureV46,step:stepStructuresV46,buy:buyPickaxeV39,get real(){return saveInventoryV54()},get cheat(){return devToolsV30.infiniteResources},get bag(){return structureBagV46},get tier(){return pickaxeTier}};`)});});
  const load=async()=>{await page.goto(process.env.SKY_TEST_URL||'http://127.0.0.1:8767/sky-stack/');await page.waitForFunction(()=>window.resourceTest)};await load();
  await page.evaluate(()=>{const t=resourceTest;for(const k of Object.keys(t.inv))t.inv[k]=0;t.inv.dirt=7;t.ui();t.save()});
  await page.keyboard.press('F2');await page.locator('#devResources').check();assert.equal(await page.locator('#dc').innerText(),'∞');await page.locator('#devClose').click();
  await page.evaluate(()=>{const t=resourceTest;t.one('dirt',{x:100,y:-300});if(!t.craft())throw Error('Workshop unavailable');if(!t.pay({ironOre:10000,coal:10000,ironIngot:1000,copperIngot:1000,nails:10000}))throw Error('Industry materials not infinite');if(!t.buy())throw Error('Currency not infinite');if(t.real.dirt!==7||t.real.gold!==0||t.real.stone!==0)throw Error('Real resources consumed');t.inv.dirt+=2;t.save()});
  let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('skyStack.save.v1')));assert.equal(saved.inv.dirt,9);assert.equal(saved.inv.gold,0);assert.ok(Object.values(saved.inv).every(n=>Number.isFinite(n)&&n<1000000000));
  await page.keyboard.press('F2');await page.locator('#devResources').uncheck();assert.equal(await page.evaluate(()=>resourceTest.inv.dirt),9);assert.equal(await page.evaluate(()=>resourceTest.pay({stone:1})),false);assert.equal(await page.locator('#dc').innerText(),'9');
  await page.locator('#devResources').check();await page.evaluate(()=>resourceTest.save());await load();assert.equal(await page.evaluate(()=>resourceTest.cheat),false);assert.equal(await page.evaluate(()=>resourceTest.inv.dirt),9);assert.equal(await page.evaluate(()=>resourceTest.bag.workshop),1);assert.equal(await page.evaluate(()=>resourceTest.tier),1);
  assert.deepEqual(errors,[]);console.log('PASS infinite construction, crafting, metals, nails, currency, real inventory restoration and clean reload');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
