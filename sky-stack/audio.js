(() => {
'use strict';
let ac,music,sfx,ambience,ready=false,timer=null,next=0,bar=0,beatOrigin=0,windSource=null,lastSplash=0,lastSizzle=0;
let ghostMix=0,ghostPan=0,lastSpiritDeathSlot=-1,spiritCues=0,lastGoldSlot=-1,musicOn=true,sfxOn=true;
let automation,machineSource=()=>[],machineSlot=0,machineVoices=[],machineHistory=[],machineMix=[];
const minerSlots=new Map();
const pendingMinerVoices=new Map();
// Patterns use sixteenth-note positions within a 4/4 bar. Future physical
// facilities only register active sources; gameplay never waits for this clock.
const MACHINE_AUDIO={
 furnace:{pattern:[0],everyBars:1,gain:.034,duration:.26,chordTone:0,octave:-12,timbre:'metal',maxVoices:1},
 sawmill:{pattern:[3,10],everyBars:1,gain:.018,duration:.09,chordTone:1,octave:0,timbre:'wood',maxVoices:1},
 stonecutter:{pattern:[4,12],everyBars:1,gain:.014,duration:.06,chordTone:2,octave:12,timbre:'chisel',maxVoices:1}
};
const BPM=72,beat=60/BPM,barLen=beat*4,hz=midi=>440*Math.pow(2,(midi-69)/12);

// The score is MIDI note data played by tiny Web Audio instruments. No recordings
// or music samples are used, so every performance is generated inside the game.
const SONG=[
 {chord:[50,57,61,64],bass:[38,45],melody:[[1,69,1.5],[3.25,66,.65]]},
 {chord:[47,54,57,62],bass:[35,42],melody:[[.5,66,1],[2.5,69,1.2]]},
 {chord:[43,50,54,57],bass:[31,38],melody:[[1.5,62,1.5]]},
 {chord:[45,52,57,61],bass:[33,40],melody:[[.75,64,.75],[2.75,61,1]]},
 {chord:[50,57,61,66],bass:[38,45],melody:[[.5,69,1.25],[2.5,73,.7]]},
 {chord:[52,59,62,66],bass:[40,47],melody:[[1,71,1.5],[3,69,.7]]},
 {chord:[43,50,54,59],bass:[31,38],melody:[[.75,66,1],[2.25,62,1.5]]},
 {chord:[45,52,57,64],bass:[33,40],melody:[[1.5,64,1],[3.25,61,.5]]},
 {chord:[50,57,61,64],bass:[38,45],melody:[[.5,66,1],[2,69,1.5]]},
 {chord:[47,54,59,62],bass:[35,42],melody:[[1.25,71,1.5]]},
 {chord:[52,59,64,67],bass:[40,47],melody:[[.5,67,.8],[2.5,64,1.2]]},
 {chord:[45,52,57,61],bass:[33,40],melody:[[1,61,1.3],[3,64,.7]]}
],ARP=[0,2,1,3,1,2,0,1];
function env(g,t,a,v,d){g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+d)}
function route(node,bus,pan=0){if(bus===music&&!musicOn)return;if(bus===sfx&&!sfxOn)return;if(ac.createStereoPanner){const p=ac.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,pan));node.connect(p);p.connect(bus)}else node.connect(bus)}
function voice(midi,t,d,v,type='triangle',bus=music,pan=0,detune=0,cutoff=1800){const o=ac.createOscillator(),f=ac.createBiquadFilter(),g=ac.createGain();o.type=type;o.frequency.value=hz(midi);o.detune.value=detune;f.type='lowpass';f.frequency.value=cutoff;env(g,t,.018,v,d);o.connect(f);f.connect(g);route(g,bus,pan);o.start(t);o.stop(t+d+.06)}
function pad(midi,t,d,pan){
 const f=ac.createBiquadFilter(),g=ac.createGain(),lfo=ac.createOscillator(),depth=ac.createGain();f.type='lowpass';f.frequency.value=950;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.018,t+.65);g.gain.setValueAtTime(.018,t+d-.55);g.gain.exponentialRampToValueAtTime(.0001,t+d+.75);lfo.frequency.value=.18;depth.gain.value=4;lfo.connect(depth);
 for(const [type,cents,level] of [['sine',-5,.78],['triangle',5,.35]]){const o=ac.createOscillator(),og=ac.createGain();o.type=type;o.frequency.value=hz(midi);o.detune.value=cents;og.gain.value=level;depth.connect(o.detune);o.connect(og);og.connect(f);o.start(t);o.stop(t+d+1)}f.connect(g);route(g,music,pan);lfo.start(t);lfo.stop(t+d+1)
}
function playBar(i,t){const p=SONG[i],pan=[-.48,-.15,.17,.48];p.chord.forEach((n,j)=>pad(n,t,barLen*.98,pan[j]));voice(p.bass[0],t,beat*1.7,.028,'triangle',music,-.08,0,600);voice(p.bass[1],t+beat*2,beat*1.45,.021,'triangle',music,.08,0,560);for(let s=0;s<8;s++){if((i+s)%7===5)continue;voice(p.chord[ARP[s]]+12,t+s*beat*.5,beat*.34,.011,'triangle',music,s%2?.2:-.2,s%3===0?-3:2,1250)}for(const [o,n,d] of p.melody)voice(n,t+o*beat,d*beat,.018,'sine',music,o<2?-.16:.16,0,1400);voice(38,t,.16,i%4===0?.018:.012,'sine',music,0,0,420);voice(38,t+beat*2,.16,.01,'sine',music,0,0,420)}
function schedule(){if(!ready||ac.state!=='running'||document.hidden)return;while(next<ac.currentTime+1){playBar(bar,next);playGhostBar(bar,next);next+=barLen;bar=(bar+1)%SONG.length}scheduleMachines()}
function start(){clearInterval(timer);next=ac.currentTime+.08;beatOrigin=next;bar=0;machineSlot=0;minerSlots.clear();lastSpiritDeathSlot=-1;timer=setInterval(schedule,50);schedule()}
function setMachineSource(source){machineSource=typeof source==='function'?source:()=>[]}
function scheduleMachines(){
 const now=ac.currentTime,step=beat/4;
 machineVoices=machineVoices.filter(v=>v.end>now);
 // Skip elapsed slots after a stall; never replay a backlog of missed actions.
 machineSlot=Math.max(machineSlot,Math.ceil((now-beatOrigin)/step),0);
 while(beatOrigin+machineSlot*step<now+.15){
   const slot=machineSlot++,t=beatOrigin+slot*step,barIndex=Math.floor(slot/16),subdivision=slot%16;
   const chord=SONG[barIndex%SONG.length].chord,groups=new Map();
   for(const m of machineSource()){
     if(!m.active||!MACHINE_AUDIO[m.type]||!Number.isFinite(m.gain)||m.gain<.012)continue;
     const group=groups.get(m.type)||[];group.push(m);groups.set(m.type,group);
   }
   machineMix=[];
   for(const [type,list] of groups){
     const d=MACHINE_AUDIO[type];list.sort((a,b)=>b.gain-a.gain);
     const strongest=list[0],sum=list.reduce((n,m)=>n+m.gain,0);
     // One combined voice per instrument, modest count accent, bounded headroom.
     const gain=d.gain*Math.min(1,strongest.gain)*(1+Math.min(.3,Math.log2(1+sum)*.065));
     const pan=list.reduce((n,m)=>n+(m.pan||0)*m.gain,0)/sum;
     machineMix.push({type,count:list.length,gain,pan,pattern:d.pattern});
     if(barIndex%d.everyBars||!d.pattern.includes(subdivision)||machineVoices.length>=6||machineVoices.filter(v=>v.type===type).length>=d.maxVoices)continue;
     const midi=chord[d.chordTone%chord.length]+d.octave;
     voice(midi,t,d.duration,gain,d.timbre==='wood'?'sine':'triangle',automation,pan,0,d.timbre==='metal'?850:2400);
     if(d.timbre==='metal')voice(chord[1]-12,t+.018,d.duration*.65,gain*.2,'sine',automation,pan,0,1100);
     machineVoices.push({type,start:t,end:t+d.duration+.06});
     machineHistory.push({type,t,bar:barIndex,subdivision,midi,chord:[...chord],gain,pan,count:list.length});
     if(machineHistory.length>64)machineHistory.shift();
   }
 }
}

