// Profil du joueur connecté.
// GET : résumé (points, rang, missions…) · POST { username, phone, consent } : compléter le profil.
import { send, body, player, cleanUsername, normalizePhone } from "./_lib/util.js";
import { getUser, setProfile, summary } from "./_lib/points.js";

export default async function handler(req, res) {
  const uid = await player(req);
  if (!uid) return send(res, 401, { error: "Non connecté." });
  if (req.method === "POST") {
    const b = body(req);
    const u = (await getUser(uid)) || {};
    const username = b.username !== undefined ? cleanUsername(b.username) : null;
    const phone = b.phone !== undefined ? normalizePhone(b.phone) : null;
    if (b.username !== undefined && !username) return send(res, 400, { error: "Nom d'utilisateur : 3 à 16 caractères (lettres, chiffres, _ . -)." });
    if (b.phone !== undefined && !phone) return send(res, 400, { error: "Numéro tunisien invalide (8 chiffres)." });
    if (!u.consentAt && !b.consent) return send(res, 400, { error: "Merci d'accepter le règlement pour continuer." });
    const r = await setProfile(uid, { username, phone, consent: Boolean(b.consent) });
    if (r.error) return send(res, 409, { error: r.error });
  }
  return send(res, 200, { me: await summary(uid) });
}
