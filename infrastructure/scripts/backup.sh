#!/bin/bash
# Backup MySQL seguro: la clave se entrega a mysqldump mediante un archivo temporal 0600.
set -euo pipefail

BACKUP_DIR="${1:-$HOME/vitahub_backups}"
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
DB_NAME="${DB_DATABASE:?DB_DATABASE must be set}"
DB_USER="${DB_USERNAME:?DB_USERNAME must be set}"
: "${DB_PASSWORD:?DB_PASSWORD must be set}"
DB_HOST_VALUE="${DB_HOST:-localhost}"
DB_PORT_VALUE="${DB_PORT:-3306}"
RETENTION_DAYS_VALUE="${RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"
chmod 750 "$BACKUP_DIR"

CREDENTIALS_FILE="$(mktemp)"
trap 'rm -f "$CREDENTIALS_FILE"' EXIT
chmod 600 "$CREDENTIALS_FILE"
printf '[client]\npassword=%s\n' "$DB_PASSWORD" > "$CREDENTIALS_FILE"

BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"
mysqldump \
  --defaults-extra-file="$CREDENTIALS_FILE" \
  --host="$DB_HOST_VALUE" \
  --port="$DB_PORT_VALUE" \
  --user="$DB_USER" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  "$DB_NAME" | gzip > "$BACKUP_FILE"
chmod 640 "$BACKUP_FILE"

find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f -mtime "+$RETENTION_DAYS_VALUE" -delete
printf 'Backup creado: %s\n' "$BACKUP_FILE"
