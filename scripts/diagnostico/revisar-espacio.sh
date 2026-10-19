#!/usr/bin/env bash
# Cuánto pesa y cuántos archivos tiene la cuenta, y dónde están.
#
# Uso:   bash scripts/diagnostico/revisar-espacio.sh
#
# En este hosting el límite que detiene un despliegue no es el de megas: es el de **inodos**, que
# es la cuenta de archivos y carpetas. Veinte mil archivos de un kilobyte no ocupan nada y agotan
# la cuota igual. Por eso aquí se miden las dos cosas por separado, y todo se ordena por número de
# entradas y no por tamaño.
#
# Los umbrales son los mismos de `scripts/deploy/check-inodes.sh`, que es quien detiene el
# despliegue: si este diagnóstico dice que algo está al límite, el próximo despliegue se corta.
#
# Solo lee. No borra nada, no despliega y no reinicia. Al final imprime los comandos de limpieza
# para que los ejecutes tú, mirando antes qué se llevan.
set -uo pipefail

readonly HOGAR="${HOME:-/home/espartanoscl}"
readonly APP="$HOGAR/repositories/spartanoshub"
readonly FRONTEND="$HOGAR/public_html/cuartel.espartanos.cl"
readonly RUNTIME="$HOGAR/nodevenv/repositories/spartanoshub/22/lib/node_modules"

# Los mismos de check-inodes.sh. Si allí cambian, aquí también.
readonly TOPE_CUENTA=60000
readonly TOPE_PAPELERA=2000
readonly TOPE_CACHE_NPM=500
readonly TOPE_NODE_MODULES=28000

titulo() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

# Entradas de un árbol: archivos más carpetas, que es lo que consume inodos. `-xdev` no cruza a
# otro sistema de archivos, y los errores se descartan porque CageFS esconde rutas que no importan.
entradas() {
  [ -e "$1" ] || { printf '0\n'; return; }
  find "$1" -xdev -mindepth 1 -printf '.' 2>/dev/null | wc -c
}

# Tamaño legible de un árbol, o un guion si no existe.
peso() {
  [ -e "$1" ] || { printf '%s\n' '-'; return; }
  du -sh "$1" 2>/dev/null | cut -f1
}

semaforo() {
  local actual="$1" tope="$2"
  if [ "$actual" -gt "$tope" ]; then printf 'SUPERADO'
  elif [ "$actual" -gt $((tope * 80 / 100)) ]; then printf 'al límite'
  else printf 'ok'; fi
}

titulo "1. La cuota de la cuenta, según el hosting"
# `quota` es la verdad del hosting y puede no estar disponible dentro de CageFS; cuando falta, las
# secciones siguientes siguen sirviendo porque cuentan el árbol a mano.
if command -v quota >/dev/null 2>&1; then
  quota -s 2>/dev/null || echo "  (quota no responde dentro de CageFS; usa las secciones siguientes)"
else
  echo "  (sin comando quota; usa las secciones siguientes)"
fi

titulo "2. Lo que mide el guardián del despliegue"
cuenta="$(entradas "$HOGAR")"
papelera="$(entradas "$HOGAR/.trash")"
cache_npm="$(entradas "$HOGAR/.npm/_cacache")"
node_modules="$(entradas "$APP/node_modules")"
printf '  %-22s %7s / %-7s %s\n' \
  'cuenta entera'   "$cuenta"       "$TOPE_CUENTA"       "$(semaforo "$cuenta" "$TOPE_CUENTA")" \
  'papelera'        "$papelera"     "$TOPE_PAPELERA"     "$(semaforo "$papelera" "$TOPE_PAPELERA")" \
  'cache de npm'    "$cache_npm"    "$TOPE_CACHE_NPM"    "$(semaforo "$cache_npm" "$TOPE_CACHE_NPM")" \
  'node_modules'    "$node_modules" "$TOPE_NODE_MODULES" "$(semaforo "$node_modules" "$TOPE_NODE_MODULES")"
echo
echo "  Cualquier 'SUPERADO' detiene el próximo despliegue antes de reiniciar la aplicación."

titulo "3. Dónde están los archivos, por número de entradas"
# Ordenado por entradas y no por tamaño: es el recurso que se agota primero.
for ruta in \
  "$APP/node_modules" "$RUNTIME" "$HOGAR/.npm" "$HOGAR/.cache" "$HOGAR/.trash" \
  "$FRONTEND/assets" "$FRONTEND" "$APP/apps/api/dist" "$APP/apps/web/dist" \
  "$APP/packages/shared/dist" "$APP/.git" "$APP/logs" "$HOGAR/logs" "$HOGAR/.cpanel/logs" \
  "$HOGAR/mail" "$HOGAR/tmp" "$HOGAR/public_html"
