// Démarre une partie : le serveur note le jeu et l'heure de départ
// pour vérifier ensuite que le score est réaliste.
import { send, onlyPost, body, limited, ip, randomId } from "../_lib/util.js";
import { store } from "../_lib/store.js";
import { GAMES } from "../_lib/points.js";

export default async function handler(req, res) {
  if (!onlyPost(req, res)) return;
  const game = String(body(req).game || "");
  if (!GAMES[game]) return send(res, 400, { error: "Jeu inconnu." });
  if (await limited(`start:${ip(req)}`, 150, 3600)) return send(res, 429, { error: "Trop de parties. Faites une pause !" });
  const id = randomId(16);
  await store.set(`game:${id}`, JSON.stringify({ game, t: Date.now() }), { ex: 20 * 60 });
  return send(res, 200, { gameId: id });
}
