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
  const touch = { x:0, y:0, look:0 };
  let active = null;
  let last = 0;
  let raf = 0;
  let running = false;

  const keyMap = {
    arrowleft:"left", a:"strafeLeft", arrowright:"right", d:"strafeRight",
    arrowup:"up", w:"up", arrowdown:"down", s:"down",
    " ":"fire", j:"punch", k:"fire", e:"punch", shift:"punch"
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

  function isGameGesture(event) {
    const target=event.target;
    return running && (target === shell || (target instanceof Node && shell.contains(target)));
  }

  function releaseInputs() {
    input.clear();touch.x=0;touch.y=0;touch.look=0;
    controls.querySelectorAll(".pressed").forEach(node=>node.classList.remove("pressed"));
    const knob=controls.querySelector(".stick-knob");
    if(knob)knob.style.transform="translate(-50%,-50%)";
  }

  ["selectstart","contextmenu","dragstart","gesturestart","gesturechange","gestureend"].forEach(type=>{
    window.addEventListener(type,event=>{if(isGameGesture(event))event.preventDefault();},{passive:false,capture:true});
  });
  window.addEventListener("touchmove",event=>{if(isGameGesture(event))event.preventDefault();},{passive:false,capture:true});
  window.addEventListener("pointercancel",releaseInputs,{capture:true});
  window.addEventListener("touchcancel",releaseInputs,{capture:true});
  window.addEventListener("blur",releaseInputs);
  window.addEventListener("pagehide",releaseInputs);
  window.addEventListener("orientationchange",releaseInputs);
  document.addEventListener("visibilitychange",()=>{if(document.hidden)releaseInputs();});

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

  function makeControls({ look=false, jump=true } = {}) {
    touch.x=0; touch.y=0; touch.look=0;
    controls.innerHTML = `
      ${look ? '<div class="look-zone" aria-label="Drag to look"><span class="look-hint">DRAG TO LOOK</span></div>' : ''}
      <div class="virtual-stick" aria-label="Movement control">
        <span class="stick-caption">MOVE</span><span class="stick-cross"></span><span class="stick-knob"></span>
      </div>
      <div class="action-cluster">
        ${jump ? '<button type="button" class="touch-btn jump" data-key="up">JUMP</button>' : '<span></span>'}
        <button type="button" class="touch-btn punch" data-key="punch">PUNCH</button>
        <button type="button" class="touch-btn fire" data-key="fire">FIRE</button>
      </div>
      <div class="desktop-hint">${look ? 'WASD MOVE // DRAG OR ARROWS LOOK // SPACE FIRE // E PUNCH' : 'A/D MOVE // W JUMP // SPACE FIRE // E PUNCH'}</div>`;

    const stick=controls.querySelector(".virtual-stick");
    const knob=controls.querySelector(".stick-knob");
    let stickPointer=null;
    const moveStick=e=>{
      const box=stick.getBoundingClientRect();
      const radius=box.width*.34;
      let dx=e.clientX-(box.left+box.width/2),dy=e.clientY-(box.top+box.height/2);
      const length=Math.hypot(dx,dy)||1;
      if(length>radius){dx=dx/length*radius;dy=dy/length*radius;}
      touch.x=dx/radius;touch.y=dy/radius;
      knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
    };
    stick.addEventListener("pointerdown",e=>{e.preventDefault();stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);moveStick(e);});
    stick.addEventListener("pointermove",e=>{if(e.pointerId===stickPointer)moveStick(e);});
    const resetStick=e=>{if(e.pointerId!==stickPointer)return;stickPointer=null;touch.x=0;touch.y=0;knob.style.transform="translate(-50%,-50%)";};
    stick.addEventListener("pointerup",resetStick);stick.addEventListener("pointercancel",resetStick);stick.addEventListener("lostpointercapture",resetStick);

    controls.querySelectorAll("[data-key]").forEach(b=>{
      const key=b.dataset.key;
      const on=e=>{e.preventDefault();try{b.setPointerCapture?.(e.pointerId);}catch(_){}input.add(key);b.classList.add("pressed");};
      const off=e=>{e.preventDefault();input.delete(key);b.classList.remove("pressed");};
      b.addEventListener("pointerdown",on);b.addEventListener("pointerup",off);b.addEventListener("pointercancel",off);b.addEventListener("lostpointercapture",off);
    });

    const lookZone=controls.querySelector(".look-zone");
    if(lookZone){
      let lookPointer=null,lastX=0;
      lookZone.addEventListener("pointerdown",e=>{e.preventDefault();lookPointer=e.pointerId;lastX=e.clientX;lookZone.setPointerCapture(e.pointerId);lookZone.classList.add("active");});
      lookZone.addEventListener("pointermove",e=>{if(e.pointerId!==lookPointer)return;touch.look+=(e.clientX-lastX)*.012;lastX=e.clientX;});
      const endLook=e=>{if(e.pointerId!==lookPointer)return;lookPointer=null;lookZone.classList.remove("active");};
      lookZone.addEventListener("pointerup",endLook);lookZone.addEventListener("pointercancel",endLook);lookZone.addEventListener("lostpointercapture",endLook);
    }
  }

  function showMessage(title, text, buttonText="RESTART", callback=null) {
    gameMessage.innerHTML=`<strong>${title}</strong><span>${text}</span>${callback?`<button id="messageAction">${buttonText}</button>`:""}`;
    gameMessage.classList.remove("hidden");
    if(callback) document.getElementById("messageAction").onclick=()=>{gameMessage.classList.add("hidden");callback();};
  }
  function hideMessage(){ gameMessage.classList.add("hidden"); gameMessage.innerHTML=""; }

  function launch(mode) {
    stop();releaseInputs();hideMessage();document.getSelection?.()?.removeAllRanges();shell.classList.remove("hidden");shell.classList.add("game-input-active");running=true;last=performance.now();
    if(mode==="platformer") active=createPlatformer();
    if(mode==="fps") active=createFPS();
    if(!active){running=false;shell.classList.add("hidden");return;}
    active?.start?.();
    loop(last);
  }

  function stop() {
    running=false;cancelAnimationFrame(raf);releaseInputs();active?.stop?.();active=null;controls.innerHTML="";shell.classList.remove("game-input-active");
  }

  exitButton.addEventListener("click",()=>{ audio(220,.06); stop(); shell.classList.add("hidden"); hideMessage(); });

  function loop(now){
    if(!running||!active)return;
    const dt=Math.min(.035,(now-last)/1000||.016);last=now;
    active.update(dt);active.draw();raf=requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------------------
  // 01 — RUN-AND-GUN: the core campaign combat prototype.
  // ------------------------------------------------------------------------
  function createPlatformer(){
    gameTitle.textContent="SIM 01 // RUN-AND-GUN"; gameMeta.textContent="EP I // CH 01 // INTRO";
    makeControls({ jump:true });

    let p, bullets, enemyBullets, enemies, particles, score, spawnClock, elapsed, dead;
    const platforms=[{x:0,y:234,w:480,h:36},{x:102,y:190,w:76,h:7},{x:255,y:172,w:78,h:7},{x:372,y:205,w:63,h:7}];

    function reset(){
      p={x:60,y:207,w:8,h:25,vx:0,vy:0,onGround:false,facing:1,hp:100,shot:0,punch:0,punchLock:false,inv:0};
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
      if(dead)return; elapsed+=dt;p.shot=Math.max(0,p.shot-dt);p.punch=Math.max(0,p.punch-dt);p.inv=Math.max(0,p.inv-dt);
      const keyboardMove=(input.has("left")||input.has("strafeLeft")?-1:0)+(input.has("right")||input.has("strafeRight")?1:0);
      const move=Math.abs(touch.x)>.12?touch.x:keyboardMove;p.vx=move*82;if(Math.abs(move)>.08)p.facing=Math.sign(move);
      if(input.has("up")&&p.onGround){p.vy=-165;p.onGround=false;audio(260,.05,"square",.02);input.delete("up");}
      if(input.has("fire")&&p.shot<=0){p.shot=.19;const bx=p.facing>0?p.x+p.w+1:p.x-5;bullets.push({x:bx,y:p.y+9,w:6,h:2,vx:p.facing*235});audio(880,.04,"square",.025);}
      if(input.has("punch")&&!p.punchLock&&p.punch<=0){
        p.punch=.18;p.punchLock=true;audio(170,.04,"square",.022);
        const hitbox={x:p.facing>0?p.x+p.w:p.x-17,y:p.y+4,w:17,h:17};
        for(const e of enemies){if(!e.dead&&rectHit(hitbox,e)){e.hp-=2;e.flash=.14;burst(e.x+e.w/2,e.y+e.h/2,"#ffb84a",8);if(e.hp<=0){e.dead=true;score++;audio(1050,.06,"square",.024);}}}
      }
      if(!input.has("punch"))p.punchLock=false;
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
    function drawHuman(x,y,face,blink,punching){ctx.fillStyle=blink?"#fff":"#0a0810";ctx.fillRect(x+2,y,4,5);ctx.fillRect(x+2,y+5,4,3);ctx.fillRect(x,y+8,8,10);ctx.fillRect(x-2,y+10,2,9);ctx.fillRect(x+8,y+10,2,9);ctx.fillRect(x,y+18,3,7);ctx.fillRect(x+5,y+18,3,7);ctx.fillStyle="#39f2df";ctx.fillRect(x+1,y+9,6,2);ctx.fillStyle="#ff39cb";ctx.fillRect(face>0?x+9:x-4,y+12,5,2);if(punching){ctx.fillStyle="#ffb84a";ctx.fillRect(face>0?x+14:x-9,y+10,8,3);}}
    function drawRobot(e){const flash=e.flash>0;ctx.fillStyle=flash?"#fff":"#14131b";if(e.kind==="walker"){ctx.fillRect(e.x+2,e.y,7,6);ctx.fillRect(e.x,e.y+6,11,10);ctx.fillRect(e.x+1,e.y+16,3,8);ctx.fillRect(e.x+7,e.y+16,3,8);ctx.fillStyle="#ff5269";ctx.fillRect(e.x+4,e.y+2,3,2);ctx.fillStyle="#8e62ff";ctx.fillRect(e.x-4,e.y+8,5,3);}else{ctx.fillRect(e.x,e.y+2,16,5);ctx.fillRect(e.x+5,e.y,6,9);ctx.fillStyle="#ff5269";ctx.fillRect(e.x+7,e.y+3,2,2);ctx.fillStyle="#8e62ff";ctx.fillRect(e.x-3,e.y+4,3,1);ctx.fillRect(e.x+16,e.y+4,3,1);}}

    function draw(){
      skyline();for(const plat of platforms){ctx.fillStyle=plat.y>=230?"#09080f":"#16121e";ctx.fillRect(plat.x,plat.y,plat.w,plat.h);ctx.fillStyle="#4f3859";ctx.fillRect(plat.x,plat.y,plat.w,2);for(let x=plat.x+5;x<plat.x+plat.w;x+=13){ctx.fillStyle="#2b2231";ctx.fillRect(x,plat.y+3,2,3)}}
      for(const b of bullets){ctx.fillStyle="#39f2df";ctx.fillRect(b.x,b.y,b.w,b.h);ctx.fillStyle="#fff";ctx.fillRect(b.x+(b.vx>0?4:0),b.y,2,1)}for(const b of enemyBullets){ctx.fillStyle="#ff39cb";ctx.fillRect(b.x,b.y,b.w,b.h)}
      enemies.forEach(drawRobot);particles.forEach(q=>{ctx.fillStyle=q.color;ctx.fillRect(q.x|0,q.y|0,2,2)});drawHuman(p.x|0,p.y|0,p.facing,p.inv>0&&Math.floor(p.inv*20)%2===0,p.punch>0);
      ctx.fillStyle="rgba(4,3,9,.82)";ctx.fillRect(7,27,128,18);ctx.fillStyle="#fff";ctx.font="7px monospace";ctx.fillText("JESSIE // HP",12,36);ctx.fillStyle="#30131f";ctx.fillRect(61,31,66,7);ctx.fillStyle=p.hp>35?"#39f2df":"#ff5269";ctx.fillRect(61,31,Math.max(0,66*p.hp/100),7);ctx.fillStyle="#fff";ctx.fillText(`ROBOTS ${score}`,390,37);
    }
    return {start:reset,update,draw};
  }

  // ------------------------------------------------------------------------
  // 02 — NEXUS FPS: ray-cast combat with mobile joystick + drag look.
  // ------------------------------------------------------------------------
  function createFPS(){
    gameTitle.textContent="SIM 02 // NEXUS FPS"; gameMeta.textContent="EP I // CH 01 // DOOM-STYLE ROUTE";
    makeControls({ look:true, jump:false });

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
    let p,enemies,score,dead,muzzle,melee,hurt,punchLock,depth;
    const FOV=Math.PI/3;
    const wall=(x,y)=>{const X=Math.floor(x),Y=Math.floor(y);return MAP[Y]?.[X]&&MAP[Y][X]!=="0"?MAP[Y][X]:null;};
    function reset(){p={x:1.75,y:1.75,a:0,hp:100,fire:0};enemies=[{x:5.5,y:1.6,hp:2},{x:8.4,y:3.2,hp:2},{x:3.6,y:5.7,hp:2},{x:8.5,y:6.5,hp:2},{x:2.4,y:9.1,hp:2},{x:9.4,y:9.2,hp:3}].map((e,i)=>({...e,cd:.7+i*.16,flash:0,alive:true}));score=0;dead=false;muzzle=0;melee=0;hurt=0;punchLock=false;depth=new Array(240).fill(99);hideMessage();}
    function norm(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;}
    function clearMove(nx,ny){return !wall(nx-.15,ny-.15)&&!wall(nx+.15,ny-.15)&&!wall(nx-.15,ny+.15)&&!wall(nx+.15,ny+.15);}
    function rayDistance(angle,max=20){let x=p.x,y=p.y;const dx=Math.cos(angle)*.025,dy=Math.sin(angle)*.025;for(let d=0;d<max;d+=.025){x+=dx;y+=dy;if(wall(x,y))return d;}return max;}
    function los(ax,ay,bx,by){const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy),steps=Math.ceil(len/.08);for(let i=1;i<steps;i++){const q=i/steps;if(wall(ax+dx*q,ay+dy*q))return false;}return true;}
    function shoot(){
      muzzle=.12;audio(720,.05,"sawtooth",.04);let best=null,bestAngle=.13;
      for(const e of enemies){if(!e.alive)continue;const a=Math.abs(norm(Math.atan2(e.y-p.y,e.x-p.x)-p.a)),d=Math.hypot(e.x-p.x,e.y-p.y);if(a<bestAngle&&los(p.x,p.y,e.x,e.y)){best={e,d};bestAngle=a;}}
      if(best){best.e.hp--;best.e.flash=.14;audio(1500,.03,"square",.025);if(best.e.hp<=0){best.e.alive=false;score++;audio(100,.11,"sawtooth",.03);if(score===enemies.length){setTimeout(()=>showMessage("CORRIDOR CLEARED","Every NEXUS unit in this simulation is down.","RUN AGAIN",reset),180);}}}
    }
    function punch(){
      melee=.2;audio(145,.045,"square",.025);let best=null,bestDistance=1.25;
      for(const e of enemies){if(!e.alive)continue;const angle=Math.abs(norm(Math.atan2(e.y-p.y,e.x-p.x)-p.a)),distance=Math.hypot(e.x-p.x,e.y-p.y);if(distance<bestDistance&&angle<.62&&los(p.x,p.y,e.x,e.y)){best=e;bestDistance=distance;}}
      if(best){best.hp-=2;best.flash=.18;audio(1050,.05,"square",.03);if(best.hp<=0){best.alive=false;score++;if(score===enemies.length)setTimeout(()=>showMessage("CORRIDOR CLEARED","Every NEXUS unit in this simulation is down.","RUN AGAIN",reset),180);}}
    }
    function damage(n){if(hurt>0||dead)return;p.hp-=n;hurt=.45;audio(95,.1,"sawtooth",.045);if(p.hp<=0){dead=true;showMessage("NEXUS HAS YOU",`Cyborg units destroyed: ${score}/${enemies.length}.`,"RETRY",reset);}}
    function update(dt){
      if(dead)return;muzzle=Math.max(0,muzzle-dt);melee=Math.max(0,melee-dt);hurt=Math.max(0,hurt-dt);p.fire=Math.max(0,p.fire-dt);
      const turn=(input.has("left")?-1:0)+(input.has("right")?1:0);p.a+=turn*1.9*dt+touch.look;touch.look=0;
      let forward=(input.has("up")?1:0)+(input.has("down")?-1:0)-touch.y;
      let strafe=(input.has("strafeLeft")?-1:0)+(input.has("strafeRight")?1:0)+touch.x;
      const magnitude=Math.max(1,Math.hypot(forward,strafe));forward/=magnitude;strafe/=magnitude;
      if(Math.abs(forward)>.04||Math.abs(strafe)>.04){const speed=2.05*dt,nx=p.x+(Math.cos(p.a)*forward-Math.sin(p.a)*strafe)*speed,ny=p.y+(Math.sin(p.a)*forward+Math.cos(p.a)*strafe)*speed;if(clearMove(nx,p.y))p.x=nx;if(clearMove(p.x,ny))p.y=ny;}
      if(input.has("fire")&&p.fire<=0){shoot();p.fire=.2;}
      if(input.has("punch")&&!punchLock&&melee<=0){punch();punchLock=true;}if(!input.has("punch"))punchLock=false;
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
      const weaponY=melee>0?-10:0;ctx.fillStyle=muzzle>0?"#ffeac0":"#15121c";ctx.fillRect(211,230+weaponY,58,40);ctx.fillStyle="#41304b";ctx.fillRect(221,220+weaponY,38,30);ctx.fillStyle="#39f2df";ctx.fillRect(237,218+weaponY,6,12);ctx.fillStyle="#ff39cb";ctx.fillRect(226,228+weaponY,28,3);if(muzzle>0){ctx.fillStyle="#ffb84a";ctx.fillRect(234,202,12,18);ctx.fillStyle="#fff";ctx.fillRect(237,197,6,10)}if(melee>0){ctx.fillStyle="#ffb84a";ctx.fillRect(276,202,30,18);ctx.fillStyle="#f1bba0";ctx.fillRect(301,198,17,14);}
      ctx.fillStyle="rgba(5,4,11,.82)";ctx.fillRect(7,27,150,18);ctx.fillStyle="#fff";ctx.font="7px monospace";ctx.fillText("JESSIE // HP",12,36);ctx.fillStyle="#35121d";ctx.fillRect(61,31,85,7);ctx.fillStyle=p.hp>35?"#39f2df":"#ff5269";ctx.fillRect(61,31,Math.max(0,85*p.hp/100),7);ctx.fillStyle="#fff";ctx.fillText(`CYBORGS ${score}/${enemies.length}`,386,36);
      if(hurt>0){ctx.fillStyle=`rgba(255,40,80,${hurt*.28})`;ctx.fillRect(0,0,480,270)}
      // micro minimap
      const scale=3;ctx.fillStyle="rgba(0,0,0,.48)";ctx.fillRect(428,43,44,44);for(let y=0;y<12;y++)for(let x=0;x<12;x++)if(MAP[y][x]!=="0"){ctx.fillStyle=MAP[y][x]==="2"?"#6f315f":"#293d43";ctx.fillRect(432+x*scale,47+y*scale,scale,scale)}ctx.fillStyle="#39f2df";ctx.fillRect(432+p.x*scale-1,47+p.y*scale-1,3,3);ctx.fillStyle="#ff5269";enemies.filter(e=>e.alive).forEach(e=>ctx.fillRect(432+e.x*scale,47+e.y*scale,2,2));
    }
    return {start:reset,update,draw};
  }

  window.CADPrototypes={launch};
})();
