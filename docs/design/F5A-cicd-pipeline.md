# F5A — CI/CD Pipeline (Design & Technical Plan)

> **Estado:** Cerrado — 2026-07-29 (v0.5.0)
> **Depende de:** Proyecto aprobado en Project Gate Review
> **Predecesores:** Sprint Infra 1 (healthchecks, restart, CORS, rate limiting)

---

## 1. Alcance

Crear un pipeline CI/CD mínimo pero completo para FlowDesk-AI:

| Componente | Qué hace |
|------------|----------|
| **CI** | Ejecuta lint + tests + build en cada PR y push a cualquier rama |
| **CD** | Construye imágenes Docker, las publica en GHCR, y despliega en staging vía SSH |
| **Rollback** | Documentado + script de rollback por tag de imagen |
| **Migrations** | `alembic upgrade head` incluido en el deploy |

**Excluido de F5A:**
- Reverse proxy / TLS (F5B)
- Docker hardening / resource limits (F5C)
- Monitoring / backups (F5D)
- Multi-entorno (staging/prod separados) — se unifica en un solo workflow

---

## 2. Decisiones técnicas

| Decisión | Opción elegida | Por qué |
|----------|---------------|---------|
| **Registry** | GitHub Container Registry (GHCR) | Mismo ecosistema, autenticación con GITHUB_TOKEN, sin secrets extra |
| **Versionado imágenes** | `sha-<commit7>` + `latest` | Rollback trivial: `docker pull ghcr.io/flowdesk-ai/backend:sha-abc1234` |
| **Deploy target** | SSH a VPS + `docker compose up` | Simple, sin overhead de agentes externos |
| **Secretos** | GitHub Actions Secrets | SECRET_KEY, DATABASE_URL, SSH_KEY, etc |
| **Migrations** | `alembic upgrade head` antes de reiniciar backend | Explícito, controlado, sin tocar el código de la app |
| **Rollback** | Script `rollback.sh` + documentación | Sin automatización compleja — rollback manual con script |

---

## 3. Archivos a crear

```
.github/workflows/ci.yml           → CI: lint + test + build
.github/workflows/deploy.yml        → CD: build images + push + deploy
infra/deploy.sh                     → Script de deploy remoto
infra/rollback.sh                   → Script de rollback
infra/docker-compose.prod.yml       → Override de producción
backend/scripts/entrypoint.sh       → Entrypoint que ejecuta migrations + app
```

---

## 4. Workflows

### 4.1 CI (`ci.yml`)

```yaml
Triggers: [push, pull_request]

Jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - Python 3.12
      - pip install .[dev]
      - ruff check app/
      - pytest tests/

  frontend:
    runs-on: ubuntu-latest
    steps:
      - Node 20
      - npm ci
      - next lint
      - vitest run
      - next build
```

**Tiempo estimado:** ~5 min

### 4.2 CD (`deploy.yml`)

```yaml
Triggers: [push: main]

Jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      1. Checkout
      2. Login to GHCR (GITHUB_TOKEN)
      3. Build + push backend image (sha-<commit> + latest)
      4. Build + push frontend image (sha-<commit> + latest)
      5. SSH into VPS:
         - Pull new images
         - Run alembic upgrade head
         - docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
         - Healthcheck: curl --retry 12 --retry-connrefused http://localhost:8000/health
```

**Tiempo estimado:** ~8 min

---

## 5. Estrategia de versionado

```
ghcr.io/flowdesk-ai/backend:latest
ghcr.io/flowdesk-ai/backend:sha-a1b2c3d
ghcr.io/flowdesk-ai/frontend:latest
ghcr.io/flowdesk-ai/frontend:sha-a1b2c3d
```

**Rollback:**
```bash
# infra/rollback.sh
TAG=$1  # sha-abc1234
docker pull ghcr.io/flowdesk-ai/backend:$TAG
docker pull ghcr.io/flowdesk-ai/frontend:$TAG
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 6. Secrets requeridos (GitHub Actions)

| Secret | Propósito |
|--------|-----------|
| `SSH_HOST` | IP/Dominio del VPS |
| `SSH_USER` | Usuario SSH |
| `SSH_KEY` | Clave privada SSH (deploy key) |
| `DATABASE_URL` | Cadena de conexión PostgreSQL |
| `SECRET_KEY` | JWT secret |
| `INTERNAL_API_KEY` | n8n auth |
| `N8N_ENCRYPTION_KEY` | n8n encryption |
| `WHATSAPP_*` | WhatsApp API credentials |
| `GROQ_API_KEY` | Groq LLM key |
| `CORS_ORIGINS` | Orígenes permitidos (producción) |

---

## 7. docker-compose.prod.yml

Override mínimo para producción:

```yaml
services:
  backend:
    image: ghcr.io/flowdesk-ai/backend:latest
    build: []  # no rebuild from source
    env_file: []  # secrets from GH Actions, not .env
    environment:
      ENVIRONMENT: production
    restart: unless-stopped

  frontend:
    image: ghcr.io/flowdesk-ai/frontend:latest
    build: []
    restart: unless-stopped
```

---

## 8. Entrypoint (backend)

```bash
# backend/scripts/entrypoint.sh
#!/bin/sh
set -e
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Esto asegura que las migraciones se ejecuten antes de que la app acepte tráfico. El healthcheck no pasará hasta que las migraciones terminen.

---

## 9. Criterios de aceptación

- [x] CI pasa en PR (lint + test + build) — verificado: ruff clean, 65 tests, lint clean, 153 tests, build OK
- [x] CD construye imágenes y las publica en GHCR — `deploy.yml` completo con login + build-push-action v6
- [x] `docker-compose.prod.yml` permite `docker compose up` con imágenes externas — verificado
- [x] Entrypoint ejecuta migrations antes de arrancar — `scripts/entrypoint.sh` con `alembic upgrade head`
- [x] Script de rollback documentado y funcional — `infra/rollback.sh`, tags sha-<commit>
- [x] Todos los secrets documentados en DEPLOY.md — sección 8 actualizada
- [x] CHANGELOG actualizado
- [x] SESSION_HANDOFF actualizado
- [x] ROADMAP actualizado

---

## 10. No incluido (para evitar scope creep)

- Pruebas de integración end-to-end
- Multi-entorno (solo un pipeline que despliega a staging)
- Slack/email notificaciones
- Análisis de seguridad (trivy, snyk)
- Cache de dependencias (se añade si el pipeline supera 10 min)
