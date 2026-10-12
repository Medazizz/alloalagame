// Allo..Ala Jeux : 3 jeux, points cumulés, missions bonus, parrainage,
// top 50 de la semaine et tirage au sort mensuel.
import { useCallback, useEffect, useRef, useState } from "react";
import { createGame as createRush, GAME_SECONDS as RUSH_SECONDS } from "./games/rush.js";
import { createCatch, CATCH_SECONDS } from "./games/catch.js";
import Memo from "./games/Memo.jsx";
import { api, loadSession, saveSession } from "./api.js";
import { unlockAudio, isMuted, setMuted } from "./sound.js";
import { links, games, prizes, bonus, lottery, gamePoints } from "./config.js";
import Admin from "./Admin.jsx";

const BASE = import.meta.env.BASE_URL;
const logo = `${BASE}logo.png`;
const ord = (n) => (n === 1 ? "1ʳᵉ" : `${n}ᵉ`);
const fmt = (n) => Number(n || 0).toLocaleString("fr-FR");
const gameById = (id) => games.find((g) => g.id === id);
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* navigation privée */ } },
};

// Lien de parrainage reçu (…/?ref=CODE) : gardé jusqu'à l'inscription
(() => {
  const ref = new URLSearchParams(location.search).get("ref");
  if (ref) ls.set("aa-ref", ref.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8));
})();

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

const shareUrl = (me) => `${location.origin}${BASE}${me?.refCode ? `?ref=${me.refCode}` : ""}`;

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

function Sheet({ title, onClose, children, id }) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby={id} onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal-card">
        <span className="grab" aria-hidden="true" />
        {onClose && <button className="x" onClick={onClose} aria-label="Fermer">×</button>}
        {title && <h2 id={id}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

// ---------- connexion par e-mail + profil ----------
function Login({ onDone, onClose, reason, startAt = "email", session, onPrivacy, onRules }) {
  const [step, setStep] = useState(startAt);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState("");
  const [sess, setSess] = useState(session || null);
  const ref = ls.get("aa-ref") || "";

  async function run(fn) {
    setBusy(true);
    setError("");
    try { await fn(); } catch (err) { setError(err.message); }
    setBusy(false);
  }
  const sendMail = (e) => {
    e?.preventDefault();
    run(async () => {
      const r = await api("auth/send", { method: "POST", body: { email } });
      setDevCode(r.devCode || "");
      setCode("");
      setStep("code");
    });
  };
  const verify = (e) => {
    e.preventDefault();
    run(async () => {
      const r = await api("auth/verify", { method: "POST", body: { email, code, ref } });
      const s = { token: r.token };
      setSess(s);
      if (r.me.needsProfile) setStep("profile");
      else onDone(s, r.me);
    });
  };
  const saveProfile = (e) => {
    e.preventDefault();
    run(async () => {
      const r = await api("me", { method: "POST", token: sess.token, body: { username, phone, consent } });
      onDone(sess, r.me);
    });
  };

  if (step === "email")
    return (
      <Sheet title="👋 Connexion" id="login-t" onClose={onClose}>
        <form onSubmit={sendMail}>
          <p className="muted">{reason || "Pour cumuler vos points et recevoir vos prix."} Recevez un code gratuit par e-mail.</p>
          {ref && <p className="note">🎁 Invité par un ami : <b>+{bonus.welcome} points</b> offerts après votre 1ʳᵉ partie !</p>}
          <label className="field">
            <span>Adresse e-mail</span>
            <input type="email" inputMode="email" autoComplete="email" placeholder="vous@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </label>
          {error && <p className="err">{error}</p>}
          <button className="btn primary" disabled={busy || !/\S+@\S+\.\S+/.test(email)}>{busy ? "Envoi…" : "Recevoir mon code"}</button>
          <p className="tiny">Pas de mot de passe : un code à 6 chiffres suffit.</p>
        </form>
      </Sheet>
    );

  if (step === "code")
    return (
      <Sheet title="📩 Code reçu par e-mail" id="login-t" onClose={onClose}>
        <form onSubmit={verify}>
          <p className="muted">Envoyé à <b>{email}</b>. Pensez à regarder dans les <b>spams</b>. <button type="button" className="link" onClick={() => setStep("email")}>Changer</button></p>
          {devCode && <p className="note">Mode test : votre code est <b>{devCode}</b></p>}
          <input className="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus aria-label="Code à 6 chiffres" />
          {error && <p className="err">{error}</p>}
          <button className="btn primary" disabled={busy || code.length !== 6}>{busy ? "Vérification…" : "Valider"}</button>
          <button type="button" className="link center" onClick={sendMail} disabled={busy}>Renvoyer le code</button>
        </form>
      </Sheet>
    );

  return (
    <Sheet title="🏁 Votre profil joueur" id="login-t" onClose={session ? undefined : onClose}>
      <form onSubmit={saveProfile}>
        <p className="muted">Votre nom d'utilisateur apparaît dans le top 50. Votre numéro reste privé : il sert uniquement à créditer votre prix sur votre compte Allo..Ala.</p>
        <label className="field">
          <span>Nom d'utilisateur</span>
          <input maxLength={16} value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))} placeholder="ex. Sami_Sbeitla" autoComplete="nickname" autoFocus />
          <small>3 à 16 caractères : lettres, chiffres, _ . -</small>
        </label>
        <label className="field">
          <span>Numéro de votre compte Allo..Ala</span>
          <div className="phone-field">
            <span>🇹🇳 +216</span>
            <input inputMode="tel" autoComplete="tel-national" placeholder="93 332 862" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </label>
        <label className="check">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>J'accepte le <button type="button" className="link" onClick={onRules}>règlement</button> et l'utilisation de mes données pour le jeu (<button type="button" className="link" onClick={onPrivacy}>confidentialité</button>).</span>
        </label>
        {error && <p className="err">{error}</p>}
        <button className="btn primary" disabled={busy || username.length < 3 || phone.replace(/\D/g, "").length < 8 || !consent}>{busy ? "Enregistrement…" : "C'est parti !"}</button>
      </form>
    </Sheet>
  );
}

