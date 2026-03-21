#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT_DIR/.expo-external.pid"
PORT="${EXPO_PORT:-8081}"
NGROK_API_PORT="${EXPO_NGROK_API_PORT:-4040}"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" || true)"
  if [[ -n "${PID:-}" ]] && kill -0 "$PID" >/dev/null 2>&1; then
    echo "[expo:external:stop] Stopping Expo PID $PID"
    pkill -TERM -P "$PID" >/dev/null 2>&1 || true
    kill "$PID" >/dev/null 2>&1 || true
    sleep 1
    if kill -0 "$PID" >/dev/null 2>&1; then
      pkill -9 -P "$PID" >/dev/null 2>&1 || true
      kill -9 "$PID" >/dev/null 2>&1 || true
    fi
  fi
  rm -f "$PID_FILE"
fi

for LISTEN_PORT in "$PORT" "$NGROK_API_PORT"; do
  PIDS="$(lsof -tiTCP:"$LISTEN_PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${PIDS:-}" ]]; then
    echo "[expo:external:stop] Releasing port $LISTEN_PORT (pids: $PIDS)"
    kill $PIDS >/dev/null 2>&1 || true
    sleep 1
    kill -9 $PIDS >/dev/null 2>&1 || true
  fi
done

# Narrow fallback patterns to avoid killing unrelated Node/PNPM processes.
pkill -9 -f "expo start .*--port ${PORT}" >/dev/null 2>&1 || true
pkill -9 -f "ngrok.*${PORT}" >/dev/null 2>&1 || true
pkill -9 -f "ngrok.*${NGROK_API_PORT}" >/dev/null 2>&1 || true
echo "[expo:external:stop] Done."
