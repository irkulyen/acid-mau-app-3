# Deployment-Dokumentation: Acid-Mau Online Multiplayer

## Überblick

Die App nutzt **GitHub Actions** für automatisiertes Deployment. Bei jedem Push auf `main`/`master` wird die App gebaut, getestet und auf den Produktionsserver deployed.

---

## Voraussetzungen

### 1. GitHub Repository
- Repository auf GitHub erstellen
- Code pushen

### 2. Docker Hub Account
- Account erstellen auf [hub.docker.com](https://hub.docker.com)
- Repository `acid-mau` erstellen

### 3. Produktionsserver
- Linux-Server (Ubuntu 22.04 empfohlen)
- Docker + Docker Compose installiert
- SSH-Zugang

---

## GitHub Secrets konfigurieren

Gehe zu **Settings → Secrets and variables → Actions** und füge hinzu:

| Secret Name | Beschreibung | Beispiel |
|-------------|--------------|----------|
| `DOCKER_USERNAME` | Docker Hub Benutzername | `deinusername` |
| `DOCKER_PASSWORD` | Docker Hub Passwort/Token | `dein-token` |
| `DEPLOY_HOST` | Server IP/Domain | `123.45.67.89` |
| `DEPLOY_USER` | SSH Benutzername | `ubuntu` |
| `DEPLOY_SSH_KEY` | Private SSH Key | `-----BEGIN RSA PRIVATE KEY-----...` |
| `DEPLOY_PATH` | App-Pfad auf Server (optional) | `/opt/acid-mau` |
| `DEPLOY_API_URL` | Öffentliche API-URL für Post-Deploy Verify | `https://deine-domain.com` |

---

## Server-Setup

### 1. Docker installieren

```bash
# Docker installieren
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Docker Compose installieren
sudo apt-get update
sudo apt-get install docker-compose-plugin

# User zu docker Gruppe hinzufügen
sudo usermod -aG docker $USER
```

### 2. Projektverzeichnis erstellen

```bash
sudo mkdir -p /opt/acid-mau
sudo chown $USER:$USER /opt/acid-mau
cd /opt/acid-mau
```

### 3. docker-compose.yml hochladen

Kopiere `docker-compose.yml` auf den Server:

```bash
scp docker-compose.yml user@server:/opt/acid-mau/
```

### 4. Umgebungsvariablen setzen

Erstelle `.env` Datei auf dem Server:

```bash
cd /opt/acid-mau
nano .env
```

Füge hinzu:

```env
DB_PASSWORD=dein-sicheres-passwort
JWT_SECRET=dein-jwt-secret-mindestens-32-zeichen
OAUTH_CLIENT_ID=dein-oauth-client-id
OAUTH_CLIENT_SECRET=dein-oauth-client-secret
OAUTH_REDIRECT_URI=https://deine-domain.com/api/oauth/callback
CORS_ALLOWED_ORIGINS=https://deine-app-domain.com,https://*.expo.dev,https://*.exp.direct
ENFORCE_SINGLE_SOCKET_INSTANCE=true
SINGLE_SOCKET_LOCK_TTL_SEC=45
ROOM_RECONCILE_INTERVAL_MS=60000
TELEMETRY_TOKEN=optionaler-bearer-token-fuer-api-telemetry
SERVER_BUILD_ID=git-sha-oder-release-tag
ADMIN_USER_IDS=123,456
```

### 5. Erste Deployment

```bash
cd /opt/acid-mau
docker-compose up -d
```

---

## CI/CD Pipeline

### Workflow-Schritte (`deploy.yml`)

1. **Test** – TypeScript-Check + Vitest
2. **Build** – Docker Image bauen und zu Docker Hub pushen
3. **Deploy** – SSH zum Server, `docker-compose pull` + `docker-compose up -d`
4. **Verify** – automatische Live-Verifikation (`verify:deploy`) inkl. Build-ID/Soak

### GitHub Actions Workflows im Repo

- `CI`: TypeScript + Tests auf Push/PR
- `Deploy Verify`: Manuell triggerbar mit `verify_api_url`, optional `expect_build_id`

### Manuelles Deployment

Falls GitHub Actions nicht genutzt wird:

```bash
# Auf lokalem Rechner
docker build -t deinusername/acid-mau:latest .
docker push deinusername/acid-mau:latest

# Auf Server
cd /opt/acid-mau
docker-compose pull
docker-compose up -d
```

---

## Monitoring

### Logs ansehen

```bash
# Alle Logs
docker-compose logs -f

# Nur API-Logs
docker-compose logs -f api

# Nur DB-Logs
docker-compose logs -f db
```

### Container-Status prüfen

```bash
docker-compose ps
```

### Health-Check

```bash
curl http://localhost:3000/api/health
```

### Multiplayer Smoke-Check

Nach dem Deployment einen kurzen Socket-Lasttest ausführen:

```bash
SOAK_API_URL=https://deine-domain.com SOAK_CLIENTS=6 SOAK_DURATION_MS=20000 pnpm test:soak
```

Optional: Telemetrie abrufen (falls `TELEMETRY_TOKEN` gesetzt ist):

```bash
curl -H "Authorization: Bearer $TELEMETRY_TOKEN" https://deine-domain.com/api/telemetry
```

### Vollständige Deploy-Verifikation

Health + Build-ID + Telemetry + Socket-Soak in einem Lauf:

```bash
VERIFY_API_URL=https://deine-domain.com EXPECT_BUILD_ID=$SERVER_BUILD_ID pnpm verify:deploy
```

Hinweis:
- `VERIFY_STRICT=false` erlaubt fehlende Telemetry/Health-Felder für Legacy-Deployments.
- Standard ist `STRICT=true` (fehlende Felder = Fail).

### Diagnose: Freunde können Raum nicht beitreten

1. `GET /api/health` prüfen:
   - `socketPath` muss `/api/socket.io` sein.
   - `corsAllowAllOrigins=false` in Produktion und `corsConfiguredOrigins` muss die echte Frontend-Domain enthalten.
2. `GET /api/telemetry` prüfen:
   - `pending`/`lastFlushedSnapshot` auf `cors.blocked.http` und `cors.blocked.socket` kontrollieren.
   - `errors.join_room_reason.*` zeigt den häufigsten Join-Fehlergrund.
3. End-to-End mit Lasttest validieren:
   - `SOAK_API_URL=https://deine-domain.com SOAK_CLIENTS=6 SOAK_DURATION_MS=20000 pnpm test:soak`

---

## Troubleshooting

### Container startet nicht

```bash
# Logs prüfen
docker-compose logs api

# Container neu starten
docker-compose restart api
```

### Datenbank-Verbindung fehlgeschlagen

```bash
# DB-Status prüfen
docker-compose ps db

# DB-Logs prüfen
docker-compose logs db

# DB neu starten
docker-compose restart db
```

### Alte Images aufräumen

```bash
docker image prune -f
```

---

## Skalierung

### Mehr API-Instanzen

Aktuell gilt: **Socket-Multiplayer ist nur als Single-Replica stabil**.
Nutze daher vorerst genau **eine** `api`-Instanz und skaliere vertikal (CPU/RAM), bis eine cluster-fähige Socket-Architektur (Redis-Adapter + session affinity + verteilter State) umgesetzt ist.

Wenn du dennoch mehrere Instanzen betreibst, benötigst du zwingend:
1. Session Affinity (Sticky Sessions) am Load Balancer.
2. Verteilte Socket.IO-Adapter-Infrastruktur.
3. Konsistenten, nicht nur lokalen Realtime-Game-State.

### Load Balancer

Nutze **nginx** oder **Traefik** als Reverse Proxy vor den API-Containern.

---

## Backup

### Datenbank-Backup

```bash
docker-compose exec db mysqldump -uroot -p"$DB_ROOT_PASSWORD" acid_mau > backup_$(date +%Y%m%d).sql
```

### Datenbank wiederherstellen

```bash
docker-compose exec -T db mysql -uroot -p"$DB_ROOT_PASSWORD" acid_mau < backup_20260226.sql
```

---

## Weitere Ressourcen

- [Docker Dokumentation](https://docs.docker.com/)
- [GitHub Actions Dokumentation](https://docs.github.com/en/actions)
- [MySQL Backup Guide](https://dev.mysql.com/doc/refman/8.0/en/backup-and-recovery.html)
