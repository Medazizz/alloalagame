// Vérifie le code reçu par e-mail, crée le compte si besoin et ouvre une session (30 jours).
import { send, onlyPost, body, normalizeEmail, limited, randomId } from "../_lib/util.js";
import { checkCode } from "../_lib/mail.js";
import { store } from "../_lib/store.js";
import { userForEmail, summary } from "../_lib/points.js";

export default async function handler(req, res) {
  if (!onlyPost(req, res)) return;
  const b = body(req);
  const email = normalizeEmail(b.email);
  const code = String(b.code || "").replace(/\D/g, "");
  if (!email || code.length !== 6) return send(res, 400, { error: "Code invalide." });
  if (await limited(`verify:${email}`, 8, 900)) return send(res, 429, { error: "Trop d'essais. Redemandez un code dans 15 minutes." });

  if (!(await checkCode(email, code))) return send(res, 401, { error: "Code incorrect ou expiré." });

  const { uid, created } = await userForEmail(email, b.ref);
  const token = randomId();
  await store.set(`sess:${token}`, uid, { ex: 30 * 86400 });
  return send(res, 200, { token, created, me: await summary(uid) });
}
