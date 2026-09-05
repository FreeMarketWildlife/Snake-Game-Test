(() => {
'use strict';
let ac, music, sfx, ready=false, timer=null, next=0, bar=0;
const BPM=76, beat=60/BPM, barLen=beat*4;
const chords=[
[62,66,69,76],[61,64,69,71],[59,62,66,69],[55,59,62,66],
[54,57,62,64],[52,55,59,62],[55,59,62,66],[57,61,64,71],
[59,62,66,69],[61,64,69,71],[55,59,62,66],[54,57,62,64],
[52,55,59,62],[55,59,62,66],[57,62,64,69],[57,61,64,71]
];
const roots=[38,37,35,31,30,28,31,33,35,37,31,30,28,31,33,33];
const lead=[69,64,71,66,69,64,71,69,74,69,67,66,64,71,69,66];
const hz=n=>440*Math.pow(2,(n-69)/12);
function env(g,t,a,v,d){g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+d)}
function osc(freq,t,d,v,type='sine',bus=music,pan=0){const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.value=freq;env(g,t,.012,v,d);o.connect(g);if(ac.createStereoPanner){const p=ac.createStereoPanner();p.pan.value=pan;g.connect(p);p.connect(bus)}else g.connect(bus);o.start(t);o.stop(t+d+.05)}
function pad(note,t,d,pan){const o=ac.createOscillator(),o2=ac.createOscillator(),f=ac.createBiquadFilter(),g=ac.createGain();o.type='sine';o2.type='triangle';o.frequency.value=hz(note);o2.frequency.value=hz(note);o2.detune.value=5;f.type='lowpass';f.frequency.value=1400;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.025,t+.5);g.gain.setValueAtTime(.025,t+d-.7);g.gain.exponentialRampToValueAtTime(.0001,t+d+.8);o.connect(f);o2.connect(f);f.connect(g);if(ac.createStereoPanner){const p=ac.createStereoPanner();p.pan.value=pan;g.connect(p);p.connect(music)}else g.connect(music);o.start(t);o2.start(t);o.stop(t+d+1);o2.stop(t+d+1)}
function playBar(i,t){const c=chords[i],p=[-.5,-.16,.16,.5];c.forEach((n,j)=>pad(n,t,barLen*.95,p[j]));osc(hz(roots[i]),t,1.1,.035,'triangle');osc(hz(roots[i]+7),t+beat*2,.9,.028,'triangle');const pat=[0,2,1,3,2,1,0,2];for(let j=0;j<8;j++)osc(hz(c[pat[j]]+12),t+j*beat*.5,.45,.022,'triangle',music,j%2?.28:-.28);const n=lead[i];osc(hz(n),t+beat*.5,beat*.7,.026,'sine',music,-.12);osc(hz(n-3),t+beat*2.25,beat*.55,.018,'sine',music,.12);if(i%4===3)osc(hz(n+5),t+beat*3.1,beat*.6,.02,'sine',music,.18)}
function schedule(){if(!ready||ac.state!=='running')return;while(next<ac.currentTime+.8){playBar(bar,next);next+=barLen;bar=(bar+1)%chords.length}}
function start(){clearInterval(timer);next=ac.currentTime+.08;bar=0;timer=setInterval(schedule,90);schedule()}
function tone(freq,d=.08,v=.08,type='triangle',slide=0){if(!ready)return;const t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+d);env(g,t,.004,v,d);o.connect(g);g.connect(sfx);o.start(t);o.stop(t+d+.03)}
function hit(material,broken=false,n=1){
 if(material==='deepslate'){const f=[250,225,205,185,168,150][Math.min(5,n-1)];tone(f,broken?.19:.11,broken?.14:.085,'triangle',f*.58);tone(f*.62,.10,.045,'sine',f*.45);if(broken)tone(82,.24,.1,'triangle',50)}
 else if(material==='stone'){const f=[360,315,270][Math.min(2,n-1)];tone(f,broken?.16:.09,broken?.12:.075,'triangle',f*.7);tone(f*1.5,.055,.025,'sine');if(broken)tone(130,.17,.08,'triangle',80)}
 else{const r=.92+Math.random()*.16;tone(120*r,broken?.12:.075,broken?.1:.07,'triangle',72*r);if(broken)tone(250*r,.06,.035,'square',140*r)}
}
function place(material,cost=1){const w=Math.min(1,Math.log2(cost+1)/3),b=material==='deepslate'?64:material==='stone'?78:98;tone(b-w*10,.14,.08+w*.03,'triangle',46);tone(material==='deepslate'?165:material==='stone'?220:285,.055,.025,'sine')}
function unlock(){if(!ready)return;const t=ac.currentTime;[74,78,81,86].forEach((n,i)=>osc(hz(n),t+i*.085,.5,.06,'sine',sfx,(i-1.5)*.15));tone(110,.25,.055,'sine',82)}
function ui(){tone(680,.035,.02,'sine')}
async function ensure(){if(ready){if(ac.state==='suspended')try{await ac.resume()}catch{};return}try{if(navigator.audioSession&&'type'in navigator.audioSession)navigator.audioSession.type='playback';const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;ac=new AC();const master=ac.createGain(),comp=ac.createDynamicsCompressor();music=ac.createGain();sfx=ac.createGain();master.gain.value=.8;music.gain.value=.42;sfx.gain.value=.95;music.connect(master);sfx.connect(master);master.connect(comp);comp.connect(ac.destination);await ac.resume();ready=true;start()}catch(e){console.warn('Audio start failed',e)}}
document.addEventListener('pointerdown',ensure,{capture:true});document.addEventListener('keydown',ensure,{capture:true});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInterval(timer);timer=null}else if(ready)ac.resume().then(start).catch(()=>{})});
window.SkyAudio={ensure,hit,place,unlock,ui};
})();
