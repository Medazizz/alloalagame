// Admin · base de données : tous les comptes inscrits (les plus récents d'abord).
import { send, adminOk } from "../_lib/util.js";
import { store } from "../_lib/store.js";
import { keys, getUser, nameOf } from "../_lib/points.js";

export default async function handler(req, res) {
  if (!(await adminOk(req, res))) return;
  const all = await store.zTop(keys.users, 5000); // trié par date d'inscription (plus récent d'abord)
  const users = await Promise.all(
    all.map(async ({ member }) => {
      const u = (await getUser(member)) || {};
      return {
        uid: member,
        username: u.username || "",
        email: u.email || "",
        phone: u.phone || "",
        createdAt: Number(u.createdAt || 0),
        lastSeen: Number(u.lastSeen || 0),
        games: Number(u.games || 0),
        bonusAll: Number(u.bonusAll || 0),
        referrals: Number(u.referrals || 0),
        referredBy: u.referredBy ? await nameOf(String(u.referredBy)) : "",
        consent: Boolean(u.consentAt),
      };
    })
  );
  return send(res, 200, { count: users.length, users });
}
