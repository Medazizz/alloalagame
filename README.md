# Allo..Ala Jeux

Site de jeux Allo..Ala : 3 jeux, des points qui s'additionnent, des missions
bonus, du parrainage et un classement hebdomadaire avec des prix.

## Les jeux

| Jeu | Principe | Durée |
|---|---|---|
| 🛵 Allo..Ala Rush | Ramasser les commandes, les livrer aux maisons, éviter les obstacles | 60 s |
| 📦 Attrape-Commandes | Attraper les commandes qui tombent dans le coffre, éviter les pièges | 45 s |
| 🧠 Mémo Livraison | Retrouver les 8 paires le plus vite, en un minimum de coups | ~1 min |

## Les points (semaine du lundi 00:00 au dimanche 23:59, heure de Tunisie)

**Total = meilleur score de la semaine dans chaque jeu (additionnés) + points bonus.**

| Bonus | Points |
|---|---|
| Abonnement Facebook (une fois) | +100 |
| Abonnement Instagram (une fois) | +100 |
| Partage du site / de l'app (une fois par jour) | +30 |
| Ami parrainé (quand il joue sa 1ʳᵉ partie) | +200, et +100 pour l'ami |

Les abonnements sont déclaratifs (pas de vérification possible sans accès à Meta).

## Les prix

| Place | Prix |
|---|---|
| 🥇 1ʳᵉ | 10 TND + 3 livraisons offertes |
| 🥈 2ᵉ | 3 livraisons offertes |
| 🥉 3ᵉ | 3 livraisons offertes |

Un seul prix par numéro et par semaine. Connexion par numéro vérifié par SMS.

## Démarrer sur l'ordinateur

```bash
npm install
npm run dev
```

En local, tout fonctionne sans configuration : les scores sont gardés en mémoire
et le code SMS s'affiche à l'écran (mode test). Admin : `http://localhost:5173/#admin`, clé `dev`.

## Mise en ligne (Vercel)

Variables d'environnement à ajouter dans Vercel (Settings → Environment Variables) :

| Variable | Rôle |
|---|---|
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Base de données Upstash Redis (créée automatiquement via Vercel → Storage → Upstash Redis) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SID` | Envoi des codes SMS (Twilio Verify) |
| `ADMIN_KEY` | Mot de passe de la page admin (`/#admin`) |

Sans les variables Twilio, l'envoi de SMS est refusé en ligne (pas de mode test en production).

## Interface admin (`/#admin`)

- Tous les joueurs de la semaine : numéro, pseudo, points par jeu, bonus, parrainages.
- Les 3 gagnants avec leur prix, un bouton « 💬 Prévenir » (WhatsApp) et « Marquer récompensé ».
- Recherche par nom ou numéro, export Excel (CSV), semaines précédentes.

Chaque lundi : passer à « Semaine dernière », créditer les prix dans l'application
Allo..Ala, prévenir les gagnants, puis « Marquer récompensé ».

## Structure

```
api/            serveur (fonctions Vercel) : SMS, parties, points, bonus, parrainage, classement, admin
src/config.js   liens, jeux, prix, points bonus (à modifier ici)
src/games/      les 3 jeux (rush.js, catch.js, Memo.jsx)
src/App.jsx     écrans : accueil, classement, bonus, profil, partie, résultat, connexion
src/Admin.jsx   interface admin
src/sound.js    sons synthétisés
```
