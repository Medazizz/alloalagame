// Allo..Ala Jeux : 3 jeux, points cumulés, missions bonus, parrainage, classement.
import { useCallback, useEffect, useRef, useState } from "react";
import { createGame as createRush, GAME_SECONDS as RUSH_SECONDS } from "./games/rush.js";
import { createCatch, CATCH_SECONDS } from "./games/catch.js";
import Memo from "./games/Memo.jsx";
import { api, loadSession, saveSession } from "./api.js";
import { unlockAudio, isMuted, setMuted } from "./sound.js";
import { links, games, prizes, bonus } from "./config.js";
import Admin from "./Admin.jsx";

const BASE = import.meta.env.BASE_URL;
const logo = `${BASE}logo.png`;
const ord = (n) => (n === 1 ? "1ʳᵉ" : `${n}ᵉ`);
const fmt = (n) => Number(n || 0).toLocaleString("fr-FR");
const gameById = (id) => games.find((g) => g.id === id);

// Lien de parrainage reçu (…/?ref=CODE) : gardé jusqu'à l'inscription
(() => {
  const ref = new URLSearchParams(location.search).get("ref");
  if (ref) try { localStorage.setItem("aa-ref", ref.toUpperCase().slice(0, 8)); } catch { /* rien */ }
})();
const storedRef = () => { try { return localStorage.getItem("aa-ref") || ""; } catch { return ""; } };

function useCountdown(endsAt) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  if (!endsAt) return "";
  const ms = Math.max(0, endsAt - now);
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return d ? `${d} j ${h} h` : `${h} h ${m} min`;
}

function shareUrl(me) {
  return `${location.origin}${BASE}${me?.refCode ? `?ref=${me.refCode}` : ""}`;
}

async function shareNative({ title, text, url }) {
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return true;
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    alert("Lien copié ! Collez-le dans WhatsApp, Messenger…");
    return true;
  } catch {
    return false;
  }
}

// ---------- connexion par SMS ----------
function Login({ onDone, onClose, reason }) {
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState("");
  const [sess, setSess] = useState(null);
  const ref = storedRef();

  async function run(fn) {
    setBusy(true);
    setError("");
    try { await fn(); } catch (err) { setError(err.message); }
    setBusy(false);
  }
  const sendSms = (e) => {
    e?.preventDefault();
    run(async () => {
      const r = await api("otp/send", { method: "POST", body: { phone } });
      setDevCode(r.devCode || "");
      setStep("code");
    });
  };
  const verify = (e) => {
    e.preventDefault();
    run(async () => {
      const r = await api("otp/verify", { method: "POST", body: { phone, code, ref } });
      const s = { token: r.token };
      setSess(s);
      if (r.me.name) onDone(s, r.me);
      else setStep("name");
    });
  };
  const saveName = (e) => {
    e.preventDefault();
    run(async () => {
      const r = await api("me", { method: "POST", body: { name }, token: sess.token });
      onDone(sess, r.me);
    });
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="login-title" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <span className="grab" aria-hidden="true" />
        <button className="x" onClick={onClose} aria-label="Fermer">×</button>
        {step === "phone" && (
          <form onSubmit={sendSms}>
            <h2 id="login-title">📱 Connexion</h2>
            <p className="muted">{reason || "Pour cumuler vos points et recevoir vos prix."} Utilisez le numéro de votre compte Allo..Ala.</p>
            {ref && <p className="note">🎁 Invité par un ami : <b>+{bonus.welcome} points</b> offerts après votre 1ʳᵉ partie !</p>}
            <label className="phone-field">
              <span>🇹🇳 +216</span>
              <input inputMode="tel" autoComplete="tel-national" placeholder="93 332 862" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
            </label>
            {error && <p className="err">{error}</p>}
            <button className="btn primary" disabled={busy || phone.replace(/\D/g, "").length < 8}>{busy ? "Envoi…" : "Recevoir mon code par SMS"}</button>
            <p className="tiny">Votre numéro sert uniquement au jeu et à la remise des prix.</p>
          </form>
        )}
        {step === "code" && (
          <form onSubmit={verify}>
            <h2 id="login-title">🔐 Code reçu par SMS</h2>
            <p className="muted">Envoyé au +216 {phone}. <button type="button" className="link" onClick={() => setStep("phone")}>Changer</button></p>
            {devCode && <p className="note">Mode test : votre code est <b>{devCode}</b></p>}
            <input className="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
            {error && <p className="err">{error}</p>}
            <button className="btn primary" disabled={busy || code.length < 4}>{busy ? "Vérification…" : "Valider"}</button>
            <button type="button" className="link center" onClick={sendSms} disabled={busy}>Renvoyer le code</button>
          </form>
        )}
        {step === "name" && (
          <form onSubmit={saveName}>
            <h2 id="login-title">🏁 Votre pseudo</h2>
            <p className="muted">Il s'affiche dans le classement (votre numéro reste masqué).</p>
            <input className="text" maxLength={18} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. : Sami_Sbeitla" autoFocus />
            {error && <p className="err">{error}</p>}
            <button className="btn primary" disabled={busy || name.trim().length < 2}>C'est parti !</button>
          </form>
        )}
      </div>
    </div>
  );
}

