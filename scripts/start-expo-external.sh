#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${EXPO_PORT:-8081}"
API_URL_DEFAULT="http://185.215.165.148:3000"
PID_FILE="$ROOT_DIR/.expo-external.pid"
LOG_FILE="$ROOT_DIR/.expo-external.log"
MANIFEST_PATH="/?platform=ios&dev=true&hot=false"
PREWARM_REQUEST_TIMEOUT="${EXPO_PREWARM_REQUEST_TIMEOUT:-300}"

cd "$ROOT_DIR"

ensure_node_tooling() {
  # Keep common package-manager locations in PATH for non-interactive shells.
  export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

  # Load NVM explicitly when script is executed outside interactive zsh.
  if [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
    if command -v nvm >/dev/null 2>&1; then
      nvm use --silent default >/dev/null 2>&1 || nvm use --silent --lts >/dev/null 2>&1 || true
    fi
  fi

  # Ensure pnpm exists when Node ships with corepack but pnpm is not globally installed.
  if ! command -v pnpm >/dev/null 2>&1 && command -v corepack >/dev/null 2>&1; then
    corepack prepare pnpm@9.12.0 --activate >/dev/null 2>&1 || corepack enable >/dev/null 2>&1 || true
  fi

  local missing=0
  for bin in node npm npx pnpm curl grep; do
    if ! command -v "$bin" >/dev/null 2>&1; then
      echo "[expo:external] Missing tool '$bin' in script context."
      missing=1
    fi
  done

  echo "[expo:external] PATH=$PATH"
  command -v node >/dev/null 2>&1 && echo "[expo:external] node: $(command -v node) ($(node -v))"
  command -v npm >/dev/null 2>&1 && echo "[expo:external] npm:  $(command -v npm) ($(npm -v))"
  command -v npx >/dev/null 2>&1 && echo "[expo:external] npx:  $(command -v npx) ($(npx --version))"
  command -v pnpm >/dev/null 2>&1 && echo "[expo:external] pnpm: $(command -v pnpm) ($(pnpm -v))"

  if [[ "$missing" -ne 0 ]]; then
    echo "[expo:external] Node toolchain not fully available. Aborting start."
    exit 1
  fi
}

ensure_node_tooling

if [[ ! -f ".env" ]]; then
  printf "EXPO_PUBLIC_API_URL=%s\n" "$API_URL_DEFAULT" > .env
  echo "[expo:external] Created .env with EXPO_PUBLIC_API_URL=$API_URL_DEFAULT"
fi

echo "[expo:external] Stopping stale Expo/Metro/ngrok processes..."
if [[ -x "$ROOT_DIR/scripts/stop-expo-external.sh" ]]; then
  "$ROOT_DIR/scripts/stop-expo-external.sh" >/dev/null 2>&1 || true
fi
sleep 1

rm -f "$PID_FILE"
rm -f "$LOG_FILE"

EXPO_CMD=(npx expo start --tunnel --port "$PORT")
if [[ "${EXPO_CLEAR:-0}" == "1" ]]; then
  EXPO_CMD+=(--clear)
fi

echo "[expo:external] Starting: ${EXPO_CMD[*]}"
EXPO_SKIP_BUILD_PROPERTIES=1 EXPO_NO_TELEMETRY=1 "${EXPO_CMD[@]}" >"$LOG_FILE" 2>&1 &
EXPO_PID=$!
echo "$EXPO_PID" > "$PID_FILE"

on_terminate() {
  if kill -0 "$EXPO_PID" >/dev/null 2>&1; then
    kill "$EXPO_PID" >/dev/null 2>&1 || true
    sleep 1
    kill -9 "$EXPO_PID" >/dev/null 2>&1 || true
  fi
  rm -f "$PID_FILE"
  exit 0
}

trap on_terminate INT TERM

for _ in $(seq 1 120); do
  if curl -fsS "http://127.0.0.1:$PORT/status" 2>/dev/null | grep -q "packager-status:running"; then
    break
  fi
  sleep 1
done

if ! curl -fsS "http://127.0.0.1:$PORT/status" 2>/dev/null | grep -q "packager-status:running"; then
  echo "[expo:external] Metro did not become ready on port $PORT."
  echo "[expo:external] Tail log:"
  tail -n 80 "$LOG_FILE" || true
  exit 1
fi

for _ in $(seq 1 120); do
  MANIFEST_JSON="$(curl -fsS "http://127.0.0.1:$PORT$MANIFEST_PATH" 2>/dev/null || true)"
  if [[ -n "${MANIFEST_JSON:-}" ]]; then
    HOST_URI="$(printf "%s" "$MANIFEST_JSON" | node -e 'const fs=require("fs"); const j=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(j?.extra?.expoClient?.hostUri || "");' || true)"
    LAUNCH_ASSET_URL="$(printf "%s" "$MANIFEST_JSON" | node -e 'const fs=require("fs"); const j=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(j?.launchAsset?.url || "");' || true)"
    if [[ "$HOST_URI" == *".exp.direct" ]]; then
      break
    fi
  fi
  sleep 1
done

if [[ -z "${HOST_URI:-}" ]] || [[ "$HOST_URI" != *".exp.direct" ]]; then
  echo "[expo:external] Could not resolve exp.direct host from manifest."
  echo "[expo:external] Tail log:"
  tail -n 80 "$LOG_FILE" || true
  exit 1
fi

if [[ -z "${LAUNCH_ASSET_URL:-}" ]]; then
  echo "[expo:external] launchAsset URL missing in manifest."
  tail -n 80 "$LOG_FILE" || true
  exit 1
fi

LOCAL_BUNDLE_URL="$LAUNCH_ASSET_URL"
if [[ "$LAUNCH_ASSET_URL" == *"://$HOST_URI/"* ]]; then
  LOCAL_BUNDLE_URL="http://127.0.0.1:$PORT/${LAUNCH_ASSET_URL#*://$HOST_URI/}"
fi

echo "[expo:external] Prewarming iOS bundle (first run can take several minutes)..."
if ! curl -fsS --max-time "$PREWARM_REQUEST_TIMEOUT" "$LOCAL_BUNDLE_URL" -o /tmp/expo-entry.bundle >/dev/null 2>&1; then
  echo "[expo:external] Bundle prewarm timed out after ${PREWARM_REQUEST_TIMEOUT}s."
  tail -n 120 "$LOG_FILE" || true
  exit 1
fi

EXP_LINK="exps://$HOST_URI$MANIFEST_PATH"
HTTPS_MANIFEST="https://$HOST_URI$MANIFEST_PATH"

echo
echo "[expo:external] Ready."
echo "Expo PID: $EXPO_PID"
echo "Expo Go Link: $EXP_LINK"
echo "Legacy Link: exp://$HOST_URI"
echo "Manifest URL: $HTTPS_MANIFEST"
echo "Log file: $LOG_FILE"
echo
echo "[expo:external] Running in foreground. Keep this terminal open."
echo "[expo:external] Stop with Ctrl+C or: pnpm expo:external:stop"

wait "$EXPO_PID"
