#!/usr/bin/env bash
# Borra archivos antiguos de la web publicada que ninguna versión vigente usa.
#
# Cada despliegue agrega sus archivos con nombre único a `assets` y deja los anteriores, para que
# quien tenga la página abierta durante el cambio no quede con pantallas rotas. Sin limpieza se
# acumulan hasta superar el límite de archivos de la cuenta y el control de inodos detiene el
# despliegue. Esta limpieza es conservadora:
#
# - Sólo mira `assets` dentro de la carpeta autorizada del subdominio; nunca otra carpeta.
# - Sólo archivos con más de 30 días.
# - Conserva todo lo que nombran el `index.html` o `sw.js` publicados y los de la versión nueva.
# - Si falta alguno de esos archivos de referencia, no borra nada.
set -euo pipefail

readonly EXPECTED_FRONTEND="/home/espartanoscl/public_html/cuartel.espartanos.cl"
readonly DIAS=30

FRONTEND="${FRONTEND_DEPLOYPATH:-}"
if [ "$FRONTEND" != "$EXPECTED_FRONTEND" ]; then
  echo "PODA ASSETS: carpeta no autorizada (${FRONTEND:-sin-definir}); no se borra nada."
  exit 0
fi

ASSETS="$FRONTEND/assets"
if [ ! -d "$ASSETS" ]; then
  echo "PODA ASSETS: no existe $ASSETS; nada que limpiar."
  exit 0
fi

REFERENCIAS=("$FRONTEND/index.html" "$FRONTEND/sw.js" "apps/web/dist/index.html" "apps/web/dist/sw.js")
for referencia in "${REFERENCIAS[@]}"; do
  if [ ! -s "$referencia" ]; then
    echo "PODA ASSETS: falta $referencia; por seguridad no se borra nada."
    exit 0
  fi
done

# Nombres de archivo que alguna versión vigente todavía usa.
EN_USO="$(cat "${REFERENCIAS[@]}" | grep -oE '[A-Za-z0-9._-]+\.(js|css|woff2?|png|jpe?g|svg|webp|avif|ico|json|webmanifest)' | sort -u)"
# La versión nueva completa: todo lo que trae su carpeta assets se conserva aunque ya existiera.
if [ -d "apps/web/dist/assets" ]; then
  EN_USO="$(printf '%s\n%s\n' "$EN_USO" "$(find apps/web/dist/assets -type f -printf '%f\n')" | sort -u)"
fi

# Tuberias y un archivo temporal en vez de `<(...)`: CloudLinux CageFS no expone /dev/fd.
LISTA_EN_USO="$(mktemp)"
trap 'rm -f "$LISTA_EN_USO"' EXIT
printf '%s
' "$EN_USO" > "$LISTA_EN_USO"

BORRADOS="$(
  find "$ASSETS" -xdev -type f -mtime +"$DIAS" -print |
    while IFS= read -r archivo; do
      if ! grep -qxF -- "$(basename "$archivo")" "$LISTA_EN_USO"; then
        rm -f -- "$archivo" && echo borrado
      fi
    done | wc -l
)"

echo "PODA ASSETS: $BORRADOS archivos con mas de $DIAS dias sin uso eliminados; quedan $(find "$ASSETS" -type f | wc -l)."
