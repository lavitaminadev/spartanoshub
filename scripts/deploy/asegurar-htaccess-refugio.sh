#!/usr/bin/env bash
# Repone los dos añadidos manuales del `.htaccess` del subdominio de la API.
#
# Ese archivo lo genera CloudLinux al crear la aplicación Node y lo vuelve a generar si alguien
# recrea el subdominio, borrando lo que se le haya añadido a mano. Son dos bloques, y el primero
# no es cosmético:
#
#   1. `RewriteEngine Off` — WordPress vive en `public_html/` y su `.htaccess` se hereda hacia
#      los subdominios. Sin esta línea, toda petición sin archivo real acaba reescrita a
#      `/index.php` y la API devuelve 500 **sin una sola línea en `passenger-error.log`**,
#      porque el error es de Apache y no de la aplicación. Es el fallo más difícil de
#      diagnosticar que ha tenido este servidor.
#   2. `Header always unset X-Powered-By` — deja de publicar la versión de Passenger.
#
# Esperar a que alguien se acuerde de reponerlos es esperar a que vuelva a pasar. Por eso esto
# corre en cada despliegue, pero con el freno puesto:
#
# - Sólo toca la ruta autorizada del subdominio de la API; ninguna otra, y nunca la de WordPress.
# - Si los dos bloques ya están —el caso normal— no escribe nada y sale.
# - Antes de escribir deja un respaldo con fecha.
# - Después de escribir comprueba que la API siga respondiendo y, si no responde, **restaura el
#   respaldo por su cuenta**. Un despliegue no puede dejar la API caída por una cabecera.
# - Nunca detiene el despliegue: ante cualquier imprevisto sale sin tocar nada más.
set -uo pipefail
trap 'echo "HTACCESS API: imprevisto; no se toca nada más y el despliegue sigue."; exit 0' ERR

readonly ARCHIVO="/home/espartanoscl/public_html/refugio.espartanos.cl/.htaccess"
readonly SALUD="https://refugio.espartanos.cl/api/health"
readonly MARCA_REWRITE="RewriteEngine Off"
readonly MARCA_CABECERA="Header always unset X-Powered-By"

if [ ! -f "$ARCHIVO" ]; then
  echo "HTACCESS API: no existe $ARCHIVO; se deja como está."
  exit 0
fi

falta_rewrite=0
falta_cabecera=0
grep -qF "$MARCA_REWRITE" "$ARCHIVO" || falta_rewrite=1
grep -qF "$MARCA_CABECERA" "$ARCHIVO" || falta_cabecera=1

if [ "$falta_rewrite" -eq 0 ] && [ "$falta_cabecera" -eq 0 ]; then
  echo "HTACCESS API: los dos bloques están; no se toca nada."
  exit 0
fi

readonly RESPALDO="${ARCHIVO}.bak-$(date +%Y%m%d-%H%M%S)"
cp -p "$ARCHIVO" "$RESPALDO"
echo "HTACCESS API: falta algo. Respaldo en $RESPALDO"

# Los dos van envueltos en `<IfModule>` a propósito: si el módulo no estuviera cargado, una
# directiva suelta hace que Apache rechace el archivo entero y devuelva 500 en cada petición.
if [ "$falta_rewrite" -eq 1 ]; then
  cat >> "$ARCHIVO" <<'BLOQUE'

# Este subdominio sirve la API por Passenger, no WordPress.
# Sin esta linea hereda las reglas de reescritura de public_html/.htaccess
# y toda peticion sin archivo real termina reescrita a /index.php.
<IfModule mod_rewrite.c>
RewriteEngine Off
</IfModule>
BLOQUE
  echo "HTACCESS API: repuesto RewriteEngine Off"
fi

if [ "$falta_cabecera" -eq 1 ]; then
  cat >> "$ARCHIVO" <<'BLOQUE'

# Passenger anuncia su version en cada respuesta. No abre ninguna puerta, pero tampoco
# hay motivo para publicar que version corre.
<IfModule mod_headers.c>
Header always unset X-Powered-By
</IfModule>
BLOQUE
  echo "HTACCESS API: repuesta la cabecera oculta"
fi

# Se comprueba sólo cuando se escribió algo. Passenger puede estar arrancando justo ahora, así
# que se reintenta antes de dar nada por roto: un despliegue no debe revertir por impaciencia.
codigo=""
for intento in 1 2 3 4 5; do
  # Sin el `|| true`, `set -o pipefail` mas el `trap ERR` abortarian el script en el primer
  # intento fallido, que es justo cuando hay que reintentar. Curl ya escribe `000` si no conecta.
  codigo="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$SALUD" 2>/dev/null || true)"
  codigo="${codigo:-000}"
  [ "$codigo" = "200" ] && break
  sleep 5
done

if [ "$codigo" = "200" ]; then
  echo "HTACCESS API: la API responde 200 con los bloques puestos."
  exit 0
fi

cp -p "$RESPALDO" "$ARCHIVO"
echo "HTACCESS API: la API respondió '$codigo' tras el cambio. Se restauró el respaldo."
echo "HTACCESS API: revisa a mano $ARCHIVO antes de volver a intentarlo."
exit 0
