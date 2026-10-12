# Allo..Ala — mise en ligne sur le VPS

Ce dossier contient le **produit final, prêt à fonctionner** :

| Dossier | Adresse | Contenu |
|---|---|---|
| `jeu/` | https://alloala.com/jeu/ | Le site de jeux (déjà construit) + son serveur + la base de données |
| `qrcode/` | https://alloala.com/qrcode/ | La page du QR code (remplace l'ancienne version) |

Tout est déjà configuré, y compris l'envoi des codes depuis contact@alloala.com (Hostinger, testé).
**Aucun compte ni service extérieur n'est nécessaire.**

## Installation (5 minutes)

1. Copier ce dossier sur le VPS (ex. dans `/root/alloala-site`).
2. Lancer :
   ```bash
   cd /root/alloala-site
   sudo bash install.sh
   ```
3. Dans la configuration nginx de alloala.com (bloc `server { … }` en HTTPS), ajouter **une ligne** :
   ```nginx
   include snippets/alloala.conf;
   ```
   et **supprimer l'ancien bloc `location /qrcode`** s'il existe (ancienne page avec le 29 149 990). Puis :
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

## Vérifier

- https://alloala.com/jeu/api/health → doit afficher `"ready": true`
- https://alloala.com/jeu/ → le site de jeux
- https://alloala.com/qrcode/ → la page du QR code (numéro 93 332 862)

## Informations utiles

- Le jeu tourne comme service : `alloala-jeu` (redémarre tout seul).
  Journaux : `journalctl -u alloala-jeu -f` · Redémarrer : `systemctl restart alloala-jeu`
- Base de données : `/var/www/alloala-jeu/data/db.json`, sauvegarde automatique chaque jour
  dans `/var/www/alloala-jeu/data/backups/` (14 jours). Pensez à l'inclure dans vos sauvegardes.
- Réglages (mot de passe admin, e-mail) : `/var/www/alloala-jeu/.env`
- Mise à jour : copier le nouveau dossier et relancer `sudo bash install.sh`
  (les données et les réglages sont conservés).
- Si le port 3010 est déjà utilisé : changer `PORT=` dans `.env` **et** dans `snippets/alloala.conf`.

⚠️ Le fichier `jeu/.env` contient des mots de passe (boîte mail, admin) : ne pas le partager.
