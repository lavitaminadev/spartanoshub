#!/usr/bin/env bash
# Read-only inode guard for the single Spartanoshub production tree in cPanel.
set -euo pipefail

readonly EXPECTED_HOME="/home/espartanoscl"
readonly EXPECTED_APP_ROOT="$EXPECTED_HOME/repositories/spartanoshub"
readonly MAX_ACCOUNT_INODES=55000
readonly MAX_TRASH_INODES=2000
readonly MAX_NPM_CACHE_INODES=500
readonly MAX_NODE_MODULES_INODES=28000
readonly CLOUDLINUX_NODE_RUNTIME="$EXPECTED_HOME/nodevenv/repositories/spartanoshub/22/lib/node_modules"

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

  # CloudLinux expone `node_modules` como symlink al entorno virtual y durante algunas
  # operaciones aparecen entradas efimeras o colgantes. Para esta politica solo importa
  # contar lo que existe de forma legible; una advertencia de `find` no debe tumbar el deploy.
  local count
  count="$(find "$path" -xdev -mindepth 1 -printf '.' 2>/dev/null | wc -c || true)"
  printf '%s\n' "${count:-0}"
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

# Production allows one dependency tree only. npm workspaces can leave empty scope directories
# such as apps/web/node_modules/@vitejs; they consume only directory entries and are not a
# dependency installation. A pipeline is used instead of /dev/fd because CloudLinux CageFS does
# not expose that interface to cPanel deployment tasks.
UNAUTHORIZED_TREES="$(
  find "$EXPECTED_HOME" -xdev -type d -name node_modules -prune -print 2>/dev/null |
    while IFS= read -r dependency_tree; do
      # CloudLinux stores the Node 22 runtime's own modules outside the checkout.
      # It is managed by cPanel, is required to run the selected application, and is
      # not a second project dependency tree. Every other populated node_modules
      # directory remains a deploy blocker.
      if [ "$dependency_tree" != "$EXPECTED_APP_ROOT/node_modules" ] &&
        [ "$dependency_tree" != "$CLOUDLINUX_NODE_RUNTIME" ] &&
        [ -n "$(find "$dependency_tree" -xdev -mindepth 1 ! -type d -print -quit 2>/dev/null)" ]; then
        printf '%s\n' "$dependency_tree"
      fi
    done
)"
if [ -n "$UNAUTHORIZED_TREES" ]; then
  printf 'INODE GUARD: node_modules duplicado fuera de produccion:\n%s\n' \
    "$UNAUTHORIZED_TREES" >&2
  FAILED=1
fi

if [ "$FAILED" -ne 0 ]; then
  echo "INODE GUARD: despliegue detenido antes de reiniciar la aplicacion." >&2
  exit 1
fi

echo "INODE GUARD: consumo dentro de la politica."
