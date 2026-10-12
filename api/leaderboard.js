// Classement de la semaine (points cumulés, numéros masqués) + la place du joueur connecté.
import { send, player, weekInfo, maskPhone } from "./_lib/util.js";
import { store } from "./_lib/store.js";
import { keys, rankOf } from "./_lib/points.js";

export default async function handler(req, res) {
  const week = weekInfo();
  const top = await store.zTop(keys.lb(week.key), 20);
  const rows = await Promise.all(
    top.map(async ({ member, score }, i) => ({
      rank: i + 1,
      name: (await store.get(`name:${member}`)) || "Joueur",
      phone: maskPhone(member),
      points: score,
    }))
  );
  const phone = await player(req);
  let me = null;
  if (phone) {
    const s = await store.zScore(keys.lb(week.key), phone);
    if (s !== null) me = { rank: await rankOf(phone, week), points: Number(s) };
  }
  return send(res, 200, { week: week.key, endsAt: week.end, players: await store.zCard(keys.lb(week.key)), rows, me });
}
