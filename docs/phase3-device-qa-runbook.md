# Phase 3 Device QA Runbook

Purpose: provide a repeatable, hard acceptance checklist for game-feel quality on real devices.

## Preconditions
- Start app with external Expo flow (`pnpm expo:external`).
- Use 2 physical devices in the same room code.
- Ensure sound is enabled in-app and device mute switch is off.

## Mandatory Checks
1. Standardzug
- Action: play a normal non-special card.
- Pass criteria: visible card movement + immediate audio/haptic feedback, no delayed pop-in.

2. Ziehen
- Action: draw one card.
- Pass criteria: draw path visible to hand target, no abrupt state-only update.

3. Spezialkarte
- Action: play `7`, `ass`, `bube`.
- Pass criteria: stronger impact than standardzug (audio + visual emphasis).

4. Ziehkette
- Action: trigger chain >= 3.
- Pass criteria: escalating feedback without audio clutter.

5. Amsel-Event
- Action: trigger a Blackbird event.
- Pass criteria: readable phrase, clear silhouette, motion distinct from normal turns.

6. Eliminierung
- Action: force elimination transition.
- Pass criteria: elimination banner + elimination sound + synchronized timing.

7. Sieg/Niederlage
- Action: finish match.
- Pass criteria: match-result banner + victory sound with clear priority over low-impact tails.

8. Schnelle Aktionen
- Action: quick sequence of draw/play actions.
- Pass criteria: no visible FX queue stall, no overlapping chaotic audio.

9. Multiplayer-Konsistenz
- Action: run checks 1-8 with both devices connected.
- Pass criteria: both clients show same important event order and similar perceived timing.

## Report Template
- Device A:
- Device B:
- Build/commit:
- Failed checks (if any):
- Notes on audio balance:
- Notes on Amsel quality:

