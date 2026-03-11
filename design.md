# Acid-Mau Mobile App - Interface Design

## Designphilosophie

Die Acid-Mau App folgt den **Apple Human Interface Guidelines (HIG)** und orientiert sich an modernen iOS-Spielen. Das Design ist für **mobile Portrait-Orientierung (9:16)** und **einhändige Bedienung** optimiert.

## Farbschema

### Primärfarben
- **Primär (Accent)**: `#0a7ea4` - Für Buttons, aktive Elemente und Highlights
- **Hintergrund (Hell)**: `#ffffff` - Haupthintergrund im Light Mode
- **Hintergrund (Dunkel)**: `#151718` - Haupthintergrund im Dark Mode
- **Oberfläche (Hell)**: `#f5f5f5` - Karten und erhöhte Flächen im Light Mode
- **Oberfläche (Dunkel)**: `#1e2022` - Karten und erhöhte Flächen im Dark Mode

### Spielfarben (Kartenfarben)
- **Eichel**: `#8B4513` (Braun)
- **Gras/Grün**: `#228B22` (Grün)
- **Herz**: `#DC143C` (Rot)
- **Schellen**: `#FFD700` (Gold)

### Statusfarben
- **Erfolg**: `#22C55E` - Gewonnene Runden
- **Warnung**: `#F59E0B` - Verlustpunkte
- **Fehler**: `#EF4444` - Eliminierung

## Screen-Liste

### 1. Onboarding / Welcome Screen
**Zweck**: Erstmalige Begrüßung neuer Spieler

**Inhalt**:
- App-Logo (zentral)
- Willkommenstext "Willkommen bei Acid-Mau"
- Kurze Beschreibung (1-2 Sätze)
- Button "Loslegen"

**Layout**: Vertikal zentriert, minimalistisch

---

### 2. Home Screen (Tab: Home)
**Zweck**: Haupteinstiegspunkt für alle Spielaktionen

**Inhalt**:
- Benutzername und Avatar (oben)
- Premium-Badge (falls vorhanden)
- Hauptaktionen:
  - "Schnelles Spiel" (großer Button)
  - "Privates Spiel erstellen" (Button)
  - "Spiel beitreten" (Button mit Code-Eingabe)
- Aktuelle Statistiken (kompakte Karten):
  - Gespielte Spiele
  - Gewonnene Spiele
  - Aktuelle Siegesserie

**Layout**: Scrollbar, Karten-basiert

---

### 3. Lobby Screen
**Zweck**: Warten auf Spieler vor Spielstart

**Inhalt**:
- Lobby-Code (groß angezeigt, kopierbar)
- Liste der beigetretenen Spieler (Avatar + Name)
- Spieler-Status (bereit/nicht bereit)
- "Spiel starten" Button (nur für Host)
- "Lobby verlassen" Button

**Layout**: Liste mit Spieler-Karten, fixierter Button unten

---

### 4. Game Screen
**Zweck**: Hauptspielbildschirm während einer Runde

**Inhalt**:
- **Oben**: Gegenspieler-Anzeigen (kompakt, Anzahl Karten, Verlustpunkte)
- **Mitte**: 
  - Nachziehstapel (links)
  - Ablagestapel (rechts, oberste Karte sichtbar)
  - Aktuelle Wunschfarbe (falls aktiv)
  - Spielrichtungsanzeige (Pfeil)
- **Unten**: Eigene Handkarten (horizontal scrollbar)
- **Aktionsindikatoren**:
  - "Du bist dran" Highlight
  - Ziehketten-Anzeige (z.B. "Ziehe 4 Karten")
  - Timer (optional, für Zeitlimit)

**Interaktion**:
- Karte antippen zum Ausspielen
- Karte vom Nachziehstapel ziehen (Tap)
- Farbwahl-Dialog bei Unter

**Layout**: Feste Bereiche, keine Scrollbar

---

### 5. Color Picker Dialog (Farbwahl)
**Zweck**: Farbauswahl nach Ausspielen eines Unters

**Inhalt**:
- 4 große Farb-Buttons (Eichel, Gras, Herz, Schellen)
- Jeder Button zeigt Farbe und Symbol

**Layout**: Modal-Dialog, zentriert

---

### 6. Round End Screen
**Zweck**: Anzeige des Rundenergebnisses

**Inhalt**:
- Gewinner der Runde (Name + Avatar)
- Verlierer mit Verlustpunkten
- Aktuelle Gesamtpunktstände
- "Nächste Runde" Button
- Liste eliminierter Spieler (falls vorhanden)

**Layout**: Modal-Overlay über Spielbildschirm

---

### 7. Game End Screen
**Zweck**: Anzeige des Spielsiegers

**Inhalt**:
- Gewinner (groß, mit Animation)
- Endrangliste aller Spieler
- Buttons:
  - "Zur Lobby zurück"
  - "Neues Spiel"

**Layout**: Vollbild-Modal

---

### 8. Profile Screen (Tab: Profil)
**Zweck**: Benutzerprofil und Statistiken

**Inhalt**:
- Avatar und Benutzername (editierbar)
- Premium-Status (Badge oder Upgrade-Button)
- Detaillierte Statistiken:
  - Gespielte Spiele
  - Gewonnene Spiele
  - Siegesrate
  - Längste Siegesserie
  - Durchschnittliche Verlustpunkte
- Einstellungen-Button

**Layout**: Scrollbar, Karten-basiert

---

### 9. Settings Screen
**Zweck**: App-Einstellungen

**Inhalt**:
- Dark Mode Toggle
- Sound-Effekte Toggle
- Musik Toggle
- Vibration Toggle
- Sprache (Deutsch/Englisch)
- Account-Verwaltung:
  - Passwort ändern
  - Abmelden
  - Account löschen

