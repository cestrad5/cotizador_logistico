# VPS CamiCloud — Documentación Técnica Completa
> Última actualización: Abril 2026 | Mantenido por: Camilo Estrada

---

## 1. INFRAESTRUCTURA

### 1.1 Proveedor — Oracle Cloud Infrastructure (OCI)

| Parámetro | Valor |
|---|---|
| **Proveedor** | Oracle Cloud Infrastructure (OCI) |
| **Tier** | Always Free |
| **Nombre instancia** | instance-20260326-1413 |
| **Hostname** | vnic-camicloud |
| **Región** | sa-bogota-1 (Bogotá, Colombia) |
| **Availability Domain** | AD-1 |
| **Fault Domain** | FD-2 |
| **Compartment** | cestrad5 (root) |
| **OCID** | ocid1.instance.oc1.sa-bogota-1.anrgcljryv4wdmacxgv55tfnjitvxkm4u4ea6c6peghw3vj4ik72eyzsm33q |
| **VCN** | vcn-20260326-1418 |
| **Capacity type** | On-demand |
| **Launch mode** | PARAVIRTUALIZED |

### 1.2 Hardware Virtual

| Recurso | Valor |
|---|---|
| **Shape** | VM.Standard.A1.Flex |
| **Arquitectura** | ARM64 / Ampere (aarch64) |
| **OCPUs** | 4 |
| **RAM** | 24 GB |
| **Disco** | 193 GB Block Storage |
| **Ancho de banda** | 4 Gbps |
| **IP Pública** | 157.137.216.208 |
| **IP Privada** | 10.0.0.34 |

### 1.3 Sistema Operativo

| Parámetro | Valor |
|---|---|
| **OS** | Ubuntu 24.04.4 LTS (Noble Numbat) |
| **Kernel** | Linux aarch64 |
| **Soporte hasta** | Abril 2029 |
| **Usuario principal** | ubuntu |
| **Historial** | 20.04 → 22.04 → 24.04 (migración el día de creación) |

---

## 2. CONEXIÓN SSH

### 2.1 Archivos de Acceso

| Archivo | Tipo | Ubicación local |
|---|---|---|
| `ssh-key-2026-03-26.key` | Llave privada | `/home/camilo/Documents/ORACLE/` |
| `ssh-key-2026-03-26.key.pub` | Llave pública | `/home/camilo/Documents/ORACLE/` |

### 2.2 Comandos de Conexión

```bash
# Conexión estándar desde la carpeta ORACLE
ssh -i ssh-key-2026-03-26.key ubuntu@157.137.216.208

# Conexión con ruta absoluta (desde cualquier carpeta)
ssh -i /home/camilo/Documents/ORACLE/ssh-key-2026-03-26.key ubuntu@157.137.216.208

# Conexión si la llave está en ~/.ssh/
ssh -i ~/.ssh/oracle.key ubuntu@157.137.216.208
```

### 2.3 Instalación de llave en ~/.ssh (opcional)

```bash
cp /home/camilo/Documents/ORACLE/ssh-key-2026-03-26.key ~/.ssh/oracle.key
chmod 600 ~/.ssh/oracle.key
```

---

## 3. FIREWALL — DOS CAPAS

> ⚠️ CRÍTICO: Este servidor usa `iptables-persistent`. UFW fue eliminado automáticamente durante la instalación de iptables-persistent. **No instalar UFW** — son incompatibles.

### 3.1 Capa 1 — iptables (dentro del servidor)

**Ver reglas actuales:**
```bash
sudo iptables -L INPUT --line-numbers
```

**Estructura de reglas (orden crítico):**
```
num  target  prot  source    destination
1    ACCEPT  all   anywhere  anywhere    state RELATED,ESTABLISHED
2    ACCEPT  icmp  anywhere  anywhere
3    ACCEPT  all   anywhere  anywhere
4    ACCEPT  tcp   anywhere  anywhere    state NEW tcp dpt:ssh
5    ACCEPT  tcp   anywhere  anywhere    tcp dpt:5678   (n8n)
6    ACCEPT  tcp   anywhere  anywhere    tcp dpt:http   (80)
7    ACCEPT  tcp   anywhere  anywhere    tcp dpt:https  (443)
8    REJECT  all   anywhere  anywhere    reject-with icmp-host-prohibited
```

**Agregar nuevo puerto:**
```bash
# Insertar SIEMPRE antes de la regla REJECT (actualmente posición 8)
sudo iptables -I INPUT 5 -p tcp --dport PUERTO -j ACCEPT
sudo netfilter-persistent save
```

