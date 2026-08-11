#!/usr/bin/env bash
# Install runtime dependencies without leaving a persistent npm download cache.
set -euo pipefail

readonly EXPECTED_APP_ROOT="/home/espartanoscl/repositories/spartanoshub"
APP_ROOT="$(pwd -P)"

if [ "$APP_ROOT" != "$EXPECTED_APP_ROOT" ]; then
  echo "NPM INSTALL: raiz de aplicacion no autorizada: $APP_ROOT" >&2
  exit 1
fi

readonly NPM_CACHE_DIR="$APP_ROOT/tmp/npm-cache"
cleanup_cache() {
  /bin/rm -rf -- "$NPM_CACHE_DIR"
}

trap cleanup_cache EXIT
cleanup_cache
/bin/mkdir -p "$NPM_CACHE_DIR"
export npm_config_cache="$NPM_CACHE_DIR"

npm ci --omit=dev
