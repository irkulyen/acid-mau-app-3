#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if command -v corepack >/dev/null 2>&1; then
  PNPM_CMD=(corepack pnpm)
elif command -v pnpm >/dev/null 2>&1; then
  PNPM_CMD=(pnpm)
else
  echo "[verify-phase3] pnpm/corepack not found" >&2
  exit 1
fi

echo "[verify-phase3] check"
"${PNPM_CMD[@]}" check

echo "[verify-phase3] targeted game-feel gates"
"${PNPM_CMD[@]}" test -- \
  __tests__/game-sound-policy.test.ts \
  __tests__/game-sound-assets.test.ts \
  __tests__/blackbird-presentation.test.ts \
  __tests__/blackbird-motion-profile.test.ts \
  __tests__/game-fx-cue-spec.test.ts \
  __tests__/phase3-interaction-hierarchy.test.ts

echo "[verify-phase3] realtime multiplayer sync gates"
"${PNPM_CMD[@]}" test -- tests/room-system.test.ts

echo "[verify-phase3] PASS"
