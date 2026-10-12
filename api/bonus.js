// Missions bonus : abonnements Facebook / Instagram / TikTok (une seule fois),
// partage (une fois par jour). Les abonnements sont déclaratifs.
import { send, onlyPost, body, player } from "./_lib/util.js";
import { store } from "./_lib/store.js";
import { BONUS, addBonus, rankOf, getUser } from "./_lib/points.js";

export default async function handler(req, res) {
  if (!onlyPost(req, res)) return;
  const uid = await player(req);
  if (!uid) return send(res, 401, { error: "Connectez-vous pour gagner des points." });
  const u = await getUser(uid);
  if (!u?.username || !u?.phone) return send(res, 428, { error: "Complétez votre profil d'abord." });
  const type = String(body(req).type || "");
  const rule = BONUS[type];
  if (!rule || !(rule.once || rule.daily)) return send(res, 400, { error: "Mission inconnue." });

  const today = new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
  const flag = rule.once ? `claimed:${type}:${uid}` : `claimed:${type}:${today}:${uid}`;
  const ok = await store.set(flag, String(Date.now()), rule.once ? { nx: true } : { nx: true, ex: 2 * 86400 });
  if (!ok) return send(res, 409, { error: rule.once ? "Déjà obtenu." : "Déjà obtenu aujourd'hui, revenez demain !" });

  const r = await addBonus(uid, type, rule.points);
  return send(res, 200, { ok: true, points: rule.points, total: r.total, rank: await rankOf(uid) });
}
