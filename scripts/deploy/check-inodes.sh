#!/usr/bin/env bash
# Read-only inode guard for the single Spartanoshub production tree in cPanel.
set -euo pipefail

readonly EXPECTED_HOME="/home/espartanoscl"
readonly EXPECTED_APP_ROOT="$EXPECTED_HOME/repositories/spartanoshub"
readonly MAX_ACCOUNT_INODES=55000
readonly MAX_TRASH_INODES=2000
readonly MAX_NPM_CACHE_INODES=500
readonly MAX_NODE_MODULES_INODES=28000

if [ "${HOME:-}" != "$EXPECTED_HOME" ]; then
  echo "INODE GUARD: HOME no autorizado: ${HOME:-sin-definir}" >&2
  exit 1
fi

APP_ROOT="$(pwd -P)"
if [ "$APP_ROOT" != "$EXPECTED_APP_ROOT" ]; then
  echo "INODE GUARD: raiz de aplicacion no autorizada: $APP_ROOT" >&2
  exit 1
fi

count_entries() {
  local path="$1"
  if [ ! -e "$path" ]; then
    printf '0\n'
    return
  fi

  find "$path" -xdev -mindepth 1 -printf '.' | wc -c
}

ACCOUNT_INODES="$(count_entries "$EXPECTED_HOME")"
TRASH_INODES="$(count_entries "$EXPECTED_HOME/.trash")"
NPM_CACHE_INODES="$(count_entries "$EXPECTED_HOME/.npm/_cacache")"
NODE_MODULES_INODES="$(count_entries "$EXPECTED_APP_ROOT/node_modules")"

printf 'INODE GUARD: cuenta=%s/%s papelera=%s/%s cache_npm=%s/%s node_modules=%s/%s\n' \
  "$ACCOUNT_INODES" "$MAX_ACCOUNT_INODES" \
  "$TRASH_INODES" "$MAX_TRASH_INODES" \
  "$NPM_CACHE_INODES" "$MAX_NPM_CACHE_INODES" \
  "$NODE_MODULES_INODES" "$MAX_NODE_MODULES_INODES"

FAILED=0
check_limit() {
  local label="$1"
  local current="$2"
  local maximum="$3"
  if [ "$current" -gt "$maximum" ]; then
    echo "INODE GUARD: $label supera el limite ($current > $maximum)" >&2
    FAILED=1
  fi
}

check_limit "la cuenta" "$ACCOUNT_INODES" "$MAX_ACCOUNT_INODES"
check_limit "la papelera" "$TRASH_INODES" "$MAX_TRASH_INODES"
check_limit "la cache global de npm" "$NPM_CACHE_INODES" "$MAX_NPM_CACHE_INODES"
check_limit "node_modules productivo" "$NODE_MODULES_INODES" "$MAX_NODE_MODULES_INODES"

# Production allows one dependency tree only. Nested package dependencies are not traversed.
while IFS= read -r dependency_tree; do
  if [ "$dependency_tree" != "$EXPECTED_APP_ROOT/node_modules" ]; then
    echo "INODE GUARD: node_modules duplicado fuera de produccion: $dependency_tree" >&2
    FAILED=1
  fi
done < <(find "$EXPECTED_HOME" -xdev -type d -name node_modules -prune -print)

if [ "$FAILED" -ne 0 ]; then
  echo "INODE GUARD: despliegue detenido antes de reiniciar la aplicacion." >&2
  exit 1
fi

echo "INODE GUARD: consumo dentro de la politica."
