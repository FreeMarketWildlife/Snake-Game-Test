const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','game-v30-dev-panel.txt'),'utf8');
const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',classList:{remove(){}}});return elements.get(id)};
let normalHits=0,harvests=0,saves=0,spawned=0;
const s={inv:{gold:2},best:0,shape:false,stone:false,highCandidate:null,miners:new Set(),restingMiners:[],grid:new Map(),removedTerrain:new Set(),terrainDamage:new Map(),bs:new Set(),eng:{world:{}},key:(x,y)=>x+','+y,$:element,
 ui(){},refreshMinerMenu(){},saveGame(){saves++},saveSoon(){saves++},quest(){},awardHigh(h){s.best=h;s.shape=h>=5;s.stone=h>=10},
 mine(){normalHits++},minerHit(){normalHits++},at:p=>p,harvest(){harvests++},World:{remove(){}},wake(){},wakeFluids(){},SkyAudio:{hit(){},ui(){}},
 unlockedMiners:()=>0,availableMiners:()=>0,placeMiner(){throw Error('normal placement called')},ensureChunkAtX(){},minerDropPoint:p=>p,createMinerAt(x,y,o){spawned++;s.miners.add({x,y,...o});return o}};
vm.createContext(s);vm.runInContext(source.slice(0,source.indexOf('function installDevPanelV30')),s);
assert.equal(s.devGoldV30('1000'),true);assert.equal(s.inv.gold,1002);
for(const n of ['',-1,'NaN','Infinity',1e20])assert.equal(s.devGoldV30(n),false);
assert.equal(s.inv.gold,1002);
s.devHeightV30(100);assert.equal(s.best,100);assert.ok(s.stone);
s.devHeightV30(0);assert.equal(s.best,0);assert.equal(s.stone,false);assert.equal(s.shape,false);
assert.equal(s.devHeightV30(-1),false);
s.mine({});assert.equal(normalHits,1);
s.devToolsV30.oneHit=true;s.mine({game:{material:'stone',terrain:true}});assert.equal(harvests,1);
const bedrock={game:{material:'bedrock',terrain:true,cx:2,cy:58}};s.grid.set('2,58',bedrock);s.bs.add(bedrock);s.mine(bedrock);
assert.equal(s.grid.has('2,58'),false);assert.equal(s.bs.has(bedrock),false);assert.ok(s.removedTerrain.has('2,58'));
s.devToolsV30.oneHit=false;s.mine({});assert.equal(normalHits,2);
s.devToolsV30.infiniteMiners=true;assert.equal(s.unlockedMiners(),Infinity);assert.equal(s.availableMiners(),Infinity);
for(let i=0;i<100;i++)s.placeMiner({x:i,y:0});assert.equal(spawned,100);assert.equal(s.restingMiners.length,0);
s.devToolsV30.infiniteMiners=false;assert.equal(s.availableMiners(),0);assert.equal(s.unlockedMiners(),0);
assert.ok(saves>0);console.log('PASS dev input validation, height unlocks, one-hit bypass, saved bedrock removal, unlimited miners, and restoring normal rules');
