// Vérifie le code SMS, crée le joueur (avec son parrain éventuel) et ouvre une session (30 jours).
import { send, onlyPost, body, normalizePhone, limited, randomId } from "../_lib/util.js";
import { checkCode } from "../_lib/sms.js";
import { store } from "../_lib/store.js";
import { ensureUser, summary } from "../_lib/points.js";

export default async function handler(req, res) {
  if (!onlyPost(req, res)) return;
  const b = body(req);
  const phone = normalizePhone(b.phone);
  const code = String(b.code || "").replace(/\D/g, "");
  if (!phone || code.length < 4 || code.length > 8) return send(res, 400, { error: "Code invalide." });

  if (await limited(`verify:${phone}`, 6, 900))
    return send(res, 429, { error: "Trop d'essais. Redemandez un code dans 15 minutes." });

  if (!(await checkCode(phone, code))) return send(res, 401, { error: "Code incorrect ou expiré." });

  const { created } = await ensureUser(phone, b.ref);
  const token = randomId();
  await store.set(`sess:${token}`, phone, { ex: 30 * 86400 });
  return send(res, 200, { token, created, me: await summary(phone) });
}