// ---------- règles & confidentialité ----------
function Rules({ onClose }) {
  return (
    <Sheet title="📖 Règles & prix" id="rules-t" onClose={onClose}>
      <div className="rules">
        <h3>Vos points de la semaine</h3>
        <ul>
          <li>🎮 <b>Jeux</b> : votre meilleur score de la semaine dans chaque jeu ÷ 20, <b>jusqu'à 50 points par jeu</b>.</li>
          <li>👍 Suivre Facebook, 📸 Instagram, 🎵 TikTok : <b>+{bonus.follow_fb}</b> chacun (une fois).</li>
          <li>📤 Partager Allo..Ala : <b>+{bonus.share}</b> par jour.</li>
          <li>🤝 Inviter un ami : <b>+{bonus.referral}</b> dès qu'il joue sa 1ʳᵉ partie (<b>+{bonus.welcome}</b> pour lui).</li>
        </ul>
        <h3>Prix chaque semaine</h3>
        <ul>{prizes.map((p) => <li key={p.title}>{p.medal} <b>{p.title}</b> : {p.prize}</li>)}</ul>
        <p className="note">{lottery}</p>
        <h3>Règlement</h3>
        <ul className="small">
          <li>Jeu gratuit, sans obligation d'achat.</li>
          <li>Semaine du lundi 00:00 au dimanche 23:59 (heure de Tunisie). Les points repartent de zéro chaque lundi.</li>
          <li>Un compte par personne, par e-mail et par numéro. Un seul prix par compte et par semaine.</li>
          <li>Les prix sont crédités sur le compte Allo..Ala lié au numéro indiqué, dans la semaine qui suit.</li>
          <li>Les abonnements sont déclaratifs : un abonnement non réalisé ou toute triche entraîne l'exclusion.</li>
        </ul>
      </div>
      <button className="btn primary" onClick={onClose}>Compris !</button>
    </Sheet>
  );
}

