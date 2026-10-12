// Page admin : les 3 gagnants d'une semaine avec leur vrai numéro,
// pour créditer les récompenses dans l'application Allo..Ala.
// GET ?week=0 (semaine en cours) ou -1 (semaine dernière)
// POST { week, phone } : marquer le gagnant comme récompensé.
// Protégé par la clé ADMIN_KEY (en-tête x-admin-key).
import { send, body, weekInfo, safeEqual, limited, ip, normalizePhone } from "../_lib/util.js";
import { store } from "../_lib/store.js";

const PRIZES = [
  "10 TND + 3 livraisons offertes",
  "3 livraisons offertes",
  "3 livraisons offertes",
];

export default async function handler(req, res) {
  const key = process.env.ADMIN_KEY || (process.env.DEV_SMS === "1" ? "dev" : "");
  if (await limited(`admin:${ip(req)}`, 30, 600)) return send(res, 429, { error: "Trop d'essais." });
  if (!key || !safeEqual(req.headers["x-admin-key"] || "", key)) return send(res, 401, { error: "Clé admin incorrecte." });

  if (req.method === "POST") {
    const b = body(req);
    const phone = normalizePhone(b.phone);
    if (!phone) return send(res, 400, { error: "Numéro invalide." });
    const week = weekInfo(Math.max(-8, Math.min(0, Number(b.week) || 0)));
    await store.set(`rewarded:${week.key}:${phone}`, String(Date.now()));
    return send(res, 200, { ok: true });
  }

  const offset = Math.max(-8, Math.min(0, Number(new URL(req.url, "http://x").searchParams.get("week")) || 0));
  const week = weekInfo(offset);
  const lb = `lb:${week.key}`;
  const top = await store.zTop(lb, 3);
  const winners = await Promise.all(
    top.map(async ({ member, score }, i) => ({
      rank: i + 1,
      phone: member,
      name: (await store.get(`name:${member}`)) || "—",
      score,
      prize: PRIZES[i],
      rewarded: Boolean(await store.get(`rewarded:${week.key}:${member}`)),
    }))
  );
  return send(res, 200, { week: week.key, start: week.start, end: week.end, players: await store.zCard(lb), winners });
}
