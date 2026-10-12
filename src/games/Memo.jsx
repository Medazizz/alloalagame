// « Mémo Livraison » : retrouvez les 8 paires de commandes le plus vite possible,
// en un minimum de coups. Score = 1000 − 25 par coup au-delà de 8 − 4 par seconde (min. 100).
import { useEffect, useRef, useState } from "react";
import { sfx, buzz } from "../sound.js";

const ICONS = ["🍕", "💊", "📦", "🛒", "🥖", "☕", "🍔", "💐", "🧃", "🍰", "🛵", "🏠"];

export const memoScore = (moves, seconds) =>
  Math.max(100, Math.round(1000 - Math.max(0, moves - 8) * 25 - seconds * 4));

function deck() {
  const pick = [...ICONS].sort(() => Math.random() - 0.5).slice(0, 8);
  return [...pick, ...pick]
    .map((e, i) => ({ id: i, e, open: false, found: false }))
    .sort(() => Math.random() - 0.5);
}

export default function Memo({ onEnd, onHud }) {
  const [cards, setCards] = useState(deck);
  const [open, setOpen] = useState([]);
  const [moves, setMoves] = useState(0);
  const [count, setCount] = useState(3);
  const startRef = useRef(0);
  const [now, setNow] = useState(0);
  const doneRef = useRef(false);

  // compte à rebours 3-2-1, puis le chrono démarre
  useEffect(() => {
    if (count < 0) return;
    sfx.count(count === 0);
    const t = setTimeout(() => {
      if (count === 0) startRef.current = performance.now();
      setCount((c) => c - 1);
    }, count === 0 ? 500 : 800);
    return () => clearTimeout(t);
  }, [count]);

  useEffect(() => {
    if (count >= 0) return;
    const t = setInterval(() => setNow(performance.now()), 200);
    return () => clearInterval(t);
  }, [count]);

  const seconds = startRef.current ? Math.max(0, (now - startRef.current) / 1000) : 0;
  const found = cards.filter((c) => c.found).length / 2;

  useEffect(() => {
    onHud?.({ moves, seconds, found, score: memoScore(moves, seconds) });
  }, [moves, Math.floor(seconds), found]); // eslint-disable-line react-hooks/exhaustive-deps

  function flip(card) {
    if (count >= 0 || card.open || card.found || open.length === 2) return;
    sfx.lane();
    const nextOpen = [...open, card.id];
    setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, open: true } : c)));
    setOpen(nextOpen);
    if (nextOpen.length < 2) return;

    const m = moves + 1;
    setMoves(m);
    const first = cards.find((c) => c.id === nextOpen[0]);
    if (first.e === card.e) {
      setTimeout(() => {
        sfx.pickup();
        buzz(20);
        setCards((cs) => {
          const next = cs.map((c) => (nextOpen.includes(c.id) ? { ...c, found: true } : c));
          if (next.every((c) => c.found) && !doneRef.current) {
            doneRef.current = true;
            const secs = Math.round(((performance.now() - startRef.current) / 1000) * 10) / 10;
            sfx.deliver();
            setTimeout(() => onEnd({ moves: m, seconds: secs, score: memoScore(m, secs) }), 700);
          }
          return next;
        });
        setOpen([]);
      }, 250);
    } else {
      setTimeout(() => {
        setCards((cs) => cs.map((c) => (nextOpen.includes(c.id) ? { ...c, open: false } : c)));
        setOpen([]);
      }, 750);
    }
  }

  return (
    <div className="memo">
      <div className="memo-grid">
        {cards.map((c) => (
          <button
            key={c.id}
            className={`mcard${c.open || c.found ? " is-open" : ""}${c.found ? " is-found" : ""}`}
            onClick={() => flip(c)}
            aria-label={c.open || c.found ? c.e : "Carte cachée"}
          >
            <span className="mback">A</span>
            {/* le contenu n'existe dans la page qu'une fois la carte retournée (anti-triche) */}
            <span className="mfront">{c.open || c.found ? c.e : ""}</span>
          </button>
        ))}
      </div>
      {count >= 0 && (
        <div className="memo-count">
          <b>{count > 0 ? count : "GO !"}</b>
          <span>Retrouvez les 8 paires de commandes</span>
        </div>
      )}
    </div>
  );
}
