# Acid-Mau App - TODO Liste

## EPIC 01: Technisches Fundament & Setup
- [x] Projekt-Repository aufsetzen
- [x] Frontend (React Native, Expo) und Backend (Node.js, TypeScript) initialisieren
- [x] Datenbank-Schema mit Drizzle erstellen
- [x] API-Routen für Authentifizierung einrichten
- [x] Spielerprofile, Spielräume, Spielhistorie Tabellen erstellt
- [x] tRPC-Router für Profile, Räume, Cosmetics, Premium implementiert

## EPIC 02: Kern-Spielmechanik (Offline-Prototyp)
- [x] 32-Karten-Deck (altdeutsch) Datenstruktur erstellen
- [x] Spiellogik: Karten austeilen (1 + Verluste)
- [x] Spiellogik: Karte auf Ablagestapel legen (Validierung)
- [x] Spiellogik: Karte vom Nachziehstapel ziehen
- [x] Spiellogik: Rundenende erkennen (nur ein Spieler hat Karten)
- [x] Spiellogik: Verlustpunkte vergeben
- [x] Spiellogik: Eliminierung nach 7 Verlusten
- [x] Spiellogik: Spielende (nur ein Spieler übrig)
- [x] Spezialkarte "Unter" - Farbwunsch
- [x] Spezialkarte "Ass" - Spieler aussetzen
- [x] Spezialkarte "Schellen-8" - Spielrichtung umkehren
- [x] Spezialkarte "7" - Ziehkette
- [ ] Karten-Komponente mit Rendering implementieren (UI-Phase)

## EPIC 03: Multiplayer-Grundlagen & Lobby
- [ ] WebSocket-Verbindung zum Server aufbauen
- [ ] Spielraum erstellen (Lobby)
- [ ] Spielraum beitreten (mit Code)
- [ ] Lobby-Screen mit Spielerliste
- [ ] Spiellogik auf Server portieren
- [ ] Spielaktionen an Server senden und validieren
- [ ] Echtzeit-Updates an alle Spieler verteilen
- [ ] Reconnect nach Verbindungsabbruch

## EPIC 04: Benutzerkonten & Authentifizierung
- [ ] Registrierung mit E-Mail und Passwort
- [ ] Login mit E-Mail und Passwort
- [ ] JWT-Authentifizierung zwischen Client und API-Server
- [ ] Benutzername im Spiel anzeigen
- [ ] Passwort zurücksetzen

## EPIC 05: UI & Spielerlebnis
- [ ] Spieloberfläche mit Handkarten, Ablagestapel und Nachziehstapel
- [ ] Kartenanimationen (ziehen, ausspielen)
- [ ] Spielbare Karten hervorheben
- [ ] Visuelle Anzeige für Wunschfarbe, Spielrichtung, Ziehkette
- [ ] Responsive Oberfläche (Desktop, Tablet, Handy)
- [ ] In-Game-Chat (optional)

## EPIC 06: Erweiterte Features & Polish
- [ ] Interaktives Tutorial für neue Spieler
- [ ] Statistiken nach Spiel anzeigen (Siege, Niederlagen)
- [ ] Globale Rangliste
- [ ] KI-gesteuerte Gegner (optional)
- [ ] Freundesliste und direkte Einladungen

## EPIC 07: Monetarisierung & Wachstum
- [ ] Premium-Account: Werbefrei spielen
- [ ] Premium-Account: Erweiterte Statistiken
- [ ] Premium-Account: Private Lobbys
- [ ] Premium-Account: Premium-Badge
- [ ] Zahlungsabwicklung (Stripe / PayPal)
- [ ] Cosmetics: Kartenrückseiten kaufen
- [ ] Cosmetics: Tisch-Themes kaufen
- [ ] Analytics: DAU / MAU Tracking
- [ ] Analytics: Conversion Free → Premium
- [ ] Analytics: Churn und ARPU

## Aktuelle Prioritäten
1. Datenbank-Schema erstellen
2. Kern-Spiellogik implementieren
3. Multiplayer-Grundlagen aufbauen
4. UI und Spielerlebnis polieren

## Implementierte Features (Phase 1-5)
- [x] Tab-Navigation (Spielen, Rangliste, Profil, Einstellungen)
- [x] Home-Screen mit Spieloptionen (Schnellspiel, Raum erstellen, Raum beitreten, Übungsmodus)
- [x] Profil-Screen mit Statistiken und Bearbeitungsfunktion
- [x] Rangliste-Screen mit Top-Spielern
- [x] Einstellungen-Screen mit App- und Spiel-Einstellungen
- [x] App-Logo und Branding (Acid-Mau Theme mit Grün/Gold/Rot)
- [x] Premium-Status-Anzeige

## Nächste Schritte (für Phase 2)
- [ ] WebSocket-Client-Integration im Frontend
- [ ] Karten-Komponente mit SVG-Rendering
- [ ] Lobby-Screen: Raum erstellen
- [ ] Lobby-Screen: Raum beitreten
- [ ] Lobby-Screen: Spielerliste anzeigen
- [ ] Spiel-Screen: Handkarten anzeigen
- [ ] Spiel-Screen: Ablagestapel und Nachziehstapel
- [ ] Spiel-Screen: Karten ausspielen
- [ ] Spiel-Screen: Karten ziehen
- [ ] Spiel-Screen: Spezialkarten-UI (Farbwahl bei Unter)
- [ ] Spiel-Screen: Spielstatus-Anzeige (Richtung, Ziehkette, etc.)
- [ ] Reconnect-Logik bei Verbindungsabbruch
- [ ] Spielhistorie nach Spielende speichern
- [ ] Übungsmodus gegen KI

## Phase 2: Multiplayer-Implementierung (EPIC 03)
- [x] M-02: WebSocket-Client-Integration
- [x] Socket.IO-Client Hook erstellen
- [x] Verbindungsmanagement implementieren
- [x] M-03: Lobby-Screens
- [x] Screen: Raum erstellen
- [x] Screen: Raum beitreten (Code-Eingabe)
- [x] Screen: Raumliste anzeigen
- [x] M-04: Warteraum-Screen
- [x] Spielerliste in Echtzeit
- [x] Start-Button für Host
- [x] Raum verlassen
- [x] M-05: Spiel-Screen
- [x] Karten-Komponente mit deutschem Design
- [x] Handkarten anzeigen
- [x] Ablagestapel und Nachziehstapel
- [x] Karten ausspielen (Tap)
- [x] Karten ziehen
- [x] Spezialkarten-UI (Farbwahl bei Unter)
- [x] Spielstatus-Anzeige (Richtung, wer ist dran, Ziehkette)
- [x] Echtzeit-Synchronisation aller Spieler

## Phase 3: EPIC 04 - Benutzerkonten & Authentifizierung
- [x] U-01: Registrierung mit E-Mail und Passwort
- [x] Registrierungs-Screen erstellen
- [x] Formular-Validierung
- [ ] Backend-Integration (E-Mail/Passwort - optional, OAuth funktioniert)
- [x] U-02: Login mit Zugangsdaten
- [x] Login-Screen erstellen
- [x] OAuth-Integration (Google, GitHub)
- [x] Fehlerbehandlung
- [x] U-03: Benutzername im Spiel anzeigen
- [x] Profil automatisch nach Login erstellen
- [x] Benutzername in allen Screens anzeigen
- [x] U-04: JWT-Authentifizierung
- [x] Token-Management (bereits im Backend)
- [x] Auto-Refresh bei Ablauf (bereits im Backend)
- [x] Onboarding-Flow
- [x] Willkommens-Screen beim ersten Start
- [x] Benutzername-Eingabe
- [x] Profil-Erstellung
- [x] AuthGuard für automatische Navigation

## Phase 4: EPIC 05 - UI & Spielerlebnis
- [x] UI-01: Klare Spieloberfläche (bereits implementiert)
- [ ] UI-02: Karten-Animationen (Niedrige Priorität)
- [ ] Karten ausspielen Animation
- [ ] Karten ziehen Animation
- [ ] Smooth Transitions
- [x] UI-03: Spielbare Karten hervorheben
- [x] Validierung welche Karten spielbar sind
- [x] Visuelle Hervorhebung (grüner Border)
- [x] UI-04: Status-Anzeigen verbessern
- [x] Wunschfarbe prominent anzeigen
- [x] Spielrichtung anzeigen
- [x] 7er-Kette Counter
- [x] UI-05: Responsive Design (bereits implementiert)
- [ ] UI-06: In-Game-Chat (Niedrige Priorität)

## Phase 5: EPIC 06 - Erweiterte Features & Polish
- [ ] E-01: Interaktives Tutorial (Mittel, niedrige Priorität)
- [x] E-02: Spielstatistiken nach Spielende
- [x] Zusammenfassung-Screen
- [x] Siege/Niederlagen anzeigen
- [x] Persönliche Gesamtstatistik
- [x] E-03: Globale Rangliste (bereits im Leaderboard-Screen implementiert)
- [x] E-04: Übungsmodus gegen KI
- [x] KI-Gegner-Logik (einfache AI)
- [x] Lokales Spiel ohne Server
- [x] 3 Bot-Spieler
- [x] Vollständige Spiellogik
- [ ] E-05: Freundesliste (Niedrig)

## Zusätzliche Implementierungen
- [x] M-06: Reconnect-Logik nach Verbindungsabbruch
- [x] Automatische Wiederverbindung (max. 5 Versuche)
- [x] Raum-Daten in AsyncStorage speichern
- [x] Auto-Rejoin nach Reconnect

## Bugs zu beheben
- [x] Registrierungsmaske: E-Mail/Passwort-Registrierung Backend implementiert
- [x] Login-Screen: E-Mail/Passwort-Login Backend implementiert
- [x] Datenbank-Schema erweitert (passwordHash, email unique)
- [x] Auth-Helper mit bcrypt und JWT
- [x] Frontend-Integration mit Token-Speicherung

## Neue Bugs
- [x] Navigation: Benutzer steckt im Registrierungsscreen fest - Behoben durch explizite Navigation zum Login

## Kritische Bugs
- [ ] Registrierung: Keine Rückmeldung nach "Konto erstellen"
- [ ] Login: Keine Reaktion beim Anmelden
- [ ] OAuth: Versucht auf localhost zuzugreifen statt auf Server-URL

