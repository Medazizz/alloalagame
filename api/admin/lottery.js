// Admin · tirage au sort du mois : les 3 premiers de chaque semaine du mois
// sont inscrits (1 ticket par podium). GET ?month=AAAA-MM · POST { month } pour tirer.
import crypto from "node:crypto";
import { send, body, weekInfo, adminOk } from "../_lib/util.js";
import { store } from "../_lib/store.js";
import { keys, getUser } from "../_lib/points.js";

const thisMonth = () => new Date(Date.now() + 3600e3).toISOString().slice(0, 7);

async function entries(month) {
  const tickets = [];
  for (let off = 0; off >= -8; off--) {
    const w = weekInfo(off);
    if (!w.key.startsWith(month)) continue; // semaines qui commencent dans ce mois
    if (w.end > Date.now() && off === 0) continue; // semaine pas encore terminée
    const top = await store.zTop(keys.lb(w.key), 3);
    for (const [i, { member }] of top.entries()) {
      const u = (await getUser(member)) || {};
      tickets.push({ uid: member, week: w.key, place: i + 1, username: u.username || "—", phone: u.phone || "", email: u.email || "" });
    }
  }
  return tickets;
}

export default async function handler(req, res) {
  if (!(await adminOk(req, res))) return;
  const month = String((req.method === "POST" ? body(req).month : new URL(req.url, "http://x").searchParams.get("month")) || thisMonth());
  if (!/^\d{4}-\d{2}$/.test(month)) return send(res, 400, { error: "Mois invalide." });
  const tickets = await entries(month);
  const drawKey = `draw:${month}`;

  if (req.method === "POST") {
    if (await store.get(drawKey)) return send(res, 409, { error: "Le tirage de ce mois a déjà eu lieu." });
    if (!tickets.length) return send(res, 400, { error: "Aucun participant ce mois-ci." });
    const winner = tickets[crypto.randomInt(tickets.length)];
    const draw = { ...winner, at: Date.now(), tickets: tickets.length };
    await store.set(drawKey, JSON.stringify(draw));
    return send(res, 200, { month, tickets, draw });
  }
  const raw = await store.get(drawKey);
  const draw = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;
  return send(res, 200, { month, tickets, draw });
}