**Puertos activos:**
| Puerto | Protocolo | Servicio |
|---|---|---|
| 22 | TCP | SSH |
| 80 | TCP | HTTP / Nginx |
| 443 | TCP | HTTPS |
| 5678 | TCP | n8n |

### 3.2 Capa 2 — Oracle Security List (panel web OCI)

**Ruta en panel OCI:**
```
Networking → Virtual Cloud Networks → vcn-20260326-1418 
→ Subnets → subnet → Security List → Add Ingress Rules
```

**Reglas Ingress configuradas:**
| Stateless | Source CIDR | Protocolo | Destination Port | Descripción |
|---|---|---|---|---|
| No | 0.0.0.0/0 | TCP | 22 | SSH |
| No | 0.0.0.0/0 | TCP | 80 | HTTP |
| No | 0.0.0.0/0 | TCP | 443 | HTTPS |
| No | 0.0.0.0/0 | TCP | 5678 | n8n |
| No | 0.0.0.0/0 | ICMP 3,4 | - | Destination Unreachable |
| No | 10.0.0.0/16 | ICMP 3 | - | Internal ICMP |

> ⚠️ Cada apertura de puerto requiere cambios en AMBAS capas: iptables Y Oracle Security List.

---

## 4. ESTRUCTURA DE DIRECTORIOS

```
/home/ubuntu/
├── services/                    # Configuración de servicios Docker
│   ├── n8n/
│   │   ├── docker-compose.yml
│   │   └── .env
│   ├── yiwu-app/
│   │   └── backend/
│   │       ├── docker-compose.yml   (⚠️ pendiente de mejora de seguridad)
│   │       └── nginx.conf           (pendiente de crear)
│   ├── nginx/                   # Configuración Nginx global (pendiente)
│   ├── ai/                      # Reservado para servicios IA futuros
│   └── bots/                    # Reservado para bots futuros
│
├── data/                        # Datos persistentes (volúmenes Docker)
│   ├── n8n/                     # Flujos, credenciales n8n (owner: 1000:1000)
│   └── ai/                      # Reservado para datos IA futuros
│
└── backups/                     # Reservado para backups automáticos
```

---

## 5. SERVICIOS INSTALADOS

### 5.1 Nginx

| Parámetro | Valor |
|---|---|
| **Versión** | 1.24.0-2ubuntu7.6 |
| **Estado** | Active (running) via systemd |
| **Acceso** | http://157.137.216.208 |
| **Config principal** | `/etc/nginx/nginx.conf` |
| **Sites disponibles** | `/etc/nginx/sites-available/` |
| **Sites activos** | `/etc/nginx/sites-enabled/` |

**Comandos de administración:**
```bash
sudo systemctl status nginx      # Ver estado
sudo systemctl restart nginx     # Reiniciar
sudo systemctl reload nginx      # Recargar config sin downtime
sudo nginx -t                    # Verificar sintaxis de config
sudo tail -f /var/log/nginx/access.log   # Ver logs de acceso
sudo tail -f /var/log/nginx/error.log    # Ver logs de error
```

### 5.2 Docker

| Parámetro | Valor |
|---|---|
| **Versión** | 29.3.1, build c2be9cc |
| **Usuario en grupo** | ubuntu (sin sudo) |
| **Compose plugin** | docker-compose-plugin instalado |

**Comandos de administración:**
```bash
docker ps                              # Contenedores corriendo
docker ps -a                           # Todos los contenedores
docker images                          # Imágenes disponibles
docker stats                           # Uso de recursos en tiempo real
docker logs NOMBRE_CONTENEDOR          # Ver logs
docker logs -f NOMBRE_CONTENEDOR       # Seguir logs en tiempo real

# Desde carpeta del servicio:
docker compose ps                      # Estado del servicio
docker compose up -d                   # Iniciar en background
docker compose down                    # Detener
docker compose restart                 # Reiniciar
docker compose logs -f                 # Ver logs
docker compose pull                    # Actualizar imagen
```

### 5.3 Fail2Ban

| Parámetro | Valor |
|---|---|
| **Versión** | Instalado via apt |
| **Estado** | Active (running) via systemd |
| **Config** | `/etc/fail2ban/jail.local` |
| **Ban time** | 1 hora |
| **Find time** | 10 minutos |
| **Max retry** | 3 intentos |
| **Protege** | SSH (puerto 22) |

**Contenido de `/etc/fail2ban/jail.local`:**
```ini
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 3

[sshd]
enabled = true
```

