// Enregistre le score d'une partie. Pour chaque jeu, seul le meilleur score de la
// semaine compte, converti en points (÷ 20, max 50) ; s'y ajoutent les points bonus.
import { send, onlyPost, body, player } from "../_lib/util.js";
import { store } from "../_lib/store.js";
import { GAMES, memoScore, saveScore, rankOf, getUser } from "../_lib/points.js";

export default async function handler(req, res) {
  if (!onlyPost(req, res)) return;
  const uid = await player(req);
  if (!uid) return send(res, 401, { error: "Connectez-vous pour enregistrer votre score." });
  const u = await getUser(uid);
  if (!u?.username || !u?.phone) return send(res, 428, { error: "Complétez votre profil pour enregistrer vos scores." });

  const b = body(req);
  const raw = await store.get(`game:${String(b.gameId || "")}`);
  if (!raw) return send(res, 410, { error: "Partie expirée ou déjà enregistrée." });
  await store.del(`game:${String(b.gameId)}`); // une seule fois par partie
  const started = typeof raw === "string" ? JSON.parse(raw) : raw;
  const cfg = GAMES[started.game];

  const elapsed = (Date.now() - Number(started.t)) / 1000;
  const seconds = Number(b.seconds);
  if (!Number.isFinite(seconds) || seconds < cfg.minSeconds || seconds > elapsed + 3 || seconds > cfg.maxSeconds)
    return send(res, 422, { error: "Score refusé." });

  let score;
  if (started.game === "memo") {
    const moves = Math.floor(Number(b.moves));
    if (!Number.isFinite(moves) || moves < 8 || moves > 400) return send(res, 422, { error: "Score refusé." });
    score = memoScore(moves, seconds);
  } else {
    score = Math.floor(Number(b.score));
    if (!Number.isFinite(score) || score < 0 || score > Math.ceil(seconds * cfg.maxPerSec) + 50)
      return send(res, 422, { error: "Score refusé." });
  }

  const r = await saveScore(uid, started.game, score);
  return send(res, 200, {
    saved: true,
    game: started.game,
    score,
    best: r.gameDetail[started.game].score,
    improved: r.improved,
    pointsBefore: r.pointsBefore,
    pointsNow: r.pointsNow,
    gained: r.pointsNow - r.pointsBefore,
    total: r.total,
    rank: await rankOf(uid),
    referralPaid: r.referralPaid,
  });
}
