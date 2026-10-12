# Allo..Ala Jeux

Site de jeux Allo..Ala : 3 jeux, des missions bonus, du parrainage, un top 50
chaque semaine et un tirage au sort chaque mois.

## Les jeux

| Jeu | Principe | Durée |
|---|---|---|
| 🛵 Allo..Ala Rush | Ramasser les commandes, les livrer aux maisons, éviter les obstacles | 60 s |
| 📦 Attrape-Commandes | Attraper les commandes qui tombent dans le coffre, éviter les pièges | 45 s |
| 🧠 Mémo Livraison | Retrouver les 8 paires le plus vite, en un minimum de coups | ~1 min |

## Les points (semaine du lundi 00:00 au dimanche 23:59, heure de Tunisie)

| Source | Points |
|---|---|
| Chaque jeu | meilleur score de la semaine ÷ 20, **max 50 par jeu** |
| Abonnement Facebook / Instagram / TikTok (une fois chacun) | +150 |
| Partage du site / de l'app (une fois par jour) | +50 |
| Ami parrainé (quand il joue sa 1ʳᵉ partie) | +200, et +50 pour l'ami |

Les abonnements sont déclaratifs (pas de vérification possible sans accès à Meta / TikTok).

## Les prix

| Place | Prix chaque semaine |
|---|---|
| 🥇 1ʳᵉ | 10 DT |
| 🥈 2ᵉ | 1 livraison offerte |
| 🥉 3ᵉ | −50 % sur une livraison |

Les 3 gagnants de chaque semaine reçoivent un ticket pour le **tirage au sort du mois** (prix spécial secret).

## Comptes joueurs (base de données)

Connexion **gratuite par e-mail** : un code à 6 chiffres est envoyé à l'adresse du joueur.
À la première connexion, le joueur choisit un **nom d'utilisateur** (unique, affiché dans le top 50),
indique le **numéro de son compte Allo..Ala** (unique, privé, pour créditer le prix) et accepte le règlement.

Chaque compte enregistre : e-mail, nom d'utilisateur, téléphone, date d'inscription, dernière visite,
nombre de parties, points bonus, parrain et amis parrainés.

## Démarrer sur l'ordinateur

```bash
npm install
npm run dev
```

En local, tout fonctionne sans configuration : les données sont gardées en mémoire et le code
e-mail s'affiche à l'écran (mode test). Admin : `http://localhost:5173/#admin`, clé `dev`.

## Mise en ligne (Vercel)

Variables d'environnement (Vercel → Settings → Environment Variables) :

| Variable | Rôle |
|---|---|
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Base de données Upstash Redis (gratuite), créée via Vercel → Storage → Upstash Redis |
| `BREVO_API_KEY` | Envoi des codes par e-mail avec Brevo (gratuit, 300 e-mails / jour) |
| `MAIL_FROM` | Adresse d'expédition vérifiée dans Brevo (une simple adresse Gmail suffit) |
| `MAIL_NAME` | (facultatif) Nom de l'expéditeur, « Allo..Ala Jeux » par défaut |
| `ADMIN_KEY` | Mot de passe de l'interface admin (`/#admin`) |

`RESEND_API_KEY` peut remplacer `BREVO_API_KEY` (Resend : 100 e-mails / jour gratuits).

## Interface admin (`/#admin`)

- **🏆 Semaine** : classement complet avec e-mail et téléphone, les 3 gagnants avec leur prix,
  « 💬 Prévenir » (WhatsApp) et « Marquer récompensé », export Excel.
- **🗂️ Utilisateurs** : toute la base de données des inscrits, recherche, export Excel.
- **🎟️ Tirage du mois** : les tickets du mois et le bouton de tirage au sort (une seule fois par mois).

## Structure

```
api/            serveur (fonctions Vercel) : e-mail, comptes, parties, points, bonus, classement, admin
src/config.js   liens, jeux, prix, points bonus (à modifier ici)
src/games/      les 3 jeux (rush.js, catch.js, Memo.jsx)
src/App.jsx     écrans : accueil, top 50, bonus, profil, partie, résultat, connexion
src/Admin.jsx   interface admin
src/sound.js    sons synthétisés
```
