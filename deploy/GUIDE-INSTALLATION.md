# Installer Allo..Ala Jeux sur le VPS

Le jeu fonctionne entièrement sur le serveur : pas de service extérieur, pas de compte à créer.
Il sera accessible sur **https://alloala.com/jeu/**.

- Site + API : un petit serveur Node.js (port interne 3010), derrière nginx
- Base de données : un fichier sur le serveur (`data/db.json`), sauvegardé chaque jour (14 jours gardés)
- Codes de connexion : envoyés par e-mail depuis la boîte **contact@alloala.com** (SMTP)

## Prérequis

- VPS Linux (Ubuntu / Debian) avec nginx et HTTPS déjà en place pour alloala.com
- Node.js **18 ou plus** (`node -v`). Sinon :
  `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs`
- Les réglages SMTP de la boîte contact@alloala.com (serveur, port, mot de passe), disponibles
  chez l'hébergeur mail (rubrique « configurer un client mail »)

## Installation (10 minutes)

```bash
# 1. Récupérer le code
sudo mkdir -p /var/www/alloalagame && sudo chown $USER /var/www/alloalagame
git clone https://github.com/Medazizz/alloalagame.git /var/www/alloalagame
cd /var/www/alloalagame          # (ou décompresser le ZIP fourni dans ce dossier)

# 2. Réglages : copier le modèle puis remplir SMTP_HOST, SMTP_PORT, SMTP_PASS
cp .env.example .env
nano .env

# 3. Installer, construire et démarrer (crée le service « alloalagame »)
bash deploy/install.sh
```

Le script affiche **le mot de passe admin** généré (il est aussi dans `.env`, ligne `ADMIN_KEY`).
Transmettez-le au responsable d'Allo..Ala.

## nginx

Ajouter le contenu de `deploy/nginx.conf` **dans** le bloc `server { … }` HTTPS de alloala.com, puis :

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Vérifier

Ouvrir **https://alloala.com/jeu/api/health**. Tout est prêt quand on voit :

```json
{ "ready": true, "database": "ok", "email": "ok (smtp)", "admin": "ok" }
```

Puis s'inscrire sur https://alloala.com/jeu/ avec une vraie adresse e-mail pour tester la réception du code.

## Interface admin

**https://alloala.com/jeu/#admin** → saisir le mot de passe `ADMIN_KEY`.

## Au quotidien

| Action | Commande |
|---|---|
| Voir les journaux | `journalctl -u alloalagame -f` |
| Redémarrer | `sudo systemctl restart alloalagame` |
| Mettre à jour le jeu | `cd /var/www/alloalagame && git pull && bash deploy/install.sh` |
| Sauvegarde manuelle | copier le dossier `data/` (le fichier `data/db.json` contient tout) |

Les sauvegardes automatiques sont dans `data/backups/` (une par jour, 14 jours).

## En cas de problème d'e-mail

- `"email": "absent"` sur /api/health : SMTP_HOST, SMTP_USER ou SMTP_PASS manquant dans `.env`
  (puis `sudo systemctl restart alloalagame`).
- Le code n'arrive pas : voir `journalctl -u alloalagame -n 50`. Essayer `SMTP_PORT=587` à la place de 465.
  Certains hébergeurs de VPS bloquent les ports SMTP sortants : dans ce cas, leur demander de les ouvrir.
- Le code arrive dans les spams : vérifier que le domaine a bien ses enregistrements SPF/DKIM
  (normalement déjà configurés par l'hébergeur mail).
