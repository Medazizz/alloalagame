// Envoie un code par SMS au numéro du joueur.
import { send, onlyPost, body, normalizePhone, limited, ip } from "../_lib/util.js";
import { sendCode, devSms } from "../_lib/sms.js";

export default async function handler(req, res) {
  if (!onlyPost(req, res)) return;
  const phone = normalizePhone(body(req).phone);
  if (!phone) return send(res, 400, { error: "Numéro tunisien invalide (8 chiffres)." });

  if (await limited(`otp-min:${phone}`, 1, 60))
    return send(res, 429, { error: "Patientez une minute avant de redemander un code." });
  if (await limited(`otp-day:${phone}`, 5, 86400))
    return send(res, 429, { error: "Trop de codes demandés aujourd'hui pour ce numéro." });
  if (await limited(`otp-ip:${ip(req)}`, 20, 3600))
    return send(res, 429, { error: "Trop de demandes. Réessayez plus tard." });

  try {
    const r = await sendCode(phone);
    return send(res, 200, { ok: true, ...(devSms ? { devCode: r.devCode } : {}) });
  } catch (e) {
    console.error("sms", e.message);
    return send(res, 502, { error: "Impossible d'envoyer le SMS pour le moment." });
  }
}
