// Classement de la semaine (numéros masqués) + la place du joueur connecté.
import { send, player, weekInfo, maskPhone } from "./_lib/util.js";
import { store } from "./_lib/store.js";

export default async function handler(req, res) {
  const week = weekInfo();
  const lb = `lb:${week.key}`;
  const top = await store.zTop(lb, 10);
  const rows = await Promise.all(
    top.map(async ({ member, score }, i) => ({
      rank: i + 1,
      name: (await store.get(`name:${member}`)) || "Joueur",
      phone: maskPhone(member),
      score,
    }))
  );
  const phone = await player(req);
  let me = null;
  if (phone) {
    const s = await store.zScore(lb, phone);
    if (s !== null) me = { rank: (await store.zRankDesc(lb, phone)) + 1, score: Number(s) };
  }
  return send(res, 200, { week: week.key, endsAt: week.end, players: await store.zCard(lb), rows, me });
}
