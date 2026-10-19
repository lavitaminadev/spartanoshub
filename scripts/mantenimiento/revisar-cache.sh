#!/usr/bin/env bash
# Vigilancia diaria de inodos y cachés de la cuenta.
#
# Uso:
#   bash scripts/mantenimiento/revisar-cache.sh             # callado si todo está bien
#   bash scripts/mantenimiento/revisar-cache.sh --informe   # imprime siempre
#   bash scripts/mantenimiento/revisar-cache.sh --aplicar   # borra lo regenerable que pasó su tope
#
# POR QUÉ CALLADO. Va en el crontab, y cPanel envía un correo por cada línea que una tarea
# escribe. Una revisión diaria que siempre habla se convierte en un correo que nadie abre, y el
# día que de verdad avisa tampoco se abre. Así que sin hallazgos no escribe nada y no hay correo;
# si algo pasó su tope, escribe, y ese correo significa algo.
#
# QUÉ BORRA CON `--aplicar`. Sólo lo que se regenera solo y sólo cuando pasó su propio tope: la
# caché de compilación de Node y la de npm. Un borrado en seco cada día dejaría a npm sin caché y
# haría más lenta cada instalación sin ganar nada, porque el problema no es que exista: es que
# crezca. Lo demás **no lo toca**, por decisión y no por olvido:
#
#   - `node_modules` y el runtime de CloudLinux: la aplicación no arranca sin ellos.
#   - los `dist/` del repositorio: están commiteados a propósito, el servidor no compila.
#   - `public_html`: ahí vive WordPress. Los assets de Cuartel los poda `prune-old-assets.sh`,
#     que tiene sus propios cerrojos; esto sólo cuenta cuántos esperan.
#   - `.trash`: `POLITICA-INODOS.md` exige auditarla y pedir autorización antes de vaciarla.
#   - `mail`, `.cagefs` y las bases de datos: ahí hay datos, no basura.
#
# MÉTRICAS. Cada ejecución agrega una línea a `~/logs/inodos.csv`, hable o no. Un número suelto
# no dice nada; la serie dice si algo crece y a qué ritmo, que es lo que permite actuar antes de
# que el despliegue se detenga.
#
# Nunca devuelve un código distinto de cero por un tope superado: es una vigilancia, no una
# puerta. La puerta es `scripts/deploy/check-inodes.sh`, que corre dentro del despliegue.
set -uo pipefail

readonly APP="$HOME/repositories/spartanoshub"
readonly FRONTEND="$HOME/public_html/cuartel.espartanos.cl"
readonly CSV="$HOME/logs/inodos.csv"

# De `docs/deployment/POLITICA-INODOS.md`. El techo real de la cuenta es 75.000; el objetivo deja
# la reserva que la política exige para poder instalar algo nuevo sin quedar al borde.
readonly TECHO_REAL=75000
readonly OBJETIVO_CUENTA=55000
readonly ALERTA_CUENTA=60000
readonly TOPE_PAPELERA=2000
readonly TOPE_CACHE_NPM=500
readonly TOPE_NODE_MODULES=28000
readonly TOPE_COMPILE_CACHE=1000

MODO='callado'
case "${1:-}" in
  --informe) MODO='informe' ;;
  --aplicar) MODO='aplicar' ;;
  '') ;;
  *) echo "Opción desconocida: $1" >&2; exit 2 ;;
esac

contar() { [ -e "$1" ] || { printf '0\n'; return; }; find "$1" -xdev -mindepth 1 2>/dev/null | wc -l; }

CUENTA="$(contar "$HOME")"
PAPELERA="$(contar "$HOME/.trash")"
CACHE_NPM="$(contar "$HOME/.npm/_cacache")"
NODE_MODULES="$(contar "$APP/node_modules/")"
COMPILE="$(contar "$HOME/tmp/node-compile-cache")"

# Assets de Cuartel que ya nadie pide: más de 30 días y sin aparecer en el `index.html` ni el
# `sw.js` publicados. Es la misma regla de `prune-old-assets.sh`, para que los dos números hablen
# de lo mismo y nadie tenga que reconciliarlos a mano.
ASSETS_TOTAL=0
ASSETS_HUERFANOS=0
if [ -d "$FRONTEND/assets" ] && [ -f "$FRONTEND/index.html" ]; then
  ASSETS_TOTAL="$(find "$FRONTEND/assets" -type f 2>/dev/null | wc -l)"
  EN_USO="$(grep -oh 'assets/[A-Za-z0-9._-]*' "$FRONTEND/index.html" "$FRONTEND/sw.js" 2>/dev/null | sed 's|assets/||' | sort -u)"
  if [ -d "$APP/apps/web/dist/assets" ]; then
    EN_USO="$(printf '%s\n%s\n' "$EN_USO" "$(find "$APP/apps/web/dist/assets" -type f -printf '%f\n' 2>/dev/null)" | sort -u)"
  fi
  # La lista en uso va a un archivo y la comparación la hace `awk`.
  #
  # Ni `< <(…)` ni `grep -f <(…)`: CloudLinux CageFS no expone `/dev/fd` a estas tareas, así que
  # una sustitución de procesos falla con «No such file or directory» y el conteo sale en cero
  # —que se lee igual que «no hay nada que podar» y es lo contrario de lo que pasa—.
  EN_USO_TMP="$(mktemp "${TMPDIR:-/tmp}/assets-en-uso.XXXXXX")"
  printf '%s\n' "$EN_USO" > "$EN_USO_TMP"
  ASSETS_HUERFANOS="$(find "$FRONTEND/assets" -type f -mtime +30 -printf '%f\n' 2>/dev/null \
    | awk -v lista="$EN_USO_TMP" 'BEGIN { while ((getline linea < lista) > 0) usados[linea] = 1 } !($0 in usados) { n++ } END { print n + 0 }')"
  rm -f "$EN_USO_TMP"
