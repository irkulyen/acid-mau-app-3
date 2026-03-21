#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN1_LOG="/tmp/acidmau-expo-run1.log"
RUN2_LOG="/tmp/acidmau-expo-run2.log"

cd "$ROOT_DIR"

wait_for_link() {
  local log_file="$1"
  for _ in $(seq 1 100); do
    if rg -q "Expo Go Link:" "$log_file" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

extract_line_value() {
  local prefix="$1"
  local log_file="$2"
  rg -o "${prefix}.*" "$log_file" | tail -n 1 | sed -E "s/^${prefix}//"
}

verify_cycle() {
  local cycle="$1"
  local log_file="$2"

  pnpm expo:external:stop >/dev/null 2>&1 || true
  rm -f "$log_file"
  (pnpm expo:external >"$log_file" 2>&1 &) >/dev/null 2>&1

  if ! wait_for_link "$log_file"; then
    echo "[verify-expo] cycle=${cycle} failed: no Expo Go link emitted"
    tail -n 120 "$log_file" || true
    exit 1
  fi

  local link
  link="$(extract_line_value "Expo Go Link: " "$log_file")"
  local manifest
  manifest="$(extract_line_value "Manifest URL: " "$log_file")"

  if [[ -z "$link" || -z "$manifest" ]]; then
    echo "[verify-expo] cycle=${cycle} failed: missing link/manifest in log"
    tail -n 120 "$log_file" || true
    exit 1
  fi

  local manifest_json
  manifest_json="$(curl -fsS "$manifest")"
  local launch_asset
  launch_asset="$(printf "%s" "$manifest_json" | node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(0,"utf8"));process.stdout.write(j?.launchAsset?.url||"");')"
  if [[ -z "$launch_asset" ]]; then
    echo "[verify-expo] cycle=${cycle} failed: launchAsset missing in manifest"
    exit 1
  fi

  local bundle_status
  bundle_status="$(curl -sS -o /dev/null -w "%{http_code}" "$launch_asset")"
  if [[ "$bundle_status" != "200" ]]; then
    echo "[verify-expo] cycle=${cycle} failed: bundle status=$bundle_status"
    exit 1
  fi

  echo "[verify-expo] cycle=${cycle} ok"
  echo "[verify-expo] cycle=${cycle} link=$link"
  echo "[verify-expo] cycle=${cycle} manifest=$manifest"
  echo "[verify-expo] cycle=${cycle} launchAsset=$launch_asset"
}

verify_cycle "1" "$RUN1_LOG"
verify_cycle "2" "$RUN2_LOG"

pnpm expo:external:stop >/dev/null 2>&1 || true
echo "[verify-expo] PASS"