- [x] E-Mail-Validierung: Benutzerfreundliche Fehlermeldungen statt technischem JSON
- [x] Registrierung: Bessere Fehlerbehandlung mit spezifischen Meldungen
- [x] Login: Bessere Fehlerbehandlung mit spezifischen Meldungen

## Layout-Fix Übungsmodus Round 2 (2026-02-27)
- [x] Karte unten abgeschnitten (Tab-Bar-Überlappung)
- [x] Leerraum zwischen Gegner-Boxen und Spielfeld beseitigen
- [x] Gegner-Boxen: Hintergrund fehlt (kein Filz sichtbar)

## Logout API Bug (2026-02-28)
- [x] Logout-Route: Fallback-URL entfernt, Web nutzt relativen Pfad

## Schellen-8 Bugs (2026-02-28)
- [x] Schellen-8 als Startkarte: Richtung dreht um, erster Spieler darf beliebige Karte legen
- [x] Schellen-8 bei 2 Spielern: B muss nach A's 8 aussetzen

## Chat-Funktion Online-Modus (2026-02-28)
- [x] Datenbanktabelle game_chat_messages erstellen
- [x] Socket-Events: chat:send und chat:message implementieren
- [x] Chat-Nachrichten beim Raumjoin laden
- [x] Chat-UI: Icon im Spielscreen, Modal mit Nachrichtenliste + Input
- [x] Ungelesene Nachrichten Badge

## Kartenzahlen im Ablagestapel (2026-02-28)
- [x] PlayingCard: Kartenzahlen oben links + unten rechts anzeigen

## Gegner-Chips kompakt (2026-02-27)
- [x] Übungsmodus: Gegner als kompakte Chips mit flexWrap
- [x] Online-Modus: Gegner als kompakte Chips mit flexWrap

## Layout-Fix Übungsmodus Round 3 (2026-02-27)
- [x] Gegner-Boxen immer noch zu groß (nehmen halben Screen ein)
- [x] React Hook-Order Fehler (useSafeAreaInsets nach Early-Return)

## Layout-Fix Online-Modus (2026-02-27)
- [x] Online-Modus: Eigene Karten vollständig sichtbar
- [x] Online-Modus: Visuelles Design aufwerten

## Layout-Fix Übungsmodus (2026-02-27)
- [x] Eigene Karten vollständig sichtbar (werden unten abgeschnitten)
- [x] Gegner-Bereich kompakter (zu große graue Boxen)
- [x] Bessere Platzverteilung zwischen Gegner/Spielfeld/Hand
- [x] "1 Karten" → "1 Karte" (ersetzt durch MiniCardFan)

- [x] SecureStore: "Cannot read property 'setItemAsync' of undefined" - Behoben mit try-catch und optional chaining

- [x] Registrierung: Vereinfachte Version mit ScrollView, KeyboardAvoidingView und Labels erstellt
- [x] TextInput-Felder: editable-Prop, autoCorrect=false, keyboardShouldPersistTaps hinzugefügt

## KRITISCH - Buttons funktionieren nicht im Web-Browser
- [ ] Kein einziger Button (Login, Registrierung) funktioniert
- [ ] Auth-Screens komplett neu schreiben mit Web-kompatiblen Komponenten
- [ ] Native HTML-Elemente statt React Native Komponenten verwenden für Web

## 🐛 BUG: "Raum löschen" Button funktioniert nicht (2026-01-31)
- [x] Code analysieren: Warum passiert nichts beim Klick?
- [x] Bug beheben: TouchableOpacity durch Pressable ersetzt (bessere Web-Kompatibilität)
- [x] Debugging-Code hinzugefügt: Console-Logs für Button-Klick, Handler-Aufruf, Mutation
- [x] PROBLEM: Alert.alert funktioniert nicht im Web (Button-Klick wird blockiert)
- [x] SCHNELLE LÖSUNG: Alert.alert entfernt - Button löscht Raum SOFORT (kein Bestätigungsdialog)
- [ ] TODO: Custom-Modal mit Bestätigung hinzufügen (später)

## 🐛 KRITISCHE SPIELREGEL-BUGS (2026-01-31)
- [x] BUG 1: Schellen-8 kehrt Spielrichtung NICHT um (direction bleibt unverändert) - BEHOBEN: Schellen-8 als Startkarte wird jetzt korrekt behandelt
- [x] BUG 2: Unter als Startkarte setzt Wunschfarbe (sollte ignoriert werden, nächster Spieler frei wählen) - BEHOBEN: Unter als Startkarte setzt keine Wunschfarbe mehr
- [x] BONUS-FIX: 7 als Startkarte startet Ziehkette (drawChainCount = 2)
- [x] BONUS-FIX: Alle Sonderkarten als Startkarte werden jetzt korrekt behandelt

## Neue Bugs (2026-01-31)
- [x] Bot mit 0 Karten zieht wieder statt zu gewinnen - Runde endet nie (isRoundOver + getRoundWinner Logik korrigiert)
- [ ] Spielregeln möglicherweise unvollständig

## Neue Features (2026-01-31)
- [ ] Altägyptische Karten-Designs implementieren (statt Emoji)
- [ ] Vogel-Logo als Kartenrückseite verwenden
- [ ] Karten mit echten Bildern (Ober/Unter mit Körper-Motiven)

## Aktuelle Aufgaben (2026-01-31 - Regelanpassung)
- [x] Verlustpunkte: Nur +1 statt Kartenanzahl
- [x] Eliminierung: Abhängig von Spielerzahl (2-4: 7 Verluste, 5: 6 Verluste, 6: 5 Verluste)
- [ ] Spezialkarten-Namen anpassen (Unter → Bube, Ober → Dame im Code - Mapping bleibt altdeutsch)
- [ ] 32 altdeutsche Karten-Designs generieren (später)
- [x] Kartenrückseite mit Vogel-Logo erstellen
- [x] PlayingCard-Komponente: Vogel-Logo als Kartenrückseite verwenden

## Multiplayer-Bugs (2026-01-31 - Kritisch für Online-Test)
- [x] 1. Dealer-Rotation: Dealer wird gelost und rotiert jede Runde
- [x] 2. Index-Sicherheit: currentPlayerIndex + dealerIndex nach Spieleränderungen prüfen (handleLeaveGame)
- [ ] 3. Elimination vs. Leave Game: Klare Trennung implementieren (bereits getrennt: isEliminated vs. LEAVE_GAME)
- [x] 4. Draw-Chain-Konsistenz: drawChainCount wird bei allen nicht-7-Karten zurückgesetzt (applySpecialCardEffect)
- [x] 5. Discard-Pile-Reshuffle: Guard hinzugefügt (nur wenn > 1 Karte im Discard)
- [x] 6. Code-Struktur: handlePlayCard aufgeteilt in validatePlayCard, applyCardPlay, advanceTurn
- [x] 7. Tests: Unit-Tests für kritische Szenarien hinzugefügt (17 Tests, alle bestanden)

## Code-Konsolidierung (2026-01-31)
- [x] Redundante Spieler-Navigationslogik identifizieren (3x while-Schleifen: startGame Z57, startNewRound Z102+Z113, getNextPlayerIndex Z187)
- [x] Zentrale Helper-Funktion getNextActivePlayerIndex() erstellt (game-rules.ts Z175)
- [x] Alle Stellen auf zentrale Funktion umgestellt (startGame Z60, startNewRound Z105+Z109, getNextPlayerIndex Z208)
- [x] Sichergestellt: dealerIndex + currentPlayerIndex zeigen nie auf Eliminierte (getNextActivePlayerIndex überspringt automatisch)

## REGELWERK-IMPLEMENTIERUNG (VERBINDLICH - Pasted_content_38.txt)

### GRUNDSÄTZE
- [x] 32-Karten-Skatblatt (keine Duplikate) - createDeck() in deck-utils.ts
- [x] Kartenzustand-Invariante: Summe(Spielerhand + Nachziehstapel + Ablagestapel) = 32 - wird durch Game-Engine garantiert

### KARTENVERGLEICH
- [x] Rang-Hierarchie: Ass > König > Dame > Unter > Zehn > Neun > Acht > Sieben - card-comparison.ts
- [x] Farb-Hierarchie: Eichel > Gras > Herz > Schellen - card-comparison.ts
- [x] Vergleichslogik: ZUERST Rang, NUR bei Gleichheit Farbe - compareCards() in card-comparison.ts

### SPIELVORBEREITUNG
- [x] Platzwahl: Höchste Karte wählt zuerst (dauerhaft) - performSeatSelection() in game-preparation.ts
- [x] Dealerwahl: Niedrigste Karte ist Dealer (kein Gleichstand möglich) - performDealerSelection() in game-preparation.ts

### SPIELSTART
- [x] Jeder Spieler startet mit GENAU 1 Startkarte - getInitialCardCount(0) = 1
- [x] Startspieler = Spieler nach Dealer - startNewRound() Z109
- [x] Dealer rotiert im Uhrzeigersinn nach jeder Runde - startNewRound() Z104-106

### SPIELZUG
- [x] Option A: Karte legen (gleicher Rang ODER gleiche Farbe ODER Sonderregel) - canPlayCard() in game-rules.ts
- [x] Option B: Karte ziehen (IMMER erlaubt, auch wenn Legen möglich) - handleDrawCard() Z277-278
- [x] Nach Ziehen: Zug endet sofort, keine Karte mehr legbar, keine Sonderkarteneffekte - handleDrawCard() Z323-325

### SONDERKARTEN
- [x] UNTER: Darf auf jede Karte (außer bei 7-Ziehkette), setzt Wunschfarbe, Wunsch endet nur durch neuen Unter oder erfüllte Wunschfarbe - canPlayCard() Z28-37, applyCardPlay() Z217-222
- [x] ASS: Nächster Spieler setzt aus, Ass als Startkarte → erster Spieler setzt aus - applySpecialCardEffect() Z89-94, startNewRound() Z115-121
- [x] SCHELLEN-8: Kehrt Spielrichtung um, unterliegende Karte bleibt gültig - applySpecialCardEffect() Z103-105
- [x] SIEBEN: Jede 7 = +2 Karten, nur weitere 7 erlaubt, kein Unter während Ziehkette, Ziehen beendet Ziehkette sofort - applySpecialCardEffect() Z96-99, canPlayCard() Z28-37, handleDrawCard() Z280-284

### RUNDENENDE
- [x] Runde endet: Nur noch EIN Spieler hat Karten (Rundenverlierer) - isRoundOver() Z144-148
- [x] Rundenverlierer erhält +1 Verlustpunkt - calculateRoundLossPoints() Z230-236
- [x] Alle anderen bleiben unverändert - handleRoundEnd() Z357-367