fi

LIBRES=$((TECHO_REAL - CUENTA))

mkdir -p "$HOME/logs" 2>/dev/null
[ -f "$CSV" ] || echo 'fecha,cuenta,libres,papelera,cache_npm,node_modules,compile_cache,assets_total,assets_huerfanos' > "$CSV"
printf '%s,%s,%s,%s,%s,%s,%s,%s,%s\n' "$(date '+%Y-%m-%d %H:%M')" \
  "$CUENTA" "$LIBRES" "$PAPELERA" "$CACHE_NPM" "$NODE_MODULES" "$COMPILE" \
  "$ASSETS_TOTAL" "$ASSETS_HUERFANOS" >> "$CSV"

AVISOS=()
[ "$CUENTA"       -gt "$ALERTA_CUENTA" ]    && AVISOS+=("la cuenta va en $CUENTA y el despliegue se detiene sobre $ALERTA_CUENTA (techo real $TECHO_REAL, quedan $LIBRES)")
[ "$PAPELERA"     -gt "$TOPE_PAPELERA" ]    && AVISOS+=("la papelera tiene $PAPELERA de $TOPE_PAPELERA: audítala antes de vaciarla")
[ "$CACHE_NPM"    -gt "$TOPE_CACHE_NPM" ]   && AVISOS+=("la caché de npm tiene $CACHE_NPM de $TOPE_CACHE_NPM")
[ "$NODE_MODULES" -gt "$TOPE_NODE_MODULES" ] && AVISOS+=("node_modules tiene $NODE_MODULES de $TOPE_NODE_MODULES")
[ "$COMPILE"      -gt "$TOPE_COMPILE_CACHE" ] && AVISOS+=("la caché de compilación tiene $COMPILE de $TOPE_COMPILE_CACHE")
[ "$ASSETS_HUERFANOS" -gt 500 ]             && AVISOS+=("hay $ASSETS_HUERFANOS assets de más de 30 días que nadie pide; los retira la poda del despliegue")

if [ "$MODO" = 'aplicar' ]; then
  LIBERADOS=0
  # Sólo lo regenerable, y sólo si pasó su tope: lo que molesta es que crezca, no que exista.
  if [ "$COMPILE" -gt "$TOPE_COMPILE_CACHE" ]; then
    rm -rf "$HOME/tmp/node-compile-cache" && LIBERADOS=$((LIBERADOS + COMPILE))
  fi
  if [ "$CACHE_NPM" -gt "$TOPE_CACHE_NPM" ]; then
    rm -rf "$HOME/.npm/_cacache" && LIBERADOS=$((LIBERADOS + CACHE_NPM))
  fi
  if [ "$LIBERADOS" -gt 0 ]; then
    # Se vuelve a medir antes de informar: repetir los números de antes de limpiar haría
    # desconfiar de la salida justo cuando acaba de hacer algo.
    CUENTA="$(contar "$HOME")"
    CACHE_NPM="$(contar "$HOME/.npm/_cacache")"
    COMPILE="$(contar "$HOME/tmp/node-compile-cache")"
    LIBRES=$((TECHO_REAL - CUENTA))
    AVISOS=()
    [ "$CUENTA" -gt "$ALERTA_CUENTA" ] && AVISOS+=("la cuenta sigue en $CUENTA y el despliegue se detiene sobre $ALERTA_CUENTA (quedan $LIBRES)")
    echo "LIMPIEZA: $LIBERADOS entradas liberadas; la cuenta queda en $CUENTA."
  else
    echo "LIMPIEZA: nada superaba su tope; no se borró nada."
  fi
fi

if [ "$MODO" = 'informe' ] || [ "${#AVISOS[@]}" -gt 0 ]; then
  printf 'INODOS %s/%s (quedan %s)  papelera %s  npm %s  node_modules %s  compilacion %s  assets %s (%s sin uso)\n' \
    "$CUENTA" "$TECHO_REAL" "$LIBRES" "$PAPELERA" "$CACHE_NPM" "$NODE_MODULES" "$COMPILE" \
    "$ASSETS_TOTAL" "$ASSETS_HUERFANOS"
  for aviso in "${AVISOS[@]:-}"; do [ -n "$aviso" ] && echo "  AVISO: $aviso"; done
  [ "$CUENTA" -gt "$OBJETIVO_CUENTA" ] && [ "$CUENTA" -le "$ALERTA_CUENTA" ] && \
    echo "  Sobre el objetivo de $OBJETIVO_CUENTA de la politica, aun bajo el corte del despliegue."
  echo "  Serie completa en $CSV"
fi

exit 0
