#!/usr/bin/env bash
# Traslado de los directorios de datos al nombre de marca vigente.
#
# Los directorios guardan archivos subidos y respaldos: renombrarlos en la configuracion sin
# mover el contenido dejaria la aplicacion apuntando a un directorio vacio y sin acceso a lo ya
# almacenado. Este script hace el traslado durante el despliegue, antes de que la aplicacion se
# reinicie con la ruta nueva.
#
# Es idempotente: en el segundo despliegue no queda nada que mover y solo verifica permisos.
set -euo pipefail

# Pares "nombre_anterior:nombre_actual" bajo $HOME.
readonly DIRECTORIES=(
  "vitahub_storage:espartanos_storage"
  "vitahub_uploads:espartanos_uploads"
  "vitahub_backups:espartanos_backups"
)

readonly MODE=750

for pair in "${DIRECTORIES[@]}"; do
  previous="$HOME/${pair%%:*}"
  current="$HOME/${pair##*:}"

  if [ -d "$previous" ] && [ ! -e "$current" ]; then
    # Camino habitual: el directorio entero cambia de nombre, sin copiar archivo por archivo.
    mv "$previous" "$current"
    echo "Directorio trasladado: ${pair%%:*} -> ${pair##*:}"
  elif [ -d "$previous" ] && [ -d "$current" ]; then
    # Un despliegue interrumpido pudo dejar los dos. Se traslada lo que falte sin pisar nada
    # de lo que ya vive en el directorio actual, y el anterior se retira solo si queda vacio.
    find "$previous" -mindepth 1 -maxdepth 1 -exec mv -n {} "$current"/ \;
    rmdir "$previous" 2>/dev/null || echo "Quedan archivos en ${pair%%:*}: se conserva para revision" >&2
  fi

  mkdir -p "$current"
  chmod "$MODE" "$current"
done
