# DEPLOY — FlowDesk-AI

> Versión: 1.0
> Fecha: 2026-07-28

---

## Requisitos

- Docker y Docker Compose
- Git
- Acceso a Supabase Cloud (cuenta gratuita)
- API keys: WhatsApp Cloud API, Groq API

---

## Stack

| Servicio | Puerto | Docker |
|----------|--------|--------|
| Backend (FastAPI) | 8000 | `infra/docker-compose.yml` |
| Frontend (Next.js) | 3000 | `infra/docker-compose.yml` |
| n8n | 5678 | `infra/docker-compose.yml` |
| PostgreSQL | — | Supabase Cloud (externo) |

---

## 1. Clonar

```bash
git clone https://github.com/samuelbaenamejia/flowdesk-ai.git
cd flowdesk-ai
```

---

## 2. Configurar variables de entorno

```bash
cp infra/.env.example backend/.env
```

Editar `backend/.env` con valores reales:

| Variable | Descripción | Requerido |
|----------|-------------|-----------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase) | Sí |
| `SECRET_KEY` | JWT secret (generar con `openssl rand -hex 32`) | Sí |
| `SUPABASE_URL` | Supabase project URL | Sí |
| `SUPABASE_ANON_KEY` | Supabase anon key | Sí |
| `GROQ_API_KEY` | Groq API key | Sí |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta WhatsApp Phone Number ID | Sí |
| `WHATSAPP_ACCESS_TOKEN` | Meta WhatsApp Access Token | Sí |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification token (elegir uno) | Sí |
| `INTERNAL_API_KEY` | n8n → Backend auth key | Sí |
| `N8N_ENCRYPTION_KEY` | n8n encryption key | Sí |

Variables con valores por defecto funcionales para desarrollo:

| Variable | Default | Notas |
|----------|---------|-------|
| `ENVIRONMENT` | `development` | Cambiar a `production` en producción |
| `N8N_ENABLED` | `false` | `true` para habilitar n8n AI responder |
| `N8N_MODE` | `disabled` | `mirror` (responder + notificar) o `primary` (solo notificar) |
| `GROQ_MODEL` | `llama-3.1-70b-versatile` | |
| `WHATSAPP_GRAPH_API_VERSION` | `v21.0` | |

---

## 3. Inicializar base de datos

```bash
cd backend
uv sync
uv run alembic upgrade head
```

Esto crea todas las tablas (User, Contact, Conversation, Message) en la base de datos configurada en `DATABASE_URL`.

---

## 4. Crear usuario admin

```bash
uv run python scripts/create_admin.py
```

Credenciales por defecto: `admin@flowdesk.com` / `admin123` (cambiar en producción).

---

## 5. Ejecutar

```bash
# Desde la raíz del proyecto
docker compose -f infra/docker-compose.yml up --build
```

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Health check | http://localhost:8000/health |
| API Docs | http://localhost:8000/docs |
| n8n | http://localhost:5678 |

---

## 6. Webhook WhatsApp

Para recibir mensajes de WhatsApp en desarrollo:

**Opción A — ngrok:**

```bash
ngrok http 8000
```

Configurar Webhook en Meta Developer Dashboard:

- **Callback URL:** `https://<ngrok-url>/api/v1/webhooks/whatsapp`
- **Verify Token:** el mismo que `WHATSAPP_VERIFY_TOKEN`

**Opción B — Túnel con Caddy (producción):**

Configurar Caddyfile con dominio real y apuntar al backend.

---

## 7. n8n (opcional)

```env
# En backend/.env
N8N_ENABLED=true
N8N_MODE=mirror          # O "primary" según prefieras
```

Los workflows de n8n se importan desde `infra/n8n/workflows/`.

---

## 8. Producción

Para despliegue en producción:

1. **Cambiar `ENVIRONMENT=production`** en backend/.env
2. **Usar `SECRET_KEY` segura** (generar con `openssl rand -hex 32`)
3. **Configurar Caddy** como reverse proxy con TLS automático
4. **Base de datos:** Usar Supabase Cloud (no SQLite)
5. **n8n:** Migrar de SQLite a PostgreSQL si se espera alto volumen
6. **Health checks:** Configurar monitorización en `/health`

---

## Comandos útiles

```bash
# Backend (uv)
cd backend
uv sync                          # Instalar dependencias
uv run uvicorn app.main:app --reload --port 8000  # Dev server
uv run alembic upgrade head      # Migraciones
uv run pytest                    # Tests
uv run ruff check app/ --ignore B008  # Lint

# Frontend (npm)
cd frontend
npm install                      # Instalar dependencias
npm run dev                      # Dev server
npm run build                    # Build producción
npm run lint                     # Lint
npm run test                     # Tests

# Docker
docker compose -f infra/docker-compose.yml up --build   # Iniciar
docker compose -f infra/docker-compose.yml down         # Detener
docker compose -f infra/docker-compose.yml logs -f      # Logs
```

---

## Variables de entorno (referencia completa)

Ver `infra/.env.example` para la lista completa con valores por defecto.

---
