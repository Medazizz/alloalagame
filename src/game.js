// Moteur du jeu « Allo..Ala Rush » (canvas 2D, sans bibliothèque).
// Le livreur roule sur 3 voies : il ramasse les commandes (🍕💊📦…),
// les dépose aux maisons 🏠 et évite les obstacles. 60 secondes, 3 vies.
import { sfx, buzz } from "./sound.js";

export const GAME_SECONDS = 60;
const MAX_CARRY = 3;
const LIVES = 3;
const ITEMS = ["🍕", "💊", "📦", "🛒", "🥖", "☕", "🍔", "💐"];
const OBSTACLES = ["🕳️", "🐑", "🚗", "🚧", "🐐"];
const SIDE = ["🌴", "🏛️", "🌴", "🌳", "🏛️", "🌵"];
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function createGame(canvas, { onHud, onEnd }) {
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1;
  let roadX = 0, roadW = 0, laneW = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    roadW = Math.min(W * 0.78, 420);
    roadX = (W - roadW) / 2;
    laneW = roadW / 3;
  }
  resize();
  window.addEventListener("resize", resize);

  const laneX = (l) => roadX + laneW * (l + 0.5);

  const s = {
    phase: "count", // count → play → over
    countT: 3.2,
    t: 0,
    timeLeft: GAME_SECONDS,
    score: 0,
    deliveries: 0,
    lives: LIVES,
    carry: [],
    combo: 1,
    lane: 1,
    laneVis: 1,
    inv: 0,
    shake: 0,
    scroll: 0,
    objs: [],
    side: [],
    fx: [],
    nextRow: 0.6,
    nextHouse: 2.6,
    lastHouse: -10,
    clocks: 0,
    lastCount: 4,
  };

  for (let i = 0; i < 8; i++) s.side.push({ y: (i / 8) * 1.2, left: i % 2 === 0, e: pick(SIDE) });

  const speed = () => H * (0.5 + 0.55 * Math.min(1, s.t / GAME_SECONDS)); // px/s
  const playerY = () => H * 0.8;

  function hud() {
    onHud?.({
      score: s.score,
      timeLeft: Math.max(0, s.timeLeft),
      lives: s.lives,
      carry: [...s.carry],
      combo: s.combo,
      deliveries: s.deliveries,
    });
  }

  function float(text, x, y, color = "#fff") {
    s.fx.push({ text, x, y, life: 0.9, color });
  }

  function spawnRow() {
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    const hard = Math.min(1, s.t / GAME_SECONDS);
    // un obstacle presque toujours, parfois deux (jamais trois : il reste un passage)
    const nObs = Math.random() < 0.25 + hard * 0.35 ? 2 : Math.random() < 0.8 ? 1 : 0;
    let i = 0;
    for (; i < nObs; i++) s.objs.push({ kind: "obs", lane: lanes[i], y: -40, e: pick(OBSTACLES) });
    if (i < 3 && Math.random() < 0.75) s.objs.push({ kind: "item", lane: lanes[i], y: -40 - rand(0, 30), e: pick(ITEMS) });
    else if (i < 3 && s.clocks < 5 && Math.random() < 0.18) {
      s.clocks++;
      s.objs.push({ kind: "clock", lane: lanes[i], y: -40, e: "⏱️" });
    }
  }

  function spawnHouse() {
    // la maison arrive sur une voie libre de la rangée la plus haute
    const busy = new Set(s.objs.filter((o) => o.y < 40).map((o) => o.lane));
    const free = [0, 1, 2].filter((l) => !busy.has(l));
    s.objs.push({ kind: "house", lane: free.length ? pick(free) : 1, y: -70, e: "🏠" });
    s.lastHouse = s.t;
  }

  function hit(o) {
    const px = laneX(s.laneVis);
    if (o.kind === "item") {
      if (s.carry.length >= MAX_CARRY) return false;
      s.carry.push(o.e);
      s.score += 10;
      float("+10", px, playerY() - 40);
      sfx.pickup();
      return true;
    }
    if (o.kind === "house") {
      if (!s.carry.length) return false;
      const n = s.carry.length;
      const pts = 50 * n * s.combo;
      s.score += pts;
      s.deliveries += n;
      float(`+${pts} ✓`, px, playerY() - 50, "#6BE69A");
      if (s.combo > 1) float(`Combo x${s.combo}`, px, playerY() - 90, "#FFA35F");
      s.combo = Math.min(3, s.combo + 1);
      s.carry = [];
      sfx.deliver();
      buzz(30);
      return true;
    }
    if (o.kind === "clock") {
      s.timeLeft += 4;
      float("+4 s", px, playerY() - 40, "#9DD0FF");
      sfx.clock();
      return true;
    }
    if (o.kind === "obs") {
      if (s.inv > 0) return false;
      s.lives -= 1;
      s.combo = 1;
      if (s.carry.length) float("Commande perdue !", px, playerY() - 50, "#FF8A80");
      s.carry = [];
      s.inv = 1.4;
      s.shake = 0.35;
      sfx.crash();
      buzz(120);
      return true;
    }
    return false;
  }

  function update(dt) {
    if (s.phase === "count") {
      s.countT -= dt;
      const c = Math.ceil(s.countT - 0.2);
      if (c !== s.lastCount && c >= 0) {
        s.lastCount = c;
        sfx.count(c === 0);
      }
      if (s.countT <= 0) s.phase = "play";
      s.scroll += speed() * 0.3 * dt;
      return;
    }
    if (s.phase !== "play") return;

    s.t += dt;
    s.timeLeft -= dt;
    s.inv = Math.max(0, s.inv - dt);
    s.shake = Math.max(0, s.shake - dt);
    const v = speed();
    s.scroll += v * dt;
    s.laneVis += (s.lane - s.laneVis) * Math.min(1, dt * 16);

    // apparitions
    s.nextRow -= dt;
    if (s.nextRow <= 0) {
      spawnRow();
      s.nextRow = Math.max(0.55, 1.05 - s.t * 0.008);
    }
    s.nextHouse -= dt;
    if (s.nextHouse <= 0 && s.t - s.lastHouse >= 3.2) {
      spawnHouse();
      s.nextHouse = rand(3.4, 5);
    }

    // déplacement + collisions
    const py = playerY();
    const curLane = Math.round(s.laneVis);
    for (const o of s.objs) {
      o.y += v * dt;
      if (!o.done && o.lane === curLane && Math.abs(o.y - py) < laneW * 0.42) {
        if (hit(o)) o.done = true;
      }
    }
    s.objs = s.objs.filter((o) => o.y < H + 80 && !(o.done && o.kind !== "house"));
    for (const d of s.side) {
      d.y += (v * dt) / H;
      if (d.y > 1.15) {
        d.y -= 1.3;
        d.e = pick(SIDE);
      }
    }
    for (const f of s.fx) {
      f.life -= dt;
      f.y -= 50 * dt;
    }
    s.fx = s.fx.filter((f) => f.life > 0);

    if (s.timeLeft <= 0 || s.lives <= 0) {
      s.phase = "over";
      sfx.end();
      onEnd?.({ score: s.score, deliveries: s.deliveries, seconds: Math.round(s.t * 10) / 10, lives: s.lives });
    }
  }

  // ---------- dessin ----------
  function drawScooter(x, y, size) {
    const blink = s.inv > 0 && Math.floor(s.inv * 10) % 2 === 0;
    if (blink) ctx.globalAlpha = 0.35;
    const w = size * 0.42, h = size * 0.95;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((s.lane - s.laneVis) * -0.35); // penche dans les virages
    // ombre
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath();
    ctx.ellipse(0, h * 0.42, w * 0.7, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    // roues
    ctx.fillStyle = "#0B1430";
    ctx.beginPath(); ctx.roundRect(-w * 0.16, -h * 0.5, w * 0.32, h * 0.22, 6); ctx.fill();
    ctx.beginPath(); ctx.roundRect(-w * 0.16, h * 0.26, w * 0.32, h * 0.22, 6); ctx.fill();
    // carrosserie
    ctx.fillStyle = "#DCE6FA";
    ctx.beginPath(); ctx.roundRect(-w * 0.32, -h * 0.36, w * 0.64, h * 0.7, w * 0.3); ctx.fill();
    // guidon
    ctx.strokeStyle = "#0E2A5C"; ctx.lineWidth = Math.max(3, size * 0.05); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-w * 0.62, -h * 0.28); ctx.lineTo(w * 0.62, -h * 0.28); ctx.stroke();
    // coffre de livraison orange avec le « A »
    ctx.fillStyle = "#FF8438";
    ctx.beginPath(); ctx.roundRect(-w * 0.55, h * 0.02, w * 1.1, h * 0.42, 8); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `800 ${Math.round(size * 0.2)}px "Space Grotesk",sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("A", 0, h * 0.24);
    // casque du livreur
    ctx.fillStyle = "#0E2A5C";
    ctx.beginPath(); ctx.arc(0, -h * 0.1, w * 0.36, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#FF8438";
    ctx.beginPath(); ctx.arc(0, -h * 0.1, w * 0.36, Math.PI * 1.1, Math.PI * 1.9); ctx.lineTo(0, -h * 0.1); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const shake = s.shake > 0 ? s.shake * 18 : 0;
    ctx.translate(rand(-shake, shake), rand(-shake, shake));

    // bas-côtés
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0B2350");
    g.addColorStop(1, "#081B40");
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.font = `${Math.round(Math.min(roadX * 0.7, 44))}px ${EMOJI_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (roadX > 24) {
      for (const d of s.side) ctx.fillText(d.e, d.left ? roadX / 2 : W - roadX / 2, d.y * H);
    }

    // route
    ctx.fillStyle = "#16294F";
    ctx.fillRect(roadX, -20, roadW, H + 40);
    ctx.fillStyle = "#FF8438";
    ctx.fillRect(roadX - 4, -20, 4, H + 40);
    ctx.fillRect(roadX + roadW, -20, 4, H + 40);
    ctx.strokeStyle = "rgba(255,255,255,.35)";
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 26]);
    ctx.lineDashOffset = -s.scroll;
    for (let l = 1; l < 3; l++) {
      ctx.beginPath();
      ctx.moveTo(roadX + laneW * l, -20);
      ctx.lineTo(roadX + laneW * l, H + 20);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // objets
    const size = laneW * 0.62;
    for (const o of s.objs) {
      const x = laneX(o.lane);
      if (o.kind === "house") {
        const ready = s.carry.length > 0;
        ctx.fillStyle = ready ? "rgba(43,224,122,.22)" : "rgba(255,255,255,.08)";
        ctx.strokeStyle = ready ? "#2BE07A" : "rgba(255,255,255,.25)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(x - laneW * 0.44, o.y - size * 0.75, laneW * 0.88, size * 1.5, 16);
        ctx.fill();
        ctx.stroke();
        ctx.font = `${Math.round(size)}px ${EMOJI_FONT}`;
        ctx.fillText(o.done ? "✅" : "🏠", x, o.y);
        continue;
      }
      if (o.kind === "item") {
        ctx.fillStyle = "rgba(255,255,255,.95)";
        ctx.beginPath();
        ctx.arc(x, o.y, size * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `${Math.round(size * 0.7)}px ${EMOJI_FONT}`;
        ctx.fillText(o.e, x, o.y + 2);
        continue;
      }
      ctx.font = `${Math.round(o.kind === "obs" ? size * 1.05 : size * 0.85)}px ${EMOJI_FONT}`;
      ctx.fillText(o.e, x, o.y);
    }

    // joueur
    drawScooter(laneX(s.laneVis), playerY(), laneW * 0.9);

    // textes flottants
    ctx.font = `800 ${Math.round(Math.max(18, laneW * 0.2))}px "Space Grotesk",sans-serif`;
    for (const f of s.fx) {
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // compte à rebours
    if (s.phase === "count") {
      ctx.fillStyle = "rgba(5,15,38,.45)";
      ctx.fillRect(0, 0, W, H);
      const c = Math.ceil(s.countT - 0.2);
      const k = (s.countT - 0.2) % 1;
      ctx.fillStyle = c > 0 ? "#fff" : "#FF8438";
      ctx.font = `800 ${Math.round(Math.min(W, H) * 0.28 * (0.8 + k * 0.4))}px "Space Grotesk",sans-serif`;
      ctx.fillText(c > 0 ? String(c) : "GO !", W / 2, H * 0.42);
      ctx.font = `700 ${Math.round(Math.min(W, H) * 0.045)}px "Manrope",sans-serif`;
      ctx.fillStyle = "#DCE6FA";
      ctx.fillText("Glissez ← → ou touchez un côté", W / 2, H * 0.6);
    }
  }

  // ---------- boucle ----------
  let raf = 0, last = 0, hudT = 0, paused = false;
  function frame(now) {
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (!paused) {
      update(dt);
      draw();
      hudT -= dt;
      if (hudT <= 0) {
        hud();
        hudT = 0.08;
      }
    }
    if (s.phase !== "over") raf = requestAnimationFrame(frame);
    else {
      draw();
      hud();
    }
  }
  raf = requestAnimationFrame(frame);

  // ---------- commandes ----------
  function move(dir) {
    if (s.phase !== "play") return;
    const n = Math.max(0, Math.min(2, s.lane + dir));
    if (n !== s.lane) {
      s.lane = n;
      sfx.lane();
    }
  }
  const onKey = (e) => {
    if (["ArrowLeft", "a", "q", "A", "Q"].includes(e.key)) { move(-1); e.preventDefault(); }
    if (["ArrowRight", "d", "D"].includes(e.key)) { move(1); e.preventDefault(); }
  };
  let tx = null, ty = null;
  const onDown = (e) => { tx = e.clientX; ty = e.clientY; };
  const onUp = (e) => {
    if (tx === null) return;
    const dx = e.clientX - tx, dy = e.clientY - ty;
    if (Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
    else {
      const r = canvas.getBoundingClientRect();
      move(e.clientX - r.left < r.width / 2 ? -1 : 1);
    }
    tx = ty = null;
  };
  const onVis = () => {
    paused = document.hidden;
    last = 0;
  };
  window.addEventListener("keydown", onKey);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  document.addEventListener("visibilitychange", onVis);

  return {
    move,
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      document.removeEventListener("visibilitychange", onVis);
    },
  };
}
