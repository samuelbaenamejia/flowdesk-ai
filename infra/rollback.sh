#!/bin/bash
set -e

BACKEND_TAG=${1}
FRONTEND_TAG=${2:-${BACKEND_TAG}}

if [ -z "${BACKEND_TAG}" ]; then
    echo "Usage: $0 <backend-tag> [frontend-tag]"
    echo "  If frontend-tag is omitted, uses the same tag as backend"
    echo ""
    echo "Available tags:"
    docker images ghcr.io/flowdesk-ai/backend --format "  {{.Tag}}"
    exit 1
fi

echo "Rolling back to backend:${BACKEND_TAG} frontend:${FRONTEND_TAG}..."
docker pull ghcr.io/flowdesk-ai/backend:${BACKEND_TAG}
docker pull ghcr.io/flowdesk-ai/frontend:${FRONTEND_TAG}

docker tag ghcr.io/flowdesk-ai/backend:${BACKEND_TAG} ghcr.io/flowdesk-ai/backend:latest
docker tag ghcr.io/flowdesk-ai/frontend:${FRONTEND_TAG} ghcr.io/flowdesk-ai/frontend:latest

docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml up -d

echo "Waiting for backend healthcheck..."
for i in $(seq 1 30); do
    if curl --fail http://localhost:8000/health > /dev/null 2>&1; then
        echo "Backend is healthy — rollback complete"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "ERROR: Backend healthcheck failed after rollback"
        exit 1
    fi
    sleep 2
done
