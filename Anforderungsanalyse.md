# Acid-Mau Online-Multiplayer-App – Anforderungsanalyse

**Quelle:** *Technische Architektur & Tech-Stack Acid-Mau Online-Multiplayer-App (1).pdf* sowie *Product Backlog & User Stories Acid-Mau Online-Multiplayer-App (1).pdf*  
**Datum:** 30. Januar 2026

## 1) Technische Architektur

### 1.1 Architektur-Übersicht (Client-Server-Modell)
- **Client (Frontend):** Progressive Web App (PWA), lauffähig in modernen Browsern.
- **Game Server (Backend):** Node.js-Server mit Spiellogik und WebSockets für Echtzeit-Synchronisation.
- **API Server (Backend):** Separater Service für Benutzerverwaltung, Statistiken und REST-Endpunkte.
- **Datenbank:** PostgreSQL für Benutzerdaten, Spielstatistiken und Ranglisten.

### 1.2 Kommunikationsflüsse
- **Client ↔ Game Server:** Bidirektional via WebSockets.
- **Client ↔ API Server:** REST über HTTP (GET, POST, PUT).
- **Game Server ↔ API Server:** Bedarfsgesteuerte Kommunikation (z. B. Statistik-Updates).

### 1.3 Backend-Architektur (Microservices)
- **Game Server:** Fokus auf performante Echtzeit-Logik, zustandslos.
- **API Server:** Standard-Webaufgaben (Auth, User-Management, Persistenz).
- **Nutzen:** Unabhängige Skalierung von Spiel- und API-Last.

## 2) Tech-Stack

### 2.1 Frontend (Client)
| Technologie | Zweck | Begründung |
|---|---|---|
| React | UI-Bibliothek | Komponentenbasiert, großes Ökosystem |
| TypeScript | Sprache | Statische Typisierung, höhere Code-Qualität |
| Vite | Build-Tool | Schnelles Dev-Setup |
| Zustand | State-Management | Schlank und performant |
| PixiJS | 2D-Rendering | Performante Kartenanimationen über WebGL |
| Tailwind CSS | Styling | Utility-First, schnelles UI-Prototyping |

### 2.2 Backend (Server)
| Technologie | Zweck | Begründung |
|---|---|---|
| Node.js | Laufzeit | Gute I/O-Performance, JS/TS im Backend |
| TypeScript | Sprache | Konsistenz zum Frontend |
| Colyseus | Multiplayer-Framework | Für Matchmaking/Rooms/Echtzeit ausgelegt |
| Express.js | REST-Framework | Minimalistisch und etabliert |
| PostgreSQL | Datenbank | Stabil, leistungsfähig, erweiterbar |
| Prisma | ORM | Typsichere DB-Zugriffe, Migrationen |
| JWT | Auth | Standardisierte sichere Authentifizierung |

### 2.3 Infrastruktur & Deployment
| Technologie | Zweck | Begründung |
|---|---|---|
| Docker | Containerisierung | Konsistente Umgebungen |
| GitHub Actions | CI/CD | Automatisierte Tests, Builds, Deployments |
| DigitalOcean | Hosting | Kosteneffizient und praxisnah |
| S3 | Object Storage | Assets wie Kartenbilder/Avatare |

## 3) Product Backlog – Epics

1. **EPIC 01: Technisches Fundament & Setup**
2. **EPIC 02: Kern-Spielmechanik (Offline-Prototyp)**
3. **EPIC 03: Multiplayer-Grundlagen & Lobby**
4. **EPIC 04: Benutzerkonten & Authentifizierung**
5. **EPIC 05: UI & Spielerlebnis**
6. **EPIC 06: Erweiterte Features & Polish**
7. **EPIC 07: Monetarisierung & Wachstum (neu)**

## 4) Ausgewählte User Stories nach Fokus

### EPIC 02 – Kern-Spielmechanik (Auszug)
- 32-Karten-Deck (altdeutsch) anzeigen.
- Korrekte Kartenanzahl je Runde (1 + Verluste) austeilen.
- Gültige Züge (Farbe/Rang) + Ziehen vom Nachziehstapel.
- Rundenerkennung, Verlustpunkte und Eliminierung ab 7 Verlusten.
- Spezialregeln für **Unter** (Wunschfarbe), **Ass** (aussetzen), **Schellen-8** (Richtungswechsel), **7** (Ziehkette).

### EPIC 03 – Multiplayer (Auszug)
- Spiellogik auf Game-Server portieren.
- WebSocket-Realtime-Updates.
- Räume erstellen/beitreten + Lobby mit manuellem Start.
- Servervalidierung von Aktionen mit Verteilung an alle Clients.
- Session-Recovery nach Verbindungsabbruch.

### EPIC 05 – UI & Spielerlebnis (Auszug)
- Übersichtliche Spieloberfläche (Hand, Ablage, Mitspieler).
- Flüssige Kartenanimationen.
- Hervorhebung spielbarer Karten.
- Anzeige für Wunschfarbe, Spielrichtung und Ziehkette.
- Responsive UI (Desktop, Tablet, Mobile).
- In-Game-Chat.

### EPIC 06 – Erweiterte Features (Auszug)
- Interaktives Tutorial.
- Spielzusammenfassung mit persönlichen Statistiken.
- Globale Rangliste.
- KI-Gegner.
- Freundesliste und direkte Einladungen.

### EPIC 07 – Monetarisierung & Wachstum
- **Premium-Abo (4,99 €/Monat):** werbefrei, erweiterte Statistiken, private Lobbys, Premium-Badge.
- **Zahlungsintegration:** Stripe/PayPal, monatlich kündbar, serverseitige Statusverwaltung.
- **Cosmetics:** Kartenrückseiten, Animationen, Tisch-Themes (kein Pay-to-Win).
- **Analytics:** DAU/MAU, Conversion, Churn, ARPU.

## 5) Rationale für Technologieentscheidungen
- **TypeScript End-to-End:** weniger Kontextwechsel zwischen Frontend und Backend.
- **Spezialframeworks:** Colyseus für Multiplayer-Use-Cases.
- **Skalierbarkeit:** Trennung von Game-Server und API-Server.
- **Developer Experience:** Vite, Prisma und moderne CI/CD für schnelle Iterationen.

## 6) Backlog-Metrik (laut Quelle)
- **Gesamt User Stories:** 38 (34 bestehend + 4 Monetarisierung)
- **Gesamt Story Points:** 249 (215 bestehend + 34 Monetarisierung)

## 7) Nächste Schritte
- Architektur als Leitplanke in Sprint-Planung überführen.
- User Stories mit klaren Akzeptanzkriterien und Definition of Done ausarbeiten.
- Technische Meilensteine für EPIC 02/03 priorisieren (Regelwerk + Multiplayer-Stabilität).
