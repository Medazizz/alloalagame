// Allo..Ala Rush : accueil, partie, résultat, classement, connexion par SMS.
import { useCallback, useEffect, useRef, useState } from "react";
import { createGame, GAME_SECONDS } from "./game.js";
import { api, loadSession, saveSession } from "./api.js";
import { unlockAudio, isMuted, setMuted } from "./sound.js";
import Admin from "./Admin.jsx";

const logo = `${import.meta.env.BASE_URL}logo.png`;
const ord = (n) => (n === 1 ? "1ʳᵉ" : `${n}ᵉ`);

const PRIZES = [
  { medal: "🥇", title: "1ʳᵉ place", prize: "10 TND + 3 livraisons offertes" },
  { medal: "🥈", title: "2ᵉ place", prize: "3 livraisons offertes" },
  { medal: "🥉", title: "3ᵉ place", prize: "3 livraisons offertes" },
];

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

  async function sendSms(e) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api("otp/send", { method: "POST", body: { phone } });
      setDevCode(r.devCode || "");
      setStep("code");
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function verify(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api("otp/verify", { method: "POST", body: { phone, code } });
      const s = { token: r.token, profile: r.profile };
      setSess(s);
      if (r.profile.name) onDone(s);
      else setStep("name");
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function saveName(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api("me", { method: "POST", body: { name }, token: sess.token });
      onDone({ ...sess, profile: r.profile });
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
      <div className="modal-card">
        <button className="x" onClick={onClose} aria-label="Fermer">×</button>
        {step === "phone" && (
          <form onSubmit={sendSms}>
            <h2 id="login-title">📱 Votre numéro</h2>
            <p className="muted">{reason || "Pour entrer dans le classement et recevoir votre prix."} Utilisez le numéro de votre compte Allo..Ala.</p>
            <label className="phone-field">
              <span>+216</span>
              <input
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="93 332 862"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoFocus
              />
            </label>
            {error && <p className="err">{error}</p>}
            <button className="btn primary" disabled={busy || phone.replace(/\D/g, "").length < 8}>
              {busy ? "Envoi…" : "Recevoir mon code par SMS"}
            </button>
          </form>
        )}
        {step === "code" && (
          <form onSubmit={verify}>
            <h2 id="login-title">🔐 Code reçu par SMS</h2>
            <p className="muted">Envoyé au +216 {phone}. <button type="button" className="link" onClick={() => setStep("phone")}>Changer</button></p>
            {devCode && <p className="dev">Mode test : votre code est <b>{devCode}</b></p>}
            <input
              className="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoFocus
            />
            {error && <p className="err">{error}</p>}
            <button className="btn primary" disabled={busy || code.length < 4}>{busy ? "Vérification…" : "Valider"}</button>
            <button type="button" className="link center" onClick={sendSms} disabled={busy}>Renvoyer le code</button>
          </form>
        )}
        {step === "name" && (
          <form onSubmit={saveName}>
            <h2 id="login-title">🏁 Votre pseudo</h2>
            <p className="muted">Il s'affichera dans le classement (votre numéro reste masqué).</p>
            <input className="text" maxLength={18} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. : Sami_Sbeitla" autoFocus />
            {error && <p className="err">{error}</p>}
            <button className="btn primary" disabled={busy || name.trim().length < 2}>C'est parti !</button>
          </form>
        )}
      </div>
    </div>
  );
}

// ---------- règlement ----------
function Rules({ onClose }) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="rules-title">
      <div className="modal-card rules">
        <button className="x" onClick={onClose} aria-label="Fermer">×</button>
        <h2 id="rules-title">Comment jouer & gagner</h2>
        <ul>
          <li>🛵 Glissez ← → (ou touchez un côté de l'écran) pour changer de voie.</li>
          <li>🍕 Ramassez les commandes (jusqu'à 3 à la fois) : <b>+10</b>.</li>
          <li>🏠 Livrez-les aux maisons : <b>+50 par commande</b>, combo jusqu'à <b>x3</b>.</li>
          <li>🕳️🐑🚗 Évitez les obstacles : vous perdez une vie et vos commandes.</li>
          <li>⏱️ Les chronos donnent <b>+4 secondes</b>. Une partie dure {GAME_SECONDS} s.</li>
        </ul>
        <h3>Règlement</h3>
        <ul className="small">
          <li>Jeu gratuit, sans obligation d'achat.</li>
          <li>Classement du lundi 00:00 au dimanche 23:59 (heure de Tunisie). Seul votre meilleur score compte.</li>
          <li>Chaque semaine : 1ʳᵉ place 10 TND + 3 livraisons offertes ; 2ᵉ et 3ᵉ place 3 livraisons offertes, crédités sur le compte Allo..Ala lié à votre numéro.</li>
          <li>Un seul prix par numéro et par semaine. Toute triche entraîne l'exclusion.</li>
          <li>Votre numéro sert uniquement au jeu et à la remise des prix.</li>
        </ul>
        <button className="btn primary" onClick={onClose}>Compris !</button>
      </div>
    </div>
  );
}

