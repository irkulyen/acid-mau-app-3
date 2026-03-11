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
```

### 5. Erste Deployment

```bash
cd /opt/acid-mau
docker-compose up -d
```

---

## CI/CD Pipeline

### Workflow-Schritte

1. **Test** – TypeScript-Check + Vitest
2. **Build** – Docker Image bauen und zu Docker Hub pushen
3. **Deploy** – SSH zum Server, `docker-compose pull` + `docker-compose up -d`

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

Bearbeite `docker-compose.yml`:

```yaml
services:
  api:
    deploy:
      replicas: 3  # 3 API-Instanzen
```

### Load Balancer

Nutze **nginx** oder **Traefik** als Reverse Proxy vor den API-Containern.

---

## Backup

### Datenbank-Backup

```bash
docker-compose exec db pg_dump -U acid_mau acid_mau > backup_$(date +%Y%m%d).sql
```

### Datenbank wiederherstellen

```bash
docker-compose exec -T db psql -U acid_mau acid_mau < backup_20260226.sql
```

---

## Weitere Ressourcen

- [Docker Dokumentation](https://docs.docker.com/)
- [GitHub Actions Dokumentation](https://docs.github.com/en/actions)
- [PostgreSQL Backup Guide](https://www.postgresql.org/docs/current/backup.html)
