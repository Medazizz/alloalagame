// Interface admin (…/#admin) : tous les joueurs de la semaine avec leur numéro,
// leurs points, et les gagnants à récompenser dans l'application Allo..Ala.
import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { games } from "./config.js";

const fmtDate = (ms) => new Date(ms).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const fmt = (n) => Number(n || 0).toLocaleString("fr-FR");
const BONUS_LABEL = { follow_fb: "Facebook", follow_ig: "Instagram", share: "Partages", referral: "Parrainages", welcome: "Bienvenue" };

function csv(rows, week) {
  const head = ["Rang", "Pseudo", "Téléphone", "Points", ...games.map((g) => g.name), "Bonus", "Amis parrainés", "Prix", "Récompensé"];
  const lines = rows.map((p) => [
    p.rank, p.name, p.phone, p.points, ...games.map((g) => p.games[g.id]),
    Object.values(p.bonus).reduce((a, b) => a + b, 0), p.referrals, p.prize || "", p.rewarded ? "oui" : "non",
  ]);
  const text = [head, ...lines].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `allo-ala-jeux-${week}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Admin() {
  const [key, setKey] = useState(() => { try { return sessionStorage.getItem("aa-admin") || ""; } catch { return ""; } });
  const [week, setWeek] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);

  async function load(k = key, w = week) {
    setError("");
    try {
      const d = await api(`admin/players?week=${w}`, { headers: { "x-admin-key": k } });
      setData(d);
      try { sessionStorage.setItem("aa-admin", k); } catch { /* rien */ }
    } catch (e) {
      setData(null);
      setError(e.message);
    }
  }
  useEffect(() => { if (key) load(key, week); }, [week]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(p) {
    await api("admin/players", { method: "POST", headers: { "x-admin-key": key }, body: { week, phone: p.phone, rewarded: !p.rewarded } });
    load();
  }

  const list = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/\s/g, "");
    if (!data) return [];
    return s ? data.players.filter((p) => p.name.toLowerCase().includes(s) || p.phone.includes(s)) : data.players;
  }, [data, q]);
  const winners = data?.players.slice(0, 3) || [];

  return (
    <main className="admin-app">
      <header className="admin-top">
        <h1>🔒 Admin · Allo..Ala Jeux</h1>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="admin-key">
          <input type="password" placeholder="Clé admin" value={key} onChange={(e) => setKey(e.target.value)} />
          <button className="btn primary">Ouvrir</button>
        </form>
      </header>
      {error && <p className="err">{error}</p>}

      {data && (
        <>
          <div className="admin-bar">
            <button className="btn" onClick={() => setWeek(Math.max(-12, week - 1))}>←</button>
            <div className="admin-week">
              <b>{week === 0 ? "Semaine en cours" : week === -1 ? "Semaine dernière" : `Il y a ${-week} semaines`}</b>
              <small>du {fmtDate(data.start)} au {fmtDate(data.end - 1)}</small>
            </div>
            <button className="btn" disabled={week >= 0} onClick={() => setWeek(Math.min(0, week + 1))}>→</button>
          </div>

          <div className="admin-stats">
            <div><b>{data.players.length}</b><small>joueurs cette semaine</small></div>
            <div><b>{data.totalUsers}</b><small>inscrits au total</small></div>
            <div><b>{data.players.reduce((a, p) => a + (p.bonus.referral ? p.bonus.referral / 200 : 0), 0)}</b><small>amis parrainés</small></div>
          </div>

          <h2 className="sec">🏆 Gagnants {week === 0 && <small>(provisoire jusqu'à dimanche 23:59)</small>}</h2>
          <div className="winners">
            {winners.map((p) => (
              <div key={p.phone} className={`winner w${p.rank}`}>
                <span className="medal">{["🥇", "🥈", "🥉"][p.rank - 1]}</span>
                <div className="w-info">
                  <b>{p.name}</b>
                  <a href={`tel:${p.phone}`} className="w-phone">{p.phone}</a>
                  <small>{fmt(p.points)} pts · {p.prize}</small>
                </div>
                <div className="w-actions">
                  <a
                    className="btn mini"
                    href={`https://wa.me/${p.phone.replace("+", "")}?text=${encodeURIComponent(`Félicitations ${p.name} ! 🎉 Vous êtes ${p.rank === 1 ? "1er" : `${p.rank}e`} du classement Allo..Ala Jeux. Votre prix : ${p.prize}. Il est crédité sur votre compte Allo..Ala.`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >💬 Prévenir</a>
                  <button className={`btn mini ${p.rewarded ? "ok" : "primary"}`} onClick={() => toggle(p)}>
                    {p.rewarded ? "✓ Récompensé" : "Marquer récompensé"}
                  </button>
                </div>
              </div>
            ))}
            {!winners.length && <p className="muted">Aucun joueur cette semaine.</p>}
          </div>

          <div className="admin-tools">
            <h2 className="sec">👥 Tous les joueurs</h2>
            <input className="search" placeholder="Rechercher un nom ou un numéro…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn" onClick={() => csv(data.players, data.week)}>⬇️ Export Excel (CSV)</button>
          </div>

          <div className="table-wrap">
            <table className="ptable">
              <thead>
                <tr>
                  <th>#</th><th>Joueur</th><th>Téléphone</th><th>Points</th>
                  {games.map((g) => <th key={g.id}>{g.emoji}</th>)}
                  <th>🎁</th><th>🤝</th><th>Prix</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const b = Object.values(p.bonus).reduce((a, x) => a + x, 0);
                  return [
                    <tr key={p.phone} onClick={() => setOpen(open === p.phone ? null : p.phone)} className={p.rank <= 3 ? "is-top" : ""}>
                      <td>{p.rank}</td>
                      <td>{p.name}</td>
                      <td><a href={`tel:${p.phone}`} onClick={(e) => e.stopPropagation()}>{p.phone}</a></td>
                      <td><b>{fmt(p.points)}</b></td>
                      {games.map((g) => <td key={g.id}>{fmt(p.games[g.id])}</td>)}
                      <td>{fmt(b)}</td>
                      <td>{p.referrals}</td>
                      <td>{p.rank <= 3 ? (p.rewarded ? "✓" : "⏳") : ""}</td>
                    </tr>,
                    open === p.phone && (
                      <tr key={`${p.phone}-d`} className="detail">
                        <td colSpan={8 + games.length}>
                          <b>Bonus :</b>{" "}
                          {Object.keys(p.bonus).length ? Object.entries(p.bonus).map(([t, v]) => `${BONUS_LABEL[t] || t} +${v}`).join(" · ") : "aucun"}
                          {" · "}<b>Inscrit le</b> {p.since ? fmtDate(p.since) : "—"}
                          {p.referredBy && <> · <b>Parrain :</b> {p.referredBy}</>}
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
