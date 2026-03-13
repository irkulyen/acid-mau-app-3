# Crazy Amsel – Technisches Audit (2026-03-13)

## Scope
- Vollständige Code- und Architekturprüfung von Frontend, Backend, Multiplayer-Flows, Datenzugriffen, Stabilität und UX.
- Fokus auf Raumbeitritt/Reconnect-Probleme und mögliche Root-Causes.

## Methodik
1. Struktur-/Architektur-Review
2. Multiplayer-Flow-Analyse (create/join/reconnect)
3. State-Management- und DB-Abgleich
4. Codequalitäts- und Stabilitätsprüfung
5. Laufende Checks (`pnpm check`, `pnpm test`)

## Kurzfazit
- Das Projekt hat bereits eine solide Echtzeit-Basis (Socket.IO, serverseitige Action-Validierung, Reconnect-Mechanismen), aber **kritische Architekturbrüche** zwischen In-Memory-State, Room-DB-State und Client-Konfigurationen.
- Die wahrscheinlichste Ursache für „externe Spieler können Raum nicht joinen“ ist eine Kombination aus:
  - **nicht eindeutiger Server-/URL-Strategie**,
  - **In-Memory-Runtime-States ohne verteilte Synchronisierung**,
  - **Port-/Instanz-Divergenz durch dynamische Portwahl**,
  - und **fehlender eindeutiger Join-Ack-Events / weak error semantics**.

## Wichtigste Risiken (Top)

### KRITISCH
1. **Horizontale Skalierung bricht Multiplayer-Zustand**
   - `gameStates`, `roomSockets`, `userRoomMapping`, `socketUserMapping`, Timeouts liegen rein im Prozessspeicher.
   - Bei mehreren Instanzen, Neustart oder Routing auf andere Instanz sind Room-/Reconnect-States verloren.

2. **Server startet ggf. auf anderem Port als erwartet**
   - `findAvailablePort()` weicht von `PORT` ab; Clients/Proxy können dann auf falschen Port zeigen.
   - Bei Deployments/Containern ist das ein harter Verfügbarkeitsfehler.

3. **Room-/State-Dualismus (DB vs In-Memory) erzeugt Inkonsistenz**
   - Room kann in DB existieren, aber `gameState` fehlt/ist neu initialisiert.
   - Join-Flow erzeugt bei fehlendem In-Memory-State einen neuen State mit nur Joiner als Player (Datenverlust für laufende Lobby).

4. **Datenbank-Stack inkonsistent dokumentiert/konfiguriert**
   - Code/Drizzle nutzt MySQL-Dialekt, Deployment nutzt PostgreSQL-URL.
   - Migrationen/Queries können dadurch im Zielsystem fehlschlagen.

### HOCH
5. **Keine expliziten Join-/Reconnect-Bestätigungs-Events**
   - Client interpretiert Erfolg implizit über `game-state-update`; robustes Handshaking fehlt.

6. **Security/Trust Boundary im Socket-Layer schwach**
   - Events nehmen `userId`/`playerId` aus Clientpayload entgegen, ohne harte Bindung an authentifizierte Session/JWT im Socket-Handshake.

7. **Mehrere konkurrierende API-URL-Quellen**
   - Socket und tRPC nutzen unterschiedliche Strategien/Fallbacks/Hardcodings.
   - Erhöht Risiko, dass HTTP und WebSocket gegen verschiedene Backends laufen.

### MITTEL
8. **Disconnect/Timeout-Logik komplex und fehleranfällig**
   - Viele Timer-Pfade (bot/turn/disconnect/preparation) ohne zentrale State-Machine oder Cancel-Registry je Room-Transition.

9. **Game-History/Participants-Verknüpfung fehlerverdächtig**
   - `createGameHistory` liefert keine ID zurück, `createGameParticipant` nutzt `roomId` als `gameHistoryId`.

10. **Alt-API/duplizierte Socket-Implementierung im Frontend**
    - `hooks/use-game-socket.ts` und `lib/socket-provider.tsx` doppeln Verantwortung.

### NIEDRIG
11. **Inkonsistente CORS/credentials-Konfiguration**
12. **Fehlende strukturierte Logs/Korrelation (roomId/userId/socketId/traceId)**
13. **Admin-Aktion per Username-String statt robustem Rollencheck**

## Konkrete Architekturmaßnahmen
1. Multiplayer-State aus Prozessspeicher in Redis verlagern (Room State + Presence + Reconnect-Session + Locks).
2. Socket.IO Redis Adapter einführen (Pub/Sub + room fanout über Instanzen).
3. Harte Port-Strategie: kein Auto-Port in Production, Startup fail-fast bei Portkonflikt.
4. Einheitliche zentrale `API_BASE_URL`/`WS_BASE_URL` Config für alle Clients.
5. Explizite Events einführen: `room:join:ack`, `room:join:error`, `room:reconnect:ack`.
6. Socket-Auth über JWT im Handshake; serverseitige `socket.userId`-Bindung, keine Trust auf Payload-IDs.
7. Room-Lifecycle vereinheitlichen: DB als Source of Truth + Recovery-Mechanismus für Spielzustand.
8. Chat/Game-Events mit Sequenznummern/Versionierung versehen (idempotent, reorder-safe).
9. Timeout/Turn/Bot als deterministische Room-State-Machine modellieren.
10. Observability: strukturierte Logs + Metrics (join latency, reconnect success rate, orphan rooms, timer count).

## Sofortmaßnahmen (48h)
1. URL-Konfiguration zentralisieren und harte E2E-Prüfung „Host erstellt / extern joined / beide sehen gleichen roomId“.
2. Production-Port fixieren, Auto-Port deaktivieren.
3. `join-room` um explizites Ack erweitern inkl. roomId/roomCode/playerId/currentPlayers.
4. Socket-Auth im Handshake erzwingen, `userId` aus Token beziehen.
5. Join-Flow absichern: bei existierender DB-Lobby + fehlendem In-Memory-State keinen stillen Neuaufbau ohne Recovery.

## Test-/Qualitätsstatus (Ist-Zustand)
- `pnpm check` schlägt fehl (TypeScript-Fehler in Testdatei).
- `pnpm test` mit mehreren Failures:
  - Room-System-Tests timeouten.
  - Login/User-Journey Tests scheitern mangels erreichbarem API-Backend.

## Empfehlung zur nächsten Iteration
- Erst Stabilitäts-/Connectivity-Basics fixen (URL, Port, Join-Ack, Socket-Auth).
- Danach State-Persistenz + Multi-Instance-Fähigkeit (Redis Adapter + Recovery).
- Anschließend E2E-Testmatrix (lokal, staging, multi-instance, reconnect-chaos tests).
