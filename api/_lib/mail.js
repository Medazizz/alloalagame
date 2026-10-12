// Vérification par e-mail (gratuite) : un code à 6 chiffres envoyé par e-mail.
// Fournisseurs gratuits pris en charge :
//   - Brevo  : BREVO_API_KEY  (300 e-mails / jour gratuits, expéditeur = une simple adresse vérifiée, ex. Gmail)
//   - Resend : RESEND_API_KEY (100 e-mails / jour gratuits)
// MAIL_FROM = adresse d'expédition (ex. alloala.jeux@gmail.com), MAIL_NAME = nom affiché.
// Sans clé : mode test, le code est renvoyé à l'écran uniquement si DEV_MAIL=1 (jamais en production).
import crypto from "node:crypto";
import { store } from "./store.js";

const BREVO = process.env.BREVO_API_KEY;
const RESEND = process.env.RESEND_API_KEY;
const FROM = process.env.MAIL_FROM || "";
const NAME = process.env.MAIL_NAME || "Allo..Ala Jeux";

export const mailConfigured = Boolean((BREVO || RESEND) && FROM);
export const devMail = !mailConfigured && process.env.DEV_MAIL === "1";

const hash = (s) => crypto.createHash("sha256").update(s).digest("hex");

function template(code) {
  return `<!doctype html><html><body style="margin:0;background:#081B40;font-family:Arial,Helvetica,sans-serif;color:#F3F6FC">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
    <table width="100%" style="max-width:440px;background:#0F2C5E;border-radius:20px;padding:28px" cellpadding="0" cellspacing="0">
      <tr><td style="font-size:24px;font-weight:bold">Allo<span style="color:#FF8438">..Ala</span> Jeux</td></tr>
      <tr><td style="padding-top:18px;font-size:16px;line-height:1.5;color:#DCE6FA">Voici votre code de connexion :</td></tr>
      <tr><td style="padding:18px 0"><div style="font-size:40px;letter-spacing:10px;font-weight:bold;color:#FF8438;background:#081B40;border-radius:14px;padding:16px;text-align:center">${code}</div></td></tr>
      <tr><td style="font-size:14px;line-height:1.5;color:#A9B8D6">Ce code est valable 10 minutes. Si vous n'avez rien demandé, ignorez cet e-mail.</td></tr>
      <tr><td style="padding-top:20px;font-size:13px;color:#A9B8D6">كلمني ... نفضهالك · Sbeïtla &amp; Kasserine</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

async function deliver(email, code) {
  const subject = `${code} est votre code Allo..Ala Jeux`;
  const html = template(code);
  const text = `Votre code Allo..Ala Jeux : ${code} (valable 10 minutes).`;
  let r;
  if (BREVO) {
    r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: { email: FROM, name: NAME }, to: [{ email }], subject, htmlContent: html, textContent: text }),
    });
  } else {
    r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${NAME} <${FROM}>`, to: [email], subject, html, text }),
    });
  }
  if (!r.ok) throw new Error(`mail ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

export async function sendCode(email) {
  if (!mailConfigured && !devMail) throw new Error("E-mail non configuré");
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  await store.set(`otp:${email}`, JSON.stringify({ h: hash(`${email}:${code}`), n: 0 }), { ex: 600 });
  if (mailConfigured) {
    await deliver(email, code);
    return {};
  }
  return { devCode: code };
}

export async function checkCode(email, code) {
  const raw = await store.get(`otp:${email}`);
  if (!raw) return false;
  const o = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (o.n >= 5) return false; // trop d'essais sur ce code
  if (o.h === hash(`${email}:${code}`)) {
    await store.del(`otp:${email}`);
    return true;
  }
  await store.set(`otp:${email}`, JSON.stringify({ ...o, n: o.n + 1 }), { ex: 600 });
  return false;
}
