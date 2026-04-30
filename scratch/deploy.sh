#!/bin/bash

# Configuration
SSH_KEY="/home/camilo/Documents/ORACLE/ssh-key-2026-03-26.key"
VPS_USER="ubuntu"
VPS_IP="157.137.216.208"
REPO_URL="https://github.com/cestrad5/cotizador_logistico.git"
TARGET_DIR="/home/ubuntu/services/cotizador_logistico"
LOCAL_ENV="/home/camilo/Desktop/EAFIT/RETOV2/.env.local"

echo "Starting deployment to $VPS_IP..."

# 1. Update repo or clone
ssh -i "$SSH_KEY" "$VPS_USER@$VPS_IP" "mkdir -p /home/ubuntu/services && if [ -d $TARGET_DIR ]; then cd $TARGET_DIR && git pull; else cd /home/ubuntu/services && git clone $REPO_URL; fi"

# 2. Transfer .env.local
echo "Transferring .env.local..."
scp -i "$SSH_KEY" "$LOCAL_ENV" "$VPS_USER@$VPS_IP:$TARGET_DIR/.env.local"

# 3. Docker build and Nginx
ssh -i "$SSH_KEY" "$VPS_USER@$VPS_IP" << EOF
  set -e
  cd "$TARGET_DIR"
  echo "--- Building and starting Docker container ---"
  docker compose up -d --build

  echo "--- Configuring Nginx ---"
  if [ ! -f /etc/nginx/sites-available/cotizador ]; then
    echo "Creating Nginx configuration..."
    sudo tee /etc/nginx/sites-available/cotizador << 'ENGINX'
server {
    listen 80;
    server_name 157.137.216.208;

    location / {
        proxy_pass http://localhost:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
ENGINX
    sudo ln -sf /etc/nginx/sites-available/cotizador /etc/nginx/sites-enabled/
  fi

  echo "--- Reloading Nginx ---"
  sudo nginx -t && sudo systemctl reload nginx

  echo "--- Deployment finished successfully! ---"
EOF
