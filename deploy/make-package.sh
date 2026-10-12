#!/usr/bin/env bash
# Fabrique le paquet final à envoyer à l'hébergeur : ~/Desktop/LandingPage/alloala-site-final.zip
#   - jeu/    : le jeu construit pour /jeu/ + serveur + dépendances d'exécution + .env
#   - qrcode/ : la page du QR code construite pour /qrcode/ (dossier voisin ../allo-ala-react)
# Usage (sur le Mac) :  bash deploy/make-package.sh
set -euo pipefail
cd "$(dirname "$0")/.."
GAME="$(pwd)"; QRSRC="$GAME/../allo-ala-react"
OUT="$(mktemp -d)/alloala-site"; mkdir -p "$OUT/jeu" "$OUT/qrcode"
[ -f .env ] || { echo "Il manque le fichier .env (copier .env.example)"; exit 1; }
npm run build
cp -R api server.js package.json package-lock.json .env .env.example dist "$OUT/jeu/"
(cd "$OUT/jeu" && npm ci --omit=dev --no-audit --no-fund)
(cd "$QRSRC" && npm run build) && cp -R "$QRSRC/dist/." "$OUT/qrcode/"
cp deploy/package/install.sh deploy/package/nginx-alloala.conf deploy/package/LISEZMOI.md "$OUT/"
chmod +x "$OUT/install.sh"
ZIP="$GAME/../alloala-site-final.zip"; rm -f "$ZIP"
(cd "$(dirname "$OUT")" && zip -qr "$ZIP" alloala-site)
echo "Paquet prêt : $ZIP"
