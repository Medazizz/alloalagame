// Base de données des joueurs + règles des points.
//
// Points de la semaine = points de jeu + points bonus
//   points de jeu  : pour chaque jeu, meilleur score de la semaine ÷ 20 (max 50 par jeu)
//   points bonus   : abonnements (+150), partage (+50 / jour), parrainage (+200 / +50)
import crypto from "node:crypto";
import { store } from "./store.js";
import { weekInfo, maskPhone, maskEmail } from "./util.js";

// Les jeux et leurs plafonds de vraisemblance (cohérents avec src/games/*)
export const GAMES = {
  rush: { name: "Allo..Ala Rush", maxSeconds: 90, maxPerSec: 200, minSeconds: 3 },
  catch: { name: "Attrape-Commandes", maxSeconds: 75, maxPerSec: 120, minSeconds: 3 },
  memo: { name: "Mémo Livraison", maxSeconds: 180, minSeconds: 8 },
};
export const GAME_POINTS = { divisor: 20, max: 50 };
export const gamePoints = (score) => Math.min(GAME_POINTS.max, Math.round(Number(score || 0) / GAME_POINTS.divisor));

// Mémo : le serveur recalcule le score à partir des coups et du temps
export function memoScore(moves, seconds) {
  return Math.max(100, Math.round(1000 - Math.max(0, moves - 8) * 25 - seconds * 4));
}

export const BONUS = {
  follow_fb: { points: 150, once: true, label: "Abonnement Facebook" },
  follow_ig: { points: 150, once: true, label: "Abonnement Instagram" },
  follow_tt: { points: 150, once: true, label: "Abonnement TikTok" },
  share: { points: 50, daily: true, label: "Partage" },
  referral: { points: 200, label: "Ami parrainé" },
  welcome: { points: 50, label: "Bienvenue (parrainage)" },
};

export const PRIZES = ["10 DT", "1 livraison offerte", "−50 % sur une livraison"];

export const keys = {
  user: (u) => `user:${u}`,
  email: (e) => `idx:email:${e}`,
  phone: (p) => `idx:phone:${p}`,
  uname: (n) => `idx:uname:${n.toLowerCase()}`,
  code: (c) => `idx:ref:${c}`,
  users: "users",
  best: (w, u) => `best:${w}:${u}`,
  bonus: (w, u) => `bonus:${w}:${u}`,
  lb: (w) => `lb:${w}`,
  allTime: "lb:all",
};

// ---------- joueurs ----------
export async function getUser(uid) {
  return (await store.hgetall(keys.user(uid))) || null;
}

function newRefCode() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += abc[crypto.randomInt(abc.length)];
  return s;
}

// Trouve le joueur par e-mail, ou le crée (avec son parrain éventuel)
export async function userForEmail(email, refCode) {
  const existing = await store.get(keys.email(email));
  if (existing) {
    await store.hset(keys.user(String(existing)), { lastSeen: String(Date.now()) });
    return { uid: String(existing), created: false };
  }
  const uid = "u_" + crypto.randomBytes(9).toString("base64url");
  let code = newRefCode();
  while (await store.get(keys.code(code))) code = newRefCode();
  const now = String(Date.now());
  const user = { email, refCode: code, createdAt: now, lastSeen: now, referrals: "0", games: "0" };
  if (refCode) {
    const parrain = await store.get(keys.code(String(refCode).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)));
    if (parrain) user.referredBy = String(parrain);
  }
  // l'index e-mail est posé en « nx » : deux inscriptions simultanées ne créent pas deux comptes
  if (!(await store.set(keys.email(email), uid, { nx: true }))) return userForEmail(email, refCode);
  await store.set(keys.code(code), uid);
  await store.hset(keys.user(uid), user);
  await store.zset(keys.users, Date.now(), uid);
  return { uid, created: true };
}

