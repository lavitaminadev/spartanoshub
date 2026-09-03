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
# CloudLinux entrega npm con los workspaces deshabilitados. Forzarlos falla con
# "No workspaces found"; omitirlos, en cambio, puede podar las dependencias del
# API. Nunca hacemos una de esas dos operaciones sobre el runtime activo.
#
# El entorno de Node.js Selector se prepara fuera del despliegue y se valida aquí.
# Si falta una dependencia, se detiene antes de migrar, publicar o reiniciar.
required_modules=(
  "dotenv"
  "@nestjs/core"
  "@nestjs/common"
  "@nestjs/platform-express"
  "typeorm"
)

missing_modules=()
for required_module in "${required_modules[@]}"; do
  if [ ! -d "$APP_ROOT/node_modules/$required_module" ]; then
    missing_modules+=("$required_module")
  fi
done

if [ "${#missing_modules[@]}" -gt 0 ]; then
  echo "NPM INSTALL: faltan dependencias de produccion: ${missing_modules[*]}" >&2
  echo "NPM INSTALL: no se ejecuta npm install porque CloudLinux podria podar el API activo." >&2
  exit 1
fi

echo "NPM INSTALL: runtime de produccion validado; se omite reinstalacion destructiva."

# El enlace tiene que seguir siendo un enlace al terminar. Si algo lo convirtió en carpeta, la
# aplicación arrancaría a medias y el fallo aparecería horas después, lejos del despliegue.
if [ -e "$APP_ROOT/node_modules" ] && [ ! -L "$APP_ROOT/node_modules" ]; then
  echo "NPM INSTALL: node_modules dejo de ser un symlink; CloudLinux lo exige asi." >&2
  echo "Borralo desde el Administrador de archivos y usa «Run NPM Install» del Node.js Selector." >&2
  exit 1
fi
