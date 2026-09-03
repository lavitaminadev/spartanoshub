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
# El selector Node de cPanel no resuelve de forma fiable selectores de workspace por
# nombre. Al activar la instalación de workspaces, npm instala las dependencias de
# producción declaradas por el monorepo (incluida la API y dotenv), sin devDependencies.
runtime_dependencies_resolve() {
  node -e "for (const dependency of ['dotenv', '@nestjs/core', 'typeorm', 'mysql2', '@espartanos/shared']) { console.log('NPM INSTALL: runtime disponible ' + dependency + ' -> ' + require.resolve(dependency)); }"
}

# Algunos Node.js Selector deshabilitan workspaces pese a que el package.json los
# declara correctamente. La vía alternativa instala en el mismo runtime los paquetes
# productivos declarados por la API y el paquete compartido local, sin modificar el
# manifiesto ni el lockfile. Así un comportamiento particular de npm no bloquea un deploy.
if ! npm install --omit=dev --workspaces --include-workspace-root || ! runtime_dependencies_resolve; then
  echo "NPM INSTALL: workspaces no disponibles; usando instalacion compatible de runtime."
  RUNTIME_PACKAGES="$(node -e 'const api = require("./apps/api/package.json"); process.stdout.write(Object.entries(api.dependencies).filter(([name]) => name !== "@espartanos/shared").map(([name, version]) => `${name}@${version}`).join(" "));')"
  test -n "$RUNTIME_PACKAGES" || { echo "NPM INSTALL: no se encontraron dependencias productivas de la API" >&2; exit 1; }
  npm install --omit=dev --workspaces=false --no-save --package-lock=false ./packages/shared $RUNTIME_PACKAGES
fi

runtime_dependencies_resolve

# El enlace tiene que seguir siendo un enlace al terminar. Si algo lo convirtió en carpeta, la
# aplicación arrancaría a medias y el fallo aparecería horas después, lejos del despliegue.
if [ -e "$APP_ROOT/node_modules" ] && [ ! -L "$APP_ROOT/node_modules" ]; then
  echo "NPM INSTALL: node_modules dejo de ser un symlink; CloudLinux lo exige asi." >&2
  echo "Borralo desde el Administrador de archivos y usa «Run NPM Install» del Node.js Selector." >&2
  exit 1
fi
