const EPISODES = [
  {
    id: 1,
    roman: "I",
    title: "CTRL ALT DEL",
    subtitle: "A Story By: The Walking Red Flags",
    year: 2025,
    locked: false,
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
    subtitle: "Ctrl Alt Del Episode II",
    year: 2025,
    locked: false,
    chapters: [
      "Here Goes Nothing",
      "Activate Project Judas!",
      "Mission Gone Wrong!",
      "Janey Gets Hacked",
      "A Glitch In The System",
      "A Second Chance",
      "Jessy Tells His Story (Remix (Chapter Ten: Never Say Die))",
      "Evalyn is Taken, And The Plan To Get Her Back",
      "In The Hallway",
      "Interogation",
      "Hand In Hand (GET OUT OF OUR WAY BILLY!)",
      "Jessie and The Moral Code (Remix ( Chapter Two: The Moral Code))"
    ]
  },
  {
    id: 3,
    roman: "III",
    title: "CLASSIFIED",
    subtitle: "Transmission incomplete",
    year: null,
    locked: true,
    chapters: []
  }
];

const state = {
  screen: "main",
  episodeId: Number(localStorage.getItem("cad-episode")) || 1,
  chapterIndex: Number(localStorage.getItem("cad-chapter")) || 0,
  motion: localStorage.getItem("cad-motion") !== "off",
  scanlines: localStorage.getItem("cad-scanlines") !== "off",
  bloom: localStorage.getItem("cad-bloom") !== "off"
};

