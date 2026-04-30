#!/bin/bash

# Configuration
SSH_KEY="/home/camilo/Documents/ORACLE/ssh-key-2026-03-26.key"
VPS_USER="ubuntu"
VPS_IP="157.137.216.208"
TARGET_DIR="/home/ubuntu/services/cotizador_logistico"
NEW_PORT="3010"

echo "Undoing Nginx changes and switching to port $NEW_PORT..."

# 1. Remove Nginx config
ssh -i "$SSH_KEY" "$VPS_USER@$VPS_IP" << EOF
  set -e
  echo "--- Removing Nginx config ---"
  sudo rm -f /etc/nginx/sites-enabled/cotizador
  sudo nginx -t && sudo systemctl reload nginx

  echo "--- Updating docker-compose.yml to port $NEW_PORT ---"
  cd "$TARGET_DIR"
  sed -i 's/"3000:3000"/"$NEW_PORT:3000"/' docker-compose.yml
  docker compose up -d

  echo "--- Updating iptables ---"
  # Check if port already exists in iptables
  if ! sudo iptables -L INPUT | grep -q "dpt:$NEW_PORT"; then
    echo "Adding port $NEW_PORT to iptables..."
    # Insert before the last REJECT rule (usually position 8 or similar)
    REJECT_LINE=\$(sudo iptables -L INPUT --line-numbers | grep REJECT | head -n 1 | awk '{print \$1}')
    if [ -z "\$REJECT_LINE" ]; then
      sudo iptables -A INPUT -p tcp --dport $NEW_PORT -j ACCEPT
    else
      sudo iptables -I INPUT \$REJECT_LINE -p tcp --dport $NEW_PORT -j ACCEPT
    fi
    sudo netfilter-persistent save
  fi

  echo "--- Done! ---"
EOF