**Comandos de administración:**
```bash
sudo systemctl status fail2ban
sudo fail2ban-client status sshd        # Ver IPs baneadas en SSH
sudo fail2ban-client set sshd unbanip IP  # Desbanear IP
```

### 5.4 Tailscale

| Parámetro | Valor |
|---|---|
| **Propósito** | VPN privada para acceso seguro al panel de OpenClaw |
| **URL del servidor** | `https://vnic-camicloud.tail1b3d30.ts.net/` |
| **Modo** | Serve (proxy a localhost:18789) |

**Comandos:**
```bash
sudo tailscale status                  # Ver dispositivos conectados
sudo tailscale up                      # Conectar
sudo tailscale down                    # Desconectar
sudo tailscale serve --bg http://127.0.0.1:18789  # Exponer OpenClaw (si se reinicia)
```

> ⚠️ Si el servidor se reinicia, verificar que `tailscale serve` sigue activo.

---

## 6. CONTENEDORES DOCKER ACTIVOS

### 6.1 n8n

| Parámetro | Valor |
|---|---|
| **Nombre** | n8n-n8n-1 |
| **Imagen** | n8nio/n8n |
| **Versión** | 2.13.4 (Self Hosted) |
| **Puerto** | 0.0.0.0:5678 → 5678/tcp |
| **Acceso** | http://157.137.216.208:5678 |
| **Ubicación config** | `~/services/n8n/` |
| **Datos persistentes** | `~/data/n8n/` (owner: 1000:1000) |
| **Restart policy** | always |

**Archivo `~/services/n8n/.env`:**
```env
N8N_HOST=0.0.0.0
N8N_PORT=5678
N8N_PROTOCOL=http
WEBHOOK_URL=http://157.137.216.208:5678
N8N_ENCRYPTION_KEY=<clave_secreta_almacenada>
GENERIC_TIMEZONE=America/Bogota
N8N_SECURE_COOKIE=false    # ⚠️ Temporal — cambiar a true cuando se configure HTTPS
```

**Archivo `~/services/n8n/docker-compose.yml`:**
```yaml
services:
  n8n:
    image: n8nio/n8n
    restart: always
    ports:
      - "5678:5678"
    env_file:
      - .env
    volumes:
      - ~/data/n8n:/home/node/.n8n
```

**Fix de permisos (si n8n falla al iniciar):**
```bash
sudo chown -R 1000:1000 ~/data/n8n
cd ~/services/n8n && docker compose down && docker compose up -d
```

### 6.2 Yiwu Backend

| Parámetro | Valor |
|---|---|
| **Nombre** | backend-backend-1 |
| **Imagen** | backend-backend (local, ARM64) |
| **Puerto** | 0.0.0.0:5000 → 5000/tcp |
| **Runtime** | Node.js 22.22.2 (index.js) |
| **Ubicación** | `~/services/yiwu-app/backend/` |
| **Base de datos** | MongoDB Atlas (URI en variables de entorno) |
| **Autenticación** | JWT |
| **Almacenamiento** | Cloudinary |

**Rutas de la API:**
```
GET  /              → "Yiwu API is running"
POST /api/auth/*    → Autenticación de usuarios
GET  /api/orders/*  → Gestión de órdenes
```

**⚠️ Problemas de seguridad pendientes:**
| Severidad | Problema | Acción requerida |
|---|---|---|
| 🔴 CRÍTICO | Node.js corre como root (UID 0) | Agregar `USER node` al Dockerfile |
| 🔴 CRÍTICO | MONGODB_URI con credenciales en variables de entorno | Migrar a archivo `.env` externo |
| 🔴 CRÍTICO | JWT_SECRET visible en variables de entorno | Migrar a `.env` y rotar |
| 🟠 ALTO | Cloudinary API keys expuestas | Migrar a `.env` y rotar |
| 🟡 MEDIO | Sin rate limiting | Agregar Nginx como reverse proxy |
| 🟡 MEDIO | Bots escaneando activamente (GET /api/.env, /api/phpinfo.php) | Implementar rate limiting |

**Mejoras propuestas para docker-compose.yml:**
```yaml
services:
  backend:
    build: .
    restart: unless-stopped
    user: "1000:1000"
    ports:
      - '127.0.0.1:5000:5000'    # Solo localhost
    env_file:
      - .env
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETGID
      - SETUID
      - NET_BIND_SERVICE

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - '5000:5000'
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - yiwu-network

networks:
  yiwu-network:
    driver: bridge
```

---