function Privacy({ onClose }) {
  return (
    <Sheet title="🔒 Confidentialité" id="priv-t" onClose={onClose}>
      <div className="rules small">
        <p>Allo..Ala collecte uniquement ce qui est nécessaire au jeu :</p>
        <ul>
          <li><b>E-mail</b> : pour vous connecter (code de vérification).</li>
          <li><b>Numéro de téléphone</b> : pour créditer vos prix sur votre compte Allo..Ala. Jamais affiché publiquement.</li>
          <li><b>Nom d'utilisateur, scores, points, parrainages</b> : pour le classement.</li>
        </ul>
        <p>Vos données ne sont ni vendues ni partagées. Pour les modifier ou les supprimer, contactez-nous sur WhatsApp au 93 332 862.</p>
      </div>
      <button className="btn primary" onClick={onClose}>Fermer</button>
    </Sheet>
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
            <p className="eyebrow">Salut {me.username} 👋 · cette semaine</p>
            <div className="hero-points"><b>{fmt(me.total)}</b><span>points</span></div>
            <div className="hero-meta">
              <span>{me.rank ? `🏆 ${ord(me.rank)} sur ${me.players}` : "🏁 Pas encore classé"}</span>
              <span>⏳ Fin dans {left}</span>
            </div>
          </>
        ) : (
          <>
            <p className="eyebrow">Jouez · cumulez · gagnez</p>
            <h1>Gagnez <em>10 DT</em> et des livraisons offertes 🛵</h1>
            <p className="hero-sub">3 jeux, des missions bonus et un classement chaque semaine.</p>
            <button className="btn light" onClick={onLogin}>👋 Se connecter</button>
          </>
        )}
      </div>

      <h2 className="sec">🎮 Les jeux <small>jusqu'à 50 pts chacun</small></h2>
      <div className="games">
        {games.map((g, i) => (
          <button key={g.id} className="game-card" style={{ "--bg": g.color, "--i": i }} onClick={() => onPlay(g.id)}>
            <span className="gc-emoji" aria-hidden="true">{g.emoji}</span>
            <span className="gc-txt">
              <b>{g.name}</b>
              <small>{g.tagline} · {g.duration}</small>
            </span>
            <span className="gc-best">
              {me ? <>{me.games?.[g.id]?.points ?? 0}<small>/ 50 pts</small></> : <>▶<small>Jouer</small></>}
            </span>
          </button>
        ))}
      </div>

      <button className="bonus-banner" onClick={() => goto("bonus")}>
        <span className="bb-emoji">🎁</span>
        <span className="bb-txt"><b>Gagnez jusqu'à {bonus.follow_fb * 3 + bonus.share} points en 1 minute</b><small>Suivez-nous, partagez et invitez vos amis</small></span>
        <span className="bb-go">→</span>
      </button>

      <div className="card prizes">
        <h2 className="sec in">🏅 À gagner chaque semaine</h2>
        {prizes.map((p) => (
          <div key={p.title} className="prize">
            <span className="medal">{p.medal}</span>
            <span><b>{p.title}</b><small>{p.prize}</small></span>
          </div>
        ))}
        <div className="lottery"><span>🎟️</span><p><b>Tirage au sort du mois</b><small>Les 3 gagnants de chaque semaine tentent leur chance pour un prix spécial… secret 🤫</small></p></div>
        <div className="row">
          <button className="btn" onClick={() => goto("board")}>🏆 Top 50</button>
          <button className="btn" onClick={onRules}>📖 Règlement</button>
        </div>
      </div>

      <h2 className="sec">🧡 Allo..Ala</h2>
      <div className="links">
        <a className="lk wa" href={`https://wa.me/${links.whatsapp}?text=${encodeURIComponent("Bonjour Allo..Ala, je voudrais passer une commande.")}`}><span>💬</span>Commander sur WhatsApp</a>
        <a className="lk" href={`tel:${links.phone}`}><span>📞</span>Appeler 93 332 862</a>
        <a className="lk" href={links.site}><span>🌐</span>alloala.com</a>
        <a className="lk" href={links.qr}><span>📲</span>Tous nos liens</a>
        {links.playStore ? <a className="lk" href={links.playStore}><span>▶️</span>Google Play</a> : <span className="lk soon"><span>📱</span>App bientôt</span>}
        <a className="lk" href={links.instagram}><span>📸</span>Instagram</a>
      </div>
      <p className="foot">Sbeïtla, Tunisie · © {new Date().getFullYear()} Allo..Ala</p>
    </section>
  );
}