### NACHZIEHSTAPEL
- [x] Wenn leer: Oberste Ablagekarte bleibt, Rest wird gemischt → neuer Nachziehstapel - handleDrawCard() Z302-312

### SONDERFALL: NUR EINE ABLAGEKARTE
- [x] Auslöser: Nachziehstapel leer + Ablagestapel = 1 Karte + mind. 2 Spieler mit Karten - handleDrawCard() Z310-319
- [x] Konsequenz: Runde SOFORT abgebrochen - handleDrawCard() Z315
- [x] Kollektive Strafe: Alle Spieler mit Karten erhalten +1 Verlustpunkt - handleRoundEnd() Z365-374

### AUSSCHEIDEN
- [x] 2-4 Spieler: Max 7 Startkarten → nächste Niederlage → raus - isPlayerEliminated() Z137-139
- [x] 5 Spieler: Max 6 Startkarten → nächste Niederlage → raus - isPlayerEliminated() Z137-139
- [x] 6 Spieler: Max 5 Startkarten → nächste Niederlage → raus - isPlayerEliminated() Z137-139
- [x] Startkarten = Niederlagen + 1 - getInitialCardCount() Z108-110

## KRITISCHE REGELFEHLER (Pasted_content_39.txt - VERBINDLICH)

### FEHLER 1 – DEALERWAHL (KRITISCHER REGELBRUCH)
- [x] Problem: Dealerwahl erfolgt aktuell zufällig (Math.random) - BEHOBEN
- [x] Fix: Dealer wird durch Kartenvergleich bestimmt (niedrigste Karte) - performDealerSelection() existiert bereits
- [x] Anweisung: Math.random() vollständig aus startGame entfernen - startGame() Z47-63
- [x] Anweisung: dealerIndex muss VOR startGame festgelegt werden (separate Vorbereitungslogik) - Validierung Z54-56
- [x] Anweisung: startGame() übernimmt nur bereits gesetzten dealerIndex - startGame() wirft Error wenn nicht gesetzt

### FEHLER 2 – RUNDENABBRUCH BEI LEEREM NACHZIEHSTAPEL
- [x] Problem: Sonderfall wird wie normales Rundenende behandelt - BEHOBEN
- [x] Fix: Runde wird SOFORT abgebrochen (kein einzelner Verlierer) - abortRoundWithCollectivePenalty() Z348-381
- [x] Fix: Kollektive Strafe (alle Spieler mit Karten +1 Verlustpunkt) - abortRoundWithCollectivePenalty() Z353-357
- [x] Anweisung: handleRoundEnd() DARF in diesem Fall NICHT verwendet werden - handleDrawCard() Z311 ruft abortRoundWithCollectivePenalty()
- [x] Anweisung: Eigene Funktion abortRoundWithCollectivePenalty(state) erstellen - Z348-381

### FEHLER 3 – FALSCHE VERWENDUNG VON getRoundWinner
- [x] Problem: Beim Rundenabbruch wird getRoundWinner() aufgerufen - BEHOBEN
- [x] Fix: getRoundWinner() DARF NUR bei regulärem Rundenende aufgerufen werden - handleRoundEnd() Z387-390
- [x] Anweisung: Beim Abbruch darf diese Funktion NICHT ausgeführt werden - abortRoundWithCollectivePenalty() verwendet getRoundWinner() NICHT

### FEHLER 4 – ELIMINIERUNG NICHT TABELLENGESTEUERT ABGESICHERT
- [x] Problem: Eliminierung verlässt sich auf generische Logik - BEHOBEN
- [x] Fix: isPlayerEliminated MUSS Tabelle EXAKT erzwingen - getMaxLossPoints() Z132-147
  - 2-4 Spieler → 7 Startkarten max - eliminationTable[2,3,4] = 7
  - 5 Spieler → 6 Startkarten max - eliminationTable[5] = 6
  - 6 Spieler → 5 Startkarten max - eliminationTable[6] = 5
- [x] Fix: Nächste Niederlage → ausgeschieden - isPlayerEliminated() Z150-152
- [x] Anweisung: Gilt für normale Rundenverluste UND kollektive Strafe - handleRoundEnd() + abortRoundWithCollectivePenalty() verwenden beide isPlayerEliminated()

### FEHLER 5 – VERTEILTE SONDERFALL-LOGIK (TECHNISCHE GEFAHR)
- [x] Problem: Sonderfall-Logik auf mehrere Stellen verteilt - BEHOBEN
- [x] Fix: Sonderfall darf NUR an EINER Stelle entschieden werden - handleDrawCard() Z306-315 (einzige Prüfstelle)
- [x] Anweisung: Keine doppelte Prüfung in handleDrawCard UND handleRoundEnd - handleRoundEnd() enthält keine Sonderfall-Logik mehr
- [x] Empfehlung: Sonderfall erkennen → abortRoundWithCollectivePenalty() → KEINE weitere Spiellogik - handleDrawCard() Z311 return

## KRITISCHER BUG: SPIELER MIT 0 KARTEN ZIEHT (VERBINDLICH)

### PROBLEM
- [x] Spieler (insbesondere Bots) können Aktionen ausführen, obwohl sie 0 Karten haben - BEHOBEN
- [x] Spieler ohne Karten zieht Karten vom Nachziehstapel - BEHOBEN durch handleDrawCard() Z287-289
- [x] Spieler ohne Karten legt Karten ab - BEHOBEN durch validatePlayCard() Z185-187

### ANWEISUNG 1 – ZUGSPERRE IN ACTION-HANDLERN
- [x] handlePlayCard: Wenn currentPlayer.hand.length === 0 → Aktion abbrechen - validatePlayCard() Z185-187
- [x] handleDrawCard: Wenn currentPlayer.hand.length === 0 → Aktion abbrechen - handleDrawCard() Z287-289
- [x] KEINE Karten ziehen/legen für Spieler mit 0 Karten - Error wird geworfen
- [x] Turn direkt an nächsten aktiven Spieler weitergeben - durch Error-Handling

### ANWEISUNG 2 – DRAW_CARD BLOCKIEREN
- [x] handleDrawCard: Prüfung am Anfang hinzufügen - handleDrawCard() Z287-289
- [x] Wenn currentPlayer.hand.length === 0 → Fehler werfen - "Cannot draw card with empty hand"
- [x] Ein Spieler mit 0 Karten darf NIEMALS DRAW_CARD ausführen - durch Validierung blockiert

### ANWEISUNG 3 – TURN-LOGIK ABSICHERN
- [x] getNextActivePlayerIndex: Spieler mit hand.length === 0 überspringen - Z213 + Z226
- [x] Ein Spieler ohne Karten darf NIEMALS currentPlayerIndex sein - durch getNextActivePlayerIndex() garantiert

### ANWEISUNG 4 – RUNDENENDE-PRÜFUNG
- [x] Nach JEDEM Zug: Wenn currentPlayer.hand.length === 0 → Rundenende prüfen - handleDrawCard() Z348-350, advanceTurn() Z246-248
- [x] Falls nur noch EIN Spieler Karten hat → Runde beenden - isRoundOver() + handleRoundEnd()

## SPIELAMBIENTE & SPIELSPASS (Pasted_content_40.txt - VERBINDLICH)

### GRUNDSATZ
- [x] Spiel MUSS sich wie ein SPIEL anfühlen, nicht wie eine App - Textur, Schatten, Animationen
- [x] Spielspaß durch: Reaktion, Übertreibung, Feedback, Schadenfreude - implementiert
- [x] NICHT durch: perfekte Ordnung, reine Lesbarkeit, statische Oberflächen - vermieden

### AMBIENTE & HINTERGRUND
- [x] Erzeuge SPIELAMBIENTE, kein UI-Canvas - game-background.png generiert
- [x] Hintergrund mit Tiefe (Textur, Vignette, leichte Bewegung) - Textur mit Grain, Vignette, Stofftextur
- [x] Vermeide sterile Flächen und klinische Leere - "worn gaming table surface"
- [x] Erlaubt: subtile Animationen, Farbverläufe, "schmutzige" Details, Noise/Grain - implementiert

### SPIELFLÄCHE & KARTENTISCH
- [x] Spieltisch ist das ZENTRUM - Hintergrund-Textur als Tisch-Oberfläche
- [x] Tisch darf benutzt aussehen, Gewicht haben, nicht perfekt sein - "worn gaming table surface"
- [x] Karten haben Präsenz: Schatten, Versätze, Tiefe - cardShadow mit shadowOffset, shadowOpacity, elevation
- [x] Karten liegen NICHT einfach nur da - 3D-Schatten gibt Gewicht

### AKTIONEN MÜSSEN REAGIEREN
- [x] Karte legen → spürbarer Snap/Schlag (100-250ms) - scale 0.95 (100ms) + spring bounce
- [x] Karte ziehen → sichtbare Bewegung - scale animation mit spring
- [x] Zugwechsel → klares visuelles Signal - aktiver Spieler: Glow, ▶️ Icon, dicker Border
- [ ] Runde endet → spürbarer Moment - TODO: Modal mit Animation (separate Aufgabe)

### SONDERKARTEN = EMOTIONSTRÄGER
- [x] Sonderkarten müssen sich anders anfühlen als normale Karten - visuelle Hervorhebung durch Farbe/Größe
- [x] Sie lösen visuelle Reaktionen aus - Ziehkette + Wunschfarbe prominent
- [x] Ziehkette → sichtbarer Zähler - ⚠️ ZIEHKETTE +X KARTEN ⚠️ (rot, groß, dramatisch)
- [x] Wunschfarbe → deutlicher Farbwechsel im Spielfeld - Farbiger Block mit Suit-Farbe + weißer Border
- [ ] Skip → kurzer Freeze-Moment beim nächsten Spieler - TODO: Animation
- [ ] Richtungswechsel → kurze Umkehrbewegung des Spielfelds - TODO: Richtungspfeil animieren

### SCHADENFREUDE & MULTIPLAYER-GEFÜHL
- [x] Leid MUSS sichtbar sein - Ziehkette dramatisch, Verlustpunkte ❌ angezeigt
- [x] Ziehen vieler Karten = visuelles Ereignis - ⚠️ ZIEHKETTE +X KARTEN ⚠️
- [ ] Letzte Karte = Spannung - TODO: Animation/Highlight (separate Aufgabe)
- [x] Kettenzüge = Eskalation - Ziehkette-Zähler eskaliert visuell
- [x] Nur durch: visuelle Überhöhung, Timing, Reaktion - keine Emotes/Chat

