## Aktuelle Baustelle
Systemstabilität Phase 0

## Ziel
Projekt von kritisch instabil auf stabilisierbar bringen

## Bekannter Stand
- Mehrere State-Quellen auf dem Server
- Reconnect-/Join-Logik doppelt
- Room-Lifecycle inkonsistent
- Audio-Pfad hat Runtime-Crash
- Game-Screen und game-socket sind monolithisch

## Aktueller Blocker
Kein einzelner Bug, sondern fehlende Systemautorität und instabile Kernpfade

## Root-Cause-Hypothesen
1. Verantwortlichkeiten sind über mehrere Layer verteilt
2. Realtime-Logik ist redundant und widersprüchlich
3. UI und Runtime-/FX-Logik sind zu eng gekoppelt
4. Dev-/Prod-Pfade sind nicht sauber getrennt

## Betroffene Dateien
- server/game-socket.ts
- server/realtime-store.ts
- server/room-manager.ts
- lib/socket-provider.tsx
- app/game/play.tsx
- hooks/use-game-sounds.ts
- server/db.ts
- server/routers.ts

## Minimaler Plan
1. Audio-Crash eliminieren
2. Server State Authority definieren
3. Reconnect/Join-Pfad vereinheitlichen
4. Room-Lifecycle auf einen Kanal bringen
5. play.tsx und game-socket.ts entkoppeln

## Validierung
- [ ] kein Runtime-Crash mehr
- [ ] eindeutige State-Quelle dokumentiert
- [ ] Reconnect reproduzierbar stabil
- [ ] Room-Flow konsistent
- [ ] keine offensichtlichen Doppeltrigger

## Done-Kriterien
- Projekt ist nicht mehr kritisch instabil
- Kernpfade sind deterministischer
- weitere Fixes können kontrolliert erfolgen
