// État de la configuration (sans rien révéler de secret) :
// base de données, envoi des e-mails, mot de passe admin.
import { send } from "./_lib/util.js";
import { store, storeConfigured } from "./_lib/store.js";
import { mailConfigured, mailMethod } from "./_lib/mail.js";

export default async function handler(req, res) {
  let database = storeConfigured ? "configurée" : "absente";
  if (storeConfigured) {
    try {
      await store.set("health:ping", String(Date.now()), { ex: 60 });
      database = "ok";
    } catch (e) {
      database = "erreur : " + e.message.slice(0, 80);
    }
  }
  const ready = database === "ok" && mailConfigured && Boolean(process.env.ADMIN_KEY);
  return send(res, ready ? 200 : 503, {
    ready,
    database,
    email: mailConfigured ? `ok (${mailMethod})` : "absent (SMTP_HOST, SMTP_USER, SMTP_PASS)",
    admin: process.env.ADMIN_KEY ? "ok" : "absent (ADMIN_KEY)",
  });
}
