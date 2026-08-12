#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-$PWD}"
LOG_FILE="$APP_ROOT/logs/startup-check.log"

mkdir -p "$APP_ROOT/logs"
rm -f "$LOG_FILE"

# Use a dedicated local port so the smoke test does not collide with Passenger.
set +e
NODE_ENV=production PORT="${STARTUP_CHECK_PORT:-3100}" /usr/bin/timeout 25s node app.js > "$LOG_FILE" 2>&1
status=$?
set -e

if [ "$status" = "124" ]; then
  echo "STARTUP CHECK: app stayed alive for 25s"
  exit 0
fi

echo "STARTUP CHECK FAILED: node app.js exited with status $status"
cat "$LOG_FILE"
exit "$status"