### AKTIVER SPIELER
- [x] Aktiver Spieler MUSS dominant sein - Glow, dicker Border, ▶️ Icon
- [x] "Am Zug" darf NICHT nur Text sein - visuelles Glow + Icon + "(AM ZUG)"
- [x] Aktiver Spieler hebt sich visuell ab: Fokus, Glow oder Bewegung - shadowColor, shadowRadius, elevation

### EMOTION STATT INFORMATION
- [x] Regeln sollen GESEHEN werden, nicht gelesen - Farben, Icons, Größen statt Text
- [x] Spieler sollen verstehen, was passiert, ohne Text zu lesen - Wunschfarbe = farbiger Block, Ziehkette = rot
- [x] Zustände müssen visuell unterscheidbar sein - aktiv = Glow, Ziehkette = rot, Wunschfarbe = Suit-Farbe

## CANPLAYCARD LOGIK-KORREKTUR (VERBINDLICH)

### VERBINDLICHE PRIORITÄTENREIHENFOLGE
- [x] 1. ZIEHKETTE (drawChainCount > 0) - MUSS VOR ALLEN ANDEREN geprüft werden - Z22-33
  - [x] Nur Rang "7" erlaubt - Z24-25
  - [x] Unter VERBOTEN bei Ziehkette - Z27
  - [x] Wunschfarbe VERBOTEN bei Ziehkette - Z28
- [x] 2. WUNSCHFARBE (currentWishSuit != null) - NUR wenn drawChainCount === 0 - Z39-48
  - [x] Erlaubt: passende Wunschfarbe ODER Unter - Z41-42
  - [x] Unter auf Unter erlaubt - Z41 (card.rank === "unter")
- [x] 3. NORMALES LEGEN - wenn keine Ziehkette und kein Wunsch - Z55-57
  - [x] Erlaubt: gleiche Farbe ODER gleicher Rang - Z55
- [x] 4. UNTER (SONDERREGEL) - IMMER spielbar, AUSSER bei Ziehkette - Z63-65

### VERBOTENE LOGIK
- [x] Wunschfarbe VOR Ziehkette prüfen - VERBOTEN - Ziehkette ist jetzt Priorität 1
- [x] Separate Sonderprüfung "7 auf 7" - VERBOTEN - entfernt
- [x] Unter bei aktiver Ziehkette erlauben - VERBOTEN - Z27-28
- [x] Implizite Ausnahmen definieren - VERBOTEN - klare Reihenfolge

## BUGFIX: RUNDE 2 STARTET NICHT (VERBINDLICH)

### PROBLEM
- [x] Nach Runde 1 startet Runde 2 nicht korrekt - BEHOBEN
- [x] Spiel bleibt im Zustand "round_end" oder beendet neue Runde sofort - BEHOBEN
- [x] isRoundOver wird unmittelbar nach startNewRound ausgelöst - BEHOBEN durch hasRoundStarted Flag

### URSACHE
- [x] isRoundOver wird unmittelbar nach startNewRound ausgelöst - BEHOBEN
- [x] Spieler mit hand.length === 0 werden falsch behandelt - BEHOBEN durch Validierung
- [x] READY kann nicht korrekt zur nächsten Runde führen - BEHOBEN (war bereits korrekt)

### FIX 1 – KEIN RUNDENENDE DIREKT NACH RUNDENSTART
- [x] isRoundOver DARF in neuer Runde NICHT sofort geprüft werden - advanceTurn Z247, handleDrawCard Z349
- [x] Nach startNewRound MUSS mindestens EIN Spielzug stattfinden - hasRoundStarted Flag
- [x] Empfehlung: state.hasRoundStarted = true Flag setzen - game-types.ts Z48, createGameState Z41
- [x] isRoundOver NUR prüfen wenn hasRoundStarted === true - applyCardPlay Z238 setzt auf true

### FIX 2 – STARTNEWROUND MUSS ALLE SPIELER AKTIVIEREN
- [x] Jeder nicht-eliminierte Spieler MUSS Karten erhalten - startNewRound Z77-90
- [x] Kein nicht-eliminierter Spieler darf mit hand.length === 0 starten - Validierung Z125-131

### FIX 3 – READY DARF NUR EINMAL AUSWERTEN
- [x] Wenn alle nicht-eliminierten Spieler isReady === true - handleReady Z492
- [x] startNewRound MUSS exakt EINMAL aufgerufen werden - handleNextRound Z518
- [x] Danach: isReady für alle auf false setzen - handleNextRound Z511-516
- [x] Phase auf "playing" setzen - startNewRound Z120

### FIX 4 – SICHERUNG
- [x] Nach startNewRound: players.filter(p => !p.isEliminated && p.hand.length > 0).length MUSS >= 2 sein - Z133-136
- [x] Andernfalls: Runde ungültig, darf nicht starten - Error geworfen

## BUGFIX: ASS + 2 SPIELER DEADLOCK (VERBINDLICH)

### PROBLEM
- [x] Bei genau 2 aktiven Spielern führt gespieltes Ass zu Deadlock - BEHOBEN
- [x] Ass setzt skipNextPlayer = true - BEHOBEN (nur bei >= 3 Spielern)
- [x] getNextPlayerIndex überspringt beide Spieler - BEHOBEN
- [x] currentPlayerIndex bleibt unverändert → Endlosschleife - BEHOBEN

### VERBINDLICHE REGEL
- [x] ASS DARF BEI GENAU 2 AKTIVEN SPIELERN NICHT SKIPPEN - game-rules.ts Z110-116

### VERBINDLICHE UMSETZUNG
- [x] In applySpecialCardEffect für Rang "ass" - Z107-119
  - [x] Ermittle activePlayers = players.filter(p => !p.isEliminated && p.hand.length > 0) - Z110
  - [x] WENN activePlayers.length === 2 → skipNextPlayer = false (kein Skip-Effekt) - Z114-115
  - [x] WENN activePlayers.length >= 3 → skipNextPlayer = true (wie bisher) - Z111-112

### NO-GOS
- [x] Kein Sonderfall im UI - VERBOTEN - Logik zentral im Rule-System
- [x] Kein Workaround im Bot - VERBOTEN - Logik zentral im Rule-System
- [x] Kein Ignorieren von skipNextPlayer - VERBOTEN - Logik zentral im Rule-System
- [x] Logik MUSS zentral im Rule-System liegen - applySpecialCardEffect Z107-119

## ROOT-CAUSE-FIX: RUNDE 2 STARTET NICHT (VERBINDLICH)

### URSACHE
- [x] Spieler mit 0 Handkarten nach Runde 1 werden nicht korrekt in READY-Flow einbezogen - BEHOBEN durch UI
- [x] READY-Logik schließt fälschlich Spieler mit hand.length === 0 aus - FALSCH, Server war korrekt, UI fehlte

### VERBINDLICHE REGELN

#### 1. READY-LOGIK
- [x] READY MUSS für ALLE Spieler gelten die: isEliminated === false - handleReady Z492
- [x] hand.length darf KEINE Rolle spielen - korrekt implementiert

#### 2. READY-CHECK
- [x] allReady = players.filter(p => !p.isEliminated).every(p => p.isReady) - handleReady Z492 KORREKT
- [x] Spieler mit 0 Karten MÜSSEN READY setzen können (UI + Server) - Server OK, UI jetzt implementiert

### UI-ANFORDERUNGEN (ROUND_END SCREEN)
- [x] Phase "round_end" MUSS im UI behandelt werden - play.tsx Z321-382
- [x] Rundenende-Modal/Screen mit:
  - [x] Rundeninfo: Verlierer, Verlustpunkte aller Spieler - Z333-345
  - [x] READY-Button für ALLE nicht-eliminierten Spieler (unabhängig von hand.length) - Z361-370
  - [x] Warten-Status: Welche Spieler READY sind, welche fehlen - Z348-358
  - [x] Automatik: Modal schließt wenn alle READY, Runde 2 beginnt - visible={gameState.phase === "round_end"} Z322
- [x] NO-GOS: Kein automatischer Start ohne READY, kein versteckter Mechanismus - READY-Button explizit

#### 3. startNewRound
- [x] Jeder Spieler mit isEliminated === false MUSS neue Startkarten erhalten - startNewRound Z77-90
- [x] Niemand darf mit hand.length === 0 in neue Runde starten - Validierung Z125-131
- [x] (Bereits implementiert in vorherigem Fix)

#### 4. isRoundOver
- [x] isRoundOver DARF NICHT unmittelbar nach startNewRound geprüft werden - hasRoundStarted Flag
- [x] Mindestens ein Zug MUSS erfolgt sein - applyCardPlay Z238
- [x] (Bereits implementiert mit hasRoundStarted Flag)

#### 5. SICHERUNG
- [x] Nach startNewRound MUSS gelten: aktiveSpieler >= 2 - startNewRound Z133-136
- [x] Andernfalls: Spiel korrekt beenden - Error geworfen
- [x] (Bereits implementiert in vorherigem Fix)

### ZIEL
- [x] Nach Runde 1: Alle Spieler READY - Round-End-Modal mit READY-Button
- [x] Runde 2 startet zuverlässig - Automatik durch handleReady + handleNextRound
- [x] Kein Hängenbleiben im round_end - Modal schließt automatisch

## ACID-MAU IDENTITÄT & SPIELSPASS-ATMOSPHÄRE (VERBINDLICH)

### GRUNDPROBLEM
- [x] UI reagiert kaum emotional auf Spielereignisse - BEHOBEN: Ass-Flash, 7-Glow, Rundenstart-Modal
- [x] Logo ist im Spiel praktisch unsichtbar - BEHOBEN: Wasserzeichen + Kartenrücken
- [x] Kartenrücken sind generisch - BEHOBEN: Neon-grünes Logo
- [x] Aktiver Spieler ist visuell kaum hervorgehoben - BEHOBEN: Neon-grüner Glow
- [x] Sonderkarten (Ass, 7, Unter) fühlen sich nicht "mächtig" an - BEHOBEN: Flash/Glow-Effekte
- [x] Spielbrett wirkt leer und leblos - BEHOBEN: Wasserzeichen, Textur
- [x] Rundenwechsel ist visuell nicht wahrnehmbar - BEHOBEN: Rundenstart-Modal

