(() => {
'use strict';
let ac,music,sfx,ambience,ready=false,timer=null,next=0,bar=0,beatOrigin=0,windSource=null,lastSplash=0,lastSizzle=0;
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
function route(node,bus,pan=0){if(ac.createStereoPanner){const p=ac.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,pan));node.connect(p);p.connect(bus)}else node.connect(bus)}
function voice(midi,t,d,v,type='triangle',bus=music,pan=0,detune=0,cutoff=1800){const o=ac.createOscillator(),f=ac.createBiquadFilter(),g=ac.createGain();o.type=type;o.frequency.value=hz(midi);o.detune.value=detune;f.type='lowpass';f.frequency.value=cutoff;env(g,t,.018,v,d);o.connect(f);f.connect(g);route(g,bus,pan);o.start(t);o.stop(t+d+.06)}
function pad(midi,t,d,pan){
 const f=ac.createBiquadFilter(),g=ac.createGain(),lfo=ac.createOscillator(),depth=ac.createGain();f.type='lowpass';f.frequency.value=950;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.018,t+.65);g.gain.setValueAtTime(.018,t+d-.55);g.gain.exponentialRampToValueAtTime(.0001,t+d+.75);lfo.frequency.value=.18;depth.gain.value=4;lfo.connect(depth);
 for(const [type,cents,level] of [['sine',-5,.78],['triangle',5,.35]]){const o=ac.createOscillator(),og=ac.createGain();o.type=type;o.frequency.value=hz(midi);o.detune.value=cents;og.gain.value=level;depth.connect(o.detune);o.connect(og);og.connect(f);o.start(t);o.stop(t+d+1)}f.connect(g);route(g,music,pan);lfo.start(t);lfo.stop(t+d+1)
}
function playBar(i,t){const p=SONG[i],pan=[-.48,-.15,.17,.48];p.chord.forEach((n,j)=>pad(n,t,barLen*.98,pan[j]));voice(p.bass[0],t,beat*1.7,.028,'triangle',music,-.08,0,600);voice(p.bass[1],t+beat*2,beat*1.45,.021,'triangle',music,.08,0,560);for(let s=0;s<8;s++){if((i+s)%7===5)continue;voice(p.chord[ARP[s]]+12,t+s*beat*.5,beat*.34,.011,'triangle',music,s%2?.2:-.2,s%3===0?-3:2,1250)}for(const [o,n,d] of p.melody)voice(n,t+o*beat,d*beat,.018,'sine',music,o<2?-.16:.16,0,1400);voice(38,t,.16,i%4===0?.018:.012,'sine',music,0,0,420);voice(38,t+beat*2,.16,.01,'sine',music,0,0,420)}
function schedule(){if(!ready||ac.state!=='running')return;while(next<ac.currentTime+1){playBar(bar,next);next+=barLen;bar=(bar+1)%SONG.length}}
function start(){clearInterval(timer);next=ac.currentTime+.08;beatOrigin=next;bar=0;timer=setInterval(schedule,100);schedule()}

function makeNoise(seconds=4){const length=Math.floor(ac.sampleRate*seconds),buffer=ac.createBuffer(1,length,ac.sampleRate),data=buffer.getChannelData(0);let last=0;for(let i=0;i<length;i++){last=last*.985+(Math.random()*2-1)*.015;data[i]=last}return buffer}
function startAmbience(){if(windSource)return;windSource=ac.createBufferSource();windSource.buffer=makeNoise(6);windSource.loop=true;const hi=ac.createBiquadFilter(),lo=ac.createBiquadFilter(),g=ac.createGain(),lfo=ac.createOscillator(),move=ac.createGain();hi.type='highpass';hi.frequency.value=110;lo.type='lowpass';lo.frequency.value=760;g.gain.value=.055;lfo.frequency.value=.055;move.gain.value=.018;lfo.connect(move);move.connect(g.gain);windSource.connect(hi);hi.connect(lo);lo.connect(g);route(g,ambience,-.12);windSource.start();lfo.start()}
function birdAt(t,pan,midi){const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.setValueAtTime(hz(midi),t);o.frequency.exponentialRampToValueAtTime(hz(midi+7),t+.07);o.frequency.exponentialRampToValueAtTime(hz(midi+2),t+.16);env(g,t,.012,.018,.2);o.connect(g);route(g,ambience,pan);o.start(t);o.stop(t+.22)}
function scheduleBirds(){if(!ready||ac.state!=='running')return;const t=ac.currentTime+1+Math.random()*3,n=76+Math.floor(Math.random()*8);birdAt(t,Math.random()*1.4-.7,n);if(Math.random()>.55)birdAt(t+.27,Math.random()*1.4-.7,n+2)}

