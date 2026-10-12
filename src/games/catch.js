// « Attrape-Commandes » : les commandes tombent du ciel de Sbeïtla,
// le joueur les attrape dans le coffre Allo..Ala et évite les pièges.
// 45 secondes, 3 vies, combo jusqu'à x3.
import { sfx, buzz } from "../sound.js";

export const CATCH_SECONDS = 45;
const GOOD = ["🍕", "💊", "📦", "🛒", "🥖", "☕", "🍔", "💐", "🧃", "🍰"];
const BAD = ["🪨", "🐝", "🌶️"];
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function createCatch(canvas, { onHud, onEnd }) {
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  resize();
  window.addEventListener("resize", resize);

  const s = {
    phase: "count", countT: 3.2, lastCount: 4,
    t: 0, timeLeft: CATCH_SECONDS, score: 0, caught: 0, lives: 3, combo: 1, streak: 0,
    x: 0.5, target: 0.5, objs: [], fx: [], next: 0.4, shake: 0, flash: 0,
  };
  const boxW = () => Math.min(W * 0.26, 130);
  const boxY = () => H * 0.86;

  function hud() {
    onHud?.({ score: s.score, timeLeft: Math.max(0, s.timeLeft), lives: s.lives, combo: s.combo, caught: s.caught, total: CATCH_SECONDS });
  }
  const float = (text, x, y, color = "#fff") => s.fx.push({ text, x, y, life: 0.9, color });

  function spawn() {
    const hard = Math.min(1, s.t / CATCH_SECONDS);
    const r = Math.random();
    let kind = "good", e = pick(GOOD);
    if (r < 0.18 + hard * 0.17) { kind = "bad"; e = pick(BAD); }
    else if (r > 0.965) { kind = "star"; e = "⭐"; }
    else if (r > 0.95 && s.timeLeft < CATCH_SECONDS - 5) { kind = "clock"; e = "⏱️"; }
    s.objs.push({ kind, e, x: rand(0.08, 0.92), y: -30, v: H * rand(0.32, 0.42) * (1 + hard * 0.9), spin: rand(-2, 2), a: 0 });
  }

  function catchIt(o) {
    const px = o.x * W, py = boxY() - 30;
    if (o.kind === "good") {
      s.streak++;
      s.combo = Math.min(3, 1 + Math.floor(s.streak / 5));
      const pts = 10 * s.combo;
      s.score += pts; s.caught++;
      float(`+${pts}`, px, py);
      sfx.pickup();
    } else if (o.kind === "star") {
      s.score += 30; s.caught++;
      float("+30 ⭐", px, py, "#FFD36A");
      sfx.deliver();
    } else if (o.kind === "clock") {
      s.timeLeft += 3;
      float("+3 s", px, py, "#9DD0FF");
      sfx.clock();
    } else {
      s.lives--; s.streak = 0; s.combo = 1; s.shake = 0.35; s.flash = 0.25;
      float("Aïe !", px, py, "#FF8A80");
      sfx.crash();
      buzz(120);
    }
  }

  function update(dt) {
    s.x += (s.target - s.x) * Math.min(1, dt * 14);
    if (s.phase === "count") {
      s.countT -= dt;
      const c = Math.ceil(s.countT - 0.2);
      if (c !== s.lastCount && c >= 0) { s.lastCount = c; sfx.count(c === 0); }
      if (s.countT <= 0) s.phase = "play";
      return;
    }
    if (s.phase !== "play") return;
    s.t += dt; s.timeLeft -= dt;
    s.shake = Math.max(0, s.shake - dt); s.flash = Math.max(0, s.flash - dt);
    s.next -= dt;
    if (s.next <= 0) { spawn(); s.next = Math.max(0.38, 0.85 - s.t * 0.011); }

    const bw = boxW(), by = boxY(), bx = s.x * W;
    for (const o of s.objs) {
      o.y += o.v * dt; o.a += o.spin * dt;
      const ox = o.x * W;
      if (!o.done && o.y > by - 26 && o.y < by + 14 && Math.abs(ox - bx) < bw * 0.55) { o.done = true; catchIt(o); }
      if (!o.done && o.y > H + 20) {
        o.done = true;
        if (o.kind === "good") { s.streak = 0; s.combo = 1; }
      }
    }
    s.objs = s.objs.filter((o) => !o.done);
    for (const f of s.fx) { f.life -= dt; f.y -= 50 * dt; }
    s.fx = s.fx.filter((f) => f.life > 0);

    if (s.timeLeft <= 0 || s.lives <= 0) {
      s.phase = "over";
      sfx.end();
      onEnd?.({ score: s.score, caught: s.caught, seconds: Math.round(s.t * 10) / 10, lives: s.lives });
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sh = s.shake * 16;
    ctx.translate(rand(-sh, sh), rand(-sh, sh));
    // ciel
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#12336B"); g.addColorStop(0.7, "#0B2350"); g.addColorStop(1, "#081B40");
    ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
    // étoiles fixes
    ctx.fillStyle = "rgba(255,255,255,.35)";
    for (let i = 0; i < 26; i++) ctx.fillRect((i * 97) % W, (i * 53) % (H * 0.6), 2, 2);
    // silhouette des temples de Sbeïtla
    ctx.strokeStyle = "rgba(255,163,95,.35)"; ctx.lineWidth = 2;
    const base = H * 0.93, u = W / 360;
    ctx.beginPath(); ctx.moveTo(0, base); ctx.lineTo(W, base); ctx.stroke();
    for (const [x, w, hgt] of [[60, 50, 60], [150, 64, 78], [250, 50, 60]]) {
      const X = x * u, Wd = w * u, Hh = hgt * u;
      ctx.strokeRect(X, base - Hh, Wd, Hh);
      ctx.beginPath(); ctx.moveTo(X - 4 * u, base - Hh); ctx.lineTo(X + Wd / 2, base - Hh - 16 * u); ctx.lineTo(X + Wd + 4 * u, base - Hh); ctx.stroke();
      for (let c = 1; c < 4; c++) { ctx.beginPath(); ctx.moveTo(X + (Wd * c) / 4, base); ctx.lineTo(X + (Wd * c) / 4, base - Hh); ctx.stroke(); }
    }
    // objets
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const size = Math.min(W * 0.11, 48);
    for (const o of s.objs) {
      ctx.save(); ctx.translate(o.x * W, o.y); ctx.rotate(o.a * 0.3);
      if (o.kind === "good" || o.kind === "star") {
        ctx.fillStyle = o.kind === "star" ? "rgba(255,211,106,.25)" : "rgba(255,255,255,.92)";
        ctx.beginPath(); ctx.arc(0, 0, size * 0.62, 0, Math.PI * 2); ctx.fill();
      }
      ctx.font = `${Math.round(size * (o.kind === "bad" ? 1 : 0.78))}px ${EMOJI_FONT}`;
      ctx.fillText(o.e, 0, 2);
      ctx.restore();
    }
    // coffre Allo..Ala
    const bw = boxW(), bh = bw * 0.62, bx = s.x * W, by = boxY();
    ctx.fillStyle = "rgba(0,0,0,.3)";
    ctx.beginPath(); ctx.ellipse(bx, by + bh * 0.55, bw * 0.55, bh * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#EF6C1C";
    ctx.beginPath(); ctx.roundRect(bx - bw / 2, by - bh * 0.15, bw, bh * 0.65, 12); ctx.fill();
    ctx.fillStyle = "#FF8438";
    ctx.beginPath(); ctx.roundRect(bx - bw / 2 - 4, by - bh * 0.32, bw + 8, bh * 0.22, 8); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `800 ${Math.round(bh * 0.36)}px "Space Grotesk",sans-serif`;
    ctx.fillText("A", bx, by + bh * 0.18);
    // textes flottants
    ctx.font = `800 ${Math.round(Math.max(18, W * 0.05))}px "Space Grotesk",sans-serif`;
    for (const f of s.fx) { ctx.globalAlpha = Math.min(1, f.life * 2); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1;
    if (s.flash > 0) { ctx.fillStyle = `rgba(255,80,60,${s.flash})`; ctx.fillRect(0, 0, W, H); }
    if (s.phase === "count") {
      ctx.fillStyle = "rgba(5,15,38,.45)"; ctx.fillRect(0, 0, W, H);
      const c = Math.ceil(s.countT - 0.2), k = (s.countT - 0.2) % 1;
      ctx.fillStyle = c > 0 ? "#fff" : "#FF8438";
      ctx.font = `800 ${Math.round(Math.min(W, H) * 0.28 * (0.8 + k * 0.4))}px "Space Grotesk",sans-serif`;
      ctx.fillText(c > 0 ? String(c) : "GO !", W / 2, H * 0.4);
      ctx.font = `700 ${Math.round(Math.min(W, H) * 0.045)}px "Manrope",sans-serif`;
      ctx.fillStyle = "#DCE6FA";
      ctx.fillText("Glissez le doigt pour déplacer le coffre", W / 2, H * 0.58);
    }
  }

  let raf = 0, last = 0, hudT = 0, paused = false;
  function frame(now) {
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (!paused) {
      update(dt); draw();
      hudT -= dt;
      if (hudT <= 0) { hud(); hudT = 0.08; }
    }
    if (s.phase !== "over") raf = requestAnimationFrame(frame);
    else { draw(); hud(); }
  }
  raf = requestAnimationFrame(frame);

  // commandes : le coffre suit le doigt / la souris ; flèches au clavier
  const setFromEvent = (e) => {
    const r = canvas.getBoundingClientRect();
    s.target = Math.max(0.06, Math.min(0.94, (e.clientX - r.left) / r.width));
  };
  let dragging = false;
  const onDown = (e) => { dragging = true; setFromEvent(e); };
  const onMoveP = (e) => { if (dragging || e.pointerType === "mouse") setFromEvent(e); };
  const onUp = () => { dragging = false; };
  const move = (dir) => { s.target = Math.max(0.06, Math.min(0.94, s.target + dir * 0.18)); };
  const onKey = (e) => {
    if (["ArrowLeft", "a", "q", "A", "Q"].includes(e.key)) { move(-1); e.preventDefault(); }
    if (["ArrowRight", "d", "D"].includes(e.key)) { move(1); e.preventDefault(); }
  };
  const onVis = () => { paused = document.hidden; last = 0; };
  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMoveP);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("keydown", onKey);
  document.addEventListener("visibilitychange", onVis);

  return {
    move,
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMoveP);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
    },
  };
}
