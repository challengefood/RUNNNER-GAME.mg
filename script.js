/* ============================================================
   MISSION TONTON JAURÈS - RETRO RUNNER (NES-INSPIRED)
   ------------------------------------------------------------
   - Stages: Désert, Forêt, Urbain, Plage, Montagne
   - AZRAEL/GARCIA = Épée + Saut
   - AMARIS/MAYA = Bouclier + Saut
   - Désert: section pyramide avec 2 voies (haut / tunnel), obstacles identiques
   - Fin stage: château + avion d'extraction
   - Lose => restart au début du stage courant
   - Sauvegarde progression localStorage
   - SANS bonus de vol / SANS cadeaux
============================================================ */

(() => {
  "use strict";

  // ---------- DOM ----------
  const introScreen = document.getElementById("introScreen");
  const menuScreen = document.getElementById("menuScreen");
  const gameScreen = document.getElementById("gameScreen");
  const victoryScreen = document.getElementById("victoryScreen");

  const introNextBtn = document.getElementById("introNextBtn");
  const heroGrid = document.getElementById("heroGrid");
  const newGameBtn = document.getElementById("newGameBtn");
  const continueBtn = document.getElementById("continueBtn");
  const resetSaveBtn = document.getElementById("resetSaveBtn");
  const saveInfo = document.getElementById("saveInfo");

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const overlayText = document.getElementById("overlayText");
  const hudScore = document.getElementById("hudScore");
  const hudStage = document.getElementById("hudStage");
  const hudStageName = document.getElementById("hudStageName");
  const hudHero = document.getElementById("hudHero");
  const hudPower = document.getElementById("hudPower");
  const hudTime = document.getElementById("hudTime");

  const btnJump = document.getElementById("btnJump");
  const btnSkill = document.getElementById("btnSkill");
  const btnTunnel = document.getElementById("btnTunnel");
  const btnTop = document.getElementById("btnTop");

  const pauseBtn = document.getElementById("pauseBtn");
  const menuBtn = document.getElementById("menuBtn");

  const finalScore = document.getElementById("finalScore");
  const playAgainBtn = document.getElementById("playAgainBtn");
  const victoryMenuBtn = document.getElementById("victoryMenuBtn");

  // ---------- Config ----------
  const SAVE_KEY = "mission_tonton_save_v2";
  const BEST_KEY = "mission_tonton_best_v2";

  const W = canvas.width;   // 960
  const H = canvas.height;  // 540

  // zone du joueur en écran (camera side-scroller)
  const PLAYER_SCREEN_X = 180;

  // sol principal / tunnel
  const GROUND_Y = 460;               // y haut du sol principal
  const TUNNEL_FLOOR_Y = 520;         // y bas tunnel (approx)
  const TUNNEL_CEIL_Y = 472;          // plafond tunnel

  const PLAYER_W = 44;
  const PLAYER_H = 52;

  const GRAVITY = 1700;
  const JUMP_V = -690;

  const HEROES = [
    {
      id: "AZRAEL",
      emoji: "🦸‍♂️",
      powerName: "ÉPÉE",
      powerType: "sword",
      description: "Attaque à l’épée + saut"
    },
    {
      id: "AMARIS",
      emoji: "🦸‍♀️",
      powerName: "BOUCLIER",
      powerType: "shield",
      description: "Bouclier temporaire + saut"
    },
    {
      id: "GARCIA",
      emoji: "🦹‍♂️",
      powerName: "ÉPÉE",
      powerType: "sword",
      description: "Attaque à l’épée + saut"
    },
    {
      id: "MAYA",
      emoji: "🦹‍♀️",
      powerName: "BOUCLIER",
      powerType: "shield",
      description: "Bouclier temporaire + saut"
    }
  ];

  const STAGES = [
    {
      id: 1,
      name: "DESERT",
      theme: "desert",
      length: 7600,
      speed: 185,
      time: 150,
      split: { start: 2150, end: 3600 }, // zone pyramide/tunnel
      obstacles: ["🌵", "🪨", "📦"]
    },
    {
      id: 2,
      name: "FORET",
      theme: "forest",
      length: 7000,
      speed: 195,
      time: 145,
      split: null,
      obstacles: ["🌳", "🪵", "🦔"]
    },
    {
      id: 3,
      name: "URBAIN",
      theme: "urban",
      length: 7000,
      speed: 205,
      time: 140,
      split: null,
      obstacles: ["🚧", "🛴", "🗑️"]
    },
    {
      id: 4,
      name: "PLAGE",
      theme: "beach",
      length: 7100,
      speed: 210,
      time: 140,
      split: null,
      obstacles: ["🪵", "🦀", "🪨"]
    },
    {
      id: 5,
      name: "MONTAGNE",
      theme: "mountain",
      length: 7400,
      speed: 220,
      time: 135,
      split: null,
      obstacles: ["🪨", "🌲", "🧊"]
    }
  ];

  // ---------- State ----------
  const state = {
    selectedHero: null,
    currentStage: 1,
    unlockedStage: 1,
    totalScore: 0,
    bestScore: 0,

    stage: null,
    objects: [],
    cameraX: 0,

    player: null,
    stageScore: 0,
    timeLeft: 0,

    phase: "idle", // idle | playing | paused | failed | ending
    phaseTimer: 0,

    overlayTimer: 0,

    planeX: W + 220,
    rafId: 0,
    lastTs: 0
  };

  // ---------- Utils ----------
  function showScreen(screen) {
    [introScreen, menuScreen, gameScreen, victoryScreen].forEach(s => s.classList.remove("active"));
    screen.classList.add("active");
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function rectIntersect(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function formatScore(num) {
    return String(Math.max(0, Math.floor(num))).padStart(6, "0");
  }

  function getHeroById(id) {
    return HEROES.find(h => h.id === id) || HEROES[0];
  }

  function stageById(id) {
    return STAGES.find(s => s.id === id) || STAGES[0];
  }

  function isInsideSplit(stage, worldX) {
    return !!stage.split && worldX >= stage.split.start && worldX <= stage.split.end;
  }

  function baseYForRoute(route) {
    const floor = route === "tunnel" ? TUNNEL_FLOOR_Y : GROUND_Y;
    return floor - PLAYER_H;
  }

  function objectY(obj) {
    const floor = obj.route === "tunnel" ? TUNNEL_FLOOR_Y : GROUND_Y;
    return floor - obj.h;
  }

  function setOverlay(text, duration = 1.5) {
    overlayText.textContent = text;
    overlayText.style.display = "block";
    state.overlayTimer = duration;
  }

  function hideOverlay() {
    overlayText.style.display = "none";
    state.overlayTimer = 0;
  }

  // ---------- Save / Load ----------
  function loadProgress() {
    let data = {
      currentStage: 1,
      unlockedStage: 1,
      heroId: "AZRAEL",
      totalScore: 0
    };

    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        data.currentStage = clamp(parsed.currentStage || 1, 1, STAGES.length);
        data.unlockedStage = clamp(parsed.unlockedStage || 1, 1, STAGES.length);
        data.heroId = parsed.heroId || "AZRAEL";
        data.totalScore = Math.max(0, parsed.totalScore || 0);
      }
    } catch {
      // ignore parse errors
    }

    try {
      state.bestScore = Math.max(0, parseInt(localStorage.getItem(BEST_KEY) || "0", 10));
    } catch {
      state.bestScore = 0;
    }

    state.currentStage = data.currentStage;
    state.unlockedStage = data.unlockedStage;
    state.totalScore = data.totalScore;
    state.selectedHero = getHeroById(data.heroId);
  }

  function persistProgress() {
    const payload = {
      currentStage: state.currentStage,
      unlockedStage: state.unlockedStage,
      heroId: state.selectedHero?.id || "AZRAEL",
      totalScore: Math.max(0, Math.floor(state.totalScore))
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  }

  function saveBestIfNeeded() {
    const scoreNow = Math.floor(state.totalScore);
    if (scoreNow > state.bestScore) {
      state.bestScore = scoreNow;
      localStorage.setItem(BEST_KEY, String(state.bestScore));
    }
  }

  function resetSave() {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(BEST_KEY);
    state.currentStage = 1;
    state.unlockedStage = 1;
    state.totalScore = 0;
    state.bestScore = 0;
    if (!state.selectedHero) state.selectedHero = HEROES[0];
    persistProgress();
    refreshSaveInfo();
  }

  function refreshSaveInfo() {
    saveInfo.textContent =
      `Progression: Stage ${state.currentStage} (débloqué jusqu'au stage ${state.unlockedStage}) | Best: ${state.bestScore}`;
  }

  // ---------- Hero cards ----------
  function renderHeroCards() {
    heroGrid.innerHTML = "";

    HEROES.forEach(hero => {
      const card = document.createElement("div");
      card.className = "hero-card";
      if (state.selectedHero?.id === hero.id) card.classList.add("selected");

      card.innerHTML = `
        <div class="hero-emoji">${hero.emoji}</div>
        <div class="hero-name">${hero.id}</div>
        <div class="hero-skill">${hero.description}</div>
      `;

      card.addEventListener("click", () => {
        state.selectedHero = hero;
        newGameBtn.disabled = false;
        [...heroGrid.querySelectorAll(".hero-card")].forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        persistProgress();
      });

      heroGrid.appendChild(card);
    });

    newGameBtn.disabled = !state.selectedHero;
  }

  // ---------- Stage ----------
  function generateStageObjects(stage) {
    const objects = [];
    let x = 620;

    while (x < stage.length - 380) {
      x += randInt(250, 390);

      if (stage.split && x > stage.split.start + 120 && x < stage.split.end - 120) {
        // Obstacles identiques voie haute + tunnel
        const emoji = stage.obstacles[randInt(0, stage.obstacles.length - 1)];
        const h = randInt(36, 56);

        objects.push({
          type: "obstacle",
          x,
          route: "top",
          w: 42,
          h,
          emoji,
          active: true
        });

        objects.push({
          type: "obstacle",
          x,
          route: "tunnel",
          w: 42,
          h,
          emoji,
          active: true
        });
      } else {
        const emoji = stage.obstacles[randInt(0, stage.obstacles.length - 1)];
        const h = randInt(34, 62);
        const w = randInt(36, 58);

        objects.push({
          type: "obstacle",
          x,
          route: "top",
          w,
          h,
          emoji,
          active: true
        });
      }
    }

    return objects;
  }

  function createPlayer() {
    return {
      worldX: 100,
      y: baseYForRoute("top"),
      vy: 0,
      onGround: true,
      route: "top",

      // skill states
      actionTimer: 0,      // épée visuel court
      shieldTimer: 0,      // durée bouclier actif
      shieldCooldown: 0    // recharge bouclier
    };
  }

  function startStage(stageId) {
    state.stage = stageById(stageId);
    state.currentStage = stageId;

    state.timeLeft = state.stage.time;
    state.stageScore = 0;

    state.phase = "playing";
    state.phaseTimer = 0;
    state.lastTs = 0;

    state.cameraX = 0;
    state.objects = generateStageObjects(state.stage);
    state.player = createPlayer();
    state.planeX = W + 220;

    persistProgress();
    updateHUD();
    setOverlay(`STAGE ${state.stage.id} - ${state.stage.name}`, 1.8);
  }

  function startNewGame() {
    if (!state.selectedHero) return;

    state.currentStage = 1;
    state.unlockedStage = 1;
    state.totalScore = 0;
    persistProgress();

    showScreen(gameScreen);
    startStage(1);
    ensureLoop();
  }

  function continueGame() {
    if (!state.selectedHero) state.selectedHero = HEROES[0];

    showScreen(gameScreen);
    startStage(state.currentStage);
    ensureLoop();
  }

  function failStage(reason = "Obstacle touché") {
    state.phase = "failed";
    state.phaseTimer = 1.35;
    setOverlay(`💥 ${reason} - Reprise Stage ${state.currentStage}`, 1.35);
    // On garde currentStage pour recommencer le stage courant
    persistProgress();
  }

  function beginStageEnding() {
    state.phase = "ending";
    state.phaseTimer = 0;
    state.planeX = W + 220;
    setOverlay("🏰 Château en vue... Extraction ✈️", 1.8);
  }

  function completeStage() {
    // Ajouter score stage + bonus temps
    const stageTotal = Math.max(0, Math.floor(state.stageScore + state.timeLeft * 10));
    state.totalScore += stageTotal;
    saveBestIfNeeded();

    if (state.currentStage < STAGES.length) {
      state.currentStage += 1;
      state.unlockedStage = Math.max(state.unlockedStage, state.currentStage);
      persistProgress();
      refreshSaveInfo();
      startStage(state.currentStage);
      return;
    }

    // Fin finale
    state.unlockedStage = STAGES.length;
    persistProgress();
    refreshSaveInfo();

    finalScore.textContent = String(Math.floor(state.totalScore));
    showScreen(victoryScreen);
    state.phase = "idle";
  }

  // ---------- Inputs ----------
  function jump() {
    if (state.phase !== "playing") return;
    const p = state.player;
    if (!p) return;

    if (p.onGround) {
      p.vy = JUMP_V;
      p.onGround = false;
    }
  }

  function skill() {
    if (state.phase !== "playing") return;
    const p = state.player;
    const hero = state.selectedHero;
    if (!p || !hero) return;

    if (hero.powerType === "sword") {
      p.actionTimer = 0.22;

      // détruit obstacles proches devant le joueur, même voie
      let hits = 0;
      for (const obj of state.objects) {
        if (!obj.active || obj.type !== "obstacle") continue;
        if (obj.route !== p.route) continue;

        const dx = obj.x - p.worldX;
        if (dx >= -10 && dx <= 120) {
          obj.active = false;
          hits++;
        }
      }

      if (hits > 0) {
        state.stageScore += hits * 35;
        setOverlay(`⚔️ ${hits} obstacle(s) détruit(s)`, 0.7);
      } else {
        setOverlay("⚔️ Coup d'épée", 0.5);
      }
    } else {
      // shield
      if (p.shieldCooldown <= 0) {
        p.shieldTimer = 1.7;
        p.shieldCooldown = 4.2;
        setOverlay("🛡️ Bouclier activé", 0.8);
      } else {
        setOverlay("🛡️ Recharge...", 0.6);
      }
    }
  }

  function goTunnel() {
    if (state.phase !== "playing") return;
    const p = state.player;
    const st = state.stage;
    if (!p || !st) return;
    if (!isInsideSplit(st, p.worldX)) return;
    if (!p.onGround) return;

    p.route = "tunnel";
    p.y = baseYForRoute("tunnel");
  }

  function goTop() {
    if (state.phase !== "playing") return;
    const p = state.player;
    const st = state.stage;
    if (!p || !st) return;
    if (!isInsideSplit(st, p.worldX)) return;
    if (!p.onGround) return;

    p.route = "top";
    p.y = baseYForRoute("top");
  }

  function togglePause() {
    if (!gameScreen.classList.contains("active")) return;

    if (state.phase === "playing") {
      state.phase = "paused";
      setOverlay("PAUSE", 999);
      pauseBtn.textContent = "Reprendre";
    } else if (state.phase === "paused") {
      state.phase = "playing";
      hideOverlay();
      pauseBtn.textContent = "Pause";
    }
  }

  // ---------- Update ----------
  function update(dt) {
    if (!state.stage || !state.player) return;

    if (state.overlayTimer > 0) {
      state.overlayTimer -= dt;
      if (state.overlayTimer <= 0) hideOverlay();
    }

    if (state.phase === "idle" || state.phase === "paused") return;

    if (state.phase === "failed") {
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) {
        startStage(state.currentStage); // restart stage courant
      }
      return;
    }

    if (state.phase === "ending") {
      updateEnding(dt);
      return;
    }

    // ------- phase playing -------
    const p = state.player;
    const st = state.stage;

    // timers
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      failStage("Temps écoulé");
      return;
    }

    if (p.actionTimer > 0) p.actionTimer -= dt;
    if (p.shieldTimer > 0) p.shieldTimer -= dt;
    if (p.shieldCooldown > 0) p.shieldCooldown -= dt;

    // move forward
    const speed = st.speed + Math.min(80, (st.time - state.timeLeft) * 0.7);
    p.worldX += speed * dt;

    // split logic
    if (!isInsideSplit(st, p.worldX)) {
      // hors zone split => retour voie haute
      if (p.route !== "top") {
        p.route = "top";
        p.y = baseYForRoute("top");
        p.vy = 0;
        p.onGround = true;
      }
    }

    // jump physics
    p.vy += GRAVITY * dt;
    p.y += p.vy * dt;

    const by = baseYForRoute(p.route);
    if (p.y >= by) {
      p.y = by;
      p.vy = 0;
      p.onGround = true;
    } else {
      p.onGround = false;
    }

    // camera
    state.cameraX = clamp(p.worldX - PLAYER_SCREEN_X, 0, st.length - W);

    // collisions
    resolveCollisions();

    // score progressif
    state.stageScore += dt * 14;

    // end condition
    if (p.worldX >= st.length - 180) {
      beginStageEnding();
    }

    updateHUD();
  }

  function resolveCollisions() {
    const p = state.player;
    if (!p) return;

    const playerRect = {
      x: PLAYER_SCREEN_X,
      y: p.y,
      w: PLAYER_W,
      h: PLAYER_H
    };

    for (const obj of state.objects) {
      if (!obj.active) continue;
      if (obj.type !== "obstacle") continue;

      const sx = obj.x - state.cameraX;
      if (sx < -120 || sx > W + 120) continue;

      const oy = objectY(obj);
      const rect = { x: sx, y: oy, w: obj.w, h: obj.h };

      if (!rectIntersect(playerRect, rect)) continue;

      // Bouclier actif (AMARIS/MAYA)
      if (state.selectedHero.powerType === "shield" && p.shieldTimer > 0) {
        obj.active = false;
        p.shieldTimer = Math.max(0, p.shieldTimer - 0.65);
        state.stageScore += 20;
        setOverlay("🛡️ Obstacle bloqué", 0.6);
        continue;
      }

      failStage("Obstacle touché");
      return;
    }
  }

  function updateEnding(dt) {
    const p = state.player;
    const st = state.stage;

    state.phaseTimer += dt;

    // avancer joueur vers porte du château
    const gateX = st.length - 150;
    if (p.worldX < gateX) {
      p.worldX += 130 * dt;
    }

    // camera suit
    state.cameraX = clamp(p.worldX - PLAYER_SCREEN_X, 0, st.length - W);

    // avion arrive
    if (state.phaseTimer > 0.7) {
      state.planeX -= 250 * dt;
    }

    // fin sequence
    if (state.phaseTimer > 4.4) {
      completeStage();
    }

    updateHUD();
  }

  // ---------- Draw helpers ----------
  function drawCloud(x, y, s = 1) {
    const w = 90 * s;
    const h = 28 * s;

    // base
    ctx.fillStyle = "#f2f2f2";
    ctx.fillRect(x, y, w, h);

    // bubbles
    ctx.beginPath();
    ctx.arc(x + 20 * s, y, 12 * s, Math.PI, 0);
    ctx.arc(x + 42 * s, y - 6 * s, 14 * s, Math.PI, 0);
    ctx.arc(x + 66 * s, y, 11 * s, Math.PI, 0);
    ctx.fill();
  }

  function drawBackground(theme) {
    // ciel
    if (theme === "desert") ctx.fillStyle = "#6f7dff";
    else if (theme === "forest") ctx.fillStyle = "#7db2ff";
    else if (theme === "urban") ctx.fillStyle = "#7593d9";
    else if (theme === "beach") ctx.fillStyle = "#7bd4ff";
    else ctx.fillStyle = "#9bb4d9";

    ctx.fillRect(0, 0, W, H);

    // nuages (parallax)
    drawCloud(120 - (state.cameraX * 0.25 % (W + 220)), 88, 1.1);
    drawCloud(560 - (state.cameraX * 0.20 % (W + 260)), 62, 0.9);
    drawCloud(900 - (state.cameraX * 0.15 % (W + 300)), 104, 1.2);

    // mid layers
    if (theme === "forest") drawForestLayer();
    if (theme === "urban") drawUrbanLayer();
    if (theme === "beach") drawBeachLayer();
    if (theme === "mountain") drawMountainLayer();
    if (theme === "desert") drawDesertLayer();
  }

  function drawDesertLayer() {
    const offset = -(state.cameraX * 0.22) % 260;
    for (let x = -260 + offset; x < W + 260; x += 260) {
      ctx.fillStyle = "#d9b15a";
      ctx.beginPath();
      ctx.moveTo(x, 390);
      ctx.quadraticCurveTo(x + 130, 330, x + 260, 390);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawForestLayer() {
    const offset = -(state.cameraX * 0.35) % 120;
    for (let x = -120 + offset; x < W + 120; x += 120) {
      ctx.fillStyle = "#2d7f3f";
      ctx.fillRect(x + 46, 320, 12, 70);
      ctx.fillStyle = "#2fb054";
      ctx.beginPath();
      ctx.moveTo(x + 10, 330);
      ctx.lineTo(x + 52, 260);
      ctx.lineTo(x + 94, 330);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawUrbanLayer() {
    const offset = -(state.cameraX * 0.35) % 180;
    for (let x = -180 + offset; x < W + 180; x += 180) {
      const h = 120 + (Math.abs(Math.sin((x + state.cameraX) * 0.01)) * 80);
      ctx.fillStyle = "#3d4c6e";
      ctx.fillRect(x, 380 - h, 120, h);
      ctx.fillStyle = "#9fc3ff";
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 3; c++) {
          ctx.fillRect(x + 12 + c * 32, 390 - h + 12 + r * 18, 12, 8);
        }
      }
    }
  }

  function drawBeachLayer() {
    ctx.fillStyle = "#3ea8ff";
    ctx.fillRect(0, 390, W, 90);

    ctx.fillStyle = "rgba(255,255,255,.45)";
    const offset = -(state.cameraX * 0.55) % 48;
    for (let x = -48 + offset; x < W + 48; x += 48) {
      ctx.fillRect(x, 402, 26, 4);
      ctx.fillRect(x + 10, 430, 18, 4);
    }

    const pOffset = -(state.cameraX * 0.3) % 260;
    for (let x = -260 + pOffset; x < W + 260; x += 260) {
      ctx.fillStyle = "#8b5a2b";
      ctx.fillRect(x + 70, 325, 10, 70);
      ctx.fillStyle = "#1fab52";
      ctx.beginPath();
      ctx.moveTo(x + 75, 320);
      ctx.lineTo(x + 38, 300);
      ctx.lineTo(x + 62, 332);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 75, 320);
      ctx.lineTo(x + 112, 300);
      ctx.lineTo(x + 88, 332);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawMountainLayer() {
    const offset = -(state.cameraX * 0.28) % 220;
    for (let x = -220 + offset; x < W + 220; x += 220) {
      ctx.fillStyle = "#607089";
      ctx.beginPath();
      ctx.moveTo(x, 390);
      ctx.lineTo(x + 100, 240);
      ctx.lineTo(x + 200, 390);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#e6edf7";
      ctx.beginPath();
      ctx.moveTo(x + 78, 274);
      ctx.lineTo(x + 100, 240);
      ctx.lineTo(x + 122, 274);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawGround(theme) {
    let topColor = "#7a4b2f";
    let tileColor = "#a86b43";

    if (theme === "forest") { topColor = "#6a4a2c"; tileColor = "#9a6a3a"; }
    if (theme === "urban") { topColor = "#4f5566"; tileColor = "#68708a"; }
    if (theme === "beach") { topColor = "#c8a86e"; tileColor = "#debf85"; }
    if (theme === "mountain") { topColor = "#5b6473"; tileColor = "#7f8b9a"; }

    ctx.fillStyle = topColor;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

    const tileW = 32;
    const shift = (-state.cameraX % tileW + tileW) % tileW;

    ctx.fillStyle = tileColor;
    for (let x = -tileW + shift; x < W + tileW; x += tileW) {
      for (let y = GROUND_Y; y < H; y += 22) {
        ctx.fillRect(x, y, tileW - 2, 20);
      }
    }

    // tunnel zone visible uniquement desert/split
    if (state.stage.theme === "desert" && state.stage.split) {
      const s = state.stage.split.start - state.cameraX;
      const e = state.stage.split.end - state.cameraX;
      if (e > 0 && s < W) {
        ctx.fillStyle = "#222";
        ctx.fillRect(Math.max(0, s), TUNNEL_CEIL_Y, Math.min(W, e) - Math.max(0, s), H - TUNNEL_CEIL_Y);
        ctx.strokeStyle = "#5a5a5a";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(Math.max(0, s), TUNNEL_CEIL_Y);
        ctx.lineTo(Math.min(W, e), TUNNEL_CEIL_Y);
        ctx.stroke();
      }
    }
  }

  function drawPyramid(x, yBase, w, h) {
    ctx.fillStyle = "#d6a84b";
    ctx.beginPath();
    ctx.moveTo(x, yBase);
    ctx.lineTo(x + w / 2, yBase - h);
    ctx.lineTo(x + w, yBase);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,.18)";
    for (let i = 0; i < 6; i++) {
      const yy = yBase - (i + 1) * (h / 7);
      ctx.beginPath();
      ctx.moveTo(x + (i * (w / 14)), yy);
      ctx.lineTo(x + w - (i * (w / 14)), yy);
      ctx.stroke();
    }
  }

  function drawDesertSplitIfAny() {
    const st = state.stage;
    if (st.theme !== "desert" || !st.split) return;

    const s = st.split.start - state.cameraX;
    const e = st.split.end - state.cameraX;

    drawPyramid(s + 140, GROUND_Y, 120, 120);
    drawPyramid(e - 200, GROUND_Y, 160, 140);
  }

  function drawCastle() {
    const st = state.stage;
    const cx = st.length - 120 - state.cameraX;
    if (cx < -200 || cx > W + 220) return;

    // corps
    ctx.fillStyle = "#7b7b8a";
    ctx.fillRect(cx, GROUND_Y - 126, 120, 126);

    // tours
    ctx.fillRect(cx - 22, GROUND_Y - 150, 26, 150);
    ctx.fillRect(cx + 116, GROUND_Y - 150, 26, 150);

    // porte
    ctx.fillStyle = "#3b2d2d";
    ctx.fillRect(cx + 50, GROUND_Y - 44, 20, 44);

    // drapeau
    ctx.fillStyle = "#ddd";
    ctx.fillRect(cx + 58, GROUND_Y - 180, 3, 30);
    ctx.fillStyle = "#ff3b3b";
    ctx.fillRect(cx + 61, GROUND_Y - 178, 20, 10);
  }

  function drawPlane() {
    const y = 150 + Math.sin(state.phaseTimer * 4.5) * 6;
    ctx.font = '34px "Press Start 2P", monospace';
    ctx.fillStyle = "#fff";
    ctx.fillText("✈️", state.planeX, y);
  }

  function drawObjects() {
    for (const obj of state.objects) {
      if (!obj.active) continue;
      if (obj.type !== "obstacle") continue;

      const x = obj.x - state.cameraX;
      if (x < -120 || x > W + 120) continue;

      const y = objectY(obj);

      ctx.fillStyle = "#1f1f1f";
      ctx.fillRect(x, y, obj.w, obj.h);
      ctx.strokeStyle = "#5d5d5d";
      ctx.strokeRect(x + 1, y + 1, obj.w - 2, obj.h - 2);

      ctx.font = '24px "Press Start 2P", monospace';
      ctx.fillStyle = "#fff";
      ctx.fillText(obj.emoji, x + 6, y + obj.h - 8);
    }
  }

  function drawPlayer() {
    const p = state.player;
    const hero = state.selectedHero || HEROES[0];

    // petite ombre/fond
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(PLAYER_SCREEN_X - 6, p.y - 6, PLAYER_W + 12, PLAYER_H + 12);

    // aura bouclier
    if (p.shieldTimer > 0) {
      ctx.strokeStyle = "#53e3ff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(PLAYER_SCREEN_X + PLAYER_W / 2, p.y + PLAYER_H / 2, 34, 36, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // hero emoji
    ctx.font = '36px "Press Start 2P", monospace';
    ctx.fillStyle = "#fff";
    ctx.fillText(hero.emoji, PLAYER_SCREEN_X + 2, p.y + 38);

    // slash visuel épée
    if (p.actionTimer > 0 && hero.powerType === "sword") {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(PLAYER_SCREEN_X + PLAYER_W + 4, p.y + 14);
      ctx.lineTo(PLAYER_SCREEN_X + PLAYER_W + 36, p.y + 30);
      ctx.stroke();

      ctx.strokeStyle = "#ffe066";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(PLAYER_SCREEN_X + PLAYER_W + 8, p.y + 8);
      ctx.lineTo(PLAYER_SCREEN_X + PLAYER_W + 42, p.y + 26);
      ctx.stroke();
    }
  }

  function drawTopLine() {
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(0, 0, W, 30);

    ctx.font = '12px "Press Start 2P", monospace';
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`WORLD ${state.stage.id} - ${state.stage.name}`, 14, 20);

    if (state.phase === "playing" && isInsideSplit(state.stage, state.player.worldX)) {
      ctx.fillStyle = "#ffe066";
      ctx.fillText(`ROUTE: ${state.player.route.toUpperCase()}`, 510, 20);
    }
  }

  function draw() {
    if (!state.stage || !state.player) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      return;
    }

    ctx.clearRect(0, 0, W, H);

    drawBackground(state.stage.theme);
    drawGround(state.stage.theme);
    drawDesertSplitIfAny();
    drawCastle();
    drawObjects();
    drawPlayer();
    if (state.phase === "ending") drawPlane();
    drawTopLine();
  }

  // ---------- HUD ----------
  function updateHUD() {
    const hero = state.selectedHero || HEROES[0];
    hudScore.textContent = formatScore(state.totalScore + state.stageScore);
    hudStage.textContent = String(state.currentStage);
    hudStageName.textContent = state.stage ? state.stage.name : "---";
    hudHero.textContent = hero.id;
    hudPower.textContent = hero.powerName;
    hudTime.textContent = String(Math.max(0, Math.ceil(state.timeLeft)));
  }

  // ---------- Loop ----------
  function ensureLoop() {
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.lastTs = 0;
    state.rafId = requestAnimationFrame(loop);
  }

  function loop(ts) {
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(0.033, (ts - state.lastTs) / 1000);
    state.lastTs = ts;

    if (gameScreen.classList.contains("active")) {
      update(dt);
      draw();
    }

    state.rafId = requestAnimationFrame(loop);
  }

  // ---------- Events ----------
  introNextBtn.addEventListener("click", () => {
    showScreen(menuScreen);
  });

  newGameBtn.addEventListener("click", startNewGame);
  continueBtn.addEventListener("click", continueGame);

  resetSaveBtn.addEventListener("click", () => {
    resetSave();
    showScreen(menuScreen);
    setOverlay("Sauvegarde réinitialisée", 0.9);
  });

  pauseBtn.addEventListener("click", togglePause);

  menuBtn.addEventListener("click", () => {
    state.phase = "idle";
    hideOverlay();
    showScreen(menuScreen);
    refreshSaveInfo();
  });

  playAgainBtn.addEventListener("click", () => {
    state.totalScore = 0;
    state.currentStage = 1;
    state.unlockedStage = 1;
    persistProgress();
    showScreen(gameScreen);
    startStage(1);
  });

  victoryMenuBtn.addEventListener("click", () => {
    showScreen(menuScreen);
    refreshSaveInfo();
  });

  // clavier
  document.addEventListener("keydown", (e) => {
    if (!gameScreen.classList.contains("active")) return;

    const k = e.key.toLowerCase();

    if (e.code === "Space") {
      e.preventDefault();
      jump();
      return;
    }

    if (k === "x") {
      e.preventDefault();
      skill();
      return;
    }

    if (k === "arrowdown" || k === "s") {
      e.preventDefault();
      goTunnel();
      return;
    }

    if (k === "arrowup" || k === "w") {
      e.preventDefault();
      goTop();
      return;
    }

    if (k === "p") {
      e.preventDefault();
      togglePause();
    }
  });

  // boutons mobile
  btnJump.addEventListener("click", jump);
  btnSkill.addEventListener("click", skill);
  btnTunnel.addEventListener("click", goTunnel);
  btnTop.addEventListener("click", goTop);

  // ---------- Init ----------
  function init() {
    loadProgress();
    renderHeroCards();
    refreshSaveInfo();
    updateHUD();
    showScreen(introScreen);
    ensureLoop();
  }

  init();
})();
