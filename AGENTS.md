# AGENTS.md

## Projekt
Expo/React-Native Multiplayer-Kartenspiel (CrazyAmsel).
Backend: Node.js + tRPC + MySQL + Socket.IO.

Arbeite wie ein Senior Engineer.
Nicht explorativ, nicht trial-and-error.

## Grundprinzipien
- Nicht bei 0 anfangen
- Immer bestehenden Stand nutzen
- Root Cause vor Fix
- Minimal-invasive Änderungen
- Keine neuen Baustellen öffnen
- Keine kosmetischen Änderungen ohne Nutzen

## Pflichtablauf
Vor jeder Änderung:
1. Relevante Dateien lesen
2. Bestehende Skripte / Logs prüfen
3. Befund formulieren
4. Engsten Blocker benennen
5. Root-Cause-Hypothese formulieren
6. Minimalen Plan formulieren

Dann:
7. Fix umsetzen
8. Validieren
9. Ergebnis berichten

## Reporting (immer!)
Am Ende immer:
1. Root Cause
2. Geänderte Dateien
3. Konkrete Änderungen
4. Validierung
5. Ergebnis:
   - BESTANDEN
   - NICHT BESTANDEN

## Definition of Done
Eine Aufgabe ist nur fertig, wenn:
- Root Cause behoben ist
- Keine Regression sichtbar ist
- Validierung durchgeführt wurde
- Ergebnis klar bewertet ist

## Spezifische Regeln
### Auth / Login
- Reihenfolge: DB → API → Client
- Keine Vermutungen ohne DB-Beleg
- passwordHash muss geprüft werden

### Multiplayer
- Join / Rejoin / Reconnect immer zusammen prüfen
- Keine Ghost Players
- Keine doppelten Listener
- Server ist Source of Truth

### Expo / Start / Tunnel
- Nur EIN Startpfad
- Keine parallelen Methoden
- Alte Prozesse bereinigen
- Script bevorzugen statt manuelle Commands

### React / Frontend
- Keine Conditional Hooks
- Keine Early Returns vor Hooks
- Keine kaputten Imports

## Validierung
Immer prüfen:
- Typecheck
- betroffener Flow real
- keine offensichtlichen Fehler

Wenn Verhalten nicht stabil ist:
→ NICHT BESTANDEN

## Große Aufgaben
Wenn `EXECPLAN.md` existiert:
- zuerst lesen
- darauf aufbauen
- keinen neuen Plan parallel erstellen

## Verboten
- Wieder bei 0 anfangen
- Wiederholen bereits erledigter Schritte
- Blindes „ich starte nochmal alles neu“
- Große Refactors ohne Grund
- Symptome fixen statt Ursachen
