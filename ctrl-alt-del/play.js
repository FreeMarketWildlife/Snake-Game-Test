(() => {
  const EPISODES = [
    {
      id: 1,
      roman: "I",
      title: "CTRL ALT DEL",
      subtitle: "A Story By: The Walking Red Flag's",
      chapters: [
        "Intro",
        "The Moral Code",
        "First Strike",
        "Breaking News In Skyview",
        "Reaching Out",
        "The Death of Jessie",
        "Ctrl Alt Del",
        "Aquire This!",
        "The Countdown Begins",
        "Never say Die"
      ]
    },
    {
      id: 2,
      roman: "II",
      title: "A GLITCH IN THE SYSTEM",
      subtitle: "Episode II",
      chapters: [
        "Here Goes Nothing",
        "Activate Project Judas!",
        "Mission Gone Wrong!",
        "Janey Gets Hacked",
        "A Glitch In The System",
        "A Second Chance",
        "Jessy Tells His Story - Remix",
        "Evalyn is Taken, And The Plan To Get Her Back",
        "In The Hallway",
        "Interogation",
        "Hand In Hand (GET OUT OF OUR WAY BILLY!)",
        "Jessie and The Moral Code - Remix"
      ]
    },
    { id: 3, roman: "III", title: "CLASSIFIED", subtitle: "Transmission incomplete", chapters: [], locked: true }
  ];

  const state = { screen: "home", episode: 1 };
  const menuPanel = document.getElementById("menuPanel");
  const modePicker = document.getElementById("modePicker");
  const menuRoot = document.getElementById("menuRoot");
  const statusText = document.getElementById("statusText");
  const wallpaper = document.getElementById("wallpaper");
  const ctx = wallpaper.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const keys = new Set();
  let buttons = [];
  let focusIndex = 0;
  let t = 0;

  function episode(id) { return EPISODES.find(e => e.id === id) || EPISODES[0]; }
  function esc(s) { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

  function beep(freq = 620, dur = .04, type = "square", volume = .025) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      window.__cadAudio ||= new AudioCtx();
      const ac = window.__cadAudio;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type; osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + dur);
      osc.connect(gain).connect(ac.destination); osc.start(); osc.stop(ac.currentTime + dur);
    } catch (_) {}
  }

  function setStatus(text) { statusText.textContent = text; }

  function title(label, meta = "RESISTANCE ARCHIVE") {
    return `<div class="menu-title"><strong>${esc(label)}</strong><span>${esc(meta)}</span></div>`;
  }

  function renderHome() {
    state.screen = "home";
    menuPanel.innerHTML = `${title("MAIN MENU", "CHAPTER ZERO // SIGNAL ACQUIRED")}
      <div class="menu-list">
        <button class="menu-btn primary" data-go="continue">CONTINUE</button>
        <button class="menu-btn" data-go="episodes">NEW GAME</button>
        <button class="menu-btn" data-go="episodes">EPISODE SELECT</button>
        <button class="menu-btn" data-go="chapters">CHAPTER SELECT</button>
        <button class="menu-btn" data-go="lab">PROTOTYPE LAB</button>
        <button class="menu-btn" data-go="intel">FIELD INTEL</button>
      </div>`;
    bindMenuButtons();
    setStatus("UNAUTHORIZED BROADCAST DETECTED");
  }

  function renderEpisodes() {
    state.screen = "episodes";
    menuPanel.innerHTML = `${title("SELECT EPISODE", "CAMPAIGN ROUTING")}
      <div class="episode-list">
        ${EPISODES.map(ep => `<button class="episode-btn" data-ep="${ep.id}" ${ep.locked ? "disabled" : ""}>
          <span class="episode-num">EPISODE ${ep.roman}</span>
          <strong>${esc(ep.title)}</strong>
          <small>${ep.locked ? "NEXUS LOCK // STORY IN DEVELOPMENT" : `${ep.chapters.length} CHAPTERS // ${esc(ep.subtitle)}`}</small>
        </button>`).join("")}
      </div>
      <div class="nav-row"><button class="small-btn" data-go="home">&lt; BACK</button></div>`;
    menuPanel.querySelectorAll("[data-ep]").forEach(btn => btn.addEventListener("click", () => {
      beep(760); state.episode = Number(btn.dataset.ep); renderChapters();
    }));
    bindGeneric();
    setStatus("SELECT AN EPISODE TO DECRYPT");
  }

  function renderChapters() {
    state.screen = "chapters";
    const ep = episode(state.episode);
    if (ep.locked) return renderEpisodes();
    menuPanel.innerHTML = `${title(`EPISODE ${ep.roman} // CHAPTERS`, ep.title)}
      <div class="chapter-grid">
        ${ep.chapters.map((name, i) => `<button class="chapter-btn ${ep.id === 1 && i === 0 ? "weird" : ""}" data-chapter="${i}">
          <span class="idx">${String(i + 1).padStart(2,"0")}</span><span>${esc(name)}</span>
        </button>`).join("")}
      </div>
      <div class="nav-row"><button class="small-btn" data-go="episodes">&lt; EPISODES</button><button class="small-btn" data-go="home">MAIN MENU</button></div>`;
    menuPanel.querySelectorAll("[data-chapter]").forEach(btn => btn.addEventListener("click", () => selectChapter(Number(btn.dataset.chapter))));
    bindGeneric();
    setStatus(`EPISODE ${ep.roman} // ${ep.chapters.length} CHAPTERS AVAILABLE`);
  }

  function selectChapter(index) {
    const ep = episode(state.episode);
    beep(900, .055, "square", .035);
    if (ep.id === 1 && index === 0) {
      triggerChapterOneGlitch();
      return;
    }
    menuPanel.innerHTML = `${title(`CHAPTER ${String(index + 1).padStart(2,"0")}`, ep.chapters[index])}
      <div style="border:1px solid var(--line);background:rgba(9,6,19,.75);padding:12px;font-size:9px;line-height:1.6;color:var(--muted)">
        <strong style="color:var(--text)">MISSION FILE NOT BUILT YET.</strong><br><br>
        Only Episode I, Chapter 1 currently contains playable prototypes. We can build this chapter together later.
      </div>
      <div class="nav-row"><button class="small-btn" data-go="chapters">&lt; BACK TO CHAPTERS</button></div>`;
    bindGeneric();
    setStatus(`CHAPTER ${index + 1} // DATA INCOMPLETE`);
  }

  function triggerChapterOneGlitch() {
    setStatus("ERROR // THREE EXECUTABLES FOUND");
    let flashes = 0;
    const id = setInterval(() => {
      document.body.style.filter = flashes % 2 ? "hue-rotate(55deg) contrast(1.35)" : "none";
      flashes++;
      if (flashes > 5) {
        clearInterval(id); document.body.style.filter = "none";
        modePicker.classList.remove("hidden");
        beep(160, .22, "sawtooth", .04);
      }
    }, 70);
  }

  function renderLab() {
    state.screen = "lab";
    menuPanel.innerHTML = `${title("PROTOTYPE LAB", "CHAPTER ONE // THREE BUILDS")}
      <div style="border:1px solid rgba(255,184,74,.4);background:rgba(30,17,30,.78);padding:12px;font-size:9px;line-height:1.55;color:var(--muted)">
        <strong style="color:var(--amber)">ROUTING ANOMALY SAVED.</strong><br>
        The three Chapter One game experiments can also be launched here at any time.
      </div>
      <div class="nav-row"><button class="small-btn" id="openLab">OPEN THE THREE SIMULATIONS</button><button class="small-btn" data-go="home">&lt; BACK</button></div>`;
    document.getElementById("openLab").addEventListener("click", () => modePicker.classList.remove("hidden"));
    bindGeneric();
    setStatus("LAB ACCESS // UNSAFE BUILDS PRESENT");
  }

  function renderIntel() {
    state.screen = "intel";
    menuPanel.innerHTML = `${title("FIELD INTEL", "WORLD BIBLE // EARLY DRAFT")}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;font-size:8px;line-height:1.55">
        <div style="border:1px solid var(--line);padding:10px;background:rgba(8,6,17,.82)"><b style="color:var(--cyan)">JESSIE</b><br>Male, 20s. Resistance fighter. Human proportions, lean silhouette, laser blaster.</div>
        <div style="border:1px solid var(--line);padding:10px;background:rgba(8,6,17,.82)"><b style="color:var(--pink)">JANE</b><br>Female, 20s. Resistance fighter. Human proportions, agile silhouette, laser blaster.</div>
        <div style="border:1px solid var(--line);padding:10px;background:rgba(8,6,17,.82)"><b style="color:var(--red)">THE NEXUS</b><br>AI superpower controlling the state, surveillance grid, machines and human collaborators.</div>
        <div style="border:1px solid var(--line);padding:10px;background:rgba(8,6,17,.82)"><b style="color:var(--amber)">THE WORLD</b><br>Soft steampunk + vaporwave. Rails, boilers, steel, neon, drones, blasters. No magic.</div>
      </div>
      <div class="nav-row"><button class="small-btn" data-go="home">&lt; BACK</button></div>`;
    bindGeneric();
    setStatus("FIELD INTEL // ENCRYPTED");
  }

  function renderContinue() {
    state.episode = 1;
    renderChapters();
    setStatus("CONTINUE // EPISODE I");
  }

  function go(name) {
    beep(650);
    if (name === "home") renderHome();
    if (name === "episodes") renderEpisodes();
    if (name === "chapters") renderChapters();
    if (name === "continue") renderContinue();
    if (name === "lab") renderLab();
    if (name === "intel") renderIntel();
  }

  function bindGeneric() {
    menuPanel.querySelectorAll("[data-go]").forEach(btn => btn.addEventListener("click", () => go(btn.dataset.go)));
  }

  function bindMenuButtons() {
    bindGeneric();
    buttons = [...menuPanel.querySelectorAll(".menu-btn")];
    focusIndex = 0;
    buttons[0]?.focus();
  }

  document.getElementById("pickerBack").addEventListener("click", () => {
    beep(420); modePicker.classList.add("hidden"); renderChapters();
  });

  modePicker.querySelectorAll("[data-mode]").forEach(card => card.addEventListener("click", () => {
    beep(980, .06, "square", .04);
    modePicker.classList.add("hidden");
    window.CADPrototypes?.launch(card.dataset.mode);
  }));

  window.addEventListener("keydown", e => {
    keys.add(e.key.toLowerCase());
    if (state.screen === "home" && ["arrowdown","arrowup"].includes(e.key.toLowerCase())) {
      e.preventDefault();
      focusIndex += e.key === "ArrowDown" ? 1 : -1;
      focusIndex = (focusIndex + buttons.length) % buttons.length;
      buttons[focusIndex]?.focus();
    }
    if (e.key === "Escape" && !modePicker.classList.contains("hidden")) modePicker.classList.add("hidden");
  });
  window.addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));

  // Animated horizontal pixel wallpaper.
  const buildings = [];
  const stars = [];
  const drones = [];
  let seed = 1337;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

  for (let i=0;i<100;i++) stars.push({x:Math.floor(rand()*480),y:Math.floor(rand()*115),p:rand()*20});
  let bx=-4;
  while(bx<486){ const w=8+Math.floor(rand()*22),h=38+Math.floor(rand()*92); buildings.push({x:bx,w,h,top:rand()>.72,ant:rand()>.76,c:rand()>.5}); bx+=w-1; }
  for(let i=0;i<5;i++) drones.push({x:rand()*480,y:38+rand()*82,s:.15+rand()*.2,p:rand()*200});

  function human(x,y,accent,hair=false){
    ctx.fillStyle="#05040a"; ctx.fillRect(x,y-19,3,4); if(hair){ctx.fillRect(x-1,y-19,1,7);ctx.fillRect(x+3,y-18,1,6)}
    ctx.fillRect(x,y-15,3,2);ctx.fillRect(x-1,y-13,5,8);ctx.fillRect(x-2,y-12,1,7);ctx.fillRect(x+4,y-12,1,7);ctx.fillRect(x-1,y-5,2,5);ctx.fillRect(x+2,y-5,2,5);
    ctx.fillStyle=accent;ctx.fillRect(x,y-12,3,2);
  }

  function drawWallpaper(){
    t++;
    const g=ctx.createLinearGradient(0,0,0,270);g.addColorStop(0,"#16132f");g.addColorStop(.38,"#4b2351");g.addColorStop(.67,"#b24f61");g.addColorStop(1,"#0b0713");ctx.fillStyle=g;ctx.fillRect(0,0,480,270);
    ctx.fillStyle="#e16a80";ctx.fillRect(330,43,48,48);ctx.fillStyle="#cf5374";for(let i=0;i<5;i++)ctx.fillRect(327,53+i*8,54,2);
    stars.forEach((s,i)=>{ctx.fillStyle=((Math.floor(t/18)+i+Math.floor(s.p))%5)?"#d2b6de":"#694a7d";ctx.fillRect(s.x,s.y,1,1)});
    ctx.fillStyle="rgba(33,17,51,.58)";ctx.fillRect(0,125,480,44);
    buildings.forEach((b,i)=>{const y=211-b.h;ctx.fillStyle=b.c?"#15152b":"#1d142a";ctx.fillRect(b.x,y,b.w,b.h);if(b.top){ctx.fillStyle="#24183b";ctx.fillRect(b.x+2,y-8,Math.max(3,b.w-5),8)}if(b.ant){ctx.fillRect(b.x+Math.floor(b.w/2),y-17,1,17);ctx.fillStyle=i%2?"#ff39cb":"#39f2df";ctx.fillRect(b.x+Math.floor(b.w/2),y-18,1,1)}for(let r=0;r<7;r++){const wx=b.x+2+((r*5+i*3)%Math.max(3,b.w-3)),wy=y+7+((r*11+i)%Math.max(9,b.h-11));ctx.fillStyle=(r+i+Math.floor(t/28))%5===0?"#ff39cb":"#6db5b0";ctx.fillRect(wx,wy,1,2)}});
    ctx.fillStyle="#07060d";ctx.fillRect(0,198,480,8);ctx.fillStyle="#3b2946";ctx.fillRect(0,198,480,1);for(let x=8;x<480;x+=27)ctx.fillRect(x,206,2,27);
    const train=(t*.7)%560-60;ctx.fillStyle="#0d0d18";ctx.fillRect(Math.floor(train),188,48,8);ctx.fillStyle="#39f2df";ctx.fillRect(Math.floor(train+4),191,35,1);ctx.fillStyle="#ff39cb";ctx.fillRect(Math.floor(train+43),190,2,2);
    ctx.fillStyle="#030309";ctx.fillRect(0,235,480,35);ctx.fillStyle="#2a1a32";ctx.fillRect(0,233,480,2);
    human(185,234,"#39f2df");human(200,234,"#ff39cb",true);
    drones.forEach((d,i)=>{const x=((d.x+t*d.s+d.p)%520)-20,y=d.y+Math.sin((t+d.p)/35)*2;ctx.fillStyle="#08070d";ctx.fillRect(x|0,y|0,9,3);ctx.fillRect((x+3)|0,(y-2)|0,3,2);ctx.fillStyle=i%2?"#ff39cb":"#39f2df";ctx.fillRect((x+4)|0,(y+3)|0,1,1)});
    if(Math.floor(t/47)%19===0){ctx.fillStyle="rgba(57,242,223,.2)";ctx.fillRect(0,101,480,1);ctx.fillStyle="rgba(255,57,203,.17)";ctx.fillRect(70,178,300,2)}
    requestAnimationFrame(drawWallpaper);
  }

  renderHome();
  drawWallpaper();
})();