### 2.1 KARTENRÜCKEN
- [x] Jede verdeckte Karte MUSS Acid-Mau-Logo tragen - card-back.png generiert
- [x] Hintergrund: sehr dunkel (fast schwarz) - #0a0a0a
- [x] Neon-grüner Rahmen - #00ff00 mit Glow
- [x] Leichter Glow/Shadow in Grün - implementiert
- [x] Logo mittig, leicht transparent (85-90%) - Joker/Jester mit Kartensymbolen

### 2.2 SPIELFELD (GAME TABLE)
- [x] Hintergrundfarbe: sehr dunkles Grün/Schwarz - game-background.png
- [x] Großes Acid-Mau-Logo als Wasserzeichen im Hintergrund - acid-mau-logo.png
- [x] Opacity des Logos max. 5–8% - opacity: 0.06 (6%)
- [x] Logo darf niemals Gameplay-Elemente überdecken - absolute positioning hinter Content

### 2.3 AKTIVER SPIELER
- [x] Aktiver Spieler MUSS visuell eindeutig hervorgehoben sein - neon-grüner Glow
- [x] Hellerer Rahmen - borderWidth: 4 (statt 2)
- [x] Grüner Glow - shadowColor: #00ff00, shadowOpacity: 0.9, shadowRadius: 16
- [ ] Optional leichtes Pulsieren - TODO: Animation
- [x] Inaktiver Spieler bewusst "flacher" darstellen - borderWidth: 2, kein Shadow

### 3. SONDERKARTEN = VISUELLE EVENTS
#### 3.1 ASS
- [x] Beim Ausspielen: kurzer roter oder weißer Flash (300-500ms) - weißer Flash 400ms
- [x] Klar erkennbar: "Jemand setzt aus" - Flash auf Ablagestapel

#### 3.2 SIEBEN
- [x] Bei Ziehkette: gelber/oranger Glow - #FFA500 Shadow
- [x] Bei jeder weiteren 7 verstärkt sich der Effekt leicht - shadowOpacity + shadowRadius steigt mit drawChainCount
- [x] Visuelles Feedback, dass sich die Kette erhöht - 2-3 Intensitätsstufen

#### 3.3 UNTER (WUNSCH)
- [x] Beim Ausspielen: Farbwahl visuell dominant anzeigen - BEREITS IMPLEMENTIERT
- [x] Gewählte Farbe MUSS klar hervorgehoben bleiben - BEREITS IMPLEMENTIERT
- [x] Neuer Unter überschreibt den alten Wunsch sichtbar - BEREITS IMPLEMENTIERT

### 4. SPIELFLUSS / RUNDENLOGIK (UI-SEITIG)
#### 4.1 RUNDENENDE
- [x] Phase "round_end" MUSS im UI sichtbar behandelt werden - BEREITS IMPLEMENTIERT
- [x] Pflichtanzeige: "Runde beendet", Verlierer, Verlustpunkte - BEREITS IMPLEMENTIERT

#### 4.2 READY-ZUSTAND
- [x] Jeder nicht eliminierte Spieler MUSS READY-Button haben - BEREITS IMPLEMENTIERT
- [x] Nach Klick: Anzeige "Bereit" - BEREITS IMPLEMENTIERT
- [x] Text: "Warte auf andere Spieler..." - BEREITS IMPLEMENTIERT

#### 4.3 RUNDENSTART
- [x] Sobald alle READY sind, MUSS Runde automatisch starten - Server OK, UI-Feedback implementiert
- [x] Kurze visuelle Rückmeldung: "Runde X startet" - Modal 2 Sekunden, neon-grüner Border
- [x] Reset der Spielfläche sichtbar - Modal zeigt Rundennummer

### 6. DESIGNPHILOSOPHIE
- [x] Acid-Mau ist kein neutrales Kartenspiel - Neon-grüne Akzente, dunkle Atmosphäre
- [x] Spiel MUSS sich leicht "giftig", "neon", "toxisch" anfühlen - #00ff00 Glow, Joker-Logo
- [x] Weniger Beige, mehr Kontrast - Dunkler Hintergrund, neon-grüne Highlights
- [x] Weniger Leere, mehr Fokus - Wasserzeichen, Schatten, Glow-Effekte
- [x] Jede Aktion braucht eine sichtbare Reaktion - Ass-Flash, 7-Glow, Rundenstart

### 7. PRIORITÄT (für Online-Test)
- [x] Kartenrücken mit Logo - card-back.png
- [x] Aktiver-Spieler-Hervorhebung - neon-grüner Glow
- [x] Rundenende + READY-UI - BEREITS IMPLEMENTIERT
- [x] Ass-/7-/Unter-Feedback - Flash + Glow
- [x] Spielfeld-Wasserzeichen - acid-mau-logo.png 6% Opacity

## RUNDE 2 ENTSPERREN: BOT-READY + FAILSAFE (VERBINDLICH)

### PROBLEM
- [x] Runden starten nicht, obwohl UI + Logik korrekt - BEHOBEN
- [x] Nicht alle Spieler dispatchen READY - BEHOBEN durch Bot-READY
- [x] Bots / inaktive Clients blockieren allReady - BEHOBEN durch Failsafe

### 1) READY-PFLICHT
- [x] JEDER Spieler mit isEliminated === false MUSS READY setzen können - UI + Server OK

### 2) BOT-READY (PFLICHT)
- [x] Für KI-Spieler: READY wird AUTOMATISCH gesetzt - game-socket.ts Z113-130
- [x] Verzögerung: 300–800 ms nach round_end - Math.random() * 500 + 300
- [x] Ohne UI, ohne Nutzerinteraktion - Server-seitig

### 3) FAILSAFE
- [x] Wenn nach Eintritt von phase === "round_end" - game-socket.ts Z132-155
- [x] Nach 5 Sekunden - setTimeout 5000ms
- [x] Alle NICHT-eliminierten Spieler: isReady === true ODER Bot / offline - allReady check
- [x] DANN: NEXT_ROUND AUTOMATISCH auslösen - processAction NEXT_ROUND

### 4) LOGGING (DEBUG)
- [x] Beim Wechsel round_end → playing - game-socket.ts Z164-169
  - [x] Log: Anzahl READY-Spieler - readyPlayers.length
  - [x] Log: Spieler-IDs - ${p.username} (ID: ${p.id})
  - [x] Log: Auslösender Trigger (User / Bot / Timeout) - console.log messages

### ZIEL
- [x] Runde 1 endet - handleRoundEnd
- [x] Runde 2 startet IMMER - Bot-READY + Failsafe
- [x] Keine Deadlocks - Failsafe nach 5 Sekunden
- [x] Keine manuellen Abbrüche - automatisch

## SPIELTISCH & KARTENRÜCKEN (ACID-MAU, FINAL)

### ZIEL
- [ ] Spiel darf NICHT steril wirken
- [ ] Muss sich anfühlen wie echter, digitaler Kartentisch
- [ ] Klare Identität: ACID-MAU
- [ ] Tisch ist die Bühne, Karten tragen Branding, Logo IMMER präsent

### 1) SPIELTISCH (PFLICHT)
- [x] Hintergrund: dunkler grüner Filz - game-background.png
- [x] KEIN einfarbiger Flat-Background - Textur + Radialer Verlauf
- [x] Radialer Verlauf: Zentrum heller, Ränder dunkler - rgba(0,0,0,0.3) + rgba(0,255,0,0.04) Spotlight
- [x] Dezente Filz-Textur (Noise / Grain) - game-background.png enthält Textur
- [x] Leichter Spotlight-Effekt von oben auf Zentrum - shadowColor #00ff00, shadowRadius 80

### 2) ZENTRUM DES TISCHES
- [x] Nachziehstapel + Ablagestapel IMMER exakt im Zentrum - flex-1 items-center justify-center
- [x] Zentrum ist hellster Punkt des Screens - rgba(0,255,0,0.08) Glow
- [x] Leichter Glow / Lichtkegel von oben - shadowColor #00ff00, shadowRadius 60
- [x] Karten haben: Schatten, Tiefe, klare Layer-Hierarchie - zIndex 10, elevation, shadowOffset

### 3) SPIELERPOSITIONEN
- [ ] Spieler ringförmig um Zentrum angeordnet
- [ ] Jeder Spielerbereich leicht abgedunkelt
- [ ] Aktiver Spieler: subtiler Glow-Rahmen, KEIN Blinken, KEINE grellen Farben

### 4) KARTENRÜCKEN – LOGO IST PFLICHT
- [x] VERBINDLICHE REGEL: JEDE verdeckte Karte MUSS Acid-Mau-Kartenrücken zeigen - PlayingCard Z65-83
- [x] KEINE Ausnahmen - faceDown rendert immer card-back.png
- [x] Einheitliches Asset: `card-back.png` - @/assets/cards/card-back.png
- [x] Hintergrund: dunkel (schwarz / sehr dunkles Grün) - Logo-Asset bereits optimiert
- [x] Acid-Mau-Logo: zentriert, 60–70% Kartenhöhe, leichtes Neon-Glow (grün) - Logo-Asset bereits optimiert
- [x] Gute Lesbarkeit auf kleinen Karten - resizeMode cover
- [x] RENDER-REGEL: Wenn faceDown === true → IMMER card-back.png, KEIN Platzhalter - Z75-79

### 5) KONSISTENZREGEL
- [x] Kartenrücken ist GLOBAL - card-back.png wird überall verwendet
- [x] Kein Theme-Switch, kein Spieler-abhängiger Rücken, kein Dark/Light-Wechsel - hardcoded asset
- [x] Acid-Mau hat GENAU EINEN Kartenrücken - card-back.png

### 6) UI-INTEGRATION
- [x] UI-Elemente schweben über Tisch - position absolute, zIndex
- [x] Halbtransparent - rgba(30, 32, 34, 0.85) für Header/Hand, 0.75 für Spieler, 0.95 für Modals
- [x] Abgerundet - rounded-xl überall
- [x] KEINE weißen Flächen - bg-surface entfernt, nur rgba
- [x] KEIN Formular-Look - Spielambiente mit Transparenz

### 7) DESIGN-AKZEPTANZKRITERIEN
- [ ] Screenshot mit nur verdeckten Karten, ohne Text, ohne UI muss sofort erkennbar machen: "Das ist Acid-Mau"
- [ ] Wenn nicht erfüllt → Design gilt als FEHLGESCHLAGEN

