// Page admin (…/#admin) : les 3 gagnants de la semaine avec leur numéro,
// pour créditer les prix dans l'application Allo..Ala.
import { useEffect, useState } from "react";
import { api } from "./api.js";

const fmt = (ms) => new Date(ms).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

export default function Admin() {
  const [key, setKey] = useState(() => {
    try {
      return sessionStorage.getItem("aa-admin") || "";
    } catch {
      return "";
    }
  });
  const [week, setWeek] = useState(-1); // par défaut : la semaine terminée
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  async function load(k = key, w = week) {
    setError("");
    try {
      const d = await api(`admin/winners?week=${w}`, { headers: { "x-admin-key": k } });
      setData(d);
      try {
        sessionStorage.setItem("aa-admin", k);
      } catch {
        // rien
      }
    } catch (e) {
      setData(null);
      setError(e.message);
    }
  }

  useEffect(() => {
    if (key) load(key, week);
  }, [week]); // eslint-disable-line react-hooks/exhaustive-deps

  async function markDone(phone) {
    await api("admin/winners", { method: "POST", headers: { "x-admin-key": key }, body: { week, phone } });
    load();
  }

  return (
    <main className="app">
      <section className="screen admin">
        <h1>🔒 Gagnants Allo..Ala Rush</h1>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <input className="text" type="password" placeholder="Clé admin" value={key} onChange={(e) => setKey(e.target.value)} />
          <button className="btn primary">Ouvrir</button>
        </form>
        {error && <p className="err">{error}</p>}

        {data && (
          <>
            <div className="row weeks">
              <button className="btn" onClick={() => setWeek(Math.max(-8, week - 1))}>← Semaine précédente</button>
              <button className="btn" disabled={week >= 0} onClick={() => setWeek(Math.min(0, week + 1))}>Suivante →</button>
            </div>
            <p className="muted center">
              {week === 0 ? "Semaine en cours" : "Semaine terminée"} : du {fmt(data.start)} au {fmt(data.end - 1)} · {data.players} joueur{data.players > 1 ? "s" : ""}
            </p>
            <ol className="rows admin-rows">
              {data.winners.map((w) => (
                <li key={w.phone} className={`top top${w.rank}`}>
                  <span className="rk">{["🥇", "🥈", "🥉"][w.rank - 1]}</span>
                  <span className="nm">
                    {w.name} · <b>{w.phone}</b>
                    <small>{w.score} pts · {w.prize}</small>
                  </span>
                  {w.rewarded ? (
                    <span className="done">✓ Récompensé</span>
                  ) : (
                    <button className="btn mini" disabled={week === 0} onClick={() => markDone(w.phone)}>
                      Marquer récompensé
                    </button>
                  )}
                </li>
              ))}
              {!data.winners.length && <li className="empty">Aucun joueur cette semaine.</li>}
            </ol>
            {week === 0 && <p className="muted center">La semaine n'est pas finie : le classement peut encore changer jusqu'à dimanche 23:59.</p>}
          </>
        )}
      </section>
    </main>
  );
}