## 7. FLUJOS ACTIVOS EN n8n

### 7.1 LinkedIn Personal Posts

| Parámetro | Valor |
|---|---|
| **Trigger** | Schedule — cada 6 horas |
| **Estado** | Active |
| **Propósito** | Generación y publicación automática de contenido B2B en LinkedIn |

**Pipeline completo:**
```
Schedule Trigger (cada 6h)
    │
    ▼
Content topic generator     [OpenRouter: glm-4.5-air:free]
    │                       Genera temas B2B con persona "Cool Senior Engineer"
    ▼
Content creator             [OpenRouter: openrouter/free]
    │                       Crea post LinkedIn 1400-2000 chars
    ├──────────────────────────────────────┐
    ▼                                      ▼
Hashtag generator/SEO       HTTP Request → HuggingFace FLUX.1-schnell
[OpenRouter: nemotron-nano]  Genera imagen para el post
    │                                      │
    └──────────────┬───────────────────────┘
                   ▼
              Merge (post + imagen)
                   │
                   ▼
              LinkedIn OAuth2
              Publica en perfil personal
```

**Credenciales requeridas:**
| Servicio | Tipo | Scope |
|---|---|---|
| OpenRouter | API Key | Múltiples modelos free |
| HuggingFace | Bearer Token | Inference Providers |
| LinkedIn | OAuth2 | r_liteprofile, w_member_social |

**LinkedIn Person ID:** `2scywWQgYa`

---

## 8. VARIABLES DE OPTIMIZACIÓN DEL SISTEMA

Agregadas a `~/.bashrc`:
```bash
export NODE_COMPILE_CACHE=/var/tmp/openclaw-compile-cache
export OPENCLAW_NO_RESPAWN=1
```

---

## 9. TAREAS PENDIENTES

### Alta Prioridad
- [ ] **Seguridad Yiwu**: Rotar credenciales MongoDB, JWT_SECRET, Cloudinary
- [ ] **Seguridad Yiwu**: Migrar secrets a archivo `.env` externo
- [ ] **Seguridad Yiwu**: Cambiar contenedor a usuario no-root
- [ ] **Seguridad Yiwu**: Agregar Nginx con rate limiting

### Media Prioridad
- [ ] Configurar dominio personalizado con Nginx
- [ ] Instalar Certbot/Let's Encrypt para HTTPS
- [ ] Cambiar `N8N_SECURE_COOKIE=false` → `true` tras configurar HTTPS
- [ ] Actualizar `WEBHOOK_URL` en n8n al dominio real
- [ ] Verificar que `tailscale serve` sobrevive reinicios del servidor

### Baja Prioridad
- [ ] Configurar backups automáticos de `~/data/`
- [ ] Explorar Ollama + OpenWebUI para IA local
- [ ] Implementar monitoreo automático con OpenClaw

---

## 10. COMANDOS DE ADMINISTRACIÓN DIARIA

```bash
# Estado general del servidor
htop                                    # Monitor de procesos
df -h                                   # Uso de disco
free -h                                 # Uso de RAM
uptime                                  # Carga del sistema

# Estado de contenedores
docker ps                               # Contenedores activos
docker stats --no-stream                # Uso de recursos

# Reiniciar servicios
cd ~/services/n8n && docker compose restart
cd ~/services/yiwu-app/backend && docker compose restart
sudo systemctl restart nginx

# Ver logs
docker logs -f n8n-n8n-1
docker logs -f backend-backend-1
sudo journalctl -u nginx -f

# Actualizaciones del sistema
sudo apt update && sudo apt upgrade -y

# Firewall
sudo iptables -L INPUT --line-numbers    # Ver reglas
sudo netfilter-persistent save          # Guardar cambios
```

---

## 11. NOTAS CRÍTICAS DE ARQUITECTURA

1. **ARM64 (aarch64)**: Verificar siempre compatibilidad de imágenes Docker y paquetes con arquitectura ARM antes de instalar.
2. **iptables-persistent vs UFW**: Este servidor usa exclusivamente iptables-persistent. Instalar UFW eliminaría iptables-persistent automáticamente.
3. **Doble firewall**: Oracle Security List + iptables. Ambos deben actualizarse al abrir puertos.
4. **Permisos n8n**: `~/data/n8n` debe tener owner `1000:1000` siempre.
5. **Tailscale Serve**: El proxy a OpenClaw puede necesitar reiniciarse manualmente si el servidor se reinicia.
6. **N8N_SECURE_COOKIE=false**: Configuración temporal insegura — resolver al implementar HTTPS.
