// Envoie un code de connexion par e-mail (gratuit).
import { send, onlyPost, body, normalizeEmail, limited, ip } from "../_lib/util.js";
import { sendCode, devMail } from "../_lib/mail.js";

export default async function handler(req, res) {
  if (!onlyPost(req, res)) return;
  const email = normalizeEmail(body(req).email);
  if (!email) return send(res, 400, { error: "Adresse e-mail invalide." });

  if (await limited(`mail-min:${email}`, 1, 45)) return send(res, 429, { error: "Patientez quelques secondes avant de redemander un code." });
  if (await limited(`mail-day:${email}`, 8, 86400)) return send(res, 429, { error: "Trop de codes demandés aujourd'hui pour cette adresse." });
  if (await limited(`mail-ip:${ip(req)}`, 25, 3600)) return send(res, 429, { error: "Trop de demandes. Réessayez plus tard." });

  try {
    const r = await sendCode(email);
    return send(res, 200, { ok: true, ...(devMail ? { devCode: r.devCode } : {}) });
  } catch (e) {
    console.error("mail", e.message);
    return send(res, 502, { error: "Impossible d'envoyer l'e-mail pour le moment. Réessayez." });
  }
}
