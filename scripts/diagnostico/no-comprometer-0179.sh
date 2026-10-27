#!/usr/bin/env bash
#
# Impide comprometer la migracion 0179, su .js compilado o el .env.
#
# La 0179 suelta tablas y esta sin seguir en git a proposito, hasta que haya confirmacion de que
# existe respaldo fuera del hosting. Que este sin seguir no basta: `git add -A apps/api/src` la
# agrega igual, y a partir de ahi solo lo nota quien mire la lista de 103 archivos de un commit de
# `dist`. Esto lo convierte en un no.
#
# Se llama desde el gancho PreToolUse de `.claude/settings.json`, con la peticion por la entrada
# estandar, y solo para `git commit`. Devuelve JSON: una decision de permiso, no un codigo de
# salida, para poder decir por que.
set -uo pipefail

cd "$(dirname "$0")/../.." || exit 0

# Lo que el commit llevaria. Sin indice —o fuera de un repositorio— no hay nada que juzgar.
preparado="$(git diff --cached --name-only 2>/dev/null)" || exit 0
[ -n "$preparado" ] || exit 0

motivos=()

if printf '%s\n' "$preparado" | grep -q '0179-soltar-las-tablas-retiradas'; then
  motivos+=("la migracion 0179-soltar-las-tablas-retiradas esta en el indice: suelta tablas y no se sigue en git hasta que confirmes que hay respaldo fuera del hosting")
fi

if printf '%s\n' "$preparado" | grep -qE '(^|/)\.env$'; then
  motivos+=("hay un .env en el indice")
fi

if [ ${#motivos[@]} -eq 0 ]; then exit 0; fi

# Cada motivo con su `git restore --staged`, para que quitarlo sea una linea y no una busqueda.
rutas="$(printf '%s\n' "$preparado" | grep -E '0179-soltar-las-tablas-retiradas|(^|/)\.env$' | tr '\n' ' ')"
razon="Este commit no puede salir: $(printf '%s; ' "${motivos[@]}")"$'\n\n'"Saca esos archivos y vuelve a intentarlo:"$'\n'"  git restore --staged $rutas"

# `node` y no `python`: en esta maquina `python` es el atajo del Store y no esta instalado. El JSON
# se arma con el interprete en vez de a mano porque la razon lleva saltos de linea y rutas.
RAZON="$razon" node -e '
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: process.env.RAZON,
  },
}));
' 2>/dev/null || printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"El indice contiene la migracion 0179 o un .env. Saca esos archivos con git restore --staged antes de comprometer."}}\n'
