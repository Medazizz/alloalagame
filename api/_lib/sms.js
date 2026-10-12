// Vérification du numéro par SMS.
// En ligne : Twilio Verify (variables TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
// TWILIO_VERIFY_SID). Sans ces variables : mode test, le code est
// enregistré côté serveur et renvoyé seulement si DEV_SMS=1 (jamais en production).
import crypto from "node:crypto";
import { store } from "./store.js";

const SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH = process.env.TWILIO_AUTH_TOKEN;
const VERIFY = process.env.TWILIO_VERIFY_SID;

export const smsConfigured = Boolean(SID && AUTH && VERIFY);
export const devSms = !smsConfigured && process.env.DEV_SMS === "1";

async function twilio(path, params) {
  const r = await fetch(`https://verify.twilio.com/v2/Services/${VERIFY}/${path}`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${SID}:${AUTH}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || `Twilio ${r.status}`);
  return data;
}

export async function sendCode(phone) {
  if (smsConfigured) {
    await twilio("Verifications", { To: phone, Channel: "sms", Locale: "fr" });
    return {};
  }
  if (!devSms) throw new Error("SMS non configuré");
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  await store.set(`devotp:${phone}`, code, { ex: 600 });
  return { devCode: code };
}

export async function checkCode(phone, code) {
  if (smsConfigured) {
    try {
      const r = await twilio("VerificationCheck", { To: phone, Code: code });
      return r.status === "approved";
    } catch {
      return false;
    }
  }
  if (!devSms) return false;
  const saved = await store.get(`devotp:${phone}`);
  if (saved && String(saved) === code) {
    await store.del(`devotp:${phone}`);
    return true;
  }
  return false;
}
