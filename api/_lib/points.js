// Règles des points : jeux, bonus, parrainage, et calcul du total de la semaine.
//   total de la semaine = meilleur score de chaque jeu (additionnés) + points bonus gagnés cette semaine
import crypto from "node:crypto";
import { store } from "./store.js";
import { weekInfo, maskPhone } from "./util.js";

// Les jeux et leurs plafonds de vraisemblance (cohérents avec src/games/*)
export const GAMES = {
  rush: { name: "Allo..Ala Rush", maxSeconds: 90, maxPerSec: 200, minSeconds: 3 },
  memo: { name: "Mémo Livraison", maxSeconds: 180, minSeconds: 8 },
  catch: { name: "Attrape-Commandes", maxSeconds: 75, maxPerSec: 120, minSeconds: 3 },
};

// Mémo : le serveur recalcule le score à partir des coups et du temps
export function memoScore(moves, seconds) {
  return Math.max(100, Math.round(1000 - Math.max(0, moves - 8) * 25 - seconds * 4));
}

export const BONUS = {
  follow_fb: { points: 100, once: true, label: "Abonnement Facebook" },
  follow_ig: { points: 100, once: true, label: "Abonnement Instagram" },
  share: { points: 30, daily: true, label: "Partage" },
  referral: { points: 200, label: "Ami parrainé" },
  welcome: { points: 100, label: "Bienvenue (parrainage)" },
};

const k = {
  user: (p) => `user:${p}`,
  best: (w, p) => `best:${w}:${p}`,
  bonus: (w, p) => `bonus:${w}:${p}`,
  lb: (w) => `lb:${w}`,
  users: "users",
  code: (c) => `refcode:${c}`,
};

// ---------- joueurs ----------
export async function getUser(phone) {
  return (await store.hgetall(k.user(phone))) || null;
}

function newRefCode() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += abc[crypto.randomInt(abc.length)];
  return s;
}

// Crée le joueur à sa première connexion (avec parrain éventuel)
export async function ensureUser(phone, refCode) {
  const u = await getUser(phone);
  if (u && u.refCode) return { user: u, created: false };
  let code = newRefCode();
  while (await store.get(k.code(code))) code = newRefCode();
  await store.set(k.code(code), phone);
  const user = { refCode: code, createdAt: String(Date.now()), referrals: "0" };
  if (refCode) {
    const parrain = await store.get(k.code(String(refCode).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)));
    if (parrain && String(parrain) !== phone) user.referredBy = String(parrain);
  }
  await store.hset(k.user(phone), user);
  await store.zset(k.users, Date.now(), phone);
  return { user: await getUser(phone), created: true };
}

// ---------- total de la semaine ----------
export async function recompute(phone, week = weekInfo()) {
  const bests = (await store.hgetall(k.best(week.key, phone))) || {};
  const bonus = (await store.hgetall(k.bonus(week.key, phone))) || {};
  const gamePts = Object.keys(GAMES).reduce((s, g) => s + Number(bests[g] || 0), 0);
  const bonusPts = Object.values(bonus).reduce((s, v) => s + Number(v || 0), 0);
  const total = gamePts + bonusPts;
  if (total > 0) await store.zset(k.lb(week.key), total, phone);
  return { total, bests, bonus, gamePts, bonusPts };
}

export async function addBonus(phone, type, points, week = weekInfo()) {
  await store.hincrby(k.bonus(week.key, phone), type, points);
  return recompute(phone, week);
}

// Enregistre un score : on ne garde que le meilleur par jeu et par semaine
export async function saveScore(phone, game, score, week = weekInfo()) {
  const key = k.best(week.key, phone);
  const before = Number((await store.hget(key, game)) || 0);
  if (score > before) await store.hset(key, { [game]: score });

  // Premier score jamais enregistré : on récompense le parrain et le filleul
  const u = await getUser(phone);
  let referralPaid = false;
  if (u && u.referredBy && !u.refPaid) {
    await store.hset(k.user(phone), { refPaid: "1" });
    await addBonus(u.referredBy, "referral", BONUS.referral.points, week);
    await store.hincrby(k.user(u.referredBy), "referrals", 1);
    await store.hincrby(k.bonus(week.key, phone), "welcome", BONUS.welcome.points);
    referralPaid = true;
  }
  const r = await recompute(phone, week);
  return { ...r, before, improved: score > before, gained: Math.max(0, score - before), referralPaid };
}

export async function rankOf(phone, week = weekInfo()) {
  const r = await store.zRankDesc(k.lb(week.key), phone);
  return r === null ? null : r + 1;
}

// Résumé complet pour l'écran « Profil » / l'accueil
export async function summary(phone) {
  const week = weekInfo();
  const u = (await getUser(phone)) || {};
  const r = await recompute(phone, week);
  const today = new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
  return {
    phone,
    masked: maskPhone(phone),
    name: (await store.get(`name:${phone}`)) || null,
    refCode: u.refCode || null,
    referrals: Number(u.referrals || 0),
    week: week.key,
    endsAt: week.end,
    total: r.total,
    gamePts: r.gamePts,
    bonusPts: r.bonusPts,
    bests: Object.fromEntries(Object.keys(GAMES).map((g) => [g, Number(r.bests[g] || 0)])),
    rank: await rankOf(phone, week),
    players: await store.zCard(k.lb(week.key)),
    missions: {
      follow_fb: Boolean(await store.get(`claimed:follow_fb:${phone}`)),
      follow_ig: Boolean(await store.get(`claimed:follow_ig:${phone}`)),
      share: Boolean(await store.get(`claimed:share:${today}:${phone}`)),
    },
  };
}

export { k as keys };
