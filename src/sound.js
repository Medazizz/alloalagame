// Petits sons du jeu, synthétisés à la volée (aucun fichier audio).
let ctx = null;
let muted = false;
try {
  muted = localStorage.getItem("aa-muted") === "1";
} catch {
  // stockage indisponible
}

export function unlockAudio() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) ctx = new AC();
}

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try {
    localStorage.setItem("aa-muted", m ? "1" : "0");
  } catch {
    // rien
  }
}

function tone({ f = 440, f2, dur = 0.12, type = "sine", vol = 0.2, delay = 0 }) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.25, vol = 0.25, freq = 800 }) {
  if (!ctx || muted) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(filt).connect(g).connect(ctx.destination);
  src.start();
}

export const sfx = {
  pickup: () => tone({ f: 880, f2: 1320, dur: 0.09, vol: 0.14 }),
  deliver: () => {
    [784, 988, 1318].forEach((f, i) => tone({ f, dur: 0.22, vol: 0.13, delay: i * 0.07 }));
  },
  clock: () => tone({ f: 1046, f2: 1568, dur: 0.15, type: "triangle", vol: 0.14 }),
  crash: () => {
    noise({ dur: 0.3, vol: 0.35, freq: 900 });
    tone({ f: 160, f2: 50, dur: 0.3, type: "square", vol: 0.12 });
  },
  lane: () => tone({ f: 300, f2: 220, dur: 0.05, type: "triangle", vol: 0.05 }),
  count: (last) => tone({ f: last ? 1046 : 660, dur: last ? 0.3 : 0.14, vol: 0.16 }),
  end: () => {
    [523, 659, 784, 1046].forEach((f, i) => tone({ f, dur: 0.3, vol: 0.12, delay: i * 0.1 }));
  },
};

export function buzz(ms = 40) {
  if (!muted) navigator.vibrate?.(ms);
}
