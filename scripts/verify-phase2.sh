#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_EXPO_CHECK="${PHASE2_VERIFY_EXPO:-0}"

# Ensure common Node install paths are available in non-interactive shells.
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

cd "$ROOT_DIR"

if command -v pnpm >/dev/null 2>&1; then
  PNPM_BIN=(pnpm)
elif command -v npx >/dev/null 2>&1; then
  PNPM_BIN=(npx pnpm)
else
  echo "[phase2] error: neither pnpm nor npx is available in PATH" >&2
  exit 1
fi

run_pnpm() {
  "${PNPM_BIN[@]}" "$@"
}

echo "[phase2] 1/4 TypeScript check"
run_pnpm check

echo "[phase2] 2/4 Multiplayer resilience test suite"
run_pnpm vitest run tests/room-system.test.ts tests/reconnect-resilience.test.ts tests/socket-auth.test.ts

echo "[phase2] 3/4 External API + room flow + soak verification"
run_pnpm verify:phase1

if [[ "$RUN_EXPO_CHECK" == "1" ]]; then
  echo "[phase2] 4/4 Expo external reproducibility verification"
  run_pnpm verify:expo-external
else
  echo "[phase2] 4/4 Expo external verification skipped (set PHASE2_VERIFY_EXPO=1 to enable)"
fi

echo "[phase2] PASS"
