// Outils partagés par les fonctions du serveur.
import crypto from "node:crypto";
import { store } from "./store.js";

export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

export function onlyPost(req, res) {
  if (req.method !== "POST") {
    send(res, 405, { error: "Méthode non autorisée" });
    return false;
  }
  return true;
}

export function body(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "string") {
    try { return JSON.parse(b); } catch { return {}; }
  }
  return b;
}

// Numéro tunisien : 8 chiffres, mobile (commence par 2, 4, 5 ou 9).
// Accepte « 93 332 862 », « +216 93332862 », « 0021693332862 »…
export function normalizePhone(input) {
  let d = String(input || "").replace(/\D/g, "");
  if (d.startsWith("00216")) d = d.slice(5);
  else if (d.startsWith("216") && d.length === 11) d = d.slice(3);
  if (!/^[2459]\d{7}$/.test(d)) return null;
  return `+216${d}`;
}

export function normalizeEmail(input) {
  const e = String(input || "").trim().toLowerCase();
  return /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/.test(e) ? e : null;
}

export function maskEmail(e) {
  const [u, d] = String(e).split("@");
  return `${u.slice(0, 2)}•••@${d}`;
}

export function maskPhone(e164) {
  const d = e164.replace("+216", "");
  return `${d.slice(0, 2)} ••• ${d.slice(5)}`;
}

export const randomId = (bytes = 24) => crypto.randomBytes(bytes).toString("base64url");

export function ip(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "local").split(",")[0].trim();
}

// Limite de débit : au plus `max` appels par `seconds` pour une clé donnée
export async function limited(key, max, seconds) {
  const n = await store.incr(`rl:${key}`);
  if (n === 1) await store.expire(`rl:${key}`, seconds);
  return n > max;
}

// Semaine du jeu : du lundi 00:00 au dimanche 23:59, heure de Tunisie (UTC+1)
export function weekInfo(offsetWeeks = 0, now = Date.now()) {
  const tn = new Date(now + 3600 * 1000); // heure tunisienne lue en UTC
  const day = (tn.getUTCDay() + 6) % 7; // lundi = 0
  const monday = Date.UTC(tn.getUTCFullYear(), tn.getUTCMonth(), tn.getUTCDate() - day) - 3600 * 1000;
  const start = monday + offsetWeeks * 7 * 86400 * 1000;
  const end = start + 7 * 86400 * 1000;
  const d = new Date(start + 3600 * 1000);
  return { key: d.toISOString().slice(0, 10), start, end };
}

// Session du joueur (jeton envoyé dans l'en-tête Authorization)
export async function player(req) {
  const h = String(req.headers.authorization || "");
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token || token.length > 100) return null;
  const uid = await store.get(`sess:${token}`);
  return uid ? String(uid) : null;
}

// Nom d'utilisateur : 3 à 16 caractères, lettres (accents compris), chiffres, _ . -
export function cleanUsername(s) {
  const n = String(s || "").trim();
  return /^[\p{L}\p{N}_.-]{3,16}$/u.test(n) ? n : null;
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Accès admin : clé ADMIN_KEY dans l'en-tête x-admin-key (« dev » en local)
export async function adminOk(req, res) {
  const key = process.env.ADMIN_KEY || (process.env.DEV_MAIL === "1" ? "dev" : "");
  if (await limited(`admin:${ip(req)}`, 120, 600)) {
    send(res, 429, { error: "Trop d'essais." });
    return false;
  }
  if (!key || !safeEqual(req.headers["x-admin-key"] || "", key)) {
    send(res, 401, { error: "Clé admin incorrecte." });
    return false;
  }
  return true;
}
