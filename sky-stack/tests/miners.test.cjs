const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
let rhythm,sounds=0,harvests=0;
const s={performance:{now:()=>0},window:{SkyAudio:{bpm:72,rhythm:()=>rhythm}},B:40,W:800,HH:600,cam:{z:1,x:0,y:0},
 bs:new Set(),miners:new Set(),terrainDamage:new Map(),key:(x,y)=>`${x},${y}`,
 terrainExposed:z=>z.exposed!==false,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
 Query:{region:bodies=>bodies,ray:()=>[]},Sleeping:{set(){}},selfRightMiner(){},saveSoon(){},
 harvest(z){harvests++;s.bs.delete(z)},SkyAudio:{minerHit(){sounds++}}};
s.window.SkyAudio.minerHit=s.SkyAudio.minerHit;
vm.createContext(s);
const core=read('game-v8-part2.txt');
vm.runInContext(core.slice(core.indexOf('function minerCanMineMaterial'),core.indexOf('function minerHit')),s);
vm.runInContext(read('game-v27-miner-ai-rhythm.txt'),s);
s.minerNavigateV27=()=>{};
const block=material=>({position:{x:0,y:0},bounds:{min:{x:-16,y:-16},max:{x:16,y:16}},game:{terrain:true,material,hits:0,max:100,cx:0,cy:0}});
const miner=level=>({position:{x:0,y:0},bounds:{min:{x:-10,y:-12},max:{x:10,y:12}},game:{level}});
for(let level=1;level<=3;level++){
 const q=miner(level);
 for(const [material,required] of [['dirt',1],['stone',2],['deepslate',3],['obsidian',4],['bedrock',4]]){
  const z=block(material);s.bs.add(z);
  assert.equal(s.minerTargetValidV27(q,z),level>=required,`${level}: ${material}`);
  z.exposed=false;assert.equal(s.minerTargetValidV27(q,z),false);s.bs.delete(z);
 }
}
// Exercise actual acquisition + update + damage, across two bars with repeated frames.
for(const [material,phase,beats] of [['dirt',0,[0,2,4,6]],['stone',0,[1,3,5,7]],['deepslate',.5,[1,3,5,7]]]){
 const q=miner(3),z=block(material);s.bs.clear();s.miners.clear();s.bs.add(z);s.miners.add(q);
 let expected=0;
 for(let beatIndex=0;beatIndex<8;beatIndex++)for(const p of [0,.05,.14,.49,.5,.55,.64,.9]){
  rhythm={ready:true,bpm:72,beatMs:60000/72,beatIndex,barBeat:beatIndex%4,phase:p};
  s.updateMiners(beatIndex*1000+p*1000);
  if(p===phase&&beats.includes(beatIndex))expected++;
  assert.equal(z.game.hits,expected,`${material} beat ${beatIndex+1} phase ${p}`);
 }
 assert.equal(z.game.hits,4);
}
const q=miner(2),z=block('deepslate');s.bs.add(z);assert.equal(s.minerHit(q,z),false);assert.equal(z.game.hits,0);
// Upgrading preserves access to existing dirt work; invalid/removed targets are dropped.
const dirt=block('dirt');s.bs.clear();s.bs.add(dirt);q.game.workTarget=dirt;
assert.equal(s.minerAcquireTargetV27(q),dirt);q.game.level=3;assert.equal(s.minerAcquireTargetV27(q),dirt);
s.bs.delete(dirt);assert.equal(s.minerAcquireTargetV27(q),null);
rhythm={ready:false,beatIndex:-1};assert.equal(s.minerRhythmV27(2500).bpm,72);
assert.equal(sounds,12);assert.equal(harvests,0);
console.log('PASS cumulative miner levels, target eligibility, material rhythms, duplicate-frame prevention, upgrades, and silent fallback tempo');

// Nearby harder work cannot consume dirt beats, and stone cannot consume the
// following deepslate offbeat. Repeated frames still produce a single hit.
{
 const worker=miner(3),dirt=block('dirt'),stone=block('stone'),deep=block('deepslate');
 s.bs.clear();s.miners.clear();[dirt,stone,deep].forEach(z=>s.bs.add(z));s.miners.add(worker);
 worker.game.workTarget=deep;
 for(const [beatIndex,phase] of [[0,0],[0,.05],[1,0],[1,.05],[1,.5],[1,.55]]){
  rhythm={ready:true,bpm:72,beatMs:60000/72,beatIndex,phase};s.updateMiners(beatIndex*1000+phase*1000);
 }
 assert.deepEqual([dirt.game.hits,stone.game.hits,deep.game.hits],[1,1,1]);
 console.log('PASS mixed-material work uses dirt, stone, and deepslate beats independently');
}
