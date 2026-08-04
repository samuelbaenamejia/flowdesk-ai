#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_ROOT="/var/backups/flowdesk"

if [ $# -lt 1 ]; then
    echo "Usage: $0 <backup-date-YYYYMMDD>"
    echo ""
    echo "Available backups:"
    ls "$BACKUP_ROOT" 2>/dev/null || echo "  (no backups found)"
    exit 1
fi

BACKUP_DIR="$BACKUP_ROOT/$1"

if [ ! -d "$BACKUP_DIR" ]; then
    echo "ERROR: Backup directory not found: $BACKUP_DIR"
    exit 1
fi

# Strip SQLAlchemy driver prefix for libpq compatibility
PG_DUMP_URL="${DATABASE_URL/+asyncpg/}"

echo "=== RESTORE: $1 ==="
echo "Source: $BACKUP_DIR"
echo ""

echo "[1/3] Restoring PostgreSQL..."
if [ -f "$BACKUP_DIR/postgres.dump" ]; then
    pg_restore -d "$PG_DUMP_URL" --clean --if-exists "$BACKUP_DIR/postgres.dump"
    echo "  PostgreSQL restore complete"
else
    echo "  WARNING: No PostgreSQL dump found at $BACKUP_DIR/postgres.dump — skipping"
fi

echo ""
echo "[2/3] Restoring n8n_data volume..."
if [ -f "$BACKUP_DIR/n8n_data.tar.gz" ]; then
    echo "  Stopping n8n..."
    docker stop n8n 2>/dev/null || true
    docker run --rm -v n8n_data:/data -v "$BACKUP_DIR":/backups alpine \
        tar xzf /backups/n8n_data.tar.gz -C /data
    echo "  Starting n8n..."
    docker start n8n 2>/dev/null || true
    echo "  n8n_data volume restore complete"
else
    echo "  WARNING: No n8n_data backup found at $BACKUP_DIR/n8n_data.tar.gz — skipping"
fi

echo ""
echo "[3/3] Manual steps:"
echo "  - n8n workflows: import from $BACKUP_DIR/n8n_workflows.json.gz (if present)"
echo "  - .env:         $BACKUP_DIR/.env (if present)"
echo "  - Caddyfile:    $BACKUP_DIR/Caddyfile (if present)"
echo "  - compose files: $BACKUP_DIR/docker-compose*.yml (if present)"
echo ""
echo "Restore complete. Run 'docker compose up -d' if services are not running."
