const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
function world(){
 const s={console,performance:{now:()=>0},localStorage:{getItem:()=>null},window:{}};vm.createContext(s);
 for(const p of ['tests/liquid-fixture.js','game-v22-liquid-engine.txt','game-v29-liquid-feel.txt'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',p),'utf8'),s,{filename:p});
 s.liquidV22Init();s.liquidReactV22=()=>{};return s;
}
const mass=s=>[...s.liquidSubV22.values()].reduce((n,r)=>n+r.a,0);
const step=(s,n,kind='water')=>{for(let i=0;i<n;i++){s.liquidStepsV29++;s.liquidStepSubV22(kind,i*1000/60)}};
function tank(s){for(let x=-2;x<=12;x++)s.grid.set(s.key(x,10),true);for(let y=-2;y<10;y++){s.grid.set(s.key(-2,y),true);s.grid.set(s.key(12,y),true)}}
{
 const s=world();tank(s);for(let x=0;x<8;x++)for(let y=4;y<9;y++)s.liquidSubPutV22(x,y,'water',1);
 const initial=mass(s);step(s,600);
 assert.ok(Math.abs(mass(s)-initial)<1e-8,'water volume conserved');
 assert.ok([...s.liquidSubV22.values()].every(r=>r.a>=0&&s.liquidSubOpenV22(r.x,r.y)),'no negative mass or wall leaks');
 const row=Array.from({length:26},(_,i)=>s.liquidSubRecV22(i-2,19)?.a||0);
 assert.ok(Math.max(...row)-Math.min(...row)<.02,'pool levels out');
 console.log('PASS water conservation, solid walls, pool leveling');
}
{
 const s=world();s.liquidSubPutV22(4,1,'water',1);step(s,8);
 assert.ok([...s.liquidSubV22.values()].every(r=>r.x===4),'falling water stays in its column');
 assert.ok(Math.abs(mass(s)-1)<1e-10);console.log('PASS coherent falling column');
}
{
 function run(fps){const s=world();tank(s);s.liquidSubPutV22(3,4,'water',12);s.updateLiquids(0);for(let i=1;i<=fps*2;i++)s.updateLiquids(i*1000/fps);return s}
 const a=run(30),b=run(60),c=run(144);
 assert.equal(a.liquidStepsV29,120);assert.equal(c.liquidStepsV29,120);
 for(const [k,r] of b.liquidSubV22){assert.ok(Math.abs((a.liquidSubV22.get(k)?.a||0)-r.a)<1e-10);assert.ok(Math.abs((c.liquidSubV22.get(k)?.a||0)-r.a)<1e-10)}
 c.updateLiquids(10000);assert.equal(c.liquidStepsV29,120);console.log('PASS identical 30/60/144 Hz simulation and hidden-tab pause');
}
{
 const w=world(),l=world();w.liquidSubPutV22(2,1,'water',1);l.liquidSubPutV22(2,1,'lava',1);
 step(w,5);step(l,5,'lava');
 const depth=s=>[...s.liquidSubV22.values()].reduce((n,r)=>n+r.y*r.a,0);
 assert.ok(depth(w)>depth(l),'lava falls more slowly');assert.ok(Math.abs(mass(l)-1)<1e-10);console.log('PASS lava viscosity and conservation');
}
{
 const s=world();tank(s);s.liquidSubPutV22(2,19,'water',1);s.liquidSubPutV22(3,19,'lava',1);step(s,10);
 assert.equal(s.liquidSubRecV22(3,19).kind,'lava');console.log('PASS different liquids cannot overwrite each other');
}
// Compile exactly what the production loader evaluates, catching concatenation errors.
{
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const loader=read('game-v28.js'),urls=[...loader.matchAll(/'([^']+\.txt)\?v=\d+'/g)].map(m=>m[1]);
 const core=urls.slice(0,3).map(read).join(''),liquid=urls.slice(3,15).map(read).join('');
 let tail=read('game-v8-part3.txt').replace(/^\s*\}\);\s*/,'');
 const additions=urls.slice(15,-1).map(read).join('\n');
 tail=tail.replace('restoreDynamicState(initialSave);',additions+'\nrestoreDynamicState(initialSave);');
 new vm.Script(core+'\n});\n'+liquid+'\n'+tail);console.log('PASS production bundle compiles');
}

{
 const s=world();let saved=null;
 s.localStorage={getItem:()=>saved,setItem:(k,v)=>{saved=v}};
 // The base save normally writes world data before the liquid wrapper extends it.
 saved=JSON.stringify({inv:{dirt:7}});
 s.liquidSubPutV22(2,5,'water',.7523);s.liquidSubPutV22(6,8,'lava',1.0123);
 s.liquidSubSeededV22.add('pocket-1');s.saveGame();
 const data=JSON.parse(saved);s.liquidSubV22.clear();s.restoreDynamicState(data);
 assert.equal(s.liquidSubRecV22(2,5).a,.7523);assert.equal(s.liquidSubRecV22(6,8).a,1.0123);
 assert.ok(s.liquidSubSeededV22.has('pocket-1'));assert.equal(data.inv.dirt,7);
 console.log('PASS v22 save format round trip and inventory preservation');
}
{
 const s=world();
 // Use the production v28 reaction, retained by v29, with minimal terrain plumbing.
 const resources=fs.readFileSync(path.join(__dirname,'..','game-v28-resources-obsidian.txt'),'utf8');
 const start=resources.indexOf('liquidReactV22=function(now)');
 vm.runInContext(resources.slice(start,resources.indexOf('window.__skyStackResourceDebug',start)),s);
 s.ctr=n=>(n+.5)*32;
 s.liquidClearWorldCellV28=(x,y)=>{for(let dx=0;dx<2;dx++)for(let dy=0;dy<2;dy++)s.liquidSubV22.delete(s.key(x*2+dx,y*2+dy))};
 s.createObsidian=(x,y)=>{const r={material:'obsidian'};s.grid.set(s.key(Math.floor(x/32),Math.floor(y/32)),r);return r};
 s.liquidSubPutV22(4,5,'water',1);s.liquidSubPutV22(4,6,'lava',1);s.liquidSubPutV22(5,6,'lava',1);
 s.liquidSubPutV22(4,4,'water',1);s.liquidReactV22(1000);
 assert.equal(s.grid.get('2,3').material,'obsidian');assert.equal(s.liquidSubRecV22(4,6),null);
 assert.equal(s.liquidSubRecV22(4,4).a,1);assert.equal(s.liquidSubOpenV22(4,6),false);
 console.log('PASS obsidian reaction creates a solid floor and preserves upstream water');
}