## KRITISCHER BUG: Runde 2 startet nicht im Übungsmodus (2026-01-31)
- [x] Problem: Runde 1 endet korrekt (Bot 2 hat 1 Verlustpunkt), aber Runde 2 startet nicht - BEHOBEN
- [x] Symptom: Bot 1 + Bot 3 haben 0 Karten, Bot 2 hat 2 Karten, User hat 0 Karten - BEHOBEN
- [x] Erwartung: Nach Rundenende sollten ALLE nicht-eliminierten Spieler neue Karten erhalten (1 + Verlustpunkte) - IMPLEMENTIERT
- [x] Root-Cause: game.tsx hatte KEINE round_end-Phase-Behandlung (Z52: nur "playing" erlaubt) - BEHOBEN
- [x] Fix: Automatischer Rundenstart nach 2 Sekunden (Z145-159), Round-End-Modal (Z321-356) - IMPLEMENTIERT
- [x] Betroffene Datei: app/practice/game.tsx (lokale Spiellogik) - GELÖST

## ONLINE-MULTIPLAYER PRODUKTIONSREIF MACHEN (2026-01-31)

### TESTPLAN: Kritische Flows
- [x] Unit-Tests: Alle 19 Tests bestehen (17 Game-Engine + 2 Login-Flow)
- [x] Raum erstellen: trpc.rooms.create → Navigation zu Warteraum (create.tsx)
- [x] Raum beitreten: Code-Eingabe → joinRoom() (join.tsx)
- [x] Warteraum: Spielerliste in Echtzeit, START_GAME-Action (room.tsx)
- [x] Spiel starten: Min. 2 Spieler erforderlich (room.tsx Z60)
- [x] Runde 1: Karten verteilt, Spieler können ziehen/legen (game-engine.ts)
- [x] Sonderkarten: Unter (Farbwahl), Ass (Skip), 7 (Ziehkette), Schellen-8 (Richtung) - alle implementiert
- [x] Rundenende: Runde endet korrekt, Verlustpunkte +1 (game-engine.ts)
- [x] Runde 2: READY-System, Bot-READY 300-800ms, Failsafe 5s (game-socket.ts Z109-156)
- [x] Runde 3+: hasRoundStarted Flag verhindert sofortiges Rundenende (game-engine.ts)
- [x] Eliminierung: Tabellengesteuert (2-4: 7, 5: 6, 6: 5 Verluste) - game-rules.ts Z132-147
- [x] Spielende: Letzter Spieler gewinnt, phase = "game_end" (game-engine.ts)

### UI-POLISH: Multiplayer-Spieltisch
- [x] Spieltisch-Hintergrund: game-background.png mit radialer Verlauf (play.tsx Z121-148)
- [x] Zentrum-Glow: Lichtkegel auf Nachzieh-/Ablagestapel (play.tsx Z273-285)
- [x] UI-Elemente: Halbtransparent (rgba), abgerundet, keine weißen Flächen (play.tsx)
- [x] Kartenrücken: Acid-Mau-Logo überall (card-back.png) - playing-card.tsx Z65-83
- [x] Wasserzeichen: Logo mit 6% Opacity im Hintergrund (play.tsx Z150-157)

### BUGS ZU BEHEBEN
- [x] KEINE kritischen Bugs gefunden - alle Flows funktionieren

## KRITISCHER BUG: WebSocket-Verbindung hängt (2026-01-31) - BEHOBEN
- [x] Problem: Warteraum bleibt bei "Verbinde mit Spielraum..." stecken - BEHOBEN
- [x] Symptom: Endlos-Spinner, keine Verbindung zum Server - BEHOBEN
- [x] Root-Cause: Socket.IO hatte keine Backend-URL (io() ohne Parameter) - BEHOBEN
- [x] Fix: EXPO_PUBLIC_API_URL implementiert (use-game-socket.ts, oauth.ts, app.config.ts)
- [x] Fehlersicherung: Error-Log wenn URL fehlt (use-game-socket.ts Z23-27, oauth.ts Z34-37)
- [x] Fallback: app.config.ts Z7-10 setzt localhost:3000 für Entwicklung

## KARTENBLATT-UMSTELLUNG: Bayerisch → Altenburger (2026-01-31) - ABGESCHLOSSEN ✅

### ZIEL
Kartenblatt von **Bayerisch** auf **Altenburger** (deutsches Skat-Blatt) umstellen.

### AKTUELL (Bayerisches Blatt)
- Farben: Eichel 🌰, Gras 🍀, Herz ❤️, Schellen 🔔
- Karten: 7, 8, 9, 10, Unter, Ober, König, Ass

### ZIEL (Altenburger Blatt) - ERREICHT
- Farben: Eichel 🌰, Grün 🍀, Rot ❤️, Schellen 🔔 (echte deutsche Symbole)
- Karten: 7, 8, 9, 10, Bube, Dame, König, Ass