do
  printf '%8s  %6s  %s\n' "$(entradas "$ruta")" "$(peso "$ruta")" "${ruta#"$HOGAR"/}"
done | sort -rn

titulo "4. Cachés que se pueden vaciar sin consecuencias"
# Se regeneran solas. Son el primer sitio donde buscar espacio.
for ruta in \
  "$HOGAR/.npm/_cacache" "$HOGAR/.cache" "$APP/node_modules/.cache" \
  "$APP/apps/web/node_modules/.vite" "$APP/.vite" "$HOGAR/.pm2" "$HOGAR/.config/configstore"
do
  [ -e "$ruta" ] && printf '%8s  %6s  %s\n' "$(entradas "$ruta")" "$(peso "$ruta")" "${ruta#"$HOGAR"/}"
done
echo "  Los .tsbuildinfo también, pero pesan poco:"
find "$APP" -xdev -name '*.tsbuildinfo' -not -path '*/node_modules/*' -printf '  %10s  %p\n' 2>/dev/null | head -5

titulo "5. Lo publicado: archivos viejos que ya nadie pide"
# Cada despliegue agrega sus archivos con hash y deja los anteriores a propósito, para que quien
# tenga la página abierta no quede con pantallas rotas. `prune-old-assets.sh` los borra a los 30
# días; esto sólo cuenta cuántos hay esperando.
if [ -d "$FRONTEND/assets" ]; then
  printf '  assets en total:        %s\n' "$(entradas "$FRONTEND/assets")"
  printf '  con más de 30 días:     %s\n' "$(find "$FRONTEND/assets" -xdev -type f -mtime +30 2>/dev/null | wc -l)"
  printf '  los pide el index/sw:   %s\n' \
    "$(grep -oh 'assets/[A-Za-z0-9._-]*' "$FRONTEND/index.html" "$FRONTEND/sw.js" 2>/dev/null | sort -u | wc -l)"
  echo "  (los que nadie pide y pasan de 30 días los retira la poda del despliegue)"
else
  echo "  No existe $FRONTEND/assets"
fi

titulo "6. Registros, que crecen sin que nadie los mire"
for ruta in "$HOGAR/logs" "$APP/logs" "$HOGAR/.cpanel/logs"; do
  [ -d "$ruta" ] || continue
  printf '  %s  (%s, %s entradas)\n' "${ruta#"$HOGAR"/}" "$(peso "$ruta")" "$(entradas "$ruta")"
  ls -S "$ruta" 2>/dev/null | head -3 | sed 's/^/      /'
done

titulo "7. node_modules duplicados"
# Producción admite un solo árbol de dependencias. Un segundo árbol son miles de inodos y es,
# además, lo que detiene el despliegue.
find "$HOGAR" -xdev -type d -name node_modules -prune -print 2>/dev/null | while IFS= read -r arbol; do
  if [ "$arbol" = "$APP/node_modules" ]; then printf '  productivo:  %s\n' "$arbol"
  elif [ "$arbol" = "$RUNTIME" ]; then printf '  runtime:     %s\n' "$arbol"
  elif [ -n "$(find "$arbol" -xdev -mindepth 1 ! -type d -print -quit 2>/dev/null)" ]; then
    printf '  DUPLICADO:   %s  (%s entradas)\n' "$arbol" "$(entradas "$arbol")"
  fi
done
if [ -L "$APP/node_modules" ]; then
  echo "  node_modules es un enlace, como CloudLinux exige."
elif [ -e "$APP/node_modules" ]; then
  echo "  node_modules ES UNA CARPETA — CloudLinux lo exige como enlace."
fi

printf '\n\033[1m== Limpieza, en orden de menor riesgo ==\033[0m\n'
cat <<'FIN'
  1. Caché de npm           npm cache clean --force
  2. Papelera de cPanel     rm -rf ~/.trash/*
  3. Cachés de compilación  rm -rf ~/.cache ~/repositories/spartanoshub/node_modules/.cache
  4. Assets viejos          bash scripts/deploy/prune-old-assets.sh   (ya corre en cada despliegue)
  5. Correo acumulado       revisa ~/mail antes de tocar nada: ahí hay datos, no basura

  Lo que NO se borra:
    - node_modules de produccion ni el runtime de CloudLinux: la aplicacion no arranca.
    - los dist/ del repositorio: estan commiteados a proposito, el servidor no compila.
    - assets con menos de 30 dias: alguien puede tener la pagina abierta pidiendolos.
    - ~/.cpanel/logs: es el unico sitio donde queda por que fallo un despliegue.
FIN