const menu = document.getElementById("mainMenu");
const panel = document.getElementById("contentPanel");
const intelCard = document.getElementById("intelCard");
const menuButtons = [...document.querySelectorAll(".menu-button")];
const canvas = document.getElementById("cityCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
ctx.imageSmoothingEnabled = false;

let focusedMenuIndex = 0;
let animationFrame = null;
let time = 0;

function romanChapter(index) {
  const names = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN"];
  return names[index] || String(index + 1);
}

function getEpisode(id = state.episodeId) {
  return EPISODES.find(ep => ep.id === id) || EPISODES[0];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setScreen(name) {
  state.screen = name;
  if (name === "main") {
    panel.classList.add("hidden");
    menu.classList.remove("hidden");
    intelCard.classList.remove("hidden");
    menuButtons[focusedMenuIndex]?.focus();
    return;
  }

  menu.classList.add("hidden");
  panel.classList.remove("hidden");
  intelCard.classList.add("hidden");

  if (name === "continue") renderContinue();
  if (name === "new-game") renderNewGame();
  if (name === "episodes") renderEpisodes("SELECT EPISODE");
  if (name === "chapters") renderChapterSelect();
  if (name === "options") renderOptions();
  if (name === "extras") renderExtras();
  if (name === "credits") renderCredits();
}

function panelHeader(title, meta = "RESISTANCE ARCHIVE") {
  return `
    <div class="panel-topline">
      <h2>${escapeHtml(title)}</h2>
      <span>${escapeHtml(meta)}</span>
    </div>
  `;
}

function backButton() {
  return `<button class="back-button" data-action="back">&lt; RETURN TO SIGNAL</button>`;
}

function renderContinue() {
  const ep = getEpisode();
  const chapter = ep.chapters[state.chapterIndex] || ep.chapters[0];
  panel.innerHTML = `
    ${panelHeader("CONTINUE", `EPISODE ${ep.roman}`)}
    <div class="briefing">
      <strong>LAST KNOWN POSITION</strong><br>
      Episode ${ep.roman}: ${escapeHtml(ep.title)}<br>
      Chapter ${romanChapter(state.chapterIndex)}: ${escapeHtml(chapter || "Unknown")}
    </div>
    <div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;">
      <button class="action-button" data-action="start-current">RESUME CAMPAIGN</button>
      ${backButton()}
    </div>
  `;
  bindPanelActions();
}

function renderNewGame() {
  panel.innerHTML = `
    ${panelHeader("NEW GAME", "CHOOSE AN ENTRY POINT")}
    <p class="briefing" style="margin-top:0;border-top:0;padding-top:0;">Start the campaign from an available episode. Gameplay is intentionally not implemented yet; this prototype only establishes the presentation and navigation layer.</p>
    <div class="episode-grid" id="episodeGrid"></div>
    <div style="margin-top:14px;">${backButton()}</div>
  `;
  renderEpisodeCards(document.getElementById("episodeGrid"), true);
  bindPanelActions();
}

function renderEpisodes(title = "SELECT EPISODE") {
  panel.innerHTML = `
    ${panelHeader(title, "CAMPAIGN ARCHIVE")}
    <div class="episode-grid" id="episodeGrid"></div>
    <div style="margin-top:14px;">${backButton()}</div>
  `;
  renderEpisodeCards(document.getElementById("episodeGrid"), false);
  bindPanelActions();
}

function renderEpisodeCards(root, newGameMode) {
  const template = document.getElementById("episodeCardTemplate");
  EPISODES.forEach(ep => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.episode = ep.id;
    node.dataset.newGame = newGameMode ? "true" : "false";
    node.disabled = ep.locked;
    node.querySelector(".episode-number").textContent = ep.roman;
    node.querySelector(".episode-lock").textContent = ep.locked ? "NEXUS LOCK // ACCESS DENIED" : "OPEN CHANNEL";
    node.querySelector(".episode-label").textContent = `EPISODE ${ep.roman}`;
    node.querySelector(".episode-title").textContent = ep.title;
    node.querySelector(".episode-meta").textContent = ep.locked
      ? "CHAPTER COUNT UNKNOWN // STORY IN DEVELOPMENT"
      : `${ep.chapters.length} CHAPTERS // ${ep.subtitle}`;
    node.addEventListener("click", () => {
      if (ep.locked) return;
      state.episodeId = ep.id;
      state.chapterIndex = 0;
      saveProgress();
      if (newGameMode) renderEpisodeLaunch(ep);
      else renderChapterSelect(ep.id);
    });
    root.appendChild(node);
  });
}

function renderEpisodeLaunch(ep) {
  panel.innerHTML = `
    ${panelHeader(`EPISODE ${ep.roman}`, "NEW CAMPAIGN")}
    <div class="briefing" style="margin-top:0;">
      <strong>${escapeHtml(ep.title)}</strong><br>
      ${escapeHtml(ep.subtitle)}<br><br>
      ${ep.chapters.length} chapter${ep.chapters.length === 1 ? "" : "s"} detected. Beginning the campaign will stage Chapter One: ${escapeHtml(ep.chapters[0])}.
    </div>
    <div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;">
      <button class="action-button" data-action="begin-episode">BEGIN EPISODE ${ep.roman}</button>
      <button class="back-button" data-action="episodes">CHANGE EPISODE</button>
    </div>
  `;
  bindPanelActions();
}

function renderChapterSelect(forEpisode = state.episodeId) {
  const ep = getEpisode(forEpisode);
  if (ep.locked) {
    renderEpisodes();
    return;
  }
  state.episodeId = ep.id;
  saveProgress();

  panel.innerHTML = `
    ${panelHeader(`EPISODE ${ep.roman} // CHAPTERS`, ep.title)}
    <div class="chapter-list" id="chapterList"></div>
    <div id="chapterBriefing"></div>
    <div style="margin-top:14px;">${backButton()}</div>
  `;

  const list = document.getElementById("chapterList");
  ep.chapters.forEach((chapter, index) => {
    const button = document.createElement("button");
    button.className = "chapter-button";
    button.innerHTML = `
      <span class="chapter-index">${String(index + 1).padStart(2, "0")}</span>
      <span class="chapter-name">${escapeHtml(chapter)}</span>
      <span class="chapter-state ${index === state.chapterIndex ? "ready" : ""}">${index === state.chapterIndex ? "LAST SIGNAL" : "AVAILABLE"}</span>
    `;
    button.addEventListener("click", () => selectChapter(ep, index));
    list.appendChild(button);
  });

  selectChapter(ep, Math.min(state.chapterIndex, ep.chapters.length - 1), false);
  bindPanelActions();
}

function selectChapter(ep, index, focusBriefing = true) {
  state.episodeId = ep.id;
  state.chapterIndex = index;
  saveProgress();
  const briefing = document.getElementById("chapterBriefing");
  if (!briefing) return;
  briefing.innerHTML = `
    <div class="briefing">
      <strong>CHAPTER ${romanChapter(index)} // ${escapeHtml(ep.chapters[index])}</strong><br>
      Mission briefing data has not been authored yet. This slot is ready for us to build together once the menu direction is locked.
      <div style="margin-top:12px;"><button class="action-button" data-action="start-current">START CHAPTER</button></div>
    </div>
  `;
  briefing.querySelector("[data-action='start-current']")?.addEventListener("click", showGameplayPlaceholder);
  if (focusBriefing) briefing.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function renderOptions() {
  panel.innerHTML = `
    ${panelHeader("OPTIONS", "DISPLAY // ACCESSIBILITY")}
    ${optionRow("AMBIENT MOTION", "Drones, steam, lights, skyline motion.", "motion", state.motion)}
    ${optionRow("CRT SCANLINES", "Subtle horizontal signal texture.", "scanlines", state.scanlines)}
    ${optionRow("NEON BLOOM", "Glow around title and broadcast lights.", "bloom", state.bloom)}
    <div style="margin-top:14px;">${backButton()}</div>
  `;
  panel.querySelectorAll(".toggle-button").forEach(button => {
    button.addEventListener("click", () => toggleOption(button.dataset.option));
  });
  bindPanelActions();
}

function optionRow(title, copy, key, enabled) {
  return `
    <div class="option-row">
      <div><strong>${title}</strong><p>${copy}</p></div>
      <button class="toggle-button" data-option="${key}" aria-pressed="${enabled}">${enabled ? "ON" : "OFF"}</button>
    </div>
  `;
}

function toggleOption(key) {
  state[key] = !state[key];
  localStorage.setItem(`cad-${key}`, state[key] ? "on" : "off");
  applyOptions();
  renderOptions();
}

function applyOptions() {
  document.body.classList.toggle("motion-off", !state.motion);
  document.body.classList.toggle("scanlines-off", !state.scanlines);
  document.body.classList.toggle("bloom-off", !state.bloom);
}

function renderExtras() {
  panel.innerHTML = `
    ${panelHeader("EXTRAS", "ARCHIVE OFFLINE")}
    <div class="briefing" style="margin-top:0;">
      <strong>FUTURE ARCHIVE MODULES</strong><br><br>
      // Character dossiers: Jessie, Jane, NEXUS operatives<br>
      // Enemy database: robots, drones, human collaborators<br>
      // Music player: chapter soundtrack archive<br>
      // Concept art and animated wallpaper gallery<br>
      // Lore terminals and recovered resistance transmissions
    </div>
    <div style="margin-top:14px;">${backButton()}</div>
  `;
  bindPanelActions();
}

function renderCredits() {
  panel.innerHTML = `
    ${panelHeader("CREDITS", "TRANSMISSION ORIGIN")}
    <div class="briefing" style="margin-top:0;">
      <strong>CTRL ALT DEL</strong><br>
      Story world based on the Ctrl Alt Del albums by The Walking Red Flag's.<br><br>
      GAME DIRECTION // Phil<br>
      ORIGINAL STORY + MUSIC // The Walking Red Flag's<br>
      PROTOTYPE STATUS // Menu UI only<br><br>
      This temporary build lives inside Snake-Game-Test until the project receives its own repository.
    </div>
    <div style="margin-top:14px;">${backButton()}</div>
  `;
  bindPanelActions();
}

function bindPanelActions() {
  panel.querySelectorAll("[data-action='back']").forEach(button => button.addEventListener("click", () => setScreen("main")));
  panel.querySelectorAll("[data-action='episodes']").forEach(button => button.addEventListener("click", () => renderNewGame()));
  panel.querySelectorAll("[data-action='start-current']").forEach(button => button.addEventListener("click", showGameplayPlaceholder));
  panel.querySelectorAll("[data-action='begin-episode']").forEach(button => button.addEventListener("click", () => {
    state.chapterIndex = 0;
    saveProgress();
    showGameplayPlaceholder();
  }));
}

function showGameplayPlaceholder() {
  const ep = getEpisode();
  const title = ep.chapters[state.chapterIndex] || "Unknown";
  showToast(`GAMEPLAY NOT BUILT YET // EP ${ep.roman} // ${title}`);
}

function showToast(message) {
  document.querySelector(".toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

function saveProgress() {
  localStorage.setItem("cad-episode", String(state.episodeId));
  localStorage.setItem("cad-chapter", String(state.chapterIndex));
}

menuButtons.forEach((button, index) => {
  button.addEventListener("focus", () => focusedMenuIndex = index);
  button.addEventListener("click", () => setScreen(button.dataset.screen));
});

window.addEventListener("keydown", event => {
  if (state.screen !== "main") {
    if (event.key === "Escape") setScreen("main");
    return;
  }
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    focusedMenuIndex += event.key === "ArrowDown" ? 1 : -1;
    focusedMenuIndex = (focusedMenuIndex + menuButtons.length) % menuButtons.length;
    menuButtons[focusedMenuIndex].focus();
  }
});

// ---------------------------------------------------------------------------
// Animated pixel-art skyline. Intentionally low-resolution and scaled with
// nearest-neighbor rendering so the menu feels like a living pixel wallpaper.
// ---------------------------------------------------------------------------

const skyline = [];
const stars = [];
const steam = [];
const drones = [];

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function buildScene() {
  const random = seeded(1987);
  skyline.length = 0;
  stars.length = 0;
  steam.length = 0;
  drones.length = 0;

  for (let i = 0; i < 80; i++) {
    stars.push({ x: Math.floor(random() * 320), y: Math.floor(random() * 95), twinkle: random() * 8 });
  }

  let x = -6;
  while (x < 326) {
    const width = 8 + Math.floor(random() * 18);
    const height = 30 + Math.floor(random() * 72);
    skyline.push({
      x,
      width,
      height,
      tier: random() > .62 ? 1 : 0,
      hue: random(),
      antenna: random() > .72,
      windows: Math.floor(random() * 8)
    });
    x += width - 1;
  }

  for (let i = 0; i < 8; i++) {
    steam.push({ x: 16 + random() * 290, y: 143 + random() * 17, phase: random() * 20, drift: .3 + random() * .7 });
  }

  for (let i = 0; i < 4; i++) {
    drones.push({ x: random() * 320, y: 32 + random() * 58, speed: .05 + random() * .09, phase: random() * 100 });
  }
}

function drawScene() {
  time += state.motion ? 1 : 0;

  // sky
  const grad = ctx.createLinearGradient(0, 0, 0, 180);
  grad.addColorStop(0, "#17122f");
  grad.addColorStop(.42, "#4a214f");
  grad.addColorStop(.7, "#a7465c");
  grad.addColorStop(1, "#130d20");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 320, 180);

  // vapor sun / NEXUS glow
  ctx.fillStyle = "#e75f79";
  ctx.fillRect(218, 34, 34, 34);
  ctx.fillStyle = "#d94f75";
  ctx.fillRect(216, 42, 38, 3);
  ctx.fillRect(216, 51, 38, 2);
  ctx.fillRect(216, 59, 38, 2);

  // stars / distant traffic
  stars.forEach((star, i) => {
    const on = ((Math.floor(time / 20) + i + Math.floor(star.twinkle)) % 4) !== 0;
    ctx.fillStyle = on ? "#d9b7df" : "#704a82";
    ctx.fillRect(star.x, star.y, 1, 1);
  });

  // far haze bands
  ctx.fillStyle = "rgba(30, 16, 52, .55)";
  ctx.fillRect(0, 94, 320, 33);
  ctx.fillStyle = "rgba(255, 44, 207, .07)";
  ctx.fillRect(0, 104 + Math.floor(Math.sin(time / 80) * 2), 320, 5);

  // skyline
  skyline.forEach((building, index) => {
    const baseY = 151;
    const y = baseY - building.height;
    const shade = building.hue > .5 ? "#15152b" : "#1d142a";
    ctx.fillStyle = shade;
    ctx.fillRect(building.x, y, building.width, building.height);

    if (building.tier) {
      ctx.fillStyle = "#22183a";
      ctx.fillRect(building.x + 2, y - 7, Math.max(3, building.width - 5), 7);
    }

    if (building.antenna) {
      ctx.fillStyle = "#29213f";
      ctx.fillRect(building.x + Math.floor(building.width / 2), y - 15, 1, 15);
      ctx.fillStyle = index % 2 ? "#ff2ccf" : "#32f1df";
      ctx.fillRect(building.x + Math.floor(building.width / 2), y - 16, 1, 1);
    }

    for (let row = 0; row < building.windows; row++) {
      const wx = building.x + 2 + ((row * 4 + index * 3) % Math.max(3, building.width - 3));
      const wy = y + 6 + ((row * 9 + index) % Math.max(8, building.height - 10));
      const flicker = (row + index + Math.floor(time / 36)) % 5;
      ctx.fillStyle = flicker === 0 ? "#ff4fcf" : flicker === 1 ? "#55f3e3" : "#b27475";
      ctx.fillRect(wx, wy, 1, 2);
    }
  });

  // elevated rail
  ctx.fillStyle = "#080711";
  ctx.fillRect(0, 137, 320, 5);
  ctx.fillStyle = "#33233e";
  ctx.fillRect(0, 137, 320, 1);
  for (let x = 4; x < 320; x += 17) ctx.fillRect(x, 142, 2, 18);

  // passing mag-rail light
  if (state.motion) {
    const trainX = (time * .48) % 360 - 40;
    ctx.fillStyle = "#0f1020";
    ctx.fillRect(Math.floor(trainX), 130, 35, 6);
    ctx.fillStyle = "#32f1df";
    ctx.fillRect(Math.floor(trainX + 3), 132, 27, 1);
    ctx.fillStyle = "#ff2ccf";
    ctx.fillRect(Math.floor(trainX + 31), 131, 2, 2);
  }

  // foreground rooftop
  ctx.fillStyle = "#05050b";
  ctx.fillRect(0, 158, 320, 22);
  ctx.fillStyle = "#21152d";
  ctx.fillRect(0, 157, 320, 2);
  ctx.fillStyle = "#42304c";
  for (let x = 5; x < 320; x += 23) ctx.fillRect(x, 162, 10, 1);

  // human silhouettes: deliberately adult, non-chibi proportions
  drawHuman(118, 145, "#33d7cf", false);
  drawHuman(130, 145, "#f04fbe", true);

  // steam plumes
  steam.forEach((puff, i) => {
    const lift = state.motion ? ((time * pufferSpeed(puff) + puff.phase * 3) % 22) : 7;
    const px = Math.floor(puff.x + Math.sin((time + puff.phase * 20) / 35) * 2);
    const py = Math.floor(puff.y - lift);
    ctx.fillStyle = i % 2 ? "rgba(108, 88, 129, .35)" : "rgba(146, 109, 144, .28)";
    ctx.fillRect(px, py, 2, 2);
    ctx.fillRect(px + 1, py - 3, 2, 2);
  });

  // drones and surveillance beams
  drones.forEach((drone, i) => {
    const x = state.motion ? ((drone.x + time * drone.speed * 10 + drone.phase) % 350) - 15 : drone.x;
    const y = drone.y + Math.sin((time + drone.phase) / 35) * 2;
    ctx.fillStyle = "#090813";
    ctx.fillRect(Math.floor(x), Math.floor(y), 7, 2);
    ctx.fillRect(Math.floor(x + 2), Math.floor(y - 1), 3, 1);
    ctx.fillStyle = i % 2 ? "#ff2ccf" : "#32f1df";
    ctx.fillRect(Math.floor(x + 3), Math.floor(y + 2), 1, 1);
    if (i === 0) {
      ctx.fillStyle = "rgba(255, 44, 207, .045)";
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 3);
      ctx.lineTo(x - 12, 157);
      ctx.lineTo(x + 18, 157);
      ctx.closePath();
      ctx.fill();
    }
  });

  // intermittent glitch bars
  if (state.motion && Math.floor(time / 53) % 13 === 0) {
    ctx.fillStyle = "rgba(50, 241, 223, .22)";
    ctx.fillRect(0, 63, 320, 1);
    ctx.fillStyle = "rgba(255, 44, 207, .16)";
    ctx.fillRect(47, 118, 208, 2);
  }

  animationFrame = requestAnimationFrame(drawScene);
}

