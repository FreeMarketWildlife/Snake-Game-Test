const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const callbacks=[],listeners={};let context;
const parameter=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
const node=()=>({gain:parameter(),frequency:parameter(),detune:parameter(),pan:parameter(),Q:parameter(),connect(){},start(){},stop(){}});
class AudioContext{
 constructor(){context=this;this.currentTime=0;this.sampleRate=8000;this.state='running';this.destination=node()}
 createGain(){return node()}createDynamicsCompressor(){return node()}createOscillator(){return node()}createBiquadFilter(){return node()}createStereoPanner(){return node()}createBufferSource(){return node()}
 createBuffer(channels,size){const data=new Float32Array(size);return{getChannelData:()=>data}}resume(){this.state='running';return Promise.resolve()}
}
const document={hidden:false,documentElement:{dataset:{}},addEventListener:(k,f)=>listeners[k]=f};
const s={window:{AudioContext},document,console,queueMicrotask,performance:{now:()=>context.currentTime*1000},setInterval:f=>(callbacks.push(f),callbacks.length),clearInterval(){}};vm.createContext(s);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../audio.js'),'utf8'),s);
(async()=>{
 const a=s.window.SkyAudio;await a.ensure();const debug=()=>s.window.__skyStackAudioDebug().automation;
 assert.equal(debug().events.length,0,'idle facilities remain silent');
 a.setMachineSource(()=>Array.from({length:100},(_,i)=>({type:'furnace',active:true,gain:1,pan:i%2?.5:-.5})));
 const schedule=callbacks[0];
 for(let i=1;i<=6000;i++){context.currentTime=i*.05;schedule()}
 const events=debug().events;assert.ok(events.length>40);
 for(const e of events){assert.equal(e.subdivision,0);assert.ok(e.chord.includes(e.midi+12));assert.ok(e.gain<.045,'100 machines cannot multiply volume');assert.equal(e.count,100);assert.ok(Math.abs((e.t-debug().beatOrigin)/(60/72)-e.bar*4)<1e-10,'no musical drift after five minutes')}
 assert.ok(debug().activeVoices<=1);console.log('PASS five-minute shared clock, song harmony and bounded 100-machine mix');
 const last=events.at(-1).t;context.currentTime+=120;schedule();
 const resumed=debug().events.filter(e=>e.t>last);assert.ok(resumed.length<=1,'no stall backlog');
 document.hidden=true;context.currentTime+=120;schedule();assert.equal(debug().events.length,events.length);
 document.hidden=false;context.state='suspended';schedule();assert.equal(debug().events.length,events.length);
 await listeners.visibilitychange();await Promise.resolve();
 context.currentTime+=.1;callbacks.at(-1)();assert.ok(debug().activeVoices<=1);
 console.log('PASS hidden/suspended audio stays quiet and resumes without replaying missed events');
 a.setMachineSource(()=>[{type:'furnace',active:false,gain:1,pan:0},{type:'furnace',active:true,gain:0,pan:0}]);
 const count=debug().events.at(-1)?.t;for(let i=0;i<100;i++){context.currentTime+=.05;callbacks.at(-1)()}
 assert.equal(debug().events.at(-1)?.t,count);console.log('PASS idle and distant facilities are silent');
 for(let i=0;i<100;i++)a.minerHit('stone',1,0,true);
 assert.equal(debug().minerVoices,1);console.log('PASS crowd miner percussion is capped within the shared beat');
})().catch(e=>{console.error(e);process.exitCode=1});