function makeNoise(seconds=4){const length=Math.floor(ac.sampleRate*seconds),buffer=ac.createBuffer(1,length,ac.sampleRate),data=buffer.getChannelData(0);let last=0;for(let i=0;i<length;i++){last=last*.985+(Math.random()*2-1)*.015;data[i]=last}return buffer}
function startAmbience(){if(windSource)return;windSource=ac.createBufferSource();windSource.buffer=makeNoise(6);windSource.loop=true;const hi=ac.createBiquadFilter(),lo=ac.createBiquadFilter(),g=ac.createGain(),lfo=ac.createOscillator(),move=ac.createGain();hi.type='highpass';hi.frequency.value=110;lo.type='lowpass';lo.frequency.value=760;g.gain.value=.055;lfo.frequency.value=.055;move.gain.value=.018;lfo.connect(move);move.connect(g.gain);windSource.connect(hi);hi.connect(lo);lo.connect(g);route(g,ambience,-.12);windSource.start();lfo.start()}
function birdAt(t,pan,midi){const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.setValueAtTime(hz(midi),t);o.frequency.exponentialRampToValueAtTime(hz(midi+7),t+.07);o.frequency.exponentialRampToValueAtTime(hz(midi+2),t+.16);env(g,t,.012,.018,.2);o.connect(g);route(g,ambience,pan);o.start(t);o.stop(t+.22)}
function scheduleBirds(){if(!ready||ac.state!=='running')return;const t=ac.currentTime+1+Math.random()*3,n=76+Math.floor(Math.random()*8);birdAt(t,Math.random()*1.4-.7,n);if(Math.random()>.55)birdAt(t+.27,Math.random()*1.4-.7,n+2)}

