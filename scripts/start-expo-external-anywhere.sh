#!/usr/bin/env bash
set -euo pipefail

# ---------- Config ----------
PROJECT_DIR="${EXPO_PROJECT_DIR:-$HOME/Documents/GitHub/crazyamsel-app}"
PORT="${EXPO_PORT:-8081}"
API_URL="${EXPO_PUBLIC_API_URL:-http://185.215.165.148:3000}"
MANIFEST_PATH="/?platform=ios&dev=true&hot=false"
METRO_WAIT_SECONDS="${EXPO_METRO_WAIT_SECONDS:-120}"
HOST_WAIT_SECONDS="${EXPO_HOST_WAIT_SECONDS:-120}"
PREWARM_TIMEOUT_SECONDS="${EXPO_PREWARM_TIMEOUT_SECONDS:-300}"

LOG_FILE="$PROJECT_DIR/.expo-external.log"
PID_FILE="$PROJECT_DIR/.expo-external.pid"

# ---------- Logging ----------
log() {
  printf '[expo-external][%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

# ---------- Tooling ----------
load_node_env() {
  export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

  if [[ -z "${NVM_DIR:-}" ]]; then
    export NVM_DIR="$HOME/.nvm"
  fi

  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    source "$NVM_DIR/nvm.sh"
    if command -v nvm >/dev/null 2>&1; then
      nvm use --silent default >/dev/null 2>&1 || nvm use --silent --lts >/dev/null 2>&1 || true
    fi
  fi
}

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || fail "Benötigtes Tool fehlt im Script-Kontext: $cmd"
}

ensure_toolchain() {
  load_node_env

  require_cmd node
  require_cmd npm
  require_cmd npx
  require_cmd curl
  require_cmd grep
  require_cmd lsof

  # pnpm optional, but preferred for install step.
  if ! command -v pnpm >/dev/null 2>&1 && command -v corepack >/dev/null 2>&1; then
    corepack prepare pnpm@9.12.0 --activate >/dev/null 2>&1 || corepack enable >/dev/null 2>&1 || true
  fi

  log "node: $(command -v node) ($(node -v))"
  log "npm:  $(command -v npm) ($(npm -v))"
  log "npx:  $(command -v npx) ($(npx --version))"
  if command -v pnpm >/dev/null 2>&1; then
    log "pnpm: $(command -v pnpm) ($(pnpm -v))"
  else
    log "pnpm: nicht gefunden (Fallback auf npm install, falls nötig)"
  fi
}

# ---------- Process / Port cleanup ----------
kill_port_processes() {
  local pids
  pids="$(lsof -ti tcp:"$PORT" || true)"
  if [[ -n "$pids" ]]; then
    log "Port $PORT belegt, beende Prozesse: $pids"
    kill -TERM $pids >/dev/null 2>&1 || true
    sleep 1
    local still
    still="$(lsof -ti tcp:"$PORT" || true)"
    if [[ -n "$still" ]]; then
      log "Erzwinge kill für Port-$PORT-Prozesse: $still"
      kill -KILL $still >/dev/null 2>&1 || true
    fi
  fi
}

stop_stale_processes() {
  log "Beende alte Expo/Metro/ngrok-Prozesse ..."
  pkill -f "expo start" >/dev/null 2>&1 || true
  pkill -f "@expo/cli" >/dev/null 2>&1 || true
  pkill -f "metro" >/dev/null 2>&1 || true
  pkill -f "ngrok" >/dev/null 2>&1 || true

  if [[ -f "$PID_FILE" ]]; then
    local old_pid
    old_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "$old_pid" ]] && kill -0 "$old_pid" >/dev/null 2>&1; then
      log "Beende alten Expo-PID aus Datei: $old_pid"
      kill -TERM "$old_pid" >/dev/null 2>&1 || true
      sleep 1
      kill -KILL "$old_pid" >/dev/null 2>&1 || true
    fi
  fi

  kill_port_processes
}

# ---------- Startup ----------
ensure_project_ready() {
  [[ -d "$PROJECT_DIR" ]] || fail "Projektpfad existiert nicht: $PROJECT_DIR"
  cd "$PROJECT_DIR" || fail "Konnte nicht in Projekt wechseln: $PROJECT_DIR"
  log "Projekt: $PROJECT_DIR"

  if [[ ! -f package.json ]]; then
    fail "Kein package.json gefunden in $PROJECT_DIR"
  fi

  if [[ ! -d node_modules ]]; then
    log "node_modules fehlt, installiere Abhängigkeiten ..."
    if command -v pnpm >/dev/null 2>&1; then
      pnpm install --frozen-lockfile || pnpm install || fail "pnpm install fehlgeschlagen"
    else
      npm install || fail "npm install fehlgeschlagen"
    fi
  fi
}