// ---------- règles ----------
function Rules({ onClose }) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="rules-title" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card rules">
        <span className="grab" aria-hidden="true" />
        <button className="x" onClick={onClose} aria-label="Fermer">×</button>
        <h2 id="rules-title">📖 Règles & prix</h2>
        <h3>Comment gagner des points</h3>
        <ul>
          <li>🎮 Chaque jeu compte : <b>votre meilleur score de la semaine dans chaque jeu</b> s'additionne.</li>
          <li>👍 Abonnement Facebook : <b>+{bonus.follow_fb}</b> · Instagram : <b>+{bonus.follow_ig}</b> (une seule fois).</li>
          <li>📤 Partager Allo..Ala : <b>+{bonus.share}</b> par jour.</li>
          <li>🤝 Inviter un ami : <b>+{bonus.referral}</b> quand il joue sa 1ʳᵉ partie (et <b>+{bonus.welcome}</b> pour lui).</li>
        </ul>
        <h3>Prix chaque semaine</h3>
        <ul>{prizes.map((p) => <li key={p.title}>{p.medal} <b>{p.title}</b> : {p.prize}</li>)}</ul>
        <h3>Règlement</h3>
        <ul className="small">
          <li>Jeu gratuit, sans obligation d'achat.</li>
          <li>Semaine du lundi 00:00 au dimanche 23:59 (heure de Tunisie). Les points repartent de zéro chaque lundi.</li>
          <li>Les prix sont crédités sur le compte Allo..Ala lié à votre numéro. Un seul prix par numéro et par semaine.</li>
          <li>Les points d'abonnement sont déclaratifs : un abonnement non effectué ou la triche entraînent l'exclusion.</li>
          <li>Votre numéro sert uniquement au jeu et à la remise des prix.</li>
        </ul>
        <button className="btn primary" onClick={onClose}>Compris !</button>
      </div>
    </div>
  );
}

