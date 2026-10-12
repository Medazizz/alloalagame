#!/usr/bin/env bash
# Installation / mise à jour d'Allo..Ala Jeux sur un VPS Linux (Ubuntu, Debian…).
# Usage, depuis le dossier du projet :   bash deploy/install.sh
set -euo pipefail
cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"

echo "== Allo..Ala Jeux : installation dans $APP_DIR"

# 1. Node.js 18 ou plus
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  echo "!! Node.js 18+ est requis. Installation (Ubuntu/Debian) :"
  echo "   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
  exit 1
fi
echo "-- Node.js $(node -v) OK"

# 2. Réglages
if [ ! -f .env ]; then
  cp .env.example .env
  echo "-- Fichier .env créé à partir de .env.example"
fi
if ! grep -qE '^ADMIN_KEY=.+' .env; then
  KEY="$(node -e 'console.log(require("crypto").randomBytes(15).toString("base64url"))')"
  sed -i "s|^ADMIN_KEY=.*|ADMIN_KEY=$KEY|" .env
  echo "-- Mot de passe admin généré : $KEY   (gardez-le, il est aussi dans .env)"
fi
chmod 600 .env

# 3. Dépendances + construction du site
npm ci --no-audit --no-fund
npm run build
mkdir -p data

# 4. Service système : démarre tout seul et redémarre en cas de problème
SERVICE=/etc/systemd/system/alloalagame.service
sudo tee "$SERVICE" >/dev/null <<UNIT
[Unit]
Description=Allo..Ala Jeux
After=network.target

[Service]
Type=simple
User=$(id -un)
WorkingDirectory=$APP_DIR
ExecStart=$(command -v node) $APP_DIR/server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now alloalagame
sudo systemctl restart alloalagame
sleep 2

PORT="$(grep -E '^PORT=' .env | cut -d= -f2)"; PORT="${PORT:-3010}"
BASE="$(grep -E '^BASE_PATH=' .env | cut -d= -f2)"; BASE="${BASE:-/jeu/}"
echo "== Vérification :"
curl -s "http://127.0.0.1:${PORT}${BASE}api/health" || true
echo
echo "== Terminé. Ajoutez le bloc deploy/nginx.conf à la configuration nginx de alloala.com, puis :"
echo "   sudo nginx -t && sudo systemctl reload nginx"
