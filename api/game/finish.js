// Enregistre le score d'une partie terminée dans le classement de la semaine.
// Le meilleur score de la semaine est gardé pour chaque numéro (= 1 place max).
import { send, onlyPost, body, player, weekInfo, profile } from "../_lib/util.js";
import { store } from "../_lib/store.js";

// Plafonds de vraisemblance (doivent rester cohérents avec src/game.js)
const MAX_POINTS_PER_SEC = 200; // ~150 pts/s au maximum théorique (1 maison / 3,2 s × 450)
const GAME_SECONDS = 60;

export default async function handler(req, res) {
  if (!onlyPost(req, res)) return;
  const phone = await player(req);
  if (!phone) return send(res, 401, { error: "Connectez-vous pour enregistrer votre score." });

  const b = body(req);
  const id = String(b.gameId || "");
  const score = Math.floor(Number(b.score));
  const deliveries = Math.floor(Number(b.deliveries));
  const seconds = Number(b.seconds);
  if (!id || !Number.isFinite(score) || score < 0 || !Number.isFinite(seconds)) return send(res, 400, { error: "Partie invalide." });

  const started = await store.get(`game:${id}`);
  if (!started) return send(res, 410, { error: "Partie expirée ou déjà enregistrée." });
  await store.del(`game:${id}`); // une seule fois par partie

  const elapsed = (Date.now() - Number(started)) / 1000;
  const played = Math.min(seconds, elapsed + 2, GAME_SECONDS + 30);
  const plausible =
    seconds >= 3 &&
    seconds <= elapsed + 3 &&
    score <= Math.ceil(played * MAX_POINTS_PER_SEC) + 50 &&
    deliveries >= 0 && deliveries <= Math.ceil(played);
  if (!plausible) return send(res, 422, { error: "Score refusé." });

  const week = weekInfo();
  const lb = `lb:${week.key}`;
  const before = await store.zScore(lb, phone);
  await store.zaddGt(lb, score, phone);
  const best = Number(await store.zScore(lb, phone));
  const rank = (await store.zRankDesc(lb, phone)) + 1;
  return send(res, 200, {
    saved: true,
    best,
    newBest: before === null || score > Number(before),
    rank,
    players: await store.zCard(lb),
    profile: await profile(phone),
  });
}
