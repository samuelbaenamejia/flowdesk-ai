#!/bin/bash
set -e

BACKEND_TAG=${1:-latest}
FRONTEND_TAG=${2:-latest}

echo "Pulling images..."
docker pull ghcr.io/flowdesk-ai/backend:${BACKEND_TAG}
docker pull ghcr.io/flowdesk-ai/frontend:${FRONTEND_TAG}

docker tag ghcr.io/flowdesk-ai/backend:${BACKEND_TAG} ghcr.io/flowdesk-ai/backend:latest
docker tag ghcr.io/flowdesk-ai/frontend:${FRONTEND_TAG} ghcr.io/flowdesk-ai/frontend:latest

echo "Running database migrations..."
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml run --rm backend alembic upgrade head

echo "Starting services..."
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml up -d

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

echo "Deploy complete"
