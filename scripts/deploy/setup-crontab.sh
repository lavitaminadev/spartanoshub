#!/bin/bash
# Instala las tareas programadas de Spartanoshub sin guardar CRON_SECRET en crontab.
# Uso: bash scripts/deploy/setup-crontab.sh https://refugio.espartanos.cl
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Uso: $0 https://refugio.espartanos.cl" >&2
  exit 1
fi

API_ORIGIN="${1%/}"
APP_DIR="${APP_DIR:-$HOME/repositories/spartanoshub}"

if [ "$API_ORIGIN" != "https://refugio.espartanos.cl" ]; then
  echo "Error: las tareas solo pueden apuntar a https://refugio.espartanos.cl" >&2
  exit 1
fi

if [ ! -f "$APP_DIR/.env" ]; then
  echo "Error: no se encontro $APP_DIR/.env" >&2
  echo "Define APP_DIR=/ruta/al/repo si el proyecto esta en otra carpeta." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090 -- APP_DIR define la ruta productiva de cPanel.
. "$APP_DIR/.env"
set +a
if [[ ! "${CRON_SECRET:-}" =~ ^[A-Za-z0-9_-]{32,128}$ ]]; then
  echo "Error: CRON_SECRET debe tener 32-128 caracteres alfanumericos, '_' o '-'." >&2
  exit 1
fi
unset CRON_SECRET

CRON_URL="$API_ORIGIN/api/cron"
mkdir -p "$APP_DIR/logs"
chmod 750 "$APP_DIR/logs"

# Tareas que este script instala. Es la unica lista que decide que lineas del crontab se reemplazan:
# al reinstalar se quitan las lineas cuya URL es exactamente $CRON_URL/<nombre>, con la comilla de
# cierre incluida, de modo que `meta-capi` no alcanza a `meta-capi/cleanup` ni a `meta-capi/diagnostics`,
# ni `google-ads` a `google-ads/diagnostics`. Una linea manual hacia una ruta que no figura aqui se conserva.
# Toda tarea nueva que se agregue al heredoc de abajo debe sumarse tambien a esta lista.
TAREAS_GESTIONADAS=(
  meta-capi meta-capi/diagnostics meta-capi/cleanup campanas google-ads
  stale-pieces leads-parados operational-alerts xp-periods monthly-cycles collection-emails data-retention
  recordatorio-reservas recordatorio-tareas encuesta-post-visita cupon-post-visita cierre-asistencia
  cumpleanos resumen-diario reservation-integrations meta-lead-recovery
  automation-runs automation-schedule automation-webhooks automation-cleanup
)
FILTRO_TAREAS=()
for tarea in "${TAREAS_GESTIONADAS[@]}"; do
  FILTRO_TAREAS+=(-e "$CRON_URL/$tarea\"")
done

# Ejecutar el instalador varias veces reemplaza las tareas anteriores en vez de duplicarlas.
# Los rotulos y rutas en desuso siguen en la lista a proposito: son los que dejaron las
# instalaciones previas, y quitarlos de aqui haria que esas lineas se acumularan en el crontab.
EXISTING="$(crontab -l 2>/dev/null | grep -v '# Spartanoshub' | grep -v '# Espartanos' | grep -v '# VitaHub' | grep -v -F "${FILTRO_TAREAS[@]}" | grep -v 'infrastructure/scripts/backup.sh' | grep -v 'scripts/deploy/check-inodes.sh' | grep -v 'vitahub/logs/cron-' || true)"

