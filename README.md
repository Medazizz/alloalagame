# Allo..Ala Rush — le jeu

Mini-jeu de livraison Allo..Ala : le joueur livre un maximum de commandes
dans les rues de Sbeïtla en 60 secondes. Classement hebdomadaire (lundi 00:00 →
dimanche 23:59, heure de Tunisie) :

| Place | Prix |
|---|---|
| 🥇 1ʳᵉ | 10 TND + 3 livraisons offertes |
| 🥈 2ᵉ | 3 livraisons offertes |
| 🥉 3ᵉ | 3 livraisons offertes |

Un seul prix par numéro et par semaine. Les joueurs se connectent avec leur
numéro, vérifié par un code SMS.

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

## Chaque lundi

1. Ouvrir `/#admin`, entrer la clé admin.
2. La semaine terminée s'affiche avec les 3 gagnants et leur numéro.
3. Créditer les prix dans l'application Allo..Ala, puis « Marquer récompensé ».

## Structure

```
api/            serveur (fonctions Vercel) : SMS, parties, classement, admin
src/game.js     moteur du jeu (canvas)
src/App.jsx     écrans : accueil, partie, résultat, classement, connexion
src/Admin.jsx   page admin des gagnants
src/sound.js    sons synthétisés
```