// Profil : nom d'utilisateur unique + numéro unique (pour créditer le prix dans l'app)
export async function setProfile(uid, { username, phone, consent }) {
  const u = (await getUser(uid)) || {};
  if (username && username !== u.username) {
    const taken = await store.get(keys.uname(username));
    if (taken && String(taken) !== uid) return { error: "Ce nom d'utilisateur est déjà pris." };
    if (u.username) await store.del(keys.uname(u.username));
    await store.set(keys.uname(username), uid);
  }
  if (phone && phone !== u.phone) {
    const taken = await store.get(keys.phone(phone));
    if (taken && String(taken) !== uid) return { error: "Ce numéro est déjà utilisé par un autre compte." };
    if (u.phone) await store.del(keys.phone(u.phone));
    await store.set(keys.phone(phone), uid);
  }
  await store.hset(keys.user(uid), {
    ...(username ? { username } : {}),
    ...(phone ? { phone } : {}),
    ...(consent ? { consentAt: String(Date.now()) } : {}),
  });
  return { ok: true };
}

export const nameOf = async (uid) => (await store.hget(keys.user(uid), "username")) || "Joueur";

// ---------- total de la semaine ----------
export async function recompute(uid, week = weekInfo()) {
  const bests = (await store.hgetall(keys.best(week.key, uid))) || {};
  const bonus = (await store.hgetall(keys.bonus(week.key, uid))) || {};
  const gameDetail = Object.fromEntries(Object.keys(GAMES).map((g) => [g, { score: Number(bests[g] || 0), points: gamePoints(bests[g]) }]));
  const gamePts = Object.values(gameDetail).reduce((s, g) => s + g.points, 0);
  const bonusPts = Object.values(bonus).reduce((s, v) => s + Number(v || 0), 0);
  const total = gamePts + bonusPts;
  if (total > 0) await store.zset(keys.lb(week.key), total, uid);
  return { total, gameDetail, bonus, gamePts, bonusPts };
}

export async function addBonus(uid, type, points, week = weekInfo()) {
  await store.hincrby(keys.bonus(week.key, uid), type, points);
  await store.hincrby(keys.user(uid), "bonusAll", points);
  return recompute(uid, week);
}

// Enregistre un score : on ne garde que le meilleur par jeu et par semaine
export async function saveScore(uid, game, score, week = weekInfo()) {
  const key = keys.best(week.key, uid);
  const before = Number((await store.hget(key, game)) || 0);
  if (score > before) await store.hset(key, { [game]: score });
  await store.hincrby(keys.user(uid), "games", 1);

  // Premier score jamais enregistré : on récompense le parrain et le filleul
  const u = await getUser(uid);
  let referralPaid = false;
  if (u && u.referredBy && !u.refPaid) {
    await store.hset(keys.user(uid), { refPaid: "1" });
    await addBonus(String(u.referredBy), "referral", BONUS.referral.points, week);
    await store.hincrby(keys.user(String(u.referredBy)), "referrals", 1);
    await store.hincrby(keys.bonus(week.key, uid), "welcome", BONUS.welcome.points);
    referralPaid = true;
  }
  const r = await recompute(uid, week);
  return {
    ...r,
    before,
    improved: score > before,
    pointsBefore: gamePoints(before),
    pointsNow: gamePoints(Math.max(score, before)),
    referralPaid,
  };
}

export async function rankOf(uid, week = weekInfo()) {
  const r = await store.zRankDesc(keys.lb(week.key), uid);
  return r === null ? null : r + 1;
}

// Résumé complet pour l'accueil / le profil
export async function summary(uid) {
  const week = weekInfo();
  const u = (await getUser(uid)) || {};
  const r = await recompute(uid, week);
  const today = new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
  const claimed = async (t) => Boolean(await store.get(`claimed:${t}:${uid}`));
  return {
    username: u.username || null,
    email: u.email ? maskEmail(u.email) : null,
    phone: u.phone ? maskPhone(u.phone) : null,
    needsProfile: !u.username || !u.phone,
    refCode: u.refCode || null,
    referrals: Number(u.referrals || 0),
    gamesPlayed: Number(u.games || 0),
    week: week.key,
    endsAt: week.end,
    total: r.total,
    gamePts: r.gamePts,
    bonusPts: r.bonusPts,
    games: r.gameDetail,
    rank: await rankOf(uid, week),
    players: await store.zCard(keys.lb(week.key)),
    missions: {
      follow_fb: await claimed("follow_fb"),
      follow_ig: await claimed("follow_ig"),
      follow_tt: await claimed("follow_tt"),
      share: Boolean(await store.get(`claimed:share:${today}:${uid}`)),
    },
  };
}
