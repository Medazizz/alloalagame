// Interface admin (…/#admin) — 3 onglets :
//   Semaine       : classement complet avec coordonnées + gagnants à récompenser
//   Utilisateurs  : toute la base de données des inscrits
//   Tirage du mois: les gagnants hebdo du mois et le tirage au sort du prix secret
import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { games, prizes } from "./config.js";

const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—");
const fmtDay = (ms) => new Date(ms).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const fmt = (n) => Number(n || 0).toLocaleString("fr-FR");
const BONUS_LABEL = { follow_fb: "Facebook", follow_ig: "Instagram", follow_tt: "TikTok", share: "Partages", referral: "Parrainages", welcome: "Bienvenue" };
const sumBonus = (b) => Object.values(b || {}).reduce((a, x) => a + x, 0);

function downloadCsv(name, head, lines) {
  const text = [head, ...lines].map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

const waLink = (phone, text) => `https://wa.me/${String(phone).replace("+", "")}?text=${encodeURIComponent(text)}`;

function Week({ adminKey }) {
  const [week, setWeek] = useState(-1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const load = () =>
    api(`admin/players?week=${week}`, { headers: { "x-admin-key": adminKey } }).then(setData).catch((e) => setError(e.message));
  useEffect(() => { setData(null); load(); }, [week]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(p) {
    await api("admin/players", { method: "POST", headers: { "x-admin-key": adminKey }, body: { week, uid: p.uid, rewarded: !p.rewarded } });
    load();
  }
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!data) return [];
    return s ? data.players.filter((p) => [p.username, p.email, p.phone].some((v) => v.toLowerCase().includes(s))) : data.players;
  }, [data, q]);

  if (error) return <p className="err">{error}</p>;
  if (!data) return <div className="skeleton" />;
  const winners = data.players.slice(0, 3);
  return (
    <>
      <div className="admin-bar">
        <button className="btn" onClick={() => setWeek(Math.max(-12, week - 1))} aria-label="Semaine précédente">←</button>
        <div className="admin-week">
          <b>{week === 0 ? "Semaine en cours" : week === -1 ? "Semaine dernière" : `Il y a ${-week} semaines`}</b>
          <small>du {fmtDay(data.start)} au {fmtDay(data.end - 1)}</small>
        </div>
        <button className="btn" disabled={week >= 0} onClick={() => setWeek(Math.min(0, week + 1))} aria-label="Semaine suivante">→</button>
      </div>

      <h2 className="sec">🏆 Gagnants {week === 0 && <small>(provisoire jusqu'à dimanche 23:59)</small>}</h2>
      <div className="winners">
        {winners.map((p) => (
          <div key={p.uid} className={`winner w${p.rank}`}>
            <span className="medal">{prizes[p.rank - 1].medal}</span>
            <div className="w-info">
              <b>{p.username}</b>
              <a href={`tel:${p.phone}`} className="w-phone">{p.phone}</a>
              <small>{p.email}</small>
              <small>{fmt(p.points)} pts · <b>{p.prize}</b> + 🎟️ tirage du mois</small>
            </div>
            <div className="w-actions">
              <a className="btn mini" target="_blank" rel="noreferrer"
                href={waLink(p.phone, `Félicitations ${p.username} ! 🎉 Vous êtes ${p.rank === 1 ? "1er" : `${p.rank}e`} du classement Allo..Ala Jeux. Votre prix : ${p.prize}, crédité sur votre compte Allo..Ala. Vous participez aussi au tirage au sort du mois 🎟️`)}>💬 Prévenir</a>
              <button className={`btn mini ${p.rewarded ? "ok" : "primary"}`} onClick={() => toggle(p)}>{p.rewarded ? "✓ Récompensé" : "Marquer récompensé"}</button>
            </div>
          </div>
        ))}
        {!winners.length && <p className="muted">Aucun joueur cette semaine.</p>}
      </div>

      <div className="admin-tools">
        <h2 className="sec">👥 Classement complet ({data.players.length})</h2>
        <input className="search" placeholder="Rechercher un nom, un e-mail ou un numéro…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={() => downloadCsv(`classement-${data.week}.csv`,
          ["Rang", "Utilisateur", "E-mail", "Téléphone", "Points", ...games.map((g) => g.name + " (pts)"), "Bonus", "Amis parrainés", "Prix", "Récompensé"],
          data.players.map((p) => [p.rank, p.username, p.email, p.phone, p.points, ...games.map((g) => p.games[g.id].points), sumBonus(p.bonus), p.referrals, p.prize || "", p.rewarded ? "oui" : "non"]))}>⬇️ Export Excel</button>
      </div>
      <div className="table-wrap">
        <table className="ptable">
          <thead><tr><th>#</th><th>Utilisateur</th><th>Téléphone</th><th>E-mail</th><th>Points</th>{games.map((g) => <th key={g.id} title={g.name}>{g.emoji}</th>)}<th>🎁</th><th>🤝</th><th>Prix</th></tr></thead>
          <tbody>
            {list.map((p) => [
              <tr key={p.uid} onClick={() => setOpen(open === p.uid ? null : p.uid)} className={p.rank <= 3 ? "is-top" : ""}>
                <td>{p.rank}</td><td>{p.username}</td>
                <td><a href={`tel:${p.phone}`} onClick={(e) => e.stopPropagation()}>{p.phone}</a></td>
                <td>{p.email}</td><td><b>{fmt(p.points)}</b></td>
                {games.map((g) => <td key={g.id}>{p.games[g.id].points}</td>)}
                <td>{fmt(sumBonus(p.bonus))}</td><td>{p.referrals}</td>
                <td>{p.rank <= 3 ? (p.rewarded ? "✓" : "⏳") : ""}</td>
              </tr>,
              open === p.uid && (
                <tr key={`${p.uid}-d`} className="detail"><td colSpan={9 + games.length}>
                  <b>Scores :</b> {games.map((g) => `${g.name} ${fmt(p.games[g.id].score)}`).join(" · ")}<br />
                  <b>Bonus :</b> {Object.keys(p.bonus).length ? Object.entries(p.bonus).map(([t, v]) => `${BONUS_LABEL[t] || t} +${v}`).join(" · ") : "aucun"}
                </td></tr>
              ),
            ])}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Users({ adminKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    api("admin/users", { headers: { "x-admin-key": adminKey } }).then(setData).catch((e) => setError(e.message));
  }, [adminKey]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!data) return [];
    return s ? data.users.filter((u) => [u.username, u.email, u.phone].some((v) => v.toLowerCase().includes(s))) : data.users;
  }, [data, q]);
  if (error) return <p className="err">{error}</p>;
  if (!data) return <div className="skeleton" />;
  const week = Date.now() - 7 * 86400000;
  return (
    <>
      <div className="admin-stats">
        <div><b>{data.count}</b><small>inscrits</small></div>
        <div><b>{data.users.filter((u) => u.createdAt > week).length}</b><small>nouveaux (7 jours)</small></div>
        <div><b>{data.users.filter((u) => u.lastSeen > week).length}</b><small>actifs (7 jours)</small></div>
        <div><b>{data.users.reduce((a, u) => a + u.referrals, 0)}</b><small>amis parrainés</small></div>
      </div>
      <div className="admin-tools">
        <h2 className="sec">🗂️ Base de données des joueurs</h2>
        <input className="search" placeholder="Rechercher un nom, un e-mail ou un numéro…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={() => downloadCsv("joueurs-allo-ala.csv",
          ["Utilisateur", "E-mail", "Téléphone", "Inscrit le", "Dernière visite", "Parties", "Points bonus (total)", "Amis parrainés", "Parrain", "Règlement accepté"],
          data.users.map((u) => [u.username, u.email, u.phone, fmtDate(u.createdAt), fmtDate(u.lastSeen), u.games, u.bonusAll, u.referrals, u.referredBy, u.consent ? "oui" : "non"]))}>⬇️ Export Excel</button>
      </div>
      <div className="table-wrap">
        <table className="ptable">
          <thead><tr><th>Utilisateur</th><th>Téléphone</th><th>E-mail</th><th>Inscrit le</th><th>Dernière visite</th><th>Parties</th><th>🤝</th><th>Parrain</th></tr></thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.uid}>
                <td>{u.username || <i className="muted">profil incomplet</i>}</td>
                <td>{u.phone ? <a href={`tel:${u.phone}`}>{u.phone}</a> : "—"}</td>
                <td>{u.email}</td><td>{fmtDate(u.createdAt)}</td><td>{fmtDate(u.lastSeen)}</td>
                <td>{u.games}</td><td>{u.referrals}</td><td>{u.referredBy || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Lottery({ adminKey }) {
  const now = new Date(Date.now() + 3600e3);
  const [month, setMonth] = useState(now.toISOString().slice(0, 7));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => api(`admin/lottery?month=${month}`, { headers: { "x-admin-key": adminKey } }).then(setData).catch((e) => setError(e.message));
  useEffect(() => { setData(null); setError(""); load(); }, [month]); // eslint-disable-line react-hooks/exhaustive-deps
  async function draw() {
    if (!confirm("Lancer le tirage au sort du mois ? Il ne pourra pas être refait.")) return;
    setBusy(true);
    try {
      const r = await api("admin/lottery", { method: "POST", headers: { "x-admin-key": adminKey }, body: { month } });
      setData(r);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }
  const shift = (n) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  const label = new Date(`${month}-15`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return (
    <>
      <div className="admin-bar">
        <button className="btn" onClick={() => shift(-1)} aria-label="Mois précédent">←</button>
        <div className="admin-week"><b>🎟️ Tirage de {label}</b><small>Les 3 premiers de chaque semaine terminée du mois (1 ticket par podium)</small></div>
        <button className="btn" onClick={() => shift(1)} aria-label="Mois suivant">→</button>
      </div>
      {error && <p className="err">{error}</p>}
      {!data && !error && <div className="skeleton" />}
      {data && (
        <>
          {data.draw ? (
            <div className="draw-result">
              <span className="big">🎉</span>
              <p>Gagnant du prix secret</p>
              <b>{data.draw.username}</b>
              <a href={`tel:${data.draw.phone}`} className="w-phone">{data.draw.phone}</a>
              <small>{data.draw.email} · tiré le {fmtDate(data.draw.at)} parmi {data.draw.tickets} tickets</small>
              <a className="btn mini" target="_blank" rel="noreferrer" href={waLink(data.draw.phone, `🎉 Bravo ${data.draw.username} ! Vous avez gagné le tirage au sort du mois Allo..Ala Jeux. Nous vous contactons pour votre prix spécial 🎁`)}>💬 Prévenir le gagnant</a>
            </div>
          ) : (
            <button className="btn primary big-draw" disabled={busy || !data.tickets.length} onClick={draw}>
              {busy ? "Tirage…" : data.tickets.length ? `🎲 Tirer au sort parmi ${data.tickets.length} tickets` : "Pas encore de participants ce mois-ci"}
            </button>
          )}
          <div className="table-wrap">
            <table className="ptable">
              <thead><tr><th>Semaine du</th><th>Place</th><th>Utilisateur</th><th>Téléphone</th><th>E-mail</th></tr></thead>
              <tbody>
                {data.tickets.map((t, i) => (
                  <tr key={i} className={data.draw && data.draw.uid === t.uid && data.draw.week === t.week ? "is-top" : ""}>
                    <td>{fmtDay(new Date(t.week).getTime())}</td><td>{prizes[t.place - 1].medal}</td><td>{t.username}</td><td>{t.phone}</td><td>{t.email}</td>
                  </tr>
                ))}
                {!data.tickets.length && <tr><td colSpan={5} className="muted">Aucune semaine terminée ce mois-ci.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

export default function Admin() {
  const [key, setKey] = useState(() => { try { return sessionStorage.getItem("aa-admin") || ""; } catch { return ""; } });
  const [ok, setOk] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("week");
  async function open(e) {
    e?.preventDefault();
    setError("");
    try {
      await api("admin/users", { headers: { "x-admin-key": key } });
      try { sessionStorage.setItem("aa-admin", key); } catch { /* rien */ }
      setOk(true);
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => { if (key) open(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="admin-app">
      <header className="admin-top">
        <h1>🔒 Admin · Allo..Ala Jeux</h1>
        {ok ? (
          <button className="btn ghost" onClick={() => { try { sessionStorage.removeItem("aa-admin"); } catch { /* rien */ } setOk(false); setKey(""); }}>Verrouiller</button>
        ) : (
          <form onSubmit={open} className="admin-key">
            <input type="password" placeholder="Clé admin" value={key} onChange={(e) => setKey(e.target.value)} autoFocus />
            <button className="btn primary">Ouvrir</button>
          </form>
        )}
      </header>
      {error && <p className="err">{error}</p>}
      {ok && (
        <>
          <nav className="admin-tabs">
            {[["week", "🏆 Semaine"], ["users", "🗂️ Utilisateurs"], ["lottery", "🎟️ Tirage du mois"]].map(([id, label]) => (
              <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
            ))}
          </nav>
          {tab === "week" && <Week adminKey={key} />}
          {tab === "users" && <Users adminKey={key} />}
          {tab === "lottery" && <Lottery adminKey={key} />}
        </>
      )}
    </main>
  );
}