// ---------- accueil ----------
function Home({ me, onPlay, onLogin, goto, onRules }) {
  const left = useCountdown(me?.endsAt);
  const [muted, setM] = useState(isMuted());
  return (
    <section className="screen home">
      <header className="top">
        <img src={logo} alt="" className="top-logo" />
        <div className="top-title">
          <b>Allo<span>..Ala</span> Jeux</b>
          <small className="ar">كلمني ... نفضهالك</small>
        </div>
        <button className="icon-btn" onClick={() => { setMuted(!muted); setM(!muted); }} aria-label={muted ? "Activer le son" : "Couper le son"}>{muted ? "🔇" : "🔊"}</button>
      </header>

      <div className="hero-card">
        <div className="hero-glow" aria-hidden="true" />
        {me ? (
          <>
            <p className="eyebrow">Salut {me.name} 👋 · cette semaine</p>
            <div className="hero-points"><b>{fmt(me.total)}</b><span>points</span></div>
            <div className="hero-meta">
              <span>{me.rank ? `🏆 ${ord(me.rank)} / ${me.players}` : "🏁 Pas encore classé"}</span>
              <span>⏳ Fin dans {left}</span>
            </div>
          </>
        ) : (
          <>
            <p className="eyebrow">Jouez · cumulez · gagnez</p>
            <h1>Gagnez vos <em>livraisons offertes</em> 🛵</h1>
            <p className="hero-sub">3 jeux, des points qui s'additionnent et des prix chaque semaine.</p>
            <button className="btn light" onClick={onLogin}>📱 Se connecter avec mon numéro</button>
          </>
        )}
      </div>

      <h2 className="sec">🎮 Les jeux</h2>
      <div className="games">
        {games.map((g, i) => (
          <button key={g.id} className="game-card" style={{ "--bg": g.color, "--i": i }} onClick={() => onPlay(g.id)}>
            <span className="gc-emoji" aria-hidden="true">{g.emoji}</span>
            <span className="gc-txt">
              <b>{g.name}</b>
              <small>{g.tagline} · {g.duration}</small>
            </span>
            <span className="gc-best">{me ? <>{fmt(me.bests?.[g.id])}<small>meilleur</small></> : "Jouer"}</span>
          </button>
        ))}
      </div>

      <div className="split">
        <button className="tile-mini" onClick={() => goto("bonus")}>
          <span className="tm-emoji">🎁</span>
          <b>Points bonus</b>
          <small>Facebook, Instagram, partage, amis</small>
        </button>
        <button className="tile-mini" onClick={() => goto("board")}>
          <span className="tm-emoji">🏆</span>
          <b>Classement</b>
          <small>Top 3 récompensé chaque semaine</small>
        </button>
      </div>

      <div className="card prizes">
        <h2 className="sec in">🏅 À gagner chaque semaine</h2>
        {prizes.map((p) => (
          <div key={p.title} className="prize">
            <span className="medal">{p.medal}</span>
            <span><b>{p.title}</b><small>{p.prize}</small></span>
          </div>
        ))}
        <button className="link" onClick={onRules}>Voir le règlement</button>
      </div>

      <h2 className="sec">🧡 Allo..Ala</h2>
      <div className="links">
        <a className="lk wa" href={`https://wa.me/${links.whatsapp}?text=${encodeURIComponent("Bonjour Allo..Ala, je voudrais passer une commande.")}`}><span>💬</span>Commander sur WhatsApp</a>
        <a className="lk" href={`tel:${links.phone}`}><span>📞</span>Appeler 93 332 862</a>
        <a className="lk" href={links.site}><span>🌐</span>Site alloala.com</a>
        <a className="lk" href={links.qr}><span>📲</span>Tous nos liens</a>
        {links.playStore ? <a className="lk" href={links.playStore}><span>▶️</span>Google Play</a> : <span className="lk soon"><span>📱</span>App bientôt</span>}
        <a className="lk" href={links.instagram}><span>📸</span>Instagram</a>
      </div>
      <p className="foot">Sbeïtla, Tunisie · © {new Date().getFullYear()} Allo..Ala</p>
    </section>
  );
}

