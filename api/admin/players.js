// Interface admin : tous les joueurs d'une semaine avec leur numéro,
// leurs points par jeu, leurs bonus et leurs parrainages, pour remettre les prix.
// GET ?week=0 (en cours) / -1 (dernière)… · POST { week, phone, rewarded } pour cocher « récompensé ».
// Protégé par la clé ADMIN_KEY (en-tête x-admin-key).
import { send, body, weekInfo, safeEqual, limited, ip, normalizePhone } from "../_lib/util.js";
import { store } from "../_lib/store.js";
import { keys, GAMES } from "../_lib/points.js";

const PRIZES = ["10 TND + 3 livraisons offertes", "3 livraisons offertes", "3 livraisons offertes"];

export default async function handler(req, res) {
  const key = process.env.ADMIN_KEY || (process.env.DEV_SMS === "1" ? "dev" : "");
  if (await limited(`admin:${ip(req)}`, 60, 600)) return send(res, 429, { error: "Trop d'essais." });
  if (!key || !safeEqual(req.headers["x-admin-key"] || "", key)) return send(res, 401, { error: "Clé admin incorrecte." });

  if (req.method === "POST") {
    const b = body(req);
    const phone = normalizePhone(b.phone);
    if (!phone) return send(res, 400, { error: "Numéro invalide." });
    const week = weekInfo(Math.max(-12, Math.min(0, Number(b.week) || 0)));
    if (b.rewarded === false) await store.del(`rewarded:${week.key}:${phone}`);
    else await store.set(`rewarded:${week.key}:${phone}`, String(Date.now()));
    return send(res, 200, { ok: true });
  }

  const offset = Math.max(-12, Math.min(0, Number(new URL(req.url, "http://x").searchParams.get("week")) || 0));
  const week = weekInfo(offset);
  const top = await store.zTop(keys.lb(week.key), 500);
  const players = await Promise.all(
    top.map(async ({ member, score }, i) => {
      const bests = (await store.hgetall(keys.best(week.key, member))) || {};
      const bonus = (await store.hgetall(keys.bonus(week.key, member))) || {};
      const u = (await store.hgetall(keys.user(member))) || {};
      return {
        rank: i + 1,
        phone: member,
        name: (await store.get(`name:${member}`)) || "—",
        points: score,
        games: Object.fromEntries(Object.keys(GAMES).map((g) => [g, Number(bests[g] || 0)])),
        bonus: Object.fromEntries(Object.entries(bonus).map(([t, v]) => [t, Number(v)])),
        referrals: Number(u.referrals || 0),
        referredBy: u.referredBy || null,
        since: Number(u.createdAt || 0),
        prize: PRIZES[i] || null,
        rewarded: Boolean(await store.get(`rewarded:${week.key}:${member}`)),
      };
    })
  );
  return send(res, 200, {
    week: week.key,
    start: week.start,
    end: week.end,
    totalUsers: await store.zCard(keys.users),
    players,
  });
}