**Layout**: Liste mit Schaltern und Buttons

---

### 10. Premium / Shop Screen (Tab: Shop)
**Zweck**: Premium-Abo und Cosmetics kaufen

**Inhalt**:
- Premium-Abo-Karte:
  - Features (werbefrei, erweiterte Stats, private Lobbys)
  - Preis: 4,99 € / Monat
  - "Jetzt upgraden" Button
- Cosmetics-Galerie:
  - Kartenrückseiten (Grid)
  - Tisch-Themes (Grid)
  - Preis pro Item: 0,99 - 2,99 €
- Gekaufte Items (markiert)

**Layout**: Scrollbar, Grid für Items

---

### 11. Login / Register Screen
**Zweck**: Authentifizierung

**Inhalt**:
- **Login-Tab**:
  - E-Mail-Eingabe
  - Passwort-Eingabe
  - "Anmelden" Button
  - "Passwort vergessen?" Link
- **Register-Tab**:
  - Benutzername-Eingabe
  - E-Mail-Eingabe
  - Passwort-Eingabe
  - "Registrieren" Button

**Layout**: Tab-basiert, zentrierte Formulare

---

### 12. Tutorial Screen
**Zweck**: Interaktives Tutorial für neue Spieler

**Inhalt**:
- Schritt-für-Schritt-Anleitung (Swipeable)
- Illustrationen zu Spielregeln
- Interaktive Beispiele
- "Tutorial überspringen" Button
- "Weiter" / "Fertig" Buttons

**Layout**: Horizontales Swiping zwischen Schritten

---

## Key User Flows

### Flow 1: Schnelles Spiel starten
1. Home Screen → "Schnelles Spiel" antippen
2. Matchmaking läuft (Loading-Anzeige)
3. Lobby Screen (automatisch gefüllt)
4. Spiel startet automatisch bei 4 Spielern
5. Game Screen

### Flow 2: Privates Spiel erstellen
1. Home Screen → "Privates Spiel erstellen"
2. Lobby Screen (Lobby-Code angezeigt)
3. Spieler teilen Code mit Freunden
4. Host tippt "Spiel starten"
5. Game Screen

### Flow 3: Karte ausspielen
1. Game Screen → Eigene Karte antippen
2. Validierung (passende Farbe/Rang?)
3. Falls Unter: Color Picker Dialog öffnet sich
4. Karte wird auf Ablagestapel gelegt
5. Nächster Spieler ist dran

### Flow 4: Runde gewinnen
1. Letzte Karte ausspielen
2. Round End Screen zeigt Gewinner
3. Verlustpunkte werden verteilt
4. "Nächste Runde" antippen
5. Neue Runde startet

### Flow 5: Premium kaufen
1. Home Screen → Tab "Shop"
2. Premium-Karte antippen
3. Zahlungsdialog (Stripe/PayPal)
4. Bestätigung
5. Premium-Badge wird aktiviert

---

## Design-Prinzipien

### 1. Einhändige Bedienung
- Alle wichtigen Buttons im unteren Bildschirmbereich
- Große Touch-Targets (mindestens 44x44 pt)
- Wichtige Aktionen immer erreichbar

### 2. Klare Hierarchie
- Große, fette Schrift für Hauptaktionen
- Sekundäre Informationen kleiner und gedämpfter
- Verwendung von Weißraum zur Trennung

### 3. Sofortiges Feedback
- Haptisches Feedback bei Buttons
- Animationen bei Kartenaktionen
- Visuelle Bestätigung bei erfolgreichen Aktionen

### 4. Konsistente Farbverwendung
- Primärfarbe für Hauptaktionen
- Spielfarben nur für Karten und spielrelevante Elemente
- Statusfarben für Erfolg/Warnung/Fehler

### 5. Minimalistisches Design
- Keine überflüssigen Dekorationen
- Fokus auf Spielinhalt
- Klare Typografie (SF Pro auf iOS, Roboto auf Android)

---

## Animationen und Übergänge

### Kartenanimationen
- **Karte ziehen**: Slide von Nachziehstapel zur Hand (300ms)
- **Karte ausspielen**: Slide von Hand zu Ablagestapel (250ms)
- **Karte mischen**: Shuffle-Animation beim Rundenstart (500ms)

### Screen-Übergänge
- **Modal öffnen**: Fade + Scale (250ms)
- **Screen wechseln**: Slide (300ms)
- **Tab wechseln**: Cross-fade (200ms)

### Feedback-Animationen
- **Button-Press**: Scale 0.97 (80ms)
- **Erfolg**: Confetti-Animation (1000ms)
- **Fehler**: Shake-Animation (300ms)

---

## Typografie

### Schriftgrößen
- **Headline**: 32pt, Bold
- **Title**: 24pt, Semibold
- **Body**: 16pt, Regular
- **Caption**: 14pt, Regular
- **Small**: 12pt, Regular

### Schriftarten
- **iOS**: SF Pro Display / SF Pro Text
- **Android**: Roboto
- **Fallback**: System Default

---

## Accessibility

- **Mindestkontrast**: WCAG AA (4.5:1 für Text)
- **Touch-Targets**: Mindestens 44x44 pt
- **VoiceOver/TalkBack**: Alle interaktiven Elemente beschriftet
- **Farbblindheit**: Zusätzliche Symbole neben Farben
- **Schriftgröße**: Unterstützung für Dynamic Type

---

## Technische Umsetzung

- **Framework**: React Native mit Expo
- **Styling**: NativeWind (Tailwind CSS)
- **Animationen**: React Native Reanimated
- **Icons**: SF Symbols (iOS) / Material Icons (Android)
- **State Management**: Zustand (für lokalen State) + TanStack Query (für Server-Daten)