// ---------- classement (top 50 + progression) ----------
function Board({ session, onPlay, goto }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [move, setMove] = useState(0);
  const left = useCountdown(data?.endsAt);
  useEffect(() => {
    api("leaderboard", { token: session?.token })
      .then((d) => {
        setData(d);
        if (d.me) {
          // progression depuis la dernière visite (même semaine)
          const prev = JSON.parse(ls.get("aa-lastrank") || "null");
          if (prev && prev.week === d.week) setMove(prev.rank - d.me.rank);
          ls.set("aa-lastrank", JSON.stringify({ week: d.week, rank: d.me.rank }));
        }
      })
      .catch((e) => setError(e.message));
  }, [session]);
  const [p1, p2, p3] = data?.rows || [];
  return (
    <section className="screen board">
      <h1 className="page-title">🏆 Top 50</h1>
      <p className="muted">Classement de la semaine · fin dans <b>{left || "…"}</b>{data ? ` · ${data.players} joueur${data.players > 1 ? "s" : ""}` : ""}</p>
      {error && <p className="err">{error}</p>}
      {!data && !error && <div className="skeleton" aria-label="Chargement" />}

      {data?.me && (
        <div className="me-card">
          <div className="me-rank"><b>{ord(data.me.rank)}</b><small>{fmt(data.me.points)} pts</small></div>
          <div className="me-info">
            <b>{data.me.name}</b>
            {move > 0 && <span className="up">▲ {move} place{move > 1 ? "s" : ""} depuis votre dernière visite</span>}
            {move < 0 && <span className="down">▼ {-move} place{move < -1 ? "s" : ""} depuis votre dernière visite</span>}
            {move === 0 && <span className="muted">Vous gardez votre place</span>}
            {data.me.gap
              ? <small>Encore <b>{fmt(data.me.gap.points)} pts</b> pour dépasser {data.me.gap.name} ({ord(data.me.gap.rank)})</small>
              : <small>Vous êtes en tête ! 🔥</small>}
          </div>
        </div>
      )}

      {data && data.rows.length > 0 && (
        <div className="podium">
          {[p2, p1, p3].map((p, i) => p ? (
            <div key={p.rank} className={`pod pod${p.rank}${p.me ? " is-me" : ""}`}>
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
          <li key={r.rank} className={r.me ? "is-me" : ""}>
            <span className="rk">{r.rank}</span>
            <span className="nm">{r.name}{r.me && <small>vous</small>}</span>
            <span className="sc">{fmt(r.points)}</span>
          </li>
        ))}
        {data && !data.rows.length && <li className="empty">Personne n'a encore de points cette semaine. La 1ʳᵉ place est à vous !</li>}
      </ol>
      <div className="row">
        <button className="btn primary" onClick={() => onPlay("rush")}>🎮 Jouer</button>
        <button className="btn" onClick={() => goto("bonus")}>🎁 Points bonus</button>
      </div>
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
      setMsg(`🎉 +${r.points} points ! Votre total : ${fmt(r.total)} pts`);
      refresh();
    } catch (e) {
      setMsg(e.message);
    }
  }
  function follow(type, url) {
    if (!session) return onLogin();
    window.open(url, "_blank", "noopener");
    setPending((p) => ({ ...p, [type]: true }));
  }
  async function share() {
    if (!session) return onLogin();
    const ok = await shareNative({
      title: "Allo..Ala",
      text: "🛵 Allo..Ala livre tout à Sbeïtla & Kasserine ! Commandez par appel ou WhatsApp, et jouez pour gagner 10 DT et des livraisons offertes :",
      url: shareUrl(me),
    });
    if (ok) claim("share");
  }
  function invite() {
    if (!session) return onLogin();
    shareNative({
      title: "Allo..Ala Jeux",
      text: `🎮 Joue avec moi sur Allo..Ala Jeux et gagne 10 DT ! Avec mon lien tu as +${bonus.welcome} points :`,
      url: shareUrl(me),
    });
  }
  const m = me?.missions || {};
  const Mission = ({ id, cls, icon, title, sub, url, pts }) => (
    <div className={`mission ${cls}`}>
      <span className="ms-icon">{icon}</span>
      <span className="ms-txt"><b>{title}</b><small>{sub}</small></span>
      {m[id] ? <span className="ms-done">✓ +{pts}</span> : pending[id]
        ? <button className="btn mini primary" onClick={() => claim(id)}>Réclamer +{pts}</button>
        : <button className="btn mini" onClick={() => follow(id, url)}>Suivre · +{pts}</button>}
    </div>
  );
  return (
    <section className="screen bonus">
      <h1 className="page-title">🎁 Points bonus</h1>
      <p className="muted">Le moyen le plus rapide de grimper dans le classement.</p>
      {msg && <p className="note" role="status">{msg}</p>}

      <Mission id="follow_fb" cls="fb" icon="👍" title="Suivre notre page Facebook" sub="Une seule fois" url={links.facebook} pts={bonus.follow_fb} />
      <Mission id="follow_ig" cls="ig" icon="📸" title="Suivre notre Instagram" sub="Une seule fois" url={links.instagram} pts={bonus.follow_ig} />
      <Mission id="follow_tt" cls="tt" icon="🎵" title="Suivre notre TikTok" sub="Une seule fois" url={links.tiktok} pts={bonus.follow_tt} />
      <div className="mission share">
        <span className="ms-icon">📤</span>
        <span className="ms-txt"><b>Partager Allo..Ala</b><small>Le site et l'app · chaque jour</small></span>
        {m.share ? <span className="ms-done">✓ Demain</span> : <button className="btn mini" onClick={share}>Partager · +{bonus.share}</button>}
      </div>

      <div className="card invite">
        <h2 className="sec in">🤝 Invitez vos amis · +{bonus.referral} pts</h2>
        <p className="muted">Votre ami s'inscrit avec votre lien et joue une partie : <b>+{bonus.referral} points pour vous</b>, <b>+{bonus.welcome} pour lui</b>. Sans limite !</p>
        {me ? (
          <>
            <div className="refbox"><span>Votre code</span><b>{me.refCode}</b></div>
            <p className="muted center">{me.referrals} ami{me.referrals > 1 ? "s" : ""} parrainé{me.referrals > 1 ? "s" : ""}</p>
            <button className="btn primary" onClick={invite}>📲 Inviter un ami</button>
          </>
        ) : (
          <button className="btn primary" onClick={onLogin}>👋 Se connecter pour inviter</button>
        )}
      </div>
    </section>
  );
}

// ---------- profil ----------
function Profile({ me, session, onLogin, onLogout, onRules, onPrivacy, refresh }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  if (!me) {
    return (
      <section className="screen profile">
        <h1 className="page-title">👤 Profil</h1>
        <div className="card center">
          <p className="big-emoji">🛵</p>
          <p>Connectez-vous pour cumuler vos points, parrainer vos amis et recevoir vos prix.</p>
          <button className="btn primary" onClick={onLogin}>👋 Se connecter</button>
        </div>
        <div className="row"><button className="btn" onClick={onRules}>📖 Règlement</button><button className="btn" onClick={onPrivacy}>🔒 Confidentialité</button></div>
      </section>
    );
  }
  async function rename(e) {
    e.preventDefault();
    setError("");
    try {
      await api("me", { method: "POST", token: session.token, body: { username: name } });
      setEditing(false);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <section className="screen profile">
      <div className="profile-head">
        <span className="avatar">{(me.username || "?").slice(0, 1).toUpperCase()}</span>
        <div>
          <h1 className="page-title">{me.username}</h1>
          <p className="muted">{me.email} · {me.phone}</p>
        </div>
      </div>
      {editing ? (
        <form className="card" onSubmit={rename}>
          <label className="field"><span>Nouveau nom d'utilisateur</span><input maxLength={16} value={name} onChange={(e) => setName(e.target.value.replace(/\s/g, ""))} autoFocus /></label>
          {error && <p className="err">{error}</p>}
          <div className="row"><button className="btn primary" disabled={name.length < 3}>Enregistrer</button><button type="button" className="btn" onClick={() => setEditing(false)}>Annuler</button></div>
        </form>
      ) : (
        <button className="link" onClick={() => { setName(me.username); setEditing(true); }}>✏️ Changer de nom d'utilisateur</button>
      )}

      <div className="card">
        <h2 className="sec in">Vos points de la semaine</h2>
        <div className="breakdown">
          {games.map((g) => (
            <div key={g.id}>
              <span>{g.emoji} {g.name}<small>record {fmt(me.games?.[g.id]?.score)}</small></span>
              <b>{me.games?.[g.id]?.points ?? 0} <small>/ 50</small></b>
            </div>
          ))}
          <div><span>🎁 Bonus</span><b>{fmt(me.bonusPts)}</b></div>
          <div className="total"><span>Total</span><b>{fmt(me.total)}</b></div>
        </div>
        <p className="muted center">{me.rank ? <>Classement : <b>{ord(me.rank)}</b> sur {me.players}</> : "Pas encore classé cette semaine"} · {me.gamesPlayed} partie{me.gamesPlayed > 1 ? "s" : ""} jouée{me.gamesPlayed > 1 ? "s" : ""}</p>
      </div>
      <div className="row"><button className="btn" onClick={onRules}>📖 Règlement</button><button className="btn" onClick={onPrivacy}>🔒 Confidentialité</button></div>
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
        <button className="icon-btn" onClick={onQuit} aria-label="Quitter la partie">✕</button>
        <div className="hud-title">{g.emoji} {g.name}</div>
        <div className="hud-score"><b>{hud.score ?? (gameId === "memo" ? 1000 : 0)}</b><small>score</small></div>
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
            {gameId === "rush" && <span className="carry">{[0, 1, 2].map((i) => <i key={i}>{hud.carry?.[i] || ""}</i>)}</span>}
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
function Result({ gameId, result, save, session, me, onLogin, onReplay, onHome, onPlay, goto }) {
  const g = gameById(gameId);
  const others = games.filter((x) => x.id !== gameId);
  const pts = gamePoints(result.score);
  return (
    <section className="screen over">
      <p className="kicker">{g.emoji} {g.name}</p>
      <div className="big-score">{fmt(result.score)}<small>score · vaut {pts} pt{pts > 1 ? "s" : ""} sur 50</small></div>
      <p className="muted center">
        {gameId === "rush" && `📦 ${result.deliveries} commande${result.deliveries > 1 ? "s" : ""} livrée${result.deliveries > 1 ? "s" : ""}`}
        {gameId === "catch" && `📦 ${result.caught} commande${result.caught > 1 ? "s" : ""} attrapée${result.caught > 1 ? "s" : ""}`}
        {gameId === "memo" && `🔁 ${result.moves} coups · ⏱️ ${Math.round(result.seconds)} s`}
      </p>

      <div className="card save">
        {save.status === "saving" && <p>Enregistrement…</p>}
        {save.status === "saved" && (
          <>
            {save.gained > 0
              ? <p className="gain">🎉 Nouveau record : <b>+{save.gained} point{save.gained > 1 ? "s" : ""}</b> ajouté{save.gained > 1 ? "s" : ""} à votre total</p>
              : save.improved
                ? <p>Nouveau record, mais vous êtes déjà à <b>{save.pointsNow} pts</b> sur ce jeu.</p>
                : <p>Votre record ici reste <b>{fmt(save.best)}</b> ({save.pointsNow} pts). Rejouez pour le battre !</p>}
            <p>Total de la semaine : <b>{fmt(save.total)} pts</b> · <b>{ord(save.rank)}</b>{save.rank <= 3 ? " 🏆 dans le top 3 !" : ""}</p>
            {save.referralPaid && <p className="note">🤝 Bonus parrainage débloqué : +{bonus.welcome} points !</p>}
          </>
        )}
        {save.status === "error" && <p className="err">{save.error}</p>}
        {!session && save.status !== "saved" && (
          <>
            <p>Connectez-vous pour ajouter ce score à votre total et tenter de gagner.</p>
            <button className="btn primary" onClick={onLogin}>👋 Enregistrer mon score</button>
          </>
        )}
      </div>

      <div className="row">
        <button className="btn primary" onClick={onReplay}>🔁 Rejouer</button>
        <button className="btn" onClick={onHome}>🏠 Accueil</button>
      </div>
      <button className="bonus-banner small" onClick={() => goto("bonus")}>
        <span className="bb-emoji">💡</span>
        <span className="bb-txt"><b>Astuce : les missions rapportent plus</b><small>+{bonus.follow_fb} par abonnement, +{bonus.referral} par ami invité</small></span>
        <span className="bb-go">→</span>
      </button>
      <div className="row">
        {others.map((o) => <button key={o.id} className="btn" onClick={() => onPlay(o.id)}>{o.emoji} {o.name}</button>)}
      </div>
      <button
        className="btn share"
        onClick={() => shareNative({ title: "Allo..Ala Jeux", text: `J'ai fait ${result.score} sur ${g.name} 🛵 Bats mon score et gagne 10 DT !`, url: shareUrl(me) })}
      >📤 Défier un ami</button>
    </section>
  );
}

// ---------- barre d'onglets ----------
function TabBar({ tab, goto }) {
  const tabs = [["home", "🏠", "Accueil"], ["board", "🏆", "Top 50"], ["bonus", "🎁", "Bonus"], ["profile", "👤", "Profil"]];
  return (
    <nav className="tabbar" aria-label="Navigation">
      {tabs.map(([id, ic, label]) => (
        <button key={id} className={tab === id ? "on" : ""} onClick={() => goto(id)} aria-current={tab === id ? "page" : undefined}>
          <span aria-hidden="true">{ic}</span>{label}
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
  const [privacy, setPrivacy] = useState(false);
  const [playing, setPlaying] = useState(null);
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

  const logout = useCallback(() => { saveSession(null); setSession(null); setMe(null); }, []);

  const refresh = useCallback(async (sess = session) => {
    if (!sess) return setMe(null);
    try {
      const r = await api("me", { token: sess.token });
      setMe(r.me);
      if (r.me.needsProfile) setLogin((l) => l || { startAt: "profile" });
    } catch (e) {
      if (e.status === 401) logout();
    }
  }, [session, logout]);
  useEffect(() => { refresh(); }, [refresh]);

  const submit = useCallback(async (res, sess) => {
    if (!sess) return;
    if (!gameIdRef.current) return setSave({ status: "error", error: "Score non enregistré (pas de connexion internet au début de la partie)." });
    setSave({ status: "saving" });
    try {
      const r = await api("game/finish", { method: "POST", token: sess.token, body: { gameId: gameIdRef.current, ...res } });
      gameIdRef.current = null;
      setSave({ status: "saved", ...r });
      refresh(sess);
    } catch (e) {
      if (e.status === 401) { logout(); setSave({ status: "idle" }); }
      else if (e.status === 428) { setSave({ status: "idle" }); setLogin({ startAt: "profile", then: "submit" }); }
      else setSave({ status: "error", error: e.message });
    }
  }, [refresh, logout]);

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
      submit(res, loadSession());
    }, 800);
  }, [submit]);

  function loggedIn(sess, profile) {
    saveSession(sess);
    setSession(sess);
    setMe(profile);
    const then = login?.then;
    setLogin(null);
    if (then === "submit" && result && playingRef.current) submit(result, sess);
  }

  const goto = (t) => { playingRef.current = null; setPlaying(null); setResult(null); setTab(t); window.scrollTo(0, 0); };
  const openLogin = (extra = {}) => setLogin(extra);

  if (isAdmin) return <Admin />;

  let content;
  if (playing && !result) content = <Play key={round} gameId={playing} onEnd={onEnd} onQuit={() => goto("home")} />;
  else if (playing && result)
    content = (
      <Result
        gameId={playing} result={result} save={save} session={session} me={me}
        onLogin={() => openLogin({ then: "submit", reason: "Pour enregistrer ce score." })}
        onReplay={() => play(playing)} onHome={() => goto("home")} onPlay={play} goto={goto}
      />
    );
  else if (tab === "board") content = <Board session={session} onPlay={play} goto={goto} />;
  else if (tab === "bonus") content = <Bonus me={me} session={session} onLogin={() => openLogin()} refresh={refresh} />;
  else if (tab === "profile")
    content = <Profile me={me} session={session} refresh={refresh} onLogin={() => openLogin()} onRules={() => setRules(true)} onPrivacy={() => setPrivacy(true)} onLogout={logout} />;
  else content = <Home me={me} onPlay={play} onLogin={() => openLogin()} goto={goto} onRules={() => setRules(true)} />;

  return (
    <div className="shell">
    {/* Panneau de gauche : uniquement sur grand écran */}
    <aside className="desk-side" aria-label="Présentation">
      <img src={logo} alt="Logo Allo..Ala" className="ds-logo" />
      <h1>Allo<span>..Ala</span> Jeux</h1>
      <p className="ds-ar ar">كلمني ... نفضهالك</p>
      <p className="ds-sub">Jouez, cumulez des points et gagnez chaque semaine. Livraison à Sbeïtla &amp; Kasserine.</p>
      <ul className="ds-prizes">
        {prizes.map((p) => <li key={p.title}><span>{p.medal}</span><b>{p.title}</b> {p.prize}</li>)}
      </ul>
      <p className="ds-lottery">🎟️ Tirage au sort chaque mois pour un prix secret</p>
      <p className="ds-tip">📱 Meilleure expérience sur téléphone</p>
    </aside>
    <main className={`app${playing && !result ? " is-playing" : ""}`}>
      <div className="bg-blobs" aria-hidden="true"><i /><i /><i /></div>
      {content}
      {!(playing && !result) && <TabBar tab={playing ? "" : tab} goto={goto} />}
      {login && (
        <Login
          reason={login.reason}
          startAt={login.startAt}
          session={login.startAt === "profile" ? session : null}
          onDone={loggedIn}
          onClose={() => setLogin(null)}
          onRules={() => setRules(true)}
          onPrivacy={() => setPrivacy(true)}
        />
      )}
      {rules && <Rules onClose={() => setRules(false)} />}
      {privacy && <Privacy onClose={() => setPrivacy(false)} />}
    </main>
    </div>
  );
}
