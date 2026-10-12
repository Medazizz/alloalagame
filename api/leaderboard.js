// Classement de la semaine : top 50 par nom d'utilisateur + la place du joueur connecté
// et l'écart avec le joueur juste devant (pour suivre sa progression).
import { send, player, weekInfo } from "./_lib/util.js";
import { store } from "./_lib/store.js";
import { keys, rankOf, nameOf } from "./_lib/points.js";

export default async function handler(req, res) {
  const week = weekInfo();
  const lb = keys.lb(week.key);
  const top = await store.zTop(lb, 50);
  const uid = await player(req);
  const rows = await Promise.all(
    top.map(async ({ member, score }, i) => ({ rank: i + 1, name: await nameOf(member), points: score, me: member === uid }))
  );
  let me = null;
  if (uid) {
    const s = await store.zScore(lb, uid);
    if (s !== null) {
      const rank = await rankOf(uid, week);
      let gap = null;
      if (rank > 1) {
        const above = (await store.zTop(lb, rank - 1)).pop();
        gap = { name: await nameOf(above.member), points: Number(above.score) - Number(s) + 1, rank: rank - 1 };
      }
      me = { rank, points: Number(s), gap, name: await nameOf(uid) };
    }
  }
  return send(res, 200, { week: week.key, endsAt: week.end, players: await store.zCard(lb), rows, me });
}
