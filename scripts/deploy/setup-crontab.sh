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

# Ejecutar el instalador varias veces reemplaza las tareas anteriores en vez de duplicarlas.
# Los rotulos y rutas en desuso siguen en la lista a proposito: son los que dejaron las
# instalaciones previas, y quitarlos de aqui haria que esas lineas se acumularan en el crontab.
EXISTING="$(crontab -l 2>/dev/null | grep -v '# Spartanoshub' | grep -v '# Espartanos' | grep -v '# VitaHub' | grep -v "$CRON_URL" | grep -v 'infrastructure/scripts/backup.sh' | grep -v 'scripts/deploy/check-inodes.sh' | grep -v 'vitahub/logs/cron-' || true)"

echo "Instalando tareas para $CRON_URL..."
{
  printf '%s\n' "$EXISTING"
  cat <<EOF

# Spartanoshub - Meta CAPI outbox (cada 5 minutos)
*/5 * * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/meta-capi" -H "Content-Type: application/json" -d '{"limit":50}' -m 60 >> $APP_DIR/logs/cron-meta-capi.log 2>&1

# Spartanoshub - Meta CAPI diagnostics (cada hora)
0 * * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - "$CRON_URL/meta-capi/diagnostics" -m 30 >> $APP_DIR/logs/cron-meta-capi-diag.log 2>&1

# Spartanoshub - Piezas estancadas (cada hora)
10 * * * * set -a && . $APP_DIR/.env && set +a && echo "header = \"x-cron-secret: \$CRON_SECRET\"" | curl -s --config - -X POST "$CRON_URL/stale-pieces" -m 60 >> $APP_DIR/logs/cron-stale-pieces.log 2>&1

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

# Spartanoshub - Backup MySQL local (diario, 03:00; retencion de 30 dias)
0 3 * * * set -a && . $APP_DIR/.env && set +a && RETENTION_DAYS=30 bash $APP_DIR/infrastructure/scripts/backup.sh \$HOME/espartanos_backups >> $APP_DIR/logs/cron-backup.log 2>&1

# Spartanoshub - Alerta de inodos (lunes, 04:15; solo lectura)
15 4 * * 1 cd $APP_DIR && /bin/bash scripts/deploy/check-inodes.sh >/dev/null
EOF
} | crontab -

echo "Crontab actualizado. Verifica las entradas con: crontab -l"
echo "Los logs se escriben en: $APP_DIR/logs/"
