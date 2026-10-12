// Démarre une partie : le serveur note l'heure de départ pour vérifier
// ensuite que le score est réaliste.
import { send, onlyPost, limited, ip, randomId } from "../_lib/util.js";
import { store } from "../_lib/store.js";

export default async function handler(req, res) {
  if (!onlyPost(req, res)) return;
  if (await limited(`start:${ip(req)}`, 120, 3600))
    return send(res, 429, { error: "Trop de parties. Faites une pause !" });
  const id = randomId(16);
  await store.set(`game:${id}`, String(Date.now()), { ex: 20 * 60 });
  return send(res, 200, { gameId: id });
}
