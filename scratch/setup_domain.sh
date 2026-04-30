#!/bin/bash

# Configuration
SSH_KEY="/home/camilo/Documents/ORACLE/ssh-key-2026-03-26.key"
VPS_USER="ubuntu"
VPS_IP="157.137.216.208"
DOMAIN="cotizador.bonettoconamor.com"
INTERNAL_PORT="3010"

echo "Configuring Nginx for $DOMAIN..."

ssh -i "$SSH_KEY" "$VPS_USER@$VPS_IP" << EOF
  set -e
  echo "--- Creating Nginx configuration for $DOMAIN ---"
  sudo tee /etc/nginx/sites-available/cotizador << 'ENGINX'
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:$INTERNAL_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
ENGINX

  echo "--- Enabling site and reloading Nginx ---"
  sudo ln -sf /etc/nginx/sites-available/cotizador /etc/nginx/sites-enabled/
  sudo nginx -t
  sudo systemctl reload nginx

  echo "--- Installing SSL with Certbot ---"
  # This might require user interaction if it's the first time, 
  # but since they have other sites, certbot should be configured.
  # We use --non-interactive and --agree-tos.
  sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m cestrad5@gmail.com || echo "Certbot failed, possibly DNS propagation. Try manually later."

  echo "--- Nginx configuration finished! ---"
EOF
