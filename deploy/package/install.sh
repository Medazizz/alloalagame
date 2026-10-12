#!/usr/bin/env bash
# =====================================================================
#  Allo..Ala — installation sur le VPS (une seule commande) :
#      sudo bash install.sh
#  Installe :
#    - le jeu       → https://alloala.com/jeu/     (service « alloala-jeu »)
#    - la page QR   → https://alloala.com/qrcode/  (fichiers statiques)
#  Une mise à jour (relancer le script) conserve les données et les réglages.
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")"
SRC="$(pwd)"
JEU=/var/www/alloala-jeu
QR=/var/www/alloala-qrcode
SNIPPET=/etc/nginx/snippets/alloala.conf

[ "$(id -u)" -eq 0 ] || { echo "Lancez avec sudo : sudo bash install.sh"; exit 1; }

echo "== 1/5 Node.js"
NODE_OK=0
if command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 18 ]; then NODE_OK=1; fi
if [ "$NODE_OK" -eq 0 ]; then
  if command -v apt-get >/dev/null 2>&1; then
    echo "   Installation de Node.js 20…"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
    apt-get install -y nodejs >/dev/null
  else
    echo "!! Installez Node.js 18 ou plus, puis relancez."; exit 1
  fi
fi
echo "   $(node -v) OK"

echo "== 2/5 Jeu → $JEU"
mkdir -p "$JEU"
# on garde les données et les réglages d'une installation précédente
[ -f "$JEU/.env" ] && cp "$JEU/.env" /tmp/alloala-env.keep || true
rm -rf "$JEU/api" "$JEU/dist" "$JEU/node_modules" "$JEU/server.js"
cp -R "$SRC/jeu/." "$JEU/"
[ -f /tmp/alloala-env.keep ] && mv /tmp/alloala-env.keep "$JEU/.env" || true
mkdir -p "$JEU/data"
chown -R www-data:www-data "$JEU"
chmod 600 "$JEU/.env"

echo "== 3/5 Page QR → $QR"
mkdir -p "$QR"
rm -rf "${QR:?}/"*
cp -R "$SRC/qrcode/." "$QR/"
chown -R www-data:www-data "$QR"

echo "== 4/5 Service « alloala-jeu »"
cat > /etc/systemd/system/alloala-jeu.service <<UNIT
[Unit]
Description=Allo..Ala Jeux
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$JEU
ExecStart=$(command -v node) $JEU/server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable alloala-jeu >/dev/null 2>&1
systemctl restart alloala-jeu
sleep 2

echo "== 5/5 nginx"
mkdir -p "$(dirname "$SNIPPET")"
cp "$SRC/nginx-alloala.conf" "$SNIPPET"
echo "   Réglages nginx copiés dans $SNIPPET"

echo
echo "== Vérification du jeu :"
curl -s "http://127.0.0.1:3010/jeu/api/health" || echo "!! Le jeu ne répond pas : journalctl -u alloala-jeu -n 50"
echo
echo
echo "=================================================================="
echo " DERNIÈRE ÉTAPE (une seule fois) :"
echo " dans le bloc  server { … }  HTTPS de alloala.com, ajouter la ligne :"
echo
echo "     include snippets/alloala.conf;"
echo
echo " (et supprimer l'ancien bloc « location /qrcode » s'il existe), puis :"
echo "     nginx -t && systemctl reload nginx"
echo
echo " Tester :  https://alloala.com/jeu/api/health   → \"ready\": true"
echo "=================================================================="