function pufferSpeed(puff) {
  return .04 + puff.drift * .04;
}

function drawHuman(x, groundY, accent, longHair) {
  const bob = state.motion ? Math.floor(Math.sin((time + x) / 42) * .55) : 0;
  const y = groundY + bob;
  ctx.fillStyle = "#05050a";

  // head (2x3), neck, torso, arms, legs — tall human silhouette
  ctx.fillRect(x, y - 14, 2, 3);
  if (longHair) {
    ctx.fillRect(x - 1, y - 14, 1, 5);
    ctx.fillRect(x + 2, y - 13, 1, 4);
  }
  ctx.fillRect(x, y - 11, 2, 1);
  ctx.fillRect(x - 1, y - 10, 4, 6);
  ctx.fillRect(x - 2, y - 9, 1, 6);
  ctx.fillRect(x + 3, y - 9, 1, 6);
  ctx.fillRect(x - 1, y - 4, 2, 4);
  ctx.fillRect(x + 1, y - 4, 2, 4);

  // tiny color accent from jacket / gear
  ctx.fillStyle = accent;
  ctx.fillRect(x, y - 9, 2, 1);
  ctx.fillRect(x + (longHair ? 3 : -2), y - 6, 1, 1);
}

buildScene();
applyOptions();
menuButtons[0]?.focus();
drawScene();