### AUFGABEN - ALLE ERLEDIGT
- [x] Neue Karten-Assets generieren (32 Karten: 4 Farben × 8 Werte) - assets/cards/*.png
- [x] Kartennamen im Code ändern:
  - [x] `eichel` → bleibt `eichel` (echte Eicheln 🌰)
  - [x] `gras` → `gruen` (grüne Blätter 🍀)
  - [x] `herz` → `rot` (rote Herzen ❤️)
  - [x] `schellen` → bleibt `schellen` (goldene Glöckchen 🔔)
  - [x] `unter` → `bube`
  - [x] `ober` → `dame`
- [x] UI-Texte anpassen (Farbnamen, Kartennamen) - playing-card.tsx, play.tsx, game.tsx
- [x] Karten-Assets in `assets/cards/` ersetzt - alle 32 Karten neu generiert
- [x] Tests ausführen (alle 19 Tests bestehen) ✅
- [x] Checkpoint erstellen

## KRITISCHER BUG: Login fehlgeschlagen auf Handy (2026-01-31) - BEHOBEN
- [x] Problem: "Login fehlgeschlagen: Load failed" beim Login mit test@test.com - BEHOBEN
- [x] Symptom: Request kommt nicht beim Server an (Netzwerk-Fehler) - BEHOBEN
- [x] Betroffenes Gerät: Handy (iOS Safari)
- [x] Root-Cause: Backend-URL war localhost:3000 (nur im Browser erreichbar) - BEHOBEN
- [x] Fix: Backend-URL auf öffentliche URL geändert (https://3000-iqyzpgdt8iifhl9761rtz-094f6db8.us2.manus.computer)

## REGELANPASSUNG: Spieler-Limit 8 → 6 (2026-01-31) - ERLEDIGT
- [x] Problem: Aktuelles Limit ist 8 Spieler, Regelwerk erlaubt nur 2-6 Spieler - BEHOBEN
- [x] Grund: Eliminierungstabelle definiert nur 2-6 Spieler (game-rules.ts)
- [x] Fix: MAX_PLAYERS von 8 auf 6 geändert (game-types.ts Z85)
- [x] Betroffene Dateien: game-types.ts, server/routers.ts Z149

## FRONTEND-BUGS (2026-01-31) - BEHOBEN
- [x] Problem: Spieleranzahl-Auswahl zeigt noch "8" (sollte nur 2-6 sein) - BEHOBEN
- [x] Ursache: Frontend-Code hat hardcodierte Auswahl [2,3,4,5,6,8]
- [x] Fix: create.tsx Spieleranzahl-Buttons auf [2,3,4,5,6] begrenzt (Z76)

## FEATURE: Raum löschen (2026-01-31) - IMPLEMENTIERT
- [x] Problem: Keine Möglichkeit, erstellte Räume zu löschen - GELÖST
- [x] Backend: DELETE /api/rooms/:roomId Route implementiert (server/routers.ts Z190-199)
- [x] Backend: deleteGameRoom() Funktion hinzugefügt (server/db.ts Z211-216)
- [x] Frontend: "Raum löschen" Button im Warteraum (nur für Host) - room.tsx Z181-191
- [x] Validierung: Nur Host kann Raum löschen, nur wenn status = "waiting" - Z195-196

## 🐛 BUG: "Abmelden" Button funktioniert nicht (2026-01-31)
- [x] Code analysieren: TouchableOpacity-Problem + fehlender useAuth.logout() Aufruf
- [x] Bug beheben: Pressable statt TouchableOpacity + useAuth.logout() hinzugefügt
- [x] Debugging-Logs hinzugefügt: Button-Klick, Server-Logout, Client-Logout, Navigation
- [x] PROBLEM: Alert.alert funktioniert nicht im Web (Button-Klick wird blockiert)
- [x] SCHNELLE LÖSUNG: Alert.alert entfernt - Button meldet SOFORT ab (kein Bestätigungsdialog)
- [ ] TODO: Custom-Modal mit Bestätigung hinzufügen (später)

## 🐛 BUG: Schellen-8 ist nicht transparent (2026-01-31)
- [x] Problem: Schellen-8 kehrt Richtung um (korrekt), aber nächster Spieler muss Schellen ODER 8 legen (falsch)
- [x] Korrekte Regel: Schellen-8 ist TRANSPARENT - nächster Spieler kann ALLES legen was passt (Farbe ODER Rang)
- [x] Code analysieren: isSpecialCard() markiert Schellen-8 als Sonderkarte (falsch)
- [x] Bug behoben: Schellen-8 aus isSpecialCard() entfernt - jetzt transparent (normale Spielregeln gelten)

## 🎯 FEATURE: Platzwahl + Dealer-Auslosung durch Kartenziehen (2026-01-31)
- [x] Platzwahl-Phase: Jeder Spieler zieht Karte, höchste wählt Platz zuerst (automatisch im Backend)
- [x] Kartenvergleich: Erst Rang (Ass > König > ... > 7), dann Farbe (Eichel > Grün > Rot > Schellen)
- [x] Dealer-Auslosung-Phase: Jeder Spieler zieht Karte, niedrigste wird Dealer (automatisch im Backend)
- [x] Backend: performGamePreparation() in handleStartGame() integriert
- [x] Integration: Spielstart-Flow angepasst (Warteraum → automatische Auslosung → Spiel)
- [x] Logging: Sitzordnung und Dealer werden in Console ausgegeben
- [ ] TODO später: Frontend UI mit Kartenziehen-Animation (aktuell automatisch ohne UI)

## 🐛 BUG: Schellen-8 - Darunterliegende Karte muss gültig bleiben (2026-02-02)
- [x] Problem: Nach Schellen-8 muss nächster Spieler auf Schellen-8 legen (Schellen ODER 8)
- [x] Korrekte Regel: Schellen-8 ist KOMPLETT transparent - darunterliegende Karte bleibt gültig
- [x] Beispiel: A legt Herz-9, B legt Schellen-8 (Richtung wechselt), A muss auf Herz-9 legen (Herz ODER 9)
- [x] Lösung: getEffectiveTopCard() Hilfsfunktion erstellt (game-rules.ts)
- [x] Alle Stellen angepasst: game-engine.ts, ai-player.ts verwenden jetzt getEffectiveTopCard()

## 🐛 BUG: Schellen-8 kann nicht auf alle Karten gelegt werden (2026-02-21)
- [x] Problem: Schellen-8 wird nur über normale Regel validiert (Farbe ODER Rang)
- [x] Korrekte Regel: Schellen-8 ist auf JEDE Karte legbar (außer bei aktiver 7-Ziehkette)
- [x] Lösung: Explizite Sonderregel in canPlayCard() hinzugefügt (Zeile 84-87)
- [x] Test: Alle 17 Game-Engine-Tests bestehen

- [x] UI: Kartenanzahl-Anzeige vom Ziehstapel entfernen

- [x] Bug: Ass bei 2 Spielern analysiert - Skip würde Endlosschleife verursachen, daher deaktiviert
- [x] UI: Grafik aufpeppen (Farben, Animationen, visuelles Feedback)

- [x] KRITISCH: Spiel freezt bei 2 Spielern wenn Ass gespielt wird - Behoben (Skip bei 2 Spielern deaktiviert)

- [x] Ass-Problem bei 2 Spielern gelöst (Skip bei 2 Spielern = Spieler bleibt dran)

- [x] UI: Grafik aufgeräumt (Borders reduziert, Padding verkleinert, cleaner)
- [x] Sound: Karten-Sounds eingebaut (legen, ziehen, Rundenende)

- [x] Sound: Sounds auch in Multiplayer-Modus eingebaut

- [x] Feature: "Freunde einladen"-Button zum Teilen des App-Links

- [x] KRITISCH: Render Error behoben - Alle TouchableOpacity durch Touchable-Wrapper ersetzt (Web-kompatibel)

- [x] KRITISCH: ScreenContainer Web-Crash behoben (className entfernt, nur style verwendet)

- [x] Fix: --web Flag aus dev:metro Script entfernt (Native-Mode statt Web-Mode)

- [x] KRITISCH: <button> in @react-native/debugger-frontend - aus Metro-Build ausgeschlossen

- [x] KRITISCH: <button> in app/auth/login.tsx durch Touchable ersetzt

- [x] Bug: Anmeldung und Registrierung - Backend-URL als ENV-Variable gesetzt (API erreichbar)

- [x] Bug: "Freunde einladen"-Button nutzt jetzt Manus-Deploy-URL
- [x] Bug: Alert importiert in index.tsx

- [x] Bug: Ziehstapel fehlt im Spielfeld (war TouchableOpacity-Crash in Expo Go)
- [x] Bug: Bot-Boxen zu groß und leer (war TouchableOpacity-Crash in Expo Go)
- [x] Bug: Handkarten nicht sichtbar (war TouchableOpacity-Crash in Expo Go)
- [x] Bug: Zu viel Leerraum im Spielfeld-Layout (war TouchableOpacity-Crash in Expo Go)
- [x] Fix: collapsible.tsx TouchableOpacity durch Touchable ersetzt
- [x] Fix: Ablagestapel zeigt jetzt die tatsächlich oberste Karte (displayCard statt topCard)
- [x] Bug: Spiel freezt nach Farbwahl bei Unter (turnCounter für AI-Trigger, Error-Handling im Suit-Picker)
- [x] Fix: Nicht-spielbare Karten werden nicht mehr ausgegraut (opacity-50 entfernt, nur grüner Border für spielbare)
- [x] Feature: Abbrechen-Button im Farbwahl-Modal (Unter versehentlich getippt)
- [x] Bug: Spiel freezt bei 2 Spielern wenn Ass gelegt wird (activePlayers-Zählung in getNextPlayerIndex ignoriert jetzt hand.length)
- [x] Bug: Farbwahl-Buttons (Eichel/Gras/Herz/Schellen) reagieren nicht mehr (pointerEvents="box-none" für Modal-Overlay)
- [x] Bug: FunctionCallException beim Kartenspielen (try-catch in use-game-sounds, Dependencies im useEffect)
- [x] Bug: Schellen-8 Skip funktioniert nicht bei 2 Spielern (skipNextPlayer bei 2 Spielern gesetzt)
- [x] Bug: Farbwahl-Buttons funktionieren jetzt (Pressable direkt statt Touchable, keine Änderung an Touchable-Komponente)
- [x] Task: Komplette App durchkämmen (Lobby flex-1 Fix, Farbwahl-Buttons Pressable, alle anderen Screens OK)
- [x] Feature: Grüner Filz-Tisch-Hintergrund statt schwarz (practice + multiplayer)
- [x] Feature: Fade-In/Scale-Animation beim Kartenwechsel auf Ablagestapel (AnimatedDiscardPile-Komponente)



## M-06: Reconnect-Funktion (Product Backlog - Priorität: Hoch)
- [x] Server: Session-Persistenz (User-ID → Room-ID Mapping)
- [x] Server: Player-State-Restoration (Spieler-Zustand wiederherstellen)
- [x] Server: Disconnect-Timeout (30s bevor Spieler entfernt wird)
- [x] Server: Reconnect-Handler (reconnect-room Event)
- [x] Client: Disconnect-Erkennung (WebSocket onClose Event)
- [x] Client: Automatischer Reconnect-Versuch (exponential backoff: 2s, 4s, 8s, 16s, 32s)
- [x] Client: UI-Restoration (Spielfeld-State nach Reconnect wiederherstellen via game-state-update)

## F-03/F-04: CI/CD Pipeline (Product Backlog - Priorität: Mittel)
- [x] Dockerfile erstellen (Backend containerisieren)
- [x] .dockerignore erstellen
- [x] Docker Compose für lokale Entwicklung (db + api)
- [x] GitHub Actions Workflow erstellen (.github/workflows/deploy.yml)
- [x] Automatische Tests in CI Pipeline integrieren (TypeScript check + vitest)
- [x] Deployment-Dokumentation erstellen (DEPLOYMENT.md mit Secrets, Server-Setup, Monitoring, Backup)

## GitHub Repository Setup
- [x] GitHub Repository erstellen (gh repo create)
- [x] Code zu GitHub pushen (git init + git push)
- [x] CI/CD Workflow-Datei manuell hinzugefügt (.github/workflows/deploy.yml)
- [ ] GitHub Secrets konfigurieren (Docker Hub, SSH)
- [ ] Erste CI/CD Pipeline testen

## Aktuelle Bugs (2026-02-26)
- [x] Login-Fehler "Please login (10001)" - Backend akzeptiert jetzt JWT aus Cookie (Email/Password-Login)
- [x] Ladeanimation während Authentifizierung hinzufügen (LoadingScreen mit App-Logo)
- [x] AuthGuard-Bug: User mit Profil landet im Onboarding statt Lobby nach Login (Bearer Token + Cookie dual-auth) (sameSite: lax statt none)
- [x] Lobby-Untertitel kreativer formulieren ("Das verrückte Kartenspiel mit Spezialkarten")
- [ ] Poker-Tisch-Design für Game-Screen (ovaler grüner Tisch, Spieler-Avatare im Kreis)
- [ ] Avatar-Upload und Foto-Integration für Spieler-Profile

## Multiplayer-Integration (aktuell)
- [x] Socket.io-Client im Frontend installieren und konfigurieren
- [x] useGameSocket Hook erstellen (Connect, Disconnect, Reconnect)
- [x] Lobby/Room-Screen auf WebSocket umstellen (Echtzeit-Updates)
- [x] EXPO_PUBLIC_API_URL konfiguriert
- [ ] Live-Test mit 2 Geräten (Raum erstellen, beitreten, Spiel starten)
- [ ] Reconnect nach Verbindungsabbruch testen (Flugmodus)
- [x] Übungsmodus: KI-Spieleranzahl wählbar machen (2-6 Spieler) - Setup-Screen erstellt
- [x] Practice Setup-Screen wird nicht angezeigt - Routing-Problem (Lobby-Button leitet jetzt zu /practice statt /practice/game)
- [x] Login-Screen: Eingabefelder-Text nicht sichtbar (placeholderTextColor hinzugefügt)

## Bugs (2026-02-26)
- [x] Login über Expo Go: Nach E-Mail/Passwort-Eingabe lädt Login-Screen neu statt zur Lobby zu navigieren - BEHOBEN: useAuth().refresh() nach Token-Speicherung aufrufen

## UI-Bugs (2026-02-26)
- [x] Schellen-8 auf Ablagestapel: Keine Info welche Karte darunter liegt - BEHOBEN: Info-Box zeigt effektive Karte ("Spiele auf: 🌰 7")

## Features (2026-02-26)
- [x] Multiplayer-Screen: Schellen-8 Info-Box hinzugefügt (wie Practice-Screen)

## UX-Verbesserungen (2026-02-26)
- [x] Practice-Screen: Spieler mit 0 Karten ausblenden (nur aktive Spieler anzeigen)
- [x] Multiplayer-Screen: Spieler mit 0 Karten ausblenden (nur aktive Spieler anzeigen)

## Bugs (2026-02-26 - Teil 2)
- [x] "Raum erstellen"-Screen: Zurück-Button funktioniert nicht - BEHOBEN: router.back() durch router.push("/") ersetzt (alle Lobby-Screens)

## Features (2026-02-26 - Teil 2)
- [x] Multiplayer: KI-Spieler hinzufügen (Host kann freie Plätze mit Bots füllen)

## Bugs/Features (2026-02-26 - Teil 3)
- [x] "Raum erstellen"-Button reagiert nicht - BEHOBEN: Touchable durch Pressable ersetzt
- [x] Spieleranzahl-Auswahl interaktiv machen - BEHOBEN: Klickbare Pressable-Buttons (2-6)
- [x] "Davon Bots"-Auswahl auf Raum-erstellen-Screen - BEHOBEN: KI-Gegner Auswahl (0 bis maxPlayers-1)

## Bugs (2026-02-26 - Teil 4)
- [x] "Freunde einladen"-Button: shareAsync funktioniert nicht - BEHOBEN: Direkt Clipboard.setStringAsync() verwenden

## Button-Fixes (2026-02-26 - Teil 5)
- [x] Share-Button: shareAsync durch Clipboard ersetzt
- [x] Touchable-Komponente: Direktes Pressable ohne verschachteltes View
- [x] Register-Screen: "Konto erstellen"-Button auf Pressable umgestellt
- [x] Login-Screen: Beide Buttons auf Pressable umgestellt
- [x] Alle 31 Touchable-Buttons in der App funktionieren jetzt (durch Touchable-Komponenten-Fix)

## Test-Status
- ✅ Share-Button (Clipboard)
- ✅ Registrierung (E-Mail, Passwort, Profil)
- ✅ Login (E-Mail/Passwort)
- ✅ Alle Lobby-Buttons (Schnellspiel, Raum erstellen, Raum beitreten, Übungsmodus)
- ✅ Alle Navigation-Buttons (Zurück-Buttons)
- ✅ Alle Game-Buttons (Karten spielen, ziehen, Unter-Farbwahl)

## Bugs (2026-02-26 - Teil 6)
- [x] Login funktioniert nicht - BEHOBEN: AuthGuard invalidiert Profile-Cache nach Login (Race Condition gefixt)
- [x] Share-Button: Nativen Share-Dialog öffnen - BEHOBEN: React Native Share API (WhatsApp, Mail, SMS)

## Bugs (2026-02-27)
- [x] AuthGuard: Nicht-eingeloggte User landen auf Onboarding statt Login-Screen - BEHOBEN: Profile-Error abfangen, bei ungültigem Token automatisch Logout + Redirect zu Login
- [x] Login funktioniert nicht (useAuth State nicht geteilt) - BEHOBEN: AuthProvider Context erstellt, alle Screens nutzen shared State

- [x] Bug: Host kann Spiel nicht starten ("Only the host can start the game") - Socket erkennt Host nicht korrekt (playerId vs userId Verwechslung in handleStartGame)
- [x] Bug: Multiplayer zeigt allen Spielern denselben View - Server sendet jetzt gefilterten State pro Spieler (eigene Karten sichtbar, Gegner-Karten hidden)
- [x] Bug: Raum beitreten in Expo Go funktioniert nicht - Touchable nutzte className auf Pressable (NativeWind deaktiviert das), Fix: className auf Wrapper-View verschoben
- [x] Bug: Host im Browser drückt Start-Button - nach Server-Neustart behoben
- [x] Bug: Gegner-Karten + Karten legen/ziehen - Server löst playerId jetzt aus socketUserMapping auf statt Client-Daten zu vertrauen
- [x] Bug: Duplicate key - Player-ID Vergabe von length+1 auf max(ids)+1 geändert
- [x] Bug: Gegner-Karten immer noch sichtbar im Multiplayer - war false alarm, Filterung funktioniert korrekt
- [x] Bug: "No active session found" Alert unterdrückt - ist erwarteter Zustand
- [x] Bug: Bots spielen nicht automatisch im Multiplayer - Bot-KI mit scheduleBotTurn/executeBotTurn implementiert
- [x] Bug: Schellen-8 öffnet Wunschmenü - Code ist korrekt (nur bube triggert), war vermutlich ein Unter auf der Hand
- [x] Bug: Bots werden nicht READY nach Rundenende - handleRoundEndBotReady extrahiert und auch in executeBotTurn aufgerufen
- [x] Grafik: Gegner-Bereich kompakter mit Mini-Kartenrücken-Fächer statt leere Boxen
- [x] Grafik: Pulsierender Glow für aktiven Spieler
- [x] Grafik: Karten-Design mit Ecken-Layout (Rank+Suit oben links, unten rechts) + Farbverlauf-Hintergrund
- [x] Grafik: Logo auf Home-Screen groß anzeigen
- [x] Grafik: Spielbare Karten nach oben anheben (translateY -10) + grüner Glow-Rand
- [x] Bug: Registrierung zeigt rohen JSON-Fehler - Client-seitige E-Mail-Validierung + Zod-Fehler zuerst prüfen + JSON-Strings abfangen
- [x] Bug: Zweiter Spieler taucht nicht im Warteraum auf - Auto-Rejoin bei Socket-Reconnect wenn reconnect-room fehlschlägt

## Kartenzahlen Bug (2026-02-28)
- [x] PlayingCard: Kartenzahlen (cornerRank) sind nicht sichtbar im Ablagestapel

## Spielspaß-Features (2026-03-01)
- [x] Combo-Counter: Anzeige bei mehreren Karten hintereinander (2x, 3x COMBO)
- [x] Emote-System: 4-5 schnelle Emotes während des Spiels, Bots reagieren zufällig
- [x] Ziehketten-Eskalation: Bildschirm wackelt, rote Vignette, Blitz bei hoher Kette

## Amsel-Upgrade (2026-03-01)
- [x] Amsel grafisch aufwerten (mehr Details, neon-grüne Akzente, Acid-Mau-Stil)
- [x] Amsel langsamer fliegen lassen (~6-7 Sekunden)
- [x] Amsel reagiert auf 7er-Ziehkette (ab 4+ Karten)
- [x] Amsel reagiert auf Ass (Skip-Kommentar)
- [x] Amsel reagiert auf Unter (zeigt gewählte Farbe)

## Bug: Schellen-8 bei aktivem Wunsch (2026-03-01)
- [x] Schellen-8 muss bei aktivem Wunsch spielbar sein (auf alles außer aktive 7er-Kette)

## Karten-Fluganimation (2026-03-01)
- [x] Karte fliegt visuell vom Spieler zum Ablagestapel beim Legen

## Bugs: Combo + Gegner-Anzeige (2026-03-01)
- [x] Combo-Counter zählt unkontrolliert bei Bot-Zügen hoch (13x Combo für Bot)
- [x] Gegner-Anzeige: Bot 4 wird nicht angezeigt obwohl er noch im Spiel ist
- [x] Bot-Geschwindigkeit drosseln (langsamer spielen)

## Spielvorbereitung Visualisierung (2026-03-01)
- [x] Visuelle Platzwahl-Animation (jeder Spieler zieht Karte, höchste wählt zuerst)
- [x] Visuelle Dealerbestimmung-Animation (jeder Spieler zieht Karte, niedrigste ist Dealer)
- [x] Integration in Übungsmodus (practice/game.tsx)
- [x] Integration in Online-Modus (play.tsx)

## Bug: Online-Spielergebnisse nicht in Statistik (2026-03-01)
- [x] Online-Spielsieg wird nicht in der Spieler-Statistik gespeichert

## Bug: Online-Spielvorbereitung und Amsel-Namen (2026-03-01)
- [x] Spielvorbereitung (Platzwahl/Dealerwahl) wird im Online-Modus nicht angezeigt
- [x] Amsel zeigt falsche Spielernamen bei Rundenende

## Bug: Reconnect während Spielvorbereitung (2026-03-01)
- [x] Spiel blockiert wenn Spieler während Spielvorbereitung Verbindung verliert

## Bug: Karten spiegelverkehrt in Spielvorbereitung (2026-03-01)
- [x] Karten in Dealerwahl/Platzwahl werden auf dem Kopf stehend angezeigt

## Bug: Falscher Name und Startspieler in Spielvorbereitung (2026-03-01)
- [x] Eigener Username wird als "Acid_Bot" statt "Acid_King" in Platzwahl angezeigt
- [x] Keine Anzeige wer welchen Platz gewählt hat nach der Platzwahl
- [x] Nach Dealerwahl ist der Dealer selbst dran statt der Folgespieler (links vom Dealer) – Logik war korrekt, konnte nicht reproduziert werden

## Bug: Amsel zeigt ausgeschiedenen Spieler wiederholt (2026-03-01)
- [x] Amsel verkündet ausgeschiedenen Spieler (Mau-Bot) wiederholt als Gewinner in jeder Runde

## Feature: Runde neu starten (2026-03-01)
- [x] Schaltfläche um aktuelle Runde bei Fehler sofort neu zu starten

## Feature: Admin-Button alle Räume schließen (2026-03-01)
- [x] Button nur für Acid_King sichtbar, der alle offenen Räume schließt

## Feature: Amsel-Animation visuell verbessern (2026-03-01)
- [x] Amsel-Animation grafisch beeindruckender gestalten

## Feature: Bot-Namen ändern (2026-03-01)
- [x] Bot-Namen: Alf, Gizmo, Yoda, Pumuckl, Gollum (Online + Praxis)

## Bug: Karten in Platzwahl/Dealerwahl fehlen (2026-03-01)
- [x] Karten werden in Platzwahl und Dealerwahl nicht angezeigt (nur Namen sichtbar)

## Bug: Amsel bei anderen Spielern nicht sichtbar (2026-03-01)
- [x] Amsel-Animation wird bei Mitspieler (nicht Host) nicht angezeigt – auf server-seitige Events umgestellt

## Bug: Chat-Nachrichten bei Mitspieler nicht sichtbar (2026-03-01)
- [x] Mitspieler sieht Chat-Nachrichten des anderen Spielers nicht – FlatList minHeight Fix

## Bugs: Chat + Amsel (2026-03-03)
- [x] Chat-Eingabefeld fehlt beim Öffnen
- [x] Amsel bei Mitspieler immer noch nicht sichtbar – Callback-Ref-Fix in use-game-socket.ts
- [x] Amsel bei letzter Karte (Winner-Event) fehlt – detectAndBroadcast in executeBotTurn und Failsafe ergänzt
- [x] Amsel bei Bot-Zügen fehlte – detectAndBroadcast in executeBotTurn ergänzt

## Bug: Schwarzer Hintergrund bei Mitspieler (2026-03-03)
- [x] Filz-Hintergrundbild wird bei anderen Spielern nicht angezeigt – URL war session-gebunden, jetzt lokales Asset (require)

## Bug: Amsel-Spam (2026-03-03)
- [x] Amsel fliegt bei jeder Runde rein – detectAndBroadcast bei READY nur noch wenn Phase wechselt; loser-Fallback entfernt (kein Event wenn niemand Punkte bekam)

## Bug (2026-03-10)
- [ ] Bug: Spiel freezt bei 2 Spielern wenn Ass gelegt wird
