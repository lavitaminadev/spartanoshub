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

if [ -e "$APP_ROOT/node_modules" ] && [ ! -L "$APP_ROOT/node_modules" ]; then
  echo "NPM INSTALL: node_modules es una carpeta fisica; CloudLinux exige un symlink al Node.js Selector." >&2
  echo "NPM INSTALL: restaura el enlace desde Setup Node.js App antes de desplegar." >&2
  exit 1
fi

# `npm install` y no `npm ci`, aunque `ci` sea lo habitual en un despliegue.
#
# `npm ci` borra `node_modules` antes de instalar. Aquí eso no es limpieza: en CloudLinux el
# `node_modules` de la raíz es un **symlink** al entorno virtual que crea el Node.js Selector, y
# borrarlo lo sustituye por una carpeta corriente. Desde ese momento la resolución de módulos deja
# de pasar por el entorno y el arranque revienta en un `require` distinto cada vez —una vez en
# `class-serializer.interceptor`, otra en `controller.decorator`—, que es lo que hace que parezca
# un paquete ausente cuando no falta ninguno.
#
# `npm install` escribe dentro del enlace sin tocarlo. A cambio no garantiza la instalación exacta
# del `package-lock.json`, y esa es la contrapartida aceptada: una versión menor distinta es
# recuperable, un despliegue que deja la aplicación sin arrancar no lo es.
# Fuerza los workspaces: sin esta opción npm puede conservar solo las dependencias
# de la raíz y podar las del API, dejando módulos de producción como dotenv fuera
# del entorno de Passenger.
npm install --omit=dev --workspaces --include-workspace-root

# El enlace tiene que seguir siendo un enlace al terminar. Si algo lo convirtió en carpeta, la
# aplicación arrancaría a medias y el fallo aparecería horas después, lejos del despliegue.
if [ -e "$APP_ROOT/node_modules" ] && [ ! -L "$APP_ROOT/node_modules" ]; then
  echo "NPM INSTALL: node_modules dejo de ser un symlink; CloudLinux lo exige asi." >&2
  echo "Borralo desde el Administrador de archivos y usa «Run NPM Install» del Node.js Selector." >&2
  exit 1
fi
