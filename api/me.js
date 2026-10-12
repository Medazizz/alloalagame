// Profil du joueur connecté : GET pour lire, POST { name } pour choisir son pseudo.
import { send, body, player, profile, cleanName } from "./_lib/util.js";
import { store } from "./_lib/store.js";

export default async function handler(req, res) {
  const phone = await player(req);
  if (!phone) return send(res, 401, { error: "Non connecté." });
  if (req.method === "POST") {
    const name = cleanName(body(req).name);
    if (!name) return send(res, 400, { error: "Pseudo : 2 à 18 caractères." });
    await store.set(`name:${phone}`, name);
  }
  return send(res, 200, { profile: await profile(phone) });
}
