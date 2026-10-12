// Missions bonus : abonnement Facebook / Instagram (une seule fois),
// partage (une fois par jour). Les abonnements sont déclaratifs.
import { send, onlyPost, body, player } from "./_lib/util.js";
import { store } from "./_lib/store.js";
import { BONUS, addBonus, rankOf } from "./_lib/points.js";

export default async function handler(req, res) {
  if (!onlyPost(req, res)) return;
  const phone = await player(req);
  if (!phone) return send(res, 401, { error: "Connectez-vous pour gagner des points." });
  const type = String(body(req).type || "");
  const rule = BONUS[type];
  if (!rule || !(rule.once || rule.daily)) return send(res, 400, { error: "Mission inconnue." });

  const today = new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
  const flag = rule.once ? `claimed:${type}:${phone}` : `claimed:${type}:${today}:${phone}`;
  const ok = await store.set(flag, String(Date.now()), rule.once ? { nx: true } : { nx: true, ex: 2 * 86400 });
  if (!ok) return send(res, 409, { error: rule.once ? "Déjà obtenu." : "Déjà obtenu aujourd'hui, revenez demain !" });

  const r = await addBonus(phone, type, rule.points);
  return send(res, 200, { ok: true, points: rule.points, total: r.total, rank: await rankOf(phone) });
}