function toneAt(freq,t,d=.08,v=.08,type='triangle',slide=0,bus=sfx,pan=0){if(!ready)return;const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(1,slide),t+d);env(g,t,.004,Math.max(.0001,v),d);o.connect(g);route(g,bus,pan);o.start(t);o.stop(t+d+.03)}
function tone(freq,d=.08,v=.08,type='triangle',slide=0){if(ready)toneAt(freq,ac.currentTime,d,v,type,slide)}
function noiseAt(t,d=.18,v=.04,cut=1800,pan=0){if(!ready)return;const src=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();src.buffer=makeNoise(Math.max(.25,d));f.type='lowpass';f.frequency.value=cut;env(g,t,.006,Math.max(.0001,v),d);src.connect(f);f.connect(g);route(g,sfx,pan);src.start(t);src.stop(t+d+.02)}
function noise(d=.18,v=.04,cut=1800){if(ready)noiseAt(ac.currentTime,d,v,cut)}
function stoneStrike(broken,gain=1,pan=0,midi=67){
 const t=ac.currentTime,d=.085;
 const buffer=ac.createBuffer(1,Math.ceil(ac.sampleRate*d),ac.sampleRate),samples=buffer.getChannelData(0);
 for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
 const source=ac.createBufferSource(),filter=ac.createBiquadFilter(),g=ac.createGain();source.buffer=buffer;filter.type='highpass';filter.frequency.value=2400;
 env(g,t,.002,.06*gain,d);source.connect(filter);filter.connect(g);route(g,sfx,pan);source.start(t);source.stop(t+d+.02);
 voice(midi,t,.045,.055*gain,'triangle',sfx,pan,0,3000);
 // Breaking keeps the same strike, with only a faint breath of debris after it.
 if(broken){const hiss=ac.createBufferSource(),band=ac.createBiquadFilter(),level=ac.createGain();hiss.buffer=buffer;band.type='bandpass';band.frequency.value=4200;band.Q.value=.7;env(level,t+.025,.008,.006*gain,.075);hiss.connect(band);band.connect(level);route(level,sfx,pan);hiss.start(t+.025);hiss.stop(t+.105)}
}
function goldChaching(gain=1,pan=0){
 if(!ready||ac.state!=='running'||document.hidden||gain<.012)return;
 const step=beat/4,slot=Math.max(0,Math.ceil((ac.currentTime-beatOrigin)/step));if(slot===lastGoldSlot)return;lastGoldSlot=slot;
 const t=beatOrigin+slot*step,chord=SONG[Math.floor(slot/16)%SONG.length].chord;
 [chord[0]+36,chord[2]+24,chord[1]+24].forEach((n,i)=>voice(n,t+i*step,.24,.04*gain,'triangle',sfx,pan,0,6500))
}
let pickStroke=null;
function beginPickStroke(){pickStroke=new Map()}
function endPickStroke(){const hits=pickStroke;pickStroke=null;if(hits)for(const [material,broken] of hits)hit(material,broken)}
function dirtHat(gain=1,pan=0){
 if(!ready||ac.state!=='running')return;
 const t=ac.currentTime,source=ac.createBufferSource(),high=ac.createBiquadFilter(),low=ac.createBiquadFilter(),level=ac.createGain();
 source.buffer=makeNoise(.08);high.type='highpass';high.frequency.value=6500;low.type='lowpass';low.frequency.value=12500;
 env(level,t,.001,.065*Math.min(1,gain),.045);source.connect(high);high.connect(low);low.connect(level);route(level,sfx,pan);source.start(t);source.stop(t+.065);
}
function hit(material,broken=false){if(pickStroke){pickStroke.set(material,broken||pickStroke.get(material)||false);return}if(!ready)return;if(material==='dirt')return dirtHat();if(material==='stone')return stoneStrike(broken);const midi={dirt:43,deepslate:40,obsidian:35}[material]||43;voice(midi,ac.currentTime,broken?.2:.09,broken?.1:.065,'triangle',sfx,0,0,material==='dirt'?700:1200);if(broken)noise(.12,.025,material==='dirt'?650:1800)}
function rhythm(){if(!ready||ac.state!=='running')return{ready:false,bpm:BPM,beatMs:beat*1000,beatIndex:-1,barBeat:0,phase:0};const pos=(ac.currentTime-beatOrigin)/beat,index=Math.floor(pos);return{ready:true,bpm:BPM,beatMs:beat*1000,beatIndex:index,barBeat:((index%4)+4)%4,phase:pos-index}}
function minerHit(material,gain=1,pan=0,broken=false){
 if(!ready||ac.state!=='running'||document.hidden||gain<.012)return;
 const pos=Math.max(0,(ac.currentTime-beatOrigin)/beat),slot=Math.floor(pos*2),key=material+':'+slot;
 for(const [k,s] of minerSlots)if(s<slot-1)minerSlots.delete(k);
 // Mining remains tied to actual hits. At most one shared strike per material
 // per eighth-note window prevents crowds multiplying the percussion volume.
 const pending=pendingMinerVoices.get(key);
 if(pending){pending.broken||=broken;if(gain>pending.gain){pending.gain=gain;pending.pan=pan}return}
 if(minerSlots.has(key))return;minerSlots.set(key,slot);
 const chord=SONG[Math.floor(pos/4)%SONG.length].chord,midi=chord[material==='stone'?1:0]+(material==='deepslate'?-12:0);
 const event={gain,pan,broken};pendingMinerVoices.set(key,event);
 // Aggregate a simulation frame before rendering its strike, so nearby workers
 // dominate even if a distant worker appears first in the worker collection.
 queueMicrotask(()=>{
   pendingMinerVoices.delete(key);if(ac.state!=='running'||document.hidden)return;
   const {gain,pan,broken}=event;
   if(material==='dirt')return dirtHat(gain,pan);
   if(material==='stone')return stoneStrike(broken,gain,pan,midi);
   voice(midi,ac.currentTime,.12,.055*Math.min(1,gain),'triangle',sfx,pan,0,900);if(broken)noiseAt(ac.currentTime,.1,.02*gain,1300,pan);
 });
}
// Breath-like, gently detuned ghost notes follow the score's actual chord and
// eighth-note grid. Nearby ghosts add a sparse counter-melody to each music bar.
function ghostVoice(midi,t,d,v,pan){
 const o=ac.createOscillator(),lfo=ac.createOscillator(),depth=ac.createGain(),f=ac.createBiquadFilter(),g=ac.createGain();
 o.type='sine';o.frequency.setValueAtTime(hz(midi-.25),t);o.frequency.exponentialRampToValueAtTime(hz(midi),t+.18);
 lfo.frequency.value=4.4;depth.gain.value=22;lfo.connect(depth);depth.connect(o.detune);
 f.type='lowpass';f.frequency.value=1350;env(g,t,.1,v,d);o.connect(f);f.connect(g);route(g,music,pan);
 o.start(t);lfo.start(t);o.stop(t+d+.06);lfo.stop(t+d+.06)
}
function playGhostBar(i,t){
 if(ghostMix<.012)return;const p=SONG[i],v=.024*ghostMix;
 ghostVoice(p.chord[2]+12,t+beat*.5,beat*1.45,v,ghostPan);
 ghostVoice(p.chord[0]+24,t+beat*2.5,beat*1.2,v*.7,-ghostPan*.6);
 ghostVoice(p.chord[2]+12,t+beat*1.25,beat*.8,v*.2,ghostPan*.5)
}
function setGhostPresence(gain=0,pan=0){ghostMix=Math.max(0,Math.min(1,gain));ghostPan=Math.max(-1,Math.min(1,pan))}
function spiritCue(kind,gain=1,pan=0){
 if(!ready||ac.state!=='running'||gain<.012)return;
 const step=beat*.5,slot=Math.max(0,Math.ceil((ac.currentTime+.015-beatOrigin)/step)),t=beatOrigin+slot*step;
 if(kind==='death'&&slot===lastSpiritDeathSlot)return;if(kind==='death')lastSpiritDeathSlot=slot;
 const index=((Math.floor((t-beatOrigin)/barLen)%SONG.length)+SONG.length)%SONG.length,p=SONG[index];
 const notes=kind==='revive'?[p.chord[0]+12,p.chord[1]+12,p.chord[2]+12,p.chord[0]+24]:[p.chord[2]+12,p.chord[1]+12,p.chord[0]+12];
 notes.forEach((n,i)=>ghostVoice(n,t+i*step,beat*(kind==='revive'?.65:1.1),.05*gain*(1-i*.13),pan));
 if(kind==='revive')noiseAt(ac.currentTime,.09,.017*gain,1600,pan);
 spiritCues++
}
function setMusicEnabled(on){musicOn=!!on;if(music?.gain)music.gain.setTargetAtTime(musicOn?.43:.0001,ac.currentTime,.025);return musicOn}
function setSfxEnabled(on){sfxOn=!!on;if(sfx?.gain)sfx.gain.setTargetAtTime(sfxOn?.9:.0001,ac.currentTime,.025);return sfxOn}
function place(material,cost=1){if(!ready)return;voice(material==='deepslate'?36:material==='stone'?43:48,ac.currentTime,.14,.07+Math.min(.03,cost*.002),'triangle',sfx,0,0,700)}
function unlock(){if(!ready)return;const t=ac.currentTime;[62,66,69,74].forEach((m,i)=>voice(m,t+i*.09,.48,.05,'sine',sfx,(i-1.5)*.12))}
function ui(){tone(620,.035,.018,'sine')}
function splash(kind='water'){if(!ready||performance.now()-lastSplash<180)return;lastSplash=performance.now();if(kind==='lava'){tone(92,.23,.05,'triangle',64);noise(.12,.014,520)}else{tone(360,.13,.026,'sine',205);noise(.07,.012,2200)}}
function sizzle(){if(!ready||performance.now()-lastSizzle<120)return;lastSizzle=performance.now();noise(.24,.045,3000);tone(170,.16,.03,'triangle',90)}
async function ensure(){if(ready){if(ac.state==='suspended')try{await ac.resume()}catch{};return}try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;ac=new AC();const master=ac.createGain(),comp=ac.createDynamicsCompressor();music=ac.createGain();sfx=ac.createGain();ambience=ac.createGain();automation=ac.createGain();automation.gain.value=.45;automation.connect(master);master.gain.value=.76;music.gain.value=.43;sfx.gain.value=.9;ambience.gain.value=.11;music.connect(master);sfx.connect(master);ambience.connect(master);master.connect(comp);comp.connect(ac.destination);await ac.resume();ready=true;start();startAmbience();setInterval(scheduleBirds,9000)}catch(e){console.warn('Audio start failed',e)}}
document.addEventListener('pointerdown',ensure,{capture:true});document.addEventListener('keydown',ensure,{capture:true});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInterval(timer);timer=null}else if(ready)ac.resume().then(start).catch(()=>{})});
window.SkyAudio={ensure,beginPickStroke,endPickStroke,hit,minerHit,rhythm,place,unlock,ui,splash,sizzle,spiritCue,setGhostPresence,goldChaching,setMachineSource,setMusicEnabled,setSfxEnabled,bpm:BPM};
window.__skyStackAudioDebug=()=>({ready,bpm:BPM,bar,scoreBars:SONG.length,midiOnly:true,wind:!!windSource,musicGain:music?.gain?.value??null,ambienceGain:ambience?.gain?.value??null,ghostMix,spiritCues,automation:{beatOrigin,beat:rhythm().beatIndex,currentBar:Math.floor(rhythm().beatIndex/4),subdivision:Math.floor(rhythm().phase*4),definitions:MACHINE_AUDIO,mix:machineMix,activeVoices:machineVoices.filter(v=>v.end>(ac?.currentTime||0)).length,events:machineHistory,minerVoices:minerSlots.size}});
document.documentElement.dataset.audioEngine='midi-ready';
})();