// ---------- classement ----------
function Board({ session, onBack, onPlay }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const left = useCountdown(data?.endsAt);
  useEffect(() => {
    api("leaderboard", { token: session?.token })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [session]);
  return (
    <section className="screen board">
      <header className="bar">
        <button className="back" onClick={onBack} aria-label="Retour">←</button>
        <h2>🏆 Classement de la semaine</h2>
      </header>
      {data && <p className="muted center">Fin de la semaine dans <b>{left}</b> · {data.players} joueur{data.players > 1 ? "s" : ""}</p>}
      {error && <p className="err">{error}</p>}
      <ol className="rows">
        {data?.rows.map((r) => (
          <li key={r.rank} className={r.rank <= 3 ? `top top${r.rank}` : ""}>
            <span className="rk">{r.rank <= 3 ? PRIZES[r.rank - 1].medal : r.rank}</span>
            <span className="nm">{r.name}<small>{r.phone}</small></span>
            <span className="sc">{r.score}</span>
          </li>
        ))}
        {data && !data.rows.length && <li className="empty">Personne n'a encore joué cette semaine. La première place est à vous !</li>}
      </ol>
      {data?.me && <p className="me">Votre place : <b>{ord(data.me.rank)}</b> avec <b>{data.me.score}</b> points</p>}
      <button className="btn primary" onClick={onPlay}>🛵 Jouer</button>
    </section>
  );
}

// ---------- partie ----------
function Play({ onEnd, onQuit }) {
  const canvasRef = useRef(null);
  const [hud, setHud] = useState({ score: 0, timeLeft: GAME_SECONDS, lives: 3, carry: [], combo: 1 });
  const gameRef = useRef(null);
  useEffect(() => {
    const g = createGame(canvasRef.current, { onHud: setHud, onEnd });
    gameRef.current = g;
    return () => g.destroy();
  }, [onEnd]);
  const pct = Math.min(100, (hud.timeLeft / GAME_SECONDS) * 100);
  return (
    <section className="screen play">
      <div className="hud">
        <button className="quit" onClick={onQuit} aria-label="Quitter">✕</button>
        <div className="hud-score"><b>{hud.score}</b><small>points</small></div>
        <div className="hud-lives" aria-label={`${hud.lives} vies`}>{"❤️".repeat(hud.lives)}{"🤍".repeat(Math.max(0, 3 - hud.lives))}</div>
      </div>
      <div className="timebar"><i style={{ width: `${pct}%` }} className={hud.timeLeft < 10 ? "low" : ""} /></div>
      <div className="carry">
        <span>Coffre :</span>
        {[0, 1, 2].map((i) => <span key={i} className="slot">{hud.carry[i] || ""}</span>)}
        {hud.combo > 1 && <span className="combo">Combo x{hud.combo}</span>}
      </div>
      <canvas ref={canvasRef} className="game" />
      <div className="pads" aria-hidden="true">
        <button onPointerDown={() => gameRef.current?.move(-1)}>←</button>
        <button onPointerDown={() => gameRef.current?.move(1)}>→</button>
      </div>
    </section>
  );
}

// ---------- résultat ----------
function Over({ result, session, onLogin, onReplay, onBoard, saveState }) {
  async function share() {
    const url = `${location.origin}${import.meta.env.BASE_URL}?src=partage`;
    const text = `J'ai livré ${result.deliveries} commandes et fait ${result.score} points sur Allo..Ala Rush 🛵 Bats mon score et gagne ta livraison offerte !`;
    try {
      if (navigator.share) await navigator.share({ title: "Allo..Ala Rush", text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        alert("Lien copié !");
      }
    } catch {
      // partage annulé
    }
  }
  return (
    <section className="screen over">
      <p className="kicker">{result.lives <= 0 ? "Oups, plus de vies !" : "Temps écoulé !"}</p>
      <div className="big-score">{result.score}<small>points</small></div>
      <p className="muted center">📦 {result.deliveries} commande{result.deliveries > 1 ? "s" : ""} livrée{result.deliveries > 1 ? "s" : ""}</p>

      <div className="save">
        {saveState.status === "saving" && <p>Enregistrement…</p>}
        {saveState.status === "saved" && (
          <p>
            {saveState.newBest ? "🎉 Nouveau record ! " : ""}Vous êtes <b>{ord(saveState.rank)}</b> sur {saveState.players} cette semaine
            {saveState.rank <= 3 ? " — dans le top 3 : vous gagnez si ça tient jusqu'à dimanche ! 🏆" : "."}
          </p>
        )}
        {saveState.status === "error" && <p className="err">{saveState.error}</p>}
        {!session && saveState.status !== "saved" && (
          <>
            <p>Enregistrez votre score pour entrer dans le classement et tenter de gagner.</p>
            <button className="btn primary" onClick={onLogin}>📱 Enregistrer mon score</button>
          </>
        )}
      </div>

      <div className="row">
        <button className="btn" onClick={onReplay}>🔁 Rejouer</button>
        <button className="btn" onClick={onBoard}>🏆 Classement</button>
      </div>
      <button className="btn share" onClick={share}>📤 Défier un ami</button>
    </section>
  );
}

// ---------- accueil ----------
function Home({ session, onPlay, onBoard, onRules, onLogin, onLogout }) {
  const [muted, setM] = useState(isMuted());
  return (
    <section className="screen home">
      <button className="mute" onClick={() => { setMuted(!muted); setM(!muted); }} aria-label={muted ? "Activer le son" : "Couper le son"}>
        {muted ? "🔇" : "🔊"}
      </button>
      <img className="logo" src={logo} alt="Logo Allo..Ala" />
      <h1>Allo<span>..Ala</span> <em>Rush</em></h1>
      <p className="ar">كلمني ... نفضهالك</p>
      <p className="sub">Livrez un maximum de commandes dans les rues de Sbeïtla en {GAME_SECONDS} secondes.</p>

      <button className="btn primary huge" onClick={onPlay}>🛵 Jouer</button>

      <div className="prizes">
        <h2>À gagner chaque semaine</h2>
        {PRIZES.map((p) => (
          <div key={p.title} className="prize">
            <span className="medal">{p.medal}</span>
            <span><b>{p.title}</b><small>{p.prize}</small></span>
          </div>
        ))}
      </div>

      <div className="row">
        <button className="btn" onClick={onBoard}>🏆 Classement</button>
        <button className="btn" onClick={onRules}>📖 Règles</button>
      </div>

      <p className="who">
        {session ? (
          <>Connecté : <b>{session.profile.name}</b> ({session.profile.masked}) · <button className="link" onClick={onLogout}>Se déconnecter</button></>
        ) : (
          <button className="link" onClick={onLogin}>📱 Se connecter avec mon numéro</button>
        )}
      </p>
    </section>
  );
}

export default function App() {
  const [screen, setScreen] = useState("home");
  const [session, setSession] = useState(loadSession);
  const [login, setLogin] = useState(null); // { reason, then }
  const [rules, setRules] = useState(false);
  const [result, setResult] = useState(null);
  const [saveState, setSaveState] = useState({ status: "idle" });
  const [round, setRound] = useState(0);
  const gameIdRef = useRef(null);

  // Lien admin : …/#admin
  const [isAdmin, setIsAdmin] = useState(location.hash === "#admin");
  useEffect(() => {
    const f = () => setIsAdmin(location.hash === "#admin");
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);

  // Session expirée côté serveur : on la retire
  useEffect(() => {
    if (!session) return;
    api("me", { token: session.token }).catch((e) => {
      if (e.status === 401) {
        saveSession(null);
        setSession(null);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = useCallback(async (res, sess) => {
    if (!sess || !gameIdRef.current) {
      if (!gameIdRef.current && sess) setSaveState({ status: "error", error: "Score non enregistré (pas de connexion au début de la partie)." });
      return;
    }
    setSaveState({ status: "saving" });
    try {
      const r = await api("game/finish", { method: "POST", token: sess.token, body: { gameId: gameIdRef.current, ...res } });
      gameIdRef.current = null;
      setSaveState({ status: "saved", ...r });
    } catch (e) {
      if (e.status === 401) {
        saveSession(null);
        setSession(null);
        setSaveState({ status: "idle" });
      } else setSaveState({ status: "error", error: e.message });
    }
  }, []);

  async function play() {
    unlockAudio();
    setSaveState({ status: "idle" });
    setResult(null);
    gameIdRef.current = null;
    api("game/start", { method: "POST" })
      .then((r) => (gameIdRef.current = r.gameId))
      .catch(() => {});
    setRound((n) => n + 1);
    setScreen("play");
  }

  const onEnd = useCallback(
    (res) => {
      setTimeout(() => {
        setResult(res);
        setScreen("over");
        submit(res, loadSession());
      }, 900);
    },
    [submit]
  );

  function loggedIn(sess) {
    saveSession(sess);
    setSession(sess);
    const then = login?.then;
    setLogin(null);
    if (then === "submit" && result) submit(result, sess);
  }

  if (isAdmin) return <Admin />;

  return (
    <main className="app">
      {screen === "home" && (
        <Home
          session={session}
          onPlay={play}
          onBoard={() => setScreen("board")}
          onRules={() => setRules(true)}
          onLogin={() => setLogin({})}
          onLogout={() => { saveSession(null); setSession(null); }}
        />
      )}
      {screen === "play" && <Play key={round} onEnd={onEnd} onQuit={() => setScreen("home")} />}
      {screen === "over" && result && (
        <Over
          result={result}
          session={session}
          saveState={saveState}
          onLogin={() => setLogin({ then: "submit", reason: "Pour enregistrer votre score." })}
          onReplay={play}
          onBoard={() => setScreen("board")}
        />
      )}
      {screen === "board" && <Board session={session} onBack={() => setScreen("home")} onPlay={play} />}
      {login && <Login reason={login.reason} onDone={loggedIn} onClose={() => setLogin(null)} />}
      {rules && <Rules onClose={() => setRules(false)} />}
    </main>
  );
}
