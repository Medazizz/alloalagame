// Admin · semaine : tous les joueurs classés avec leurs coordonnées, leurs points
// et les 3 gagnants à récompenser. GET ?week=0|-1|… · POST { week, uid, rewarded }.
import { send, body, weekInfo, adminOk } from "../_lib/util.js";
import { store } from "../_lib/store.js";
import { keys, GAMES, PRIZES, gamePoints } from "../_lib/points.js";

export default async function handler(req, res) {
  if (!(await adminOk(req, res))) return;
  if (req.method === "POST") {
    const b = body(req);
    const week = weekInfo(Math.max(-12, Math.min(0, Number(b.week) || 0)));
    const uid = String(b.uid || "");
    if (!/^u_[\w-]{6,20}$/.test(uid)) return send(res, 400, { error: "Joueur invalide." });
    if (b.rewarded === false) await store.del(`rewarded:${week.key}:${uid}`);
    else await store.set(`rewarded:${week.key}:${uid}`, String(Date.now()));
    return send(res, 200, { ok: true });
  }

  const offset = Math.max(-12, Math.min(0, Number(new URL(req.url, "http://x").searchParams.get("week")) || 0));
  const week = weekInfo(offset);
  const top = await store.zTop(keys.lb(week.key), 1000);
  const players = await Promise.all(
    top.map(async ({ member, score }, i) => {
      const bests = (await store.hgetall(keys.best(week.key, member))) || {};
      const bonus = (await store.hgetall(keys.bonus(week.key, member))) || {};
      const u = (await store.hgetall(keys.user(member))) || {};
      return {
        rank: i + 1,
        uid: member,
        username: u.username || "—",
        email: u.email || "",
        phone: u.phone || "",
        points: score,
        games: Object.fromEntries(Object.keys(GAMES).map((g) => [g, { score: Number(bests[g] || 0), points: gamePoints(bests[g]) }])),
        bonus: Object.fromEntries(Object.entries(bonus).map(([t, v]) => [t, Number(v)])),
        referrals: Number(u.referrals || 0),
        prize: PRIZES[i] || null,
        rewarded: Boolean(await store.get(`rewarded:${week.key}:${member}`)),
      };
    })
  );
  return send(res, 200, { week: week.key, start: week.start, end: week.end, totalUsers: await store.zCard(keys.users), players });
}
