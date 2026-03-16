# Crazy Amsel Brand Bible

## 1. Kernidentitaet
- Produktton: kompetitiv, frech, trocken, humorvoll.
- Figur: Crazy Amsel ist der Markenanker und kommentiert nur relevante Spielmomente.
- UX-Regel: Amsel unterstützt Entscheidung und Emotion, nie Dauerrauschen.

## 2. Einsatzmatrix (verbindlich)
- `round_start`: Kommentator, kurze Fly-by.
- `winner`: Kommentator, Triumph-Moment.
- `loser`: Kommentator, trockener Kommentar.
- `elimination`: Chaos-Verstaerker, Talon-Lift Moment.
- `draw_chain`: Chaos-Verstaerker, Eskalationsmoment.
- `chaos`: seltenes Sonderereignis.
- `mvp`: Belohnungs-/Meta-Moment.
- `guide`: Tutorial-/Hinweis-Moment.

Nicht erlaubt im Multiplayer als Amsel-Hauptevent:
- `ass`, `unter`, `seven_played` (normale Kartenaktionen; kein Markenmoment).

## 3. Tonalitaet
- Kurz, trocken, klar.
- Keine Beleidigungen.
- Keine langen Saetze.
- Keine Textwall.

Beispiele:
- Rundenstart: "Na gut. Neue Runde."
- Sieg: "{player}: sauber."
- Niederlage: "{player}: das war nichts."
- Elimination: "{player}: raus."
- Ziehkette: "Oh oh."
- Chaos: "Das wird wild."

## 4. Typografie fuer Amsel-Spruchblasen
- Maximal 1-2 kurze Zeilen.
- Hoher Kontrast auf dunklem Untergrund.
- Gewicht: semibold bis bold.
- Keine kleinteilige Zusatztypografie im selben Layer.

## 5. Motion-Regeln
- Start/Ende jeder Animation klar definiert.
- Ziel-Dauer pro Event: ca. 1.2s bis 2.4s.
- Amsel darf keine Interaktionsflaechen verdecken.
- Event-Layer ist unter Gameplay-Prioritaet.
- Keine Endlosschleifen.

## 6. Farbregeln
- Amsel-FX-Farben aus den bestehenden Token-Systemen.
- Primar fuer Hinweise: `STATE_WARNING`, `SECONDARY_NEON`.
- Gefahr/Verlust: `STATE_DANGER`.
- Text immer in hoher Lesbarkeit (`TEXT_MAIN`).

## 7. Do / Don't
Do:
- Nur bei besonderen Momenten ausloesen.
- Synchron fuer alle Spieler per `blackbird-event`.
- Kurze, klare Sprueche.
- Replays bei Reconnect aus Server-State.

Don't:
- Nicht bei jeder normalen Kartenaktion.
- Nicht dauerhaft sichtbar.
- Nicht visuell ueber Top-Card/Handkarten legen.
- Nicht client-only ausloesen.

## 8. Multiplayer-Regel
- Server ist Source of Truth.
- Amsel-Ereignisse werden serverseitig erzeugt, gefiltert und an den Raum gebroadcastet.
- Clients rendern nur, sie entscheiden nicht ueber Amsel-Momente.
