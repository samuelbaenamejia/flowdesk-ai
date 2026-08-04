#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_ROOT="/var/backups/flowdesk"
BACKUP_DIR="$BACKUP_ROOT/$(date +%Y%m%d)"
TIMESTAMP="$(date +%Y-%m-%dT%H:%M:%S%z)"

echo "[$TIMESTAMP] Starting backup to $BACKUP_DIR"

mkdir -p -m 700 "$BACKUP_DIR"

# Strip SQLAlchemy driver prefix for libpq compatibility
PG_DUMP_URL="${DATABASE_URL/+asyncpg/}"

echo "[$TIMESTAMP] Backing up PostgreSQL..."
pg_dump --no-owner --no-acl -Fc -d "$PG_DUMP_URL" -f "$BACKUP_DIR/postgres.dump"
echo "[$TIMESTAMP] PostgreSQL backup complete"

echo "[$TIMESTAMP] Stopping n8n for consistent volume backup..."
docker stop n8n || echo "Warning: n8n was not running"

echo "[$TIMESTAMP] Backing up n8n_data volume..."
docker run --rm -v n8n_data:/data -v "$BACKUP_DIR":/backups alpine \
    tar czf /backups/n8n_data.tar.gz -C /data .

echo "[$TIMESTAMP] Starting n8n..."
docker start n8n || echo "Warning: could not start n8n"

echo "[$TIMESTAMP] Exporting n8n workflows via API..."
N8N_EXPORT_FILE="$BACKUP_DIR/n8n_workflows.json"
HTTP_CODE=$(curl -s -o "$N8N_EXPORT_FILE" -w "%{http_code}" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/rest/workflows" 2>/dev/null || true)

if [ "$HTTP_CODE" != "200" ]; then
    echo "ERROR: n8n API returned HTTP $HTTP_CODE (expected 200)"
    rm -f "$N8N_EXPORT_FILE"
    exit 1
fi

if ! jq -e . >/dev/null 2>&1 < "$N8N_EXPORT_FILE"; then
    echo "ERROR: n8n response is not valid JSON"
    rm -f "$N8N_EXPORT_FILE"
    exit 1
fi

gzip -f "$N8N_EXPORT_FILE"
echo "[$TIMESTAMP] n8n workflow export complete"

echo "[$TIMESTAMP] Backing up configuration files..."
cp "$PROJECT_DIR/backend/.env" "$BACKUP_DIR/.env" 2>/dev/null || echo "Warning: no .env found at $PROJECT_DIR/backend/.env"
cp "$PROJECT_DIR/infra/Caddyfile" "$BACKUP_DIR/" 2>/dev/null || true
cp "$PROJECT_DIR/infra/docker-compose.yml" "$BACKUP_DIR/" 2>/dev/null || true
cp "$PROJECT_DIR/infra/docker-compose.prod.yml" "$BACKUP_DIR/" 2>/dev/null || true
cp "$PROJECT_DIR/infra/docker-compose.proxy.yml" "$BACKUP_DIR/" 2>/dev/null || true
echo "[$TIMESTAMP] Configuration backup complete"

# Retention: keep last 7 daily backups
echo "[$TIMESTAMP] Cleaning up backups older than 7 days..."
find "$BACKUP_ROOT" -maxdepth 1 -type d -mtime +7 -exec rm -rf {} + 2>/dev/null || true
echo "[$TIMESTAMP] Retention cleanup complete"

echo "[$TIMESTAMP] Backup complete — size: $(du -sh "$BACKUP_DIR" | cut -f1)"