function toneAt(freq,t,d=.08,v=.08,type='triangle',slide=0,bus=sfx,pan=0){if(!ready)return;const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(1,slide),t+d);env(g,t,.004,Math.max(.0001,v),d);o.connect(g);route(g,bus,pan);o.start(t);o.stop(t+d+.03)}
function tone(freq,d=.08,v=.08,type='triangle',slide=0){if(ready)toneAt(freq,ac.currentTime,d,v,type,slide)}
function noiseAt(t,d=.18,v=.04,cut=1800,pan=0){if(!ready)return;const src=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();src.buffer=makeNoise(Math.max(.25,d));f.type='lowpass';f.frequency.value=cut;env(g,t,.006,Math.max(.0001,v),d);src.connect(f);f.connect(g);route(g,sfx,pan);src.start(t);src.stop(t+d+.02)}
function noise(d=.18,v=.04,cut=1800){if(ready)noiseAt(ac.currentTime,d,v,cut)}
function hit(material,broken=false){if(!ready)return;const midi={dirt:43,stone:52,deepslate:40,obsidian:35}[material]||43;voice(midi,ac.currentTime,broken?.2:.09,broken?.1:.065,'triangle',sfx,0,0,material==='dirt'?700:1200);if(broken)noise(.12,.025,material==='dirt'?650:1800)}
function rhythm(){if(!ready)return{ready:false,bpm:BPM,beatMs:beat*1000,beatIndex:-1,barBeat:0,phase:0};const pos=(ac.currentTime-beatOrigin)/beat,index=Math.floor(pos);return{ready:true,bpm:BPM,beatMs:beat*1000,beatIndex:index,barBeat:((index%4)+4)%4,phase:pos-index}}
function minerHit(material,gain=1,pan=0,broken=false){if(!ready||gain<.012)return;const midi=material==='dirt'?43:material==='stone'?52:material==='deepslate'?40:35;voice(midi,ac.currentTime,.12,.055*Math.min(1,gain),'triangle',sfx,pan,0,900);if(broken)noiseAt(ac.currentTime,.1,.02*gain,1300,pan)}
function place(material,cost=1){if(!ready)return;voice(material==='deepslate'?36:material==='stone'?43:48,ac.currentTime,.14,.07+Math.min(.03,cost*.002),'triangle',sfx,0,0,700)}
function unlock(){if(!ready)return;const t=ac.currentTime;[62,66,69,74].forEach((m,i)=>voice(m,t+i*.09,.48,.05,'sine',sfx,(i-1.5)*.12))}
function ui(){tone(620,.035,.018,'sine')}
function splash(kind='water'){if(!ready||performance.now()-lastSplash<180)return;lastSplash=performance.now();if(kind==='lava'){tone(92,.23,.05,'triangle',64);noise(.12,.014,520)}else{tone(360,.13,.026,'sine',205);noise(.07,.012,2200)}}
function sizzle(){if(!ready||performance.now()-lastSizzle<120)return;lastSizzle=performance.now();noise(.24,.045,3000);tone(170,.16,.03,'triangle',90)}
async function ensure(){if(ready){if(ac.state==='suspended')try{await ac.resume()}catch{};return}try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;ac=new AC();const master=ac.createGain(),comp=ac.createDynamicsCompressor();music=ac.createGain();sfx=ac.createGain();ambience=ac.createGain();master.gain.value=.76;music.gain.value=.43;sfx.gain.value=.9;ambience.gain.value=.11;music.connect(master);sfx.connect(master);ambience.connect(master);master.connect(comp);comp.connect(ac.destination);await ac.resume();ready=true;start();startAmbience();setInterval(scheduleBirds,9000)}catch(e){console.warn('Audio start failed',e)}}
document.addEventListener('pointerdown',ensure,{capture:true});document.addEventListener('keydown',ensure,{capture:true});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInterval(timer);timer=null}else if(ready)ac.resume().then(start).catch(()=>{})});
window.SkyAudio={ensure,hit,minerHit,rhythm,place,unlock,ui,splash,sizzle,bpm:BPM};
window.__skyStackAudioDebug=()=>({ready,bpm:BPM,bar,scoreBars:SONG.length,midiOnly:true,wind:!!windSource,musicGain:music?.gain?.value??null,ambienceGain:ambience?.gain?.value??null});
document.documentElement.dataset.audioEngine='midi-ready';
})();
