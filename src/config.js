// ============================================================
//  RÉGLAGES DU SITE DE JEUX — liens, jeux, prix et missions.
// ============================================================

export const links = {
  site: "https://www.alloala.com/",
  qr: "https://alloala.com/qrcode/",
  facebook: "https://www.facebook.com/profile.php?id=61594596262719",
  instagram: "https://www.instagram.com/alloala_sbeitla/",
  tiktok: "https://www.tiktok.com/@alloala766",
  whatsapp: "21693332862",
  phone: "+21693332862",
  playStore: "", // à remplir quand l'app sera publiée
  appStore: "",
};

export const games = [
  {
    id: "rush",
    name: "Allo..Ala Rush",
    emoji: "🛵",
    tagline: "Ramassez, livrez, esquivez !",
    how: "Changez de voie, livrez les commandes aux maisons 🏠 et évitez les obstacles.",
    duration: "60 s",
    color: "linear-gradient(140deg, #EF6C1C, #FFA35F)",
  },
  {
    id: "catch",
    name: "Attrape-Commandes",
    emoji: "📦",
    tagline: "Rien ne doit tomber par terre",
    how: "Glissez le coffre pour attraper les commandes ⭐ et évitez les pièges 🪨🐝.",
    duration: "45 s",
    color: "linear-gradient(140deg, #3F8CFF, #1D3B8C)",
  },
  {
    id: "memo",
    name: "Mémo Livraison",
    emoji: "🧠",
    tagline: "Retrouvez les paires",
    how: "Retournez les cartes et retrouvez les 8 paires le plus vite possible.",
    duration: "~1 min",
    color: "linear-gradient(140deg, #2BE07A, #128C7E)",
  },
];

export const prizes = [
  { medal: "🥇", title: "1ʳᵉ place", prize: "10 TND + 3 livraisons offertes" },
  { medal: "🥈", title: "2ᵉ place", prize: "3 livraisons offertes" },
  { medal: "🥉", title: "3ᵉ place", prize: "3 livraisons offertes" },
];

// Points bonus (doivent correspondre à api/_lib/points.js)
export const bonus = {
  follow_fb: 100,
  follow_ig: 100,
  share: 30,
  referral: 200,
  welcome: 100,
};