// ---------- classement ----------
function Board({ session, onPlay }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const left = useCountdown(data?.endsAt);
  useEffect(() => {
    api("leaderboard", { token: session?.token }).then(setData).catch((e) => setError(e.message));
  }, [session]);
  const [p1, p2, p3] = data?.rows || [];
  return (
    <section className="screen board">
      <h1 className="page-title">🏆 Classement</h1>
      {data && <p className="muted center">Semaine en cours · fin dans <b>{left}</b> · {data.players} joueur{data.players > 1 ? "s" : ""}</p>}
      {error && <p className="err">{error}</p>}
      {data && data.rows.length > 0 && (
        <div className="podium">
          {[p2, p1, p3].map((p, i) => p ? (
            <div key={p.rank} className={`pod pod${p.rank}`}>
              <span className="pod-medal">{prizes[p.rank - 1].medal}</span>
              <b>{p.name}</b>
              <small>{fmt(p.points)} pts</small>
              <div className="pod-bar">{p.rank}</div>
            </div>
          ) : <div key={`e${i}`} className="pod empty" />)}
        </div>
      )}
      <ol className="rows">
        {data?.rows.slice(3).map((r) => (
          <li key={r.rank}>
            <span className="rk">{r.rank}</span>
            <span className="nm">{r.name}<small>{r.phone}</small></span>
            <span className="sc">{fmt(r.points)}</span>
          </li>
        ))}
        {data && !data.rows.length && <li className="empty">Personne n'a encore joué cette semaine. La 1ʳᵉ place est à vous !</li>}
      </ol>
      {data?.me && <p className="me-row">Vous : <b>{ord(data.me.rank)}</b> avec <b>{fmt(data.me.points)}</b> points</p>}
      <button className="btn primary" onClick={() => onPlay("rush")}>🎮 Jouer pour monter</button>
    </section>
  );
}

// ---------- missions bonus ----------
function Bonus({ me, session, onLogin, refresh }) {
  const [msg, setMsg] = useState("");
  const [pending, setPending] = useState({});
  async function claim(type) {
    if (!session) return onLogin();
    try {
      const r = await api("bonus", { method: "POST", token: session.token, body: { type } });
      setMsg(`🎉 +${r.points} points ! Total : ${fmt(r.total)}`);
      refresh();
    } catch (e) {
      setMsg(e.message);
    }
  }
  function follow(type, url) {
    window.open(url, "_blank", "noopener");
    setPending((p) => ({ ...p, [type]: true }));
  }
  async function share() {
    if (!session) return onLogin();
    const ok = await shareNative({
      title: "Allo..Ala",
      text: "🛵 Allo..Ala livre tout à Sbeïtla & Kasserine ! Commandez par appel ou WhatsApp, et jouez pour gagner vos livraisons offertes :",
      url: shareUrl(me),
    });
    if (ok) claim("share");
  }
  async function invite() {
    if (!session) return onLogin();
    shareNative({
      title: "Allo..Ala Jeux",
      text: `🎮 Joue avec moi sur Allo..Ala Jeux et gagne des livraisons offertes ! Avec mon lien tu as +${bonus.welcome} points :`,
      url: shareUrl(me),
    });
  }
  const m = me?.missions || {};
  return (
    <section className="screen bonus">
      <h1 className="page-title">🎁 Points bonus</h1>
      <p className="muted">Gagnez des points en plus de vos jeux pour monter dans le classement.</p>
      {msg && <p className="note">{msg}</p>}

      <div className="mission fb">
        <span className="ms-icon">👍</span>
        <span className="ms-txt"><b>Suivre notre page Facebook</b><small>Une seule fois</small></span>
        {m.follow_fb ? <span className="ms-done">✓ +{bonus.follow_fb}</span> : pending.follow_fb
          ? <button className="btn mini primary" onClick={() => claim("follow_fb")}>Réclamer +{bonus.follow_fb}</button>
          : <button className="btn mini" onClick={() => follow("follow_fb", links.facebook)}>Suivre · +{bonus.follow_fb}</button>}
      </div>
      <div className="mission ig">
        <span className="ms-icon">📸</span>
        <span className="ms-txt"><b>Suivre notre Instagram</b><small>Une seule fois</small></span>
        {m.follow_ig ? <span className="ms-done">✓ +{bonus.follow_ig}</span> : pending.follow_ig
          ? <button className="btn mini primary" onClick={() => claim("follow_ig")}>Réclamer +{bonus.follow_ig}</button>
          : <button className="btn mini" onClick={() => follow("follow_ig", links.instagram)}>Suivre · +{bonus.follow_ig}</button>}
      </div>
      <div className="mission share">
        <span className="ms-icon">📤</span>
        <span className="ms-txt"><b>Partager Allo..Ala</b><small>Le site et l'app · chaque jour</small></span>
        {m.share ? <span className="ms-done">✓ Demain</span> : <button className="btn mini" onClick={share}>Partager · +{bonus.share}</button>}
      </div>

      <div className="card invite">
        <h2 className="sec in">🤝 Invitez vos amis</h2>
        <p className="muted">Votre ami s'inscrit avec votre lien et joue une partie : <b>+{bonus.referral} points pour vous</b>, <b>+{bonus.welcome} pour lui</b>. Sans limite !</p>
        {me ? (
          <>
            <div className="refbox"><span>Votre code</span><b>{me.refCode}</b></div>
            <p className="muted center">{me.referrals} ami{me.referrals > 1 ? "s" : ""} parrainé{me.referrals > 1 ? "s" : ""}</p>
            <button className="btn primary" onClick={invite}>📲 Inviter un ami</button>
          </>
        ) : (
          <button className="btn primary" onClick={onLogin}>📱 Se connecter pour inviter</button>
        )}
      </div>
    </section>
  );
}

// ---------- profil ----------
function Profile({ me, onLogin, onLogout, onRules }) {
  if (!me) {
    return (
      <section className="screen profile">
        <h1 className="page-title">👤 Profil</h1>
        <div className="card center">
          <p className="big-emoji">🛵</p>
          <p>Connectez-vous avec votre numéro pour cumuler vos points, parrainer vos amis et recevoir vos prix.</p>
          <button className="btn primary" onClick={onLogin}>📱 Se connecter</button>
        </div>
        <button className="btn" onClick={onRules}>📖 Règles & prix</button>
      </section>
    );
  }
  return (
    <section className="screen profile">
      <h1 className="page-title">👤 {me.name}</h1>
      <p className="muted">{me.masked} · code parrain <b>{me.refCode}</b></p>
      <div className="card">
        <h2 className="sec in">Vos points de la semaine</h2>
        <div className="breakdown">
          {games.map((g) => (
            <div key={g.id}><span>{g.emoji} {g.name}</span><b>{fmt(me.bests?.[g.id])}</b></div>
          ))}
          <div><span>🎁 Bonus</span><b>{fmt(me.bonusPts)}</b></div>
          <div className="total"><span>Total</span><b>{fmt(me.total)}</b></div>
        </div>
        {me.rank && <p className="muted center">Classement : <b>{ord(me.rank)}</b> sur {me.players}</p>}
      </div>
      <button className="btn" onClick={onRules}>📖 Règles & prix</button>
      <button className="btn ghost" onClick={onLogout}>Se déconnecter</button>
    </section>
  );
}

// ---------- partie ----------
function Play({ gameId, onEnd, onQuit }) {
  const g = gameById(gameId);
  const canvasRef = useRef(null);
  const ctrl = useRef(null);
  const [hud, setHud] = useState({});
  useEffect(() => {
    if (gameId === "memo") return;
    const make = gameId === "rush" ? createRush : createCatch;
    const c = make(canvasRef.current, { onHud: setHud, onEnd });
    ctrl.current = c;
    return () => c.destroy();
  }, [gameId, onEnd]);
  const total = gameId === "rush" ? RUSH_SECONDS : CATCH_SECONDS;
  const pct = Math.min(100, ((hud.timeLeft ?? total) / total) * 100);
  return (
    <section className={`screen play play-${gameId}`}>
      <div className="hud">
        <button className="icon-btn" onClick={onQuit} aria-label="Quitter">✕</button>
        <div className="hud-title">{g.emoji} {g.name}</div>
        {gameId === "memo"
          ? <div className="hud-score"><b>{hud.score ?? 1000}</b><small>pts</small></div>
          : <div className="hud-score"><b>{hud.score ?? 0}</b><small>pts</small></div>}
      </div>
      {gameId === "memo" ? (
        <div className="memo-stats">
          <span>🔁 {hud.moves ?? 0} coups</span><span>⏱️ {Math.floor(hud.seconds ?? 0)} s</span><span>✅ {hud.found ?? 0}/8</span>
        </div>
      ) : (
        <>
          <div className="timebar"><i style={{ width: `${pct}%` }} className={(hud.timeLeft ?? total) < 10 ? "low" : ""} /></div>
          <div className="sub-hud">
            <span aria-label={`${hud.lives ?? 3} vies`}>{"❤️".repeat(hud.lives ?? 3)}{"🤍".repeat(Math.max(0, 3 - (hud.lives ?? 3)))}</span>
            {gameId === "rush" && (
              <span className="carry">{[0, 1, 2].map((i) => <i key={i}>{hud.carry?.[i] || ""}</i>)}</span>
            )}
            {(hud.combo ?? 1) > 1 && <span className="combo">Combo x{hud.combo}</span>}
          </div>
        </>
      )}
      {gameId === "memo" ? <Memo onEnd={onEnd} onHud={setHud} /> : <canvas ref={canvasRef} className="game" />}
      {gameId === "rush" && (
        <div className="pads" aria-hidden="true">
          <button onPointerDown={() => ctrl.current?.move(-1)}>←</button>
          <button onPointerDown={() => ctrl.current?.move(1)}>→</button>
        </div>
      )}
    </section>
  );
}

// ---------- résultat ----------
function Result({ gameId, result, save, session, me, onLogin, onReplay, onHome, onPlay }) {
  const g = gameById(gameId);
  const others = games.filter((x) => x.id !== gameId);
  return (
    <section className="screen over">
      <p className="kicker">{g.emoji} {g.name}</p>
      <div className="big-score">{fmt(result.score)}<small>points</small></div>
      <p className="muted center">
        {gameId === "rush" && `📦 ${result.deliveries} commande${result.deliveries > 1 ? "s" : ""} livrée${result.deliveries > 1 ? "s" : ""}`}
        {gameId === "catch" && `📦 ${result.caught} commande${result.caught > 1 ? "s" : ""} attrapée${result.caught > 1 ? "s" : ""}`}
        {gameId === "memo" && `🔁 ${result.moves} coups · ⏱️ ${Math.round(result.seconds)} s`}
      </p>

      <div className="card save">
        {save.status === "saving" && <p>Enregistrement…</p>}
        {save.status === "saved" && (
          <>
            {save.improved
              ? <p className="gain">🎉 Nouveau record ! <b>+{fmt(save.gained)} points</b> ajoutés à votre total</p>
              : <p>Votre record dans ce jeu reste <b>{fmt(save.best)}</b>. Rejouez pour le battre !</p>}
            <p>Total de la semaine : <b>{fmt(save.total)} pts</b> · <b>{ord(save.rank)}</b>{save.rank <= 3 ? " 🏆 dans le top 3 !" : ""}</p>
            {save.referralPaid && <p className="note">🤝 Bonus parrainage débloqué : +{bonus.welcome} points pour vous !</p>}
          </>
        )}
        {save.status === "error" && <p className="err">{save.error}</p>}
        {!session && save.status !== "saved" && (
          <>
            <p>Connectez-vous pour ajouter ce score à votre total et tenter de gagner.</p>
            <button className="btn primary" onClick={onLogin}>📱 Enregistrer mon score</button>
          </>
        )}
      </div>

      <div className="row">
        <button className="btn primary" onClick={onReplay}>🔁 Rejouer</button>
        <button className="btn" onClick={onHome}>🏠 Accueil</button>
      </div>
      <p className="muted center">Cumulez aussi des points dans les autres jeux :</p>
      <div className="row">
        {others.map((o) => <button key={o.id} className="btn" onClick={() => onPlay(o.id)}>{o.emoji} {o.name}</button>)}
      </div>
      <button
        className="btn share"
        onClick={() => shareNative({
          title: "Allo..Ala Jeux",
          text: `J'ai fait ${result.score} points sur ${g.name} 🛵 Bats mon score et gagne tes livraisons offertes !`,
          url: shareUrl(me),
        })}
      >📤 Défier un ami</button>
    </section>
  );
}

// ---------- barre d'onglets ----------
function TabBar({ tab, goto }) {
  const tabs = [["home", "🏠", "Accueil"], ["board", "🏆", "Classement"], ["bonus", "🎁", "Bonus"], ["profile", "👤", "Profil"]];
  return (
    <nav className="tabbar" aria-label="Navigation">
      {tabs.map(([id, ic, label]) => (
        <button key={id} className={tab === id ? "on" : ""} onClick={() => goto(id)} aria-current={tab === id ? "page" : undefined}>
          <span>{ic}</span>{label}
        </button>
      ))}
    </nav>
  );
}

export default function App() {
  const [tab, setTab] = useState("home");
  const [session, setSession] = useState(loadSession);
  const [me, setMe] = useState(null);
  const [login, setLogin] = useState(null);
  const [rules, setRules] = useState(false);
  const [playing, setPlaying] = useState(null); // id du jeu
  const [result, setResult] = useState(null);
  const [save, setSave] = useState({ status: "idle" });
  const [round, setRound] = useState(0);
  const gameIdRef = useRef(null);
  const playingRef = useRef(null);
  const [isAdmin, setIsAdmin] = useState(location.hash === "#admin");

  useEffect(() => {
    const f = () => setIsAdmin(location.hash === "#admin");
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);

  const refresh = useCallback(async (sess = session) => {
    if (!sess) return setMe(null);
    try {
      const r = await api("me", { token: sess.token });
      setMe(r.me);
    } catch (e) {
      if (e.status === 401) { saveSession(null); setSession(null); setMe(null); }
    }
  }, [session]);
  useEffect(() => { refresh(); }, [refresh]);

  const submit = useCallback(async (gid, res, sess) => {
    if (!sess) return;
    if (!gameIdRef.current) return setSave({ status: "error", error: "Score non enregistré (pas de connexion internet au début de la partie)." });
    setSave({ status: "saving" });
    try {
      const r = await api("game/finish", { method: "POST", token: sess.token, body: { gameId: gameIdRef.current, ...res } });
      gameIdRef.current = null;
      setSave({ status: "saved", ...r });
      refresh(sess);
    } catch (e) {
      if (e.status === 401) { saveSession(null); setSession(null); setSave({ status: "idle" }); }
      else setSave({ status: "error", error: e.message });
    }
  }, [refresh]);

  function play(gid) {
    unlockAudio();
    setSave({ status: "idle" });
    setResult(null);
    gameIdRef.current = null;
    api("game/start", { method: "POST", body: { game: gid } }).then((r) => (gameIdRef.current = r.gameId)).catch(() => {});
    setRound((n) => n + 1);
    playingRef.current = gid;
    setPlaying(gid);
    window.scrollTo(0, 0);
  }

  const onEnd = useCallback((res) => {
    setTimeout(() => {
      setResult(res);
      submit(playingRef.current, res, loadSession());
    }, 800);
  }, [submit]);

  function loggedIn(sess, profile) {
    saveSession(sess);
    setSession(sess);
    setMe(profile);
    const then = login?.then;
    setLogin(null);
    if (then === "submit" && result && playing) submit(playing, result, sess);
  }

  const goto = (t) => { playingRef.current = null; setPlaying(null); setResult(null); setTab(t); window.scrollTo(0, 0); };

  if (isAdmin) return <Admin />;

  let content;
  if (playing && !result) content = <Play key={round} gameId={playing} onEnd={onEnd} onQuit={() => goto("home")} />;
  else if (playing && result)
    content = (
      <Result
        gameId={playing}
        result={result}
        save={save}
        session={session}
        me={me}
        onLogin={() => setLogin({ then: "submit", reason: "Pour enregistrer ce score." })}
        onReplay={() => play(playing)}
        onHome={() => goto("home")}
        onPlay={play}
      />
    );
  else if (tab === "board") content = <Board session={session} onPlay={play} />;
  else if (tab === "bonus") content = <Bonus me={me} session={session} onLogin={() => setLogin({})} refresh={refresh} />;
  else if (tab === "profile")
    content = <Profile me={me} onLogin={() => setLogin({})} onRules={() => setRules(true)} onLogout={() => { saveSession(null); setSession(null); setMe(null); }} />;
  else content = <Home me={me} onPlay={play} onLogin={() => setLogin({})} goto={goto} onRules={() => setRules(true)} />;

  return (
    <main className={`app${playing && !result ? " is-playing" : ""}`}>
      <div className="bg-blobs" aria-hidden="true"><i /><i /><i /></div>
      {content}
      {!(playing && !result) && <TabBar tab={playing ? "" : tab} goto={goto} />}
      {login && <Login reason={login.reason} onDone={loggedIn} onClose={() => setLogin(null)} />}
      {rules && <Rules onClose={() => setRules(false)} />}
    </main>
  );
}