echo "Instalando tareas para $CRON_URL..."
{
  printf '%s\n' "$EXISTING"
  cat <<EOF

# Spartanoshub - Meta CAPI outbox (cada 5 minutos)
*/5 * * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/meta-capi" -H "Content-Type: application/json" -d '{"limit":50}' -m 60 >> $APP_DIR/logs/cron-meta-capi.log 2>&1

# Spartanoshub - Campanas de correo (cada 5 minutos)
# Sin esta linea las campanas quedan encoladas y no sale ni un correo. El lote va acotado para que
# cada pasada quepa en el minuto que da el -m 60; una campana grande sale en varias pasadas.
*/5 * * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/campanas" -H "Content-Type: application/json" -d '{"limit":100}' -m 60 >> $APP_DIR/logs/cron-campanas.log 2>&1

# Spartanoshub - Meta CAPI diagnostics (cada hora)
0 * * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - "$CRON_URL/meta-capi/diagnostics" -m 30 >> $APP_DIR/logs/cron-meta-capi-diag.log 2>&1

# Spartanoshub - Piezas estancadas (cada hora)
10 * * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/stale-pieces" -m 60 >> $APP_DIR/logs/cron-stale-pieces.log 2>&1

# Spartanoshub - Leads parados (cada hora)
# Es el aviso que le dice al responsable que una ficha lleva días sin que nadie la toque, con los
# plazos que cada empresa configure. La tarea y el correo existian desde hace meses; esta linea
# no estaba, asi que no se envio ninguno: cada lead que esperaba se quedaba esperando en silencio.
# Cada hora y no cada cinco minutos: los plazos se miden en dias y el trabajo recorre las fichas
# abiertas, de modo que repetirlo mas seguido costaria sin adelantar nada.
15 * * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/leads-parados" -m 60 >> $APP_DIR/logs/cron-leads-parados.log 2>&1

# Spartanoshub - Alertas operativas (cada hora)
20 * * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/operational-alerts" -m 60 >> $APP_DIR/logs/cron-operational-alerts.log 2>&1

# Spartanoshub - Periodos de XP (cada 6 horas)
0 */6 * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/xp-periods" -m 60 >> $APP_DIR/logs/cron-xp-periods.log 2>&1

# Spartanoshub - Ciclos mensuales (diario, 03:10)
10 3 * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/monthly-cycles" -m 120 >> $APP_DIR/logs/cron-monthly-cycles.log 2>&1

# Spartanoshub - Emails de cobranza (diario, 03:20)
20 3 * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/collection-emails" -m 120 >> $APP_DIR/logs/cron-collection-emails.log 2>&1

# Spartanoshub - Retencion de datos (diario, 03:30)
30 3 * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/data-retention" -m 120 >> $APP_DIR/logs/cron-data-retention.log 2>&1

# Spartanoshub - Las tareas siguientes son las que el planificador interno corre por intervalo,
# con la misma cadencia que alli. Los minutos van repartidos para que no arranquen a la vez.

# Spartanoshub - Recordatorio de reservas (cada 30 minutos)
7,37 * * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/recordatorio-reservas" -m 60 >> $APP_DIR/logs/cron-recordatorio-reservas.log 2>&1

# Spartanoshub - Encuesta post-visita (cada 30 minutos)
12,42 * * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/encuesta-post-visita" -m 60 >> $APP_DIR/logs/cron-encuesta-post-visita.log 2>&1

# Spartanoshub - Cupon post-visita (cada hora)
25 * * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/cupon-post-visita" -m 60 >> $APP_DIR/logs/cron-cupon-post-visita.log 2>&1

# Spartanoshub - Cierre de asistencia (cada 15 minutos)
2,17,32,47 * * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/cierre-asistencia" -m 60 >> $APP_DIR/logs/cron-cierre-asistencia.log 2>&1

# Spartanoshub - Recordatorio de tareas del CRM (cada 30 minutos)
4,34 * * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/recordatorio-tareas" -m 60 >> $APP_DIR/logs/cron-recordatorio-tareas.log 2>&1

# Spartanoshub - Reintento de calendario y CRM de reservas (cada hora)
35 * * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/reservation-integrations" -m 60 >> $APP_DIR/logs/cron-reservation-integrations.log 2>&1

# Spartanoshub - Recuperacion de leads de Meta (cada 15 minutos)
6,21,36,51 * * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/meta-lead-recovery" -m 60 >> $APP_DIR/logs/cron-meta-lead-recovery.log 2>&1

# Spartanoshub - Conversiones de Google Ads (cada 5 minutos)
2-59/5 * * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/google-ads" -H "Content-Type: application/json" -d '{"limit":100}' -m 60 >> $APP_DIR/logs/cron-google-ads.log 2>&1

# Spartanoshub - Limpieza de la bandeja de Meta CAPI (domingo, 03:45)
45 3 * * 0 set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/meta-capi/cleanup" -m 120 >> $APP_DIR/logs/cron-meta-capi-cleanup.log 2>&1

# Spartanoshub - Automatizaciones: ejecuciones pendientes (cada minuto)
* * * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/automation-runs" -m 50 >> $APP_DIR/logs/cron-automation-runs.log 2>&1

# Spartanoshub - Automatizaciones: disparadores de tiempo (cada hora)
40 * * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/automation-schedule" -m 60 >> $APP_DIR/logs/cron-automation-schedule.log 2>&1

# Spartanoshub - Automatizaciones: entrega de webhooks (cada minuto)
* * * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/automation-webhooks" -m 50 >> $APP_DIR/logs/cron-automation-webhooks.log 2>&1

# Spartanoshub - Automatizaciones: limpieza (diario, 03:40)
40 3 * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/automation-cleanup" -m 120 >> $APP_DIR/logs/cron-automation-cleanup.log 2>&1

# Spartanoshub - Resumen diario del CRM (diario, 08:05)
5 8 * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/resumen-diario" -m 120 >> $APP_DIR/logs/cron-resumen-diario.log 2>&1

# Spartanoshub - Saludo de cumpleanos (diario, 08:15)
15 8 * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/cumpleanos" -m 120 >> $APP_DIR/logs/cron-cumpleanos.log 2>&1

# Spartanoshub - Backup MySQL local (diario, 03:00; retencion de 30 dias)
0 3 * * * set -a && . $APP_DIR/.env && set +a && RETENTION_DAYS=30 bash $APP_DIR/infrastructure/scripts/backup.sh \$HOME/espartanos_backups >> $APP_DIR/logs/cron-backup.log 2>&1

# Spartanoshub - Alerta de inodos (lunes, 04:15; solo lectura)
15 4 * * 1 cd $APP_DIR && /bin/bash scripts/deploy/check-inodes.sh >/dev/null
EOF
} | crontab -

echo "Crontab actualizado. Verifica las entradas con: crontab -l"
echo "Los logs se escriben en: $APP_DIR/logs/"
