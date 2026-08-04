#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BACKEND_TAG=${1:-latest}
FRONTEND_TAG=${2:-latest}

COMPOSE_BASE="-f infra/docker-compose.yml -f infra/docker-compose.prod.yml"

# Include monitoring stack if compose file exists (backward compatible)
if [ -f "$SCRIPT_DIR/monitoring/docker-compose.mon.yml" ]; then
    COMPOSE_BASE="$COMPOSE_BASE -f infra/monitoring/docker-compose.mon.yml"
fi

echo "Pulling images..."
docker pull ghcr.io/flowdesk-ai/backend:${BACKEND_TAG}
docker pull ghcr.io/flowdesk-ai/frontend:${FRONTEND_TAG}

docker tag ghcr.io/flowdesk-ai/backend:${BACKEND_TAG} ghcr.io/flowdesk-ai/backend:latest
docker tag ghcr.io/flowdesk-ai/frontend:${FRONTEND_TAG} ghcr.io/flowdesk-ai/frontend:latest

echo "Running database migrations..."
docker compose $COMPOSE_BASE run --rm backend alembic upgrade head

echo "Starting services..."
docker compose $COMPOSE_BASE up -d

echo "Waiting for backend healthcheck..."
for i in $(seq 1 30); do
    if curl --fail http://localhost:8000/health > /dev/null 2>&1; then
        echo "Backend is healthy"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "ERROR: Backend healthcheck failed after 30 attempts"
        exit 1
    fi
    sleep 2
done

# Install backup cron without removing existing entries
if [ -f "$SCRIPT_DIR/cron/backup.cron" ]; then
    echo "Installing backup cron..."
    (crontab -l 2>/dev/null; cat "$SCRIPT_DIR/cron/backup.cron") \
        | awk '!seen[$0]++' \
        | crontab -
fi

echo "Deploy complete"