wait_for_metro() {
  local i
  for ((i=1; i<=METRO_WAIT_SECONDS; i++)); do
    if curl -fsS "http://127.0.0.1:$PORT/status" 2>/dev/null | grep -q "packager-status:running"; then
      log "Metro läuft auf Port $PORT"
      return 0
    fi
    sleep 1
  done
  return 1
}

resolve_tunnel_host() {
  local i manifest host
  for ((i=1; i<=HOST_WAIT_SECONDS; i++)); do
    manifest="$(curl -fsS "http://127.0.0.1:$PORT$MANIFEST_PATH" 2>/dev/null || true)"
    if [[ -n "$manifest" ]]; then
      host="$(printf '%s' "$manifest" | node -e 'const fs=require("fs"); const j=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(j?.extra?.expoClient?.hostUri || "");' 2>/dev/null || true)"
      if [[ "$host" == *".exp.direct" ]]; then
        printf '%s' "$host"
        return 0
      fi
    fi
    sleep 1
  done
  return 1
}

prewarm_bundle() {
  local host manifest launch_asset local_bundle
  host="$1"
  manifest="$(curl -fsS "http://127.0.0.1:$PORT$MANIFEST_PATH" 2>/dev/null || true)"
  [[ -n "$manifest" ]] || fail "Manifest leer, Bundle-Prewarm nicht möglich"

  launch_asset="$(printf '%s' "$manifest" | node -e 'const fs=require("fs"); const j=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(j?.launchAsset?.url || "");' 2>/dev/null || true)"
  [[ -n "$launch_asset" ]] || fail "launchAsset.url fehlt im Manifest"

  local_bundle="$launch_asset"
  if [[ "$launch_asset" == *"://$host/"* ]]; then
    local_bundle="http://127.0.0.1:$PORT/${launch_asset#*://$host/}"
  fi

  log "Prewarm Bundle (Timeout ${PREWARM_TIMEOUT_SECONDS}s) ..."
  curl -fsS --max-time "$PREWARM_TIMEOUT_SECONDS" "$local_bundle" -o /tmp/expo-entry.bundle >/dev/null \
    || fail "Bundle-Prewarm fehlgeschlagen (Timeout/Netzwerk)"
}

start_expo() {
  export EXPO_PUBLIC_API_URL="$API_URL"
  export EXPO_NO_TELEMETRY=1
  export EXPO_SKIP_BUILD_PROPERTIES=1

  local cmd=(npx expo start --tunnel --port "$PORT")

  : > "$LOG_FILE"
  log "Starte Expo: ${cmd[*]}"
  log "EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL"

  "${cmd[@]}" >>"$LOG_FILE" 2>&1 &
  local expo_pid=$!
  echo "$expo_pid" > "$PID_FILE"
  log "Expo PID: $expo_pid"

  if ! kill -0 "$expo_pid" >/dev/null 2>&1; then
    fail "Expo-Prozess ist sofort beendet. Prüfe $LOG_FILE"
  fi

  if ! wait_for_metro; then
    tail -n 120 "$LOG_FILE" || true
    fail "Metro wurde auf Port $PORT nicht rechtzeitig bereit"
  fi

  local host
  host="$(resolve_tunnel_host || true)"
  [[ -n "$host" ]] || { tail -n 120 "$LOG_FILE" || true; fail "Kein exp.direct Host im Manifest gefunden"; }

  prewarm_bundle "$host"

  local exp_link legacy_link https_manifest
  exp_link="exps://$host$MANIFEST_PATH"
  legacy_link="exp://$host"
  https_manifest="https://$host$MANIFEST_PATH"

  log "FERTIG"
  log "Expo Go Link: $exp_link"
  log "Legacy Link:  $legacy_link"
  log "Manifest:    $https_manifest"
  log "Log-Datei:   $LOG_FILE"
  log "Stoppen:     kill $(cat "$PID_FILE")  oder scripts/stop-expo-external.sh"
}

main() {
  ensure_toolchain
  stop_stale_processes
  ensure_project_ready
  start_expo
}

main "$@"
