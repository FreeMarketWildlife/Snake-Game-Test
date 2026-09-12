(() => {
  const shell = document.getElementById("gameShell");
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const controls = document.getElementById("touchControls");
  const gameTitle = document.getElementById("gameTitle");
  const gameMeta = document.getElementById("gameMeta");
  const gameMessage = document.getElementById("gameMessage");
  const exitButton = document.getElementById("exitGame");
  ctx.imageSmoothingEnabled = false;

  const input = new Set();
  let active = null;
  let last = 0;
  let raf = 0;
  let running = false;

  const keyMap = {
    arrowleft:"left", a:"left", arrowright:"right", d:"right",
    arrowup:"up", w:"up", arrowdown:"down", s:"down",
    " ":"fire", j:"punch", k:"fire", l:"alt", shift:"alt"
  };

  window.addEventListener("keydown", e => {
    if (!running) return;
    const k = keyMap[e.key.toLowerCase()];
    if (k) { input.add(k); e.preventDefault(); }
  }, { passive:false });
  window.addEventListener("keyup", e => {
    if (!running) return;
    const k = keyMap[e.key.toLowerCase()];
    if (k) { input.delete(k); e.preventDefault(); }
  }, { passive:false });

  function audio(freq=440, duration=.05, type="square", volume=.035) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      window.__cadAudio ||= new AudioCtx();
      const ac = window.__cadAudio;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type=type; o.frequency.setValueAtTime(freq,ac.currentTime);
      g.gain.setValueAtTime(volume,ac.currentTime); g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+duration);
      o.connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+duration);
    } catch(_){}
  }

  function makeControls(left, right) {
    controls.innerHTML = "";
    const make = (side, list) => {
      const group = document.createElement("div"); group.className=`control-cluster ${side}`;
      list.forEach(item => {
        const b=document.createElement("button"); b.className=`touch-btn ${item.cls||""}`; b.textContent=item.label; b.dataset.key=item.key;
        const on=e=>{e.preventDefault();input.add(item.key);b.classList.add("pressed");};
        const off=e=>{e.preventDefault();input.delete(item.key);b.classList.remove("pressed");};
        b.addEventListener("pointerdown",on);b.addEventListener("pointerup",off);b.addEventListener("pointercancel",off);b.addEventListener("pointerleave",off);
        group.appendChild(b);
      });
      controls.appendChild(group);
    };
    make("left",left); make("right",right);
  }

  function showMessage(title, text, buttonText="RESTART", callback=null) {
    gameMessage.innerHTML=`<strong>${title}</strong><span>${text}</span>${callback?`<button id="messageAction">${buttonText}</button>`:""}`;
    gameMessage.classList.remove("hidden");
    if(callback) document.getElementById("messageAction").onclick=()=>{gameMessage.classList.add("hidden");callback();};
  }
  function hideMessage(){ gameMessage.classList.add("hidden"); gameMessage.innerHTML=""; }

  function launch(mode) {
    stop(); input.clear(); hideMessage(); shell.classList.remove("hidden"); running=true; last=performance.now();
    if(mode==="platformer") active=createPlatformer();
    if(mode==="fps") active=createFPS();
    if(mode==="fighter") active=createFighter();
    active?.start?.();
    loop(last);
  }

  function stop() {
    running=false; cancelAnimationFrame(raf); input.clear(); active?.stop?.(); active=null; controls.innerHTML="";
  }

  exitButton.addEventListener("click",()=>{ audio(220,.06); stop(); shell.classList.add("hidden"); hideMessage(); });

  function loop(now){
    if(!running||!active)return;
    const dt=Math.min(.035,(now-last)/1000||.016);last=now;
    active.update(dt);active.draw();raf=requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------------------
  // 01 — SIDE-SCROLLER: a compact 2D platformer shooter survival prototype.
  // ------------------------------------------------------------------------
  function createPlatformer(){
    gameTitle.textContent="SIM 01 // SIDE-SCROLLER"; gameMeta.textContent="EP I // CH 01 // INTRO";
    makeControls([
      {label:"◀",key:"left"},{label:"▶",key:"right"},{label:"JMP",key:"up",cls:"alt"}
    ],[
      {label:"FIRE",key:"fire",cls:"action"}
    ]);

    let p, bullets, enemyBullets, enemies, particles, score, spawnClock, elapsed, dead;
    const platforms=[{x:0,y:234,w:480,h:36},{x:102,y:190,w:76,h:7},{x:255,y:172,w:78,h:7},{x:372,y:205,w:63,h:7}];

    function reset(){
      p={x:60,y:207,w:8,h:25,vx:0,vy:0,onGround:false,facing:1,hp:100,shot:0,inv:0};
      bullets=[];enemyBullets=[];enemies=[];particles=[];score=0;spawnClock=.5;elapsed=0;dead=false;hideMessage();
    }

    function rectHit(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
    function spawnEnemy(){
      const kind=Math.random()<.28?"drone":"walker";
      enemies.push(kind==="walker"?{kind,x:492,y:210,w:11,h:24,vx:-20-Math.random()*12,hp:2,shot:.7+Math.random()*1.3,flash:0}:{kind,x:492,y:145+Math.random()*55,w:16,h:9,vx:-25-Math.random()*16,hp:1,shot:.8+Math.random()*1.1,phase:Math.random()*8,flash:0});
    }
    function burst(x,y,color,n=5){for(let i=0;i<n;i++)particles.push({x,y,vx:(Math.random()-.5)*65,vy:(Math.random()-.8)*55,life:.3+Math.random()*.35,color});}
    function damage(amount){if(p.inv>0||dead)return;p.hp-=amount;p.inv=.55;audio(120,.09,"sawtooth",.04);burst(p.x+4,p.y+10,"#ff5269",8);if(p.hp<=0){dead=true;showMessage("SIGNAL LOST",`Jessie went down. Robots neutralized: ${score}.`,"RETRY",reset);}}

    function update(dt){
      if(dead)return; elapsed+=dt;p.shot=Math.max(0,p.shot-dt);p.inv=Math.max(0,p.inv-dt);
      const move=(input.has("left")?-1:0)+(input.has("right")?1:0);p.vx=move*68;if(move)p.facing=Math.sign(move);
      if(input.has("up")&&p.onGround){p.vy=-165;p.onGround=false;audio(260,.05,"square",.02);input.delete("up");}
      if(input.has("fire")&&p.shot<=0){p.shot=.19;const bx=p.facing>0?p.x+p.w+1:p.x-5;bullets.push({x:bx,y:p.y+9,w:6,h:2,vx:p.facing*235});audio(880,.04,"square",.025);}
      p.vy+=380*dt;p.x+=p.vx*dt;p.x=Math.max(4,Math.min(468,p.x));
      const oldBottom=p.y+p.h;p.y+=p.vy*dt;p.onGround=false;
      for(const plat of platforms){if(p.vy>=0&&p.x+p.w>plat.x&&p.x<plat.x+plat.w&&oldBottom<=plat.y+3&&p.y+p.h>=plat.y){p.y=plat.y-p.h;p.vy=0;p.onGround=true;}}
      if(p.y>280)damage(100);

      spawnClock-=dt;if(spawnClock<=0){spawnEnemy();spawnClock=Math.max(.55,1.45-elapsed*.012)+Math.random()*.45;}
      for(const b of bullets)b.x+=b.vx*dt;
      for(const b of enemyBullets){b.x+=b.vx*dt;b.y+=b.vy*dt;if(rectHit(b,p)){b.dead=true;damage(12);}}
      for(const e of enemies){
        e.x+=e.vx*dt;e.shot-=dt;e.flash=Math.max(0,e.flash-dt);
        if(e.kind==="drone")e.y+=Math.sin(elapsed*3+e.phase)*7*dt;
        if(e.shot<=0&&e.x>120){const dx=(p.x-e.x),dy=(p.y+8-e.y);const len=Math.hypot(dx,dy)||1;enemyBullets.push({x:e.x,y:e.y+5,w:4,h:2,vx:dx/len*82,vy:dy/len*82});e.shot=1.2+Math.random()*1.3;e.flash=.08;audio(190,.03,"square",.012);}
        if(rectHit(e,p)){e.dead=true;damage(20);}
        if(e.x<-25)e.dead=true;
      }
      for(const b of bullets){for(const e of enemies){if(!b.dead&&!e.dead&&rectHit(b,e)){b.dead=true;e.hp--;e.flash=.12;burst(b.x,b.y,"#39f2df",4);if(e.hp<=0){e.dead=true;score++;burst(e.x+5,e.y+8,"#ffb84a",10);audio(1200,.05,"square",.02);}}}}
      for(const q of particles){q.life-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=80*dt;}
      bullets=bullets.filter(b=>!b.dead&&b.x>-12&&b.x<492);enemyBullets=enemyBullets.filter(b=>!b.dead&&b.x>-12&&b.x<492&&b.y>-10&&b.y<280);enemies=enemies.filter(e=>!e.dead);particles=particles.filter(q=>q.life>0);
    }

    function skyline(){
      ctx.fillStyle="#17132c";ctx.fillRect(0,0,480,270);ctx.fillStyle="#482047";ctx.fillRect(0,44,480,160);ctx.fillStyle="#e36477";ctx.fillRect(342,42,43,43);for(let i=0;i<6;i++){ctx.fillStyle="#3b1f42";ctx.fillRect(20+i*83,90+(i%3)*14,50,145);ctx.fillStyle=i%2?"#ff39cb":"#39f2df";for(let y=106;y<202;y+=16)ctx.fillRect(25+i*83,y,2,4)}ctx.fillStyle="#0a0911";ctx.fillRect(0,211,480,24);ctx.fillStyle="#302039";ctx.fillRect(0,211,480,2);for(let x=10;x<480;x+=31)ctx.fillRect(x,214,3,20);ctx.fillStyle="#6f4a5d";ctx.fillRect(0,225,480,2);
    }
    function drawHuman(x,y,face,blink){ctx.fillStyle=blink?"#fff":"#0a0810";ctx.fillRect(x+2,y,4,5);ctx.fillRect(x+2,y+5,4,3);ctx.fillRect(x,y+8,8,10);ctx.fillRect(x-2,y+10,2,9);ctx.fillRect(x+8,y+10,2,9);ctx.fillRect(x,y+18,3,7);ctx.fillRect(x+5,y+18,3,7);ctx.fillStyle="#39f2df";ctx.fillRect(x+1,y+9,6,2);ctx.fillStyle="#ff39cb";ctx.fillRect(face>0?x+9:x-4,y+12,5,2);}
    function drawRobot(e){const flash=e.flash>0;ctx.fillStyle=flash?"#fff":"#14131b";if(e.kind==="walker"){ctx.fillRect(e.x+2,e.y,7,6);ctx.fillRect(e.x,e.y+6,11,10);ctx.fillRect(e.x+1,e.y+16,3,8);ctx.fillRect(e.x+7,e.y+16,3,8);ctx.fillStyle="#ff5269";ctx.fillRect(e.x+4,e.y+2,3,2);ctx.fillStyle="#8e62ff";ctx.fillRect(e.x-4,e.y+8,5,3);}else{ctx.fillRect(e.x,e.y+2,16,5);ctx.fillRect(e.x+5,e.y,6,9);ctx.fillStyle="#ff5269";ctx.fillRect(e.x+7,e.y+3,2,2);ctx.fillStyle="#8e62ff";ctx.fillRect(e.x-3,e.y+4,3,1);ctx.fillRect(e.x+16,e.y+4,3,1);}}

    function draw(){
      skyline();for(const plat of platforms){ctx.fillStyle=plat.y>=230?"#09080f":"#16121e";ctx.fillRect(plat.x,plat.y,plat.w,plat.h);ctx.fillStyle="#4f3859";ctx.fillRect(plat.x,plat.y,plat.w,2);for(let x=plat.x+5;x<plat.x+plat.w;x+=13){ctx.fillStyle="#2b2231";ctx.fillRect(x,plat.y+3,2,3)}}
      for(const b of bullets){ctx.fillStyle="#39f2df";ctx.fillRect(b.x,b.y,b.w,b.h);ctx.fillStyle="#fff";ctx.fillRect(b.x+(b.vx>0?4:0),b.y,2,1)}for(const b of enemyBullets){ctx.fillStyle="#ff39cb";ctx.fillRect(b.x,b.y,b.w,b.h)}
      enemies.forEach(drawRobot);particles.forEach(q=>{ctx.fillStyle=q.color;ctx.fillRect(q.x|0,q.y|0,2,2)});drawHuman(p.x|0,p.y|0,p.facing,p.inv>0&&Math.floor(p.inv*20)%2===0);
      ctx.fillStyle="rgba(4,3,9,.82)";ctx.fillRect(7,27,128,18);ctx.fillStyle="#fff";ctx.font="7px monospace";ctx.fillText("JESSIE // HP",12,36);ctx.fillStyle="#30131f";ctx.fillRect(61,31,66,7);ctx.fillStyle=p.hp>35?"#39f2df":"#ff5269";ctx.fillRect(61,31,Math.max(0,66*p.hp/100),7);ctx.fillStyle="#fff";ctx.fillText(`ROBOTS ${score}`,390,37);
    }
    return {start:reset,update,draw};
  }

  // ------------------------------------------------------------------------
  // 02 — NEXUS-DOOM: simple ray-cast first-person robot shooter.
  // ------------------------------------------------------------------------
  function createFPS(){
    gameTitle.textContent="SIM 02 // NEXUS-DOOM"; gameMeta.textContent="EP I // CH 01 // CORRIDOR BUILD";
    makeControls([
      {label:"↶",key:"left"},{label:"▲",key:"up",cls:"alt"},{label:"▼",key:"down"},{label:"↷",key:"right"}
    ],[{label:"FIRE",key:"fire",cls:"action"}]);

    const MAP=[
      "111111111111",
      "100000000001",
      "102220011001",
      "100020000001",
      "101020111101",
      "101000100001",
      "101110102201",
      "100010100001",
      "102010001001",
      "100000100001",
      "100000000001",
      "111111111111"
    ];
    let p,enemies,score,dead,muzzle,hurt,shotLock,depth;
    const FOV=Math.PI/3;
    const wall=(x,y)=>{const X=Math.floor(x),Y=Math.floor(y);return MAP[Y]?.[X]&&MAP[Y][X]!=="0"?MAP[Y][X]:null;};
    function reset(){p={x:1.75,y:1.75,a:0,hp:100};enemies=[{x:5.5,y:1.6,hp:2},{x:8.4,y:3.2,hp:2},{x:3.6,y:5.7,hp:2},{x:8.5,y:6.5,hp:2},{x:2.4,y:9.1,hp:2},{x:9.4,y:9.2,hp:3}].map((e,i)=>({...e,cd:.7+i*.16,flash:0,alive:true}));score=0;dead=false;muzzle=0;hurt=0;shotLock=false;depth=new Array(240).fill(99);hideMessage();}
    function norm(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;}
    function clearMove(nx,ny){return !wall(nx-.15,ny-.15)&&!wall(nx+.15,ny-.15)&&!wall(nx-.15,ny+.15)&&!wall(nx+.15,ny+.15);}
    function rayDistance(angle,max=20){let x=p.x,y=p.y;const dx=Math.cos(angle)*.025,dy=Math.sin(angle)*.025;for(let d=0;d<max;d+=.025){x+=dx;y+=dy;if(wall(x,y))return d;}return max;}
    function los(ax,ay,bx,by){const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy),steps=Math.ceil(len/.08);for(let i=1;i<steps;i++){const q=i/steps;if(wall(ax+dx*q,ay+dy*q))return false;}return true;}
    function shoot(){
      muzzle=.12;audio(720,.05,"sawtooth",.04);let best=null,bestAngle=.13;
      for(const e of enemies){if(!e.alive)continue;const a=Math.abs(norm(Math.atan2(e.y-p.y,e.x-p.x)-p.a)),d=Math.hypot(e.x-p.x,e.y-p.y);if(a<bestAngle&&los(p.x,p.y,e.x,e.y)){best={e,d};bestAngle=a;}}
      if(best){best.e.hp--;best.e.flash=.14;audio(1500,.03,"square",.025);if(best.e.hp<=0){best.e.alive=false;score++;audio(100,.11,"sawtooth",.03);if(score===enemies.length){setTimeout(()=>showMessage("CORRIDOR CLEARED","Every NEXUS unit in this simulation is down.","RUN AGAIN",reset),180);}}}
    }
    function damage(n){if(hurt>0||dead)return;p.hp-=n;hurt=.45;audio(95,.1,"sawtooth",.045);if(p.hp<=0){dead=true;showMessage("NEXUS HAS YOU",`Cyborg units destroyed: ${score}/${enemies.length}.`,"RETRY",reset);}}
    function update(dt){
      if(dead)return;muzzle=Math.max(0,muzzle-dt);hurt=Math.max(0,hurt-dt);
      const turn=(input.has("left")?-1:0)+(input.has("right")?1:0);p.a+=turn*1.85*dt;
      const move=(input.has("up")?1:0)+(input.has("down")?-1:0);if(move){const nx=p.x+Math.cos(p.a)*move*1.85*dt,ny=p.y+Math.sin(p.a)*move*1.85*dt;if(clearMove(nx,p.y))p.x=nx;if(clearMove(p.x,ny))p.y=ny;}
      if(input.has("fire")&&!shotLock){shoot();shotLock=true;}if(!input.has("fire"))shotLock=false;
      for(const e of enemies){if(!e.alive)continue;e.flash=Math.max(0,e.flash-dt);e.cd-=dt;const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy);if(d>.75&&d<7&&los(e.x,e.y,p.x,p.y)){const nx=e.x+dx/d*.45*dt,ny=e.y+dy/d*.45*dt;if(!wall(nx,e.y))e.x=nx;if(!wall(e.x,ny))e.y=ny;}if(d<3.2&&los(e.x,e.y,p.x,p.y)&&e.cd<=0){e.cd=1.0+Math.random()*.8;damage(d<1.1?15:8);}}
    }

    function drawRobotSprite(e,dist,angle){
      const screenX=(.5+angle/FOV)*480,size=Math.max(14,Math.min(115,118/dist)),baseY=151+size*.35,x=screenX-size*.35,y=baseY-size;
      const rayIndex=Math.max(0,Math.min(239,Math.floor(screenX/2)));if(depth[rayIndex]<dist-.25)return;
      const s=size/16;ctx.fillStyle=e.flash>0?"#fff":"#111018";ctx.fillRect(x+5*s,y,6*s,4*s);ctx.fillRect(x+3*s,y+4*s,10*s,7*s);ctx.fillRect(x+1*s,y+6*s,3*s,2*s);ctx.fillRect(x+12*s,y+6*s,3*s,2*s);ctx.fillRect(x+4*s,y+11*s,3*s,5*s);ctx.fillRect(x+9*s,y+11*s,3*s,5*s);ctx.fillStyle="#ff5269";ctx.fillRect(x+7*s,y+1.5*s,2*s,1.5*s);ctx.fillStyle="#8e62ff";ctx.fillRect(x+1*s,y+6*s,2*s,1*s);
    }
    function draw(){
      ctx.fillStyle="#211634";ctx.fillRect(0,0,480,135);ctx.fillStyle="#120f18";ctx.fillRect(0,135,480,135);
      for(let y=140;y<270;y+=12){ctx.fillStyle=y%24?"#1b1620":"#221925";ctx.fillRect(0,y,480,1)}
      for(let r=0;r<240;r++){
        const angle=p.a-FOV/2+(r/239)*FOV;let rx=p.x,ry=p.y,dist=0,cell=null;const dx=Math.cos(angle)*.02,dy=Math.sin(angle)*.02;while(dist<18){rx+=dx;ry+=dy;dist+=.02;cell=wall(rx,ry);if(cell)break;}const corrected=dist*Math.cos(angle-p.a);depth[r]=corrected;const h=Math.min(240,190/(corrected+.001)),top=135-h/2;const shade=Math.max(.22,1-corrected/12);const base=cell==="2"?[130,52,118]:[48,72,82];ctx.fillStyle=`rgb(${base[0]*shade|0},${base[1]*shade|0},${base[2]*shade|0})`;ctx.fillRect(r*2,top,2,h);if(r%7===0){ctx.fillStyle="rgba(255,255,255,.035)";ctx.fillRect(r*2,top,1,h)}}
      const visible=enemies.filter(e=>e.alive).map(e=>{const dx=e.x-p.x,dy=e.y-p.y;return{e,d:Math.hypot(dx,dy),a:norm(Math.atan2(dy,dx)-p.a)}}).filter(o=>Math.abs(o.a)<FOV*.7).sort((a,b)=>b.d-a.d);for(const o of visible)drawRobotSprite(o.e,o.d,o.a);
      ctx.strokeStyle="#39f2df";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(236,135);ctx.lineTo(244,135);ctx.moveTo(240,131);ctx.lineTo(240,139);ctx.stroke();
      // blaster
      ctx.fillStyle=muzzle>0?"#ffeac0":"#15121c";ctx.fillRect(211,230,58,40);ctx.fillStyle="#41304b";ctx.fillRect(221,220,38,30);ctx.fillStyle="#39f2df";ctx.fillRect(237,218,6,12);ctx.fillStyle="#ff39cb";ctx.fillRect(226,228,28,3);if(muzzle>0){ctx.fillStyle="#ffb84a";ctx.fillRect(234,202,12,18);ctx.fillStyle="#fff";ctx.fillRect(237,197,6,10)}
      ctx.fillStyle="rgba(5,4,11,.82)";ctx.fillRect(7,27,150,18);ctx.fillStyle="#fff";ctx.font="7px monospace";ctx.fillText("JESSIE // HP",12,36);ctx.fillStyle="#35121d";ctx.fillRect(61,31,85,7);ctx.fillStyle=p.hp>35?"#39f2df":"#ff5269";ctx.fillRect(61,31,Math.max(0,85*p.hp/100),7);ctx.fillStyle="#fff";ctx.fillText(`CYBORGS ${score}/${enemies.length}`,386,36);
      if(hurt>0){ctx.fillStyle=`rgba(255,40,80,${hurt*.28})`;ctx.fillRect(0,0,480,270)}
      // micro minimap
      const scale=3;ctx.fillStyle="rgba(0,0,0,.48)";ctx.fillRect(428,43,44,44);for(let y=0;y<12;y++)for(let x=0;x<12;x++)if(MAP[y][x]!=="0"){ctx.fillStyle=MAP[y][x]==="2"?"#6f315f":"#293d43";ctx.fillRect(432+x*scale,47+y*scale,scale,scale)}ctx.fillStyle="#39f2df";ctx.fillRect(432+p.x*scale-1,47+p.y*scale-1,3,3);ctx.fillStyle="#ff5269";enemies.filter(e=>e.alive).forEach(e=>ctx.fillRect(432+e.x*scale,47+e.y*scale,2,2));
    }
    return {start:reset,update,draw};
  }

  // ------------------------------------------------------------------------
  // 03 — BLASTER DUEL: arcade fighter with melee, jumping and laser shots.
  // ------------------------------------------------------------------------
  function createFighter(){
    gameTitle.textContent="SIM 03 // BLASTER DUEL"; gameMeta.textContent="EP I // CH 01 // ARCADE BUILD";
    makeControls([
      {label:"◀",key:"left"},{label:"▶",key:"right"},{label:"JMP",key:"up",cls:"alt"}
    ],[
      {label:"HIT",key:"punch",cls:"alt"},{label:"BLAST",key:"fire",cls:"action"}
    ]);
    let p,cpu,shots,sparks,time,ended,punchLock,fireLock;
    const ground=220;
    function fighter(x,side){return{x,y:ground-31,w:12,h:31,vx:0,vy:0,hp:100,facing:side,attack:0,shot:0,hit:0,onGround:true,ai:0};}
    function reset(){p=fighter(95,1);cpu=fighter(370,-1);shots=[];sparks=[];time=60;ended=false;punchLock=false;fireLock=false;hideMessage();}
    function burst(x,y,color,n=8){for(let i=0;i<n;i++)sparks.push({x,y,vx:(Math.random()-.5)*75,vy:(Math.random()-.65)*62,l:.25+Math.random()*.25,c:color});}
    function take(target,dmg,knock){if(target.hit>0||ended)return;target.hp=Math.max(0,target.hp-dmg);target.vx=knock;target.hit=.28;audio(110,.06,"square",.03);burst(target.x+6,target.y+13,"#ffb84a");if(target.hp<=0)finish(target===cpu);}
    function finish(playerWon){ended=true;audio(playerWon?900:100,.25,playerWon?"square":"sawtooth",.04);setTimeout(()=>showMessage(playerWon?"ROUND WON":"ROUND LOST",playerWon?"NEXUS enforcer defeated.":"The enforcer put Jessie down.","REMATCH",reset),180);}
    function melee(attacker,target,isPlayer){attacker.attack=.2;audio(220,.035,"square",.02);const reach=25;if(Math.abs((attacker.x+6)-(target.x+6))<reach&&Math.abs(attacker.y-target.y)<18&&Math.sign(target.x-attacker.x)===attacker.facing)take(target,12,isPlayer?70:-70);}
    function blast(attacker,isPlayer){attacker.shot=.42;const dir=attacker.facing;shots.push({x:attacker.x+(dir>0?13:-5),y:attacker.y+12,vx:dir*160,owner:isPlayer});audio(isPlayer?820:510,.04,"square",.03);}
    function physics(f,dt){f.hit=Math.max(0,f.hit-dt);f.attack=Math.max(0,f.attack-dt);f.shot=Math.max(0,f.shot-dt);f.vy+=330*dt;f.x+=f.vx*dt;f.y+=f.vy*dt;f.vx*=Math.pow(.02,dt);if(f.y+f.h>=ground){f.y=ground-f.h;f.vy=0;f.onGround=true;}f.x=Math.max(18,Math.min(450,f.x));}
    function update(dt){
      if(ended)return;time=Math.max(0,time-dt);if(time<=0){finish(p.hp>=cpu.hp);return;}
      const move=(input.has("left")?-1:0)+(input.has("right")?1:0);if(p.hit<=0){p.vx=move*66;if(move)p.facing=Math.sign(move);if(input.has("up")&&p.onGround){p.vy=-145;p.onGround=false;input.delete("up");audio(240,.04,"square",.018);}if(input.has("punch")&&!punchLock&&p.attack<=0){melee(p,cpu,true);punchLock=true;}if(!input.has("punch"))punchLock=false;if(input.has("fire")&&!fireLock&&p.shot<=0){blast(p,true);fireLock=true;}if(!input.has("fire"))fireLock=false;}
      const dx=p.x-cpu.x,dist=Math.abs(dx);cpu.facing=dx>0?1:-1;cpu.ai-=dt;if(cpu.hit<=0){if(dist>66){cpu.vx=Math.sign(dx)*36;}else if(dist<32){cpu.vx=-Math.sign(dx)*26;}else cpu.vx=0;if(cpu.ai<=0){cpu.ai=.35+Math.random()*.65;if(dist<28&&Math.random()<.72)melee(cpu,p,false);else if(cpu.shot<=0&&Math.random()<.65)blast(cpu,false);else if(cpu.onGround&&Math.random()<.2){cpu.vy=-132;cpu.onGround=false;}}}
      physics(p,dt);physics(cpu,dt);
      if(Math.abs(p.x-cpu.x)<12&&Math.abs(p.y-cpu.y)<20){const mid=(p.x+cpu.x)/2;p.x=mid-7;cpu.x=mid+7;}
      for(const s of shots){s.x+=s.vx*dt;const target=s.owner?cpu:p;if(s.x>target.x&&s.x<target.x+target.w&&s.y>target.y&&s.y<target.y+target.h&&target.hit<=0){s.dead=true;take(target,8,s.owner?45:-45);}}
      shots=shots.filter(s=>!s.dead&&s.x>-10&&s.x<490);for(const q of sparks){q.l-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=100*dt;}sparks=sparks.filter(q=>q.l>0);
    }
    function drawStage(){
      const g=ctx.createLinearGradient(0,0,0,270);g.addColorStop(0,"#27173b");g.addColorStop(.48,"#6f294f");g.addColorStop(1,"#110b18");ctx.fillStyle=g;ctx.fillRect(0,0,480,270);ctx.fillStyle="#e36679";ctx.fillRect(212,42,55,55);ctx.fillStyle="#28142d";for(let i=0;i<7;i++){const x=i*78-8,h=52+(i%3)*22;ctx.fillRect(x,170-h,48,h);ctx.fillStyle=i%2?"#ff39cb":"#39f2df";ctx.fillRect(x+8,134-h/2,2,7);ctx.fillStyle="#28142d"}ctx.fillStyle="#0c0911";ctx.fillRect(0,178,480,42);ctx.fillStyle="#36213b";ctx.fillRect(0,178,480,3);for(let x=0;x<480;x+=40){ctx.fillStyle="#1e1525";ctx.fillRect(x,181,4,39);ctx.fillStyle="#4a2d4d";ctx.fillRect(x+4,190,26,3)}ctx.fillStyle="#09070d";ctx.fillRect(0,220,480,50);ctx.fillStyle="#594064";ctx.fillRect(0,220,480,2);ctx.fillStyle="#1f1525";for(let x=8;x<480;x+=24)ctx.fillRect(x,229,14,2);
    }
    function drawFighter(f,color,isPlayer){const flash=f.hit>0&&Math.floor(f.hit*28)%2===0;ctx.fillStyle=flash?"#fff":"#09070d";const x=f.x,y=f.y;ctx.fillRect(x+4,y,5,6);ctx.fillRect(x+3,y+6,7,3);ctx.fillRect(x+1,y+9,11,12);ctx.fillRect(x-2,y+11,3,10);ctx.fillRect(x+12,y+11,3,10);ctx.fillRect(x+2,y+21,4,10);ctx.fillRect(x+8,y+21,4,10);ctx.fillStyle=color;ctx.fillRect(x+2,y+10,9,3);ctx.fillRect(f.facing>0?x+13:x-5,y+13,6,2);if(f.attack>0){ctx.fillStyle="#ffb84a";ctx.fillRect(f.facing>0?x+16:x-8,y+11,8,3)}ctx.fillStyle="#f1bba0";ctx.fillRect(x+5,y+2,3,2);ctx.fillStyle=isPlayer?"#39f2df":"#ff5269";ctx.fillRect(x+6,y+3,2,1);}
    function bar(x,y,w,h,hp,color,flip=false){ctx.fillStyle="#170b14";ctx.fillRect(x,y,w,h);ctx.fillStyle="#5b2736";ctx.fillRect(x+2,y+2,w-4,h-4);const fill=(w-4)*hp/100;ctx.fillStyle=color;ctx.fillRect(flip?x+w-2-fill:x+2,y+2,fill,h-4);ctx.strokeStyle="#80657e";ctx.strokeRect(x+.5,y+.5,w-1,h-1);}
    function draw(){
      drawStage();for(const s of shots){ctx.fillStyle=s.owner?"#39f2df":"#ff39cb";ctx.fillRect(s.x,s.y,8,2);ctx.fillStyle="#fff";ctx.fillRect(s.x+(s.vx>0?6:0),s.y,2,1)}sparks.forEach(q=>{ctx.fillStyle=q.c;ctx.fillRect(q.x,q.y,2,2)});drawFighter(p,"#39f2df",true);drawFighter(cpu,"#ff39cb",false);
      bar(14,31,165,13,p.hp,"#39f2df");bar(301,31,165,13,cpu.hp,"#ff39cb",true);ctx.fillStyle="#fff";ctx.font="7px monospace";ctx.fillText("JESSIE",15,27);ctx.textAlign="right";ctx.fillText("NEXUS ENFORCER",465,27);ctx.textAlign="left";ctx.fillStyle="#ffb84a";ctx.font="bold 14px monospace";ctx.fillText(String(Math.ceil(time)).padStart(2,"0"),231,41);
      if(p.attack>0||cpu.attack>0){ctx.fillStyle="rgba(255,184,74,.08)";ctx.fillRect(0,0,480,270)}
    }
    return {start:reset,update,draw};
  }

  window.CADPrototypes={launch};
})();
