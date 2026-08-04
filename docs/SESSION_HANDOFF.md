# SESSION_HANDOFF — FlowDesk-AI

> Última actualización: 2026-07-30

---

## Resumen del proyecto

FlowDesk-AI es una plataforma de atención automática empresarial vía WhatsApp. Utiliza IA (Groq) para generar respuestas automáticas, con posibilidad de intervención humana.

---

## PRs completados (merged a main)

> **Convención:** Cada PR = una funcionalidad vertical. El número de PR es el asignado por GitHub.

| PR | Funcionalidad | Branch |
|----|---------------|--------|
| #1 | Contact model + migration | `feature/contact-model` |
| #2 | Contacts API (GET/PATCH) | `feature/api-core` |
| #3 | Conversation model + migration | `feature/conversation-model` |
| #4 | Conversations API (list, GET, PATCH) | `feature/conversations-api` |
| #5 | Message model + migration | `feature/message-model` |
| #6 | Message model (re-merge) | `feature/message-model` |
| #7 | WhatsApp send message | `feature/whatsapp-send-message` |
| #8 | WhatsApp send message (re-merge) | `feature/whatsapp-send-message` |
| #9 | Groq LLM integration | `feature/llm-groq-integration` |
| #10 | Conversation Detail page | `feature/conversation-detail` |
| #11 | Conversation Composer | `feature/conversation-composer` |
| #12 | Human Takeover | `feature/human-takeover` |
| #13 | Auth — User Model + Migration + Config | `feature/auth-user-model` |
| #14 | Auth — Backend: Service + Endpoints + Seed | `feature/auth-backend` |
| #15 | Auth — Frontend: Login + Context + Protected Routes | `feature/auth-frontend` |
| #16 | Webhook → n8n trigger (PR C) | `feature/webhook-n8n-trigger` |
| #17 | n8n AI Responder workflow (PR D) | `feature/n8n-ai-responder` |
| #18 | n8n infrastructure (PR A) | `feature/n8n-infrastructure` |
| #19 | Internal API endpoint (PR B) | `feature/internal-api` |
| #20 | n8n Human Approval workflow (PR E) | `feature/n8n-human-approval` |
| #21 | Frontend Foundation (F1) | `feature/f1-frontend-foundation` |
| — | F2 — Dashboard (refactor) | `feature/f2-dashboard` (fast-forward merge local) |
| — | F3 — Conversation Workspace | `feature/f3-conversation-workspace` (fast-forward merge local) |
| — | F4A — Responsive Design | main (consolidated v0.4.0) |
| — | F4B — Dark Mode | main (consolidated v0.4.0) |
| — | F4C — Realtime (Smart Polling) | main (consolidated v0.4.0) |
| — | F5A — CI/CD Pipeline | main (v0.5.0) |
| — | F5B — Reverse Proxy (Caddy + TLS) | main (v0.7.0) |
| — | F5C — Docker Hardening + RLS | main (v0.7.0) |
| — | F5D — Monitoring, Backups & Observability | main (v0.7.0) |

> **Nota:** PRs #5/#6 y #7/#8 son re-merges del mismo trabajo (artifacto del proceso de desarrollo). F2, F3, F4A, F4B y F4C se mergearon directamente a main sin PR numerado (consolidados en v0.4.0). F5A–F5D se consolidaron directamente a main (v0.5.0 y v0.7.0).

---

## Stack actual

| Capa | Tecnología | Estado |
|------|-----------|--------|
| Backend | FastAPI (Python 3.12) | Funcionando |
| Frontend | Next.js 14 Pages Router | Funcionando |
| Base de Datos | PostgreSQL 17.6 via Supabase Cloud | Conectado |
| ORM | SQLAlchemy 2.0 async + asyncpg | Configurado |
| Migraciones | Alembic | Aplicadas |
| LLM | Groq API (Llama 3.1) | Integrado |
| WhatsApp | Cloud API (Meta) | Webhook + envío |
| Contenedores | Docker Compose | Funcionando |

---

## Decisiones clave

1. **Sin Service/Repository layers** — YAGNI. SQLAlchemy async directamente en endpoints. `services/message_service.py` es la excepción (lógica reutilizable de envío/historial).
2. **Webhook directo en FastAPI** — No n8n intermedio para recepción.
3. **Duplicate messages** — `wa_message_id` UNIQUE + IntegrityError.
4. **Two-phase persist** — Commit pending → send Meta → update sent.
5. **IPv6 resolved** — Session Pooler (Supavisor, IPv4) en `aws-0-sa-east-1.pooler.supabase.com:5432`.
6. **Cada PR = funcionalidad vertical completa** — No empty layers.

---

## Estado actual

### Backend

- **Endpoints:**
  - `GET /health`
  - `POST /api/v1/auth/login` (login, retorna access_token)
  - `GET /api/v1/auth/me` (usuario actual, requiere auth)
  - `GET /api/v1/contacts/{wa_id}`
  - `PATCH /api/v1/contacts/{wa_id}`
  - `GET /api/v1/conversations` (enriquecido: contact_name + last_message_preview)
  - `GET /api/v1/conversations/{id}` (enriquecido: contact_name + last_message_preview)
  - `PATCH /api/v1/conversations/{id}`
  - `GET /api/v1/conversations/{id}/messages` (pagination)
  - `POST /api/v1/conversations/{id}/messages` (create + send via WhatsApp)
   - `GET /api/v1/webhooks/whatsapp` (verify)
   - `POST /api/v1/webhooks/whatsapp` (receive)
   - `POST /api/v1/internal/conversations/{id}/trigger-ai` (n8n Internal API, auth X-Internal-Key)
   - `POST /api/v1/internal/conversations/{id}/request-human-approval` (escalamiento a humano, idempotente)
 
- **Modelos:** Contact, Conversation, Message, User
- **Clientes externos:** WhatsApp (whatsapp.py), Groq (groq.py)
- **Servicios:** message_service.py, auth_service.py (verify_password, hash_password, create_access_token, get_user_by_email, decode_access_token)
- **Dependencias:** get_current_user (aplicada en contacts, conversations, messages)
- **Scripts:** create_admin.py (seed: admin@flowdesk.com / admin123)

### Frontend

- **Design System:** 7 UI components (Button + forwardRef, Input + useId, Badge, Table + getRowKey, Skeleton, EmptyState, ErrorState). Variantes: 4 Button (primary/secondary/destructive/ghost), 5 Badge (default/success/warning/info/error), 4 Skeleton (text/title/avatar/row).
- **Layout:** AppShell (Sidebar w-16 icon-only + Header con user email + Logout + Main Content). Sidebar usa `useRouter()` para active state. Header usa `useAuth()` para datos de sesión. Header y AppShell soportan `title` prop opcional.
  - **Responsive (F4A):** AppShell con sidebar state + backdrop overlay en mobile. Sidebar slide-in/out con nav labels + user email. Header hamburger button + email/logout hidden en <768px. ConversationTable overflow-x-auto + columnas ocultas en mobile. Filters full-width en mobile. Pagination page counter oculto en mobile. ConversationHeader flex-wrap + padding responsive. MessageBubble max-w 85% mobile / 70% desktop. Composer gap reducido + text-base (iOS zoom). [id].tsx dvh en lugar de vh.
- **Testing:** Vitest + @testing-library/react + jsdom + coverage. 153 tests, 21 files. Thresholds configurados en 90%.
- **Workspace components:** ConversationHeader (back, contact name, badge, takeover/return), MessageBubble (inbound/outbound, delivery status, failed indicator), MessageList (scroll container, skeletons, EmptyState, load more, auto-scroll, scroll preservation on prepend), Composer (auto-resize textarea, Enter-to-send, error handling, content preserved on send failure).
- **Hooks:** useConversation (fetch + 404 + toggleStatus + polling 15s + AbortController cleanup), useMessages (pagination LIMIT=50 + loadMore prepend + polling 5s + after timestamp + Set dedup + sendMessage), useConversations (fetch + pagination + filters + polling 10s + visibility pause/resume).
- **Páginas:**
  - Login (refactorizado con Button + Input, role="alert" en errores, aria-labels)
  - Conversations list (refactorizada en F2: useConversations hook, filtros, paginación, skeletons, empty states contextuales)
  - Conversation detail (refactorizada en F3: ConversationHeader + MessageList + Composer composition, loading skeleton, 404 EmptyState, error ErrorState con retry, toggleError banner)
- **AuthContext:** Token + user state, login/logout, restauración de sesión, AuthGuard para rutas protegidas
- **Inter font:** Cargada vía `next/font/google` con CSS variable.
- **Tailwind:** `fontFamily.sans` configurado con Inter.

### Infraestructura (F5 — COMPLETADA)

- Docker Compose: backend, frontend, n8n, uptime-kuma. Caddy listo (Caddyfile) para deploy manual o integración futura
- Supabase Cloud (PostgreSQL 17.6) con RLS habilitado en 4 tablas
- Caddy reverse proxy con TLS automático (Let's Encrypt), routing para backend + n8n
- n8n orquestación con Internal API, escalamiento automático vía ESCALATION_KEYWORDS
- Uptime Kuma: monitoreo de salud de servicios
- CI/CD: GitHub Actions (lint + test + build + deploy), rollback script
- Backups automatizados: PostgreSQL (pg_dump custom), n8n volumes, workflows, config
- Cron: backup diario 02:00 con retención de 7 días

---

## Roadmap n8n (completado)

| PR | Estado |
|----|--------|
| PR A — Infraestructura | ✅ Merged (#18) |
| PR B — Internal API | ✅ Merged (#19) |
| PR C — Webhook → n8n trigger | ✅ Merged (#16) |
| PR D — AI Responder workflow | ✅ Merged (#17) |
| PR E — Human Approval workflow | ✅ Merged (#20) |

El roadmap de integración con n8n está completo. Los 5 PRs del plan original están en main.

## PR completados (post-merge)

| Funcionalidad | Estado |
|---------------|--------|
| F4A — Responsive Design | ✅ Completado |
| F4B — Dark Mode | ✅ Completado |
| F4C — Realtime (Smart Polling) | ✅ Completado |

### F4C — Realtime (Smart Polling)

- **Estrategia:** Smart Polling con `after` timestamp (ISO 8601 UTC), sin WebSockets/SSE.
- **Backend:** `GET /conversations/{id}/messages` ahora acepta query param `after: datetime | None` — filtra por `Message.created_at > after`.
- **Frontend:** 3 hooks con polling diferenciado:
  - `useMessages.ts`: polling 5s con `after` timestamp + Set-based dedup + `lastFetchRef`.
  - `useConversations.ts`: polling 10s + `visibilitychange` pause/resume.
  - `useConversation.ts`: polling 15s + AbortController cleanup + `visibilitychange`.
- **Cero dependencias nuevas.** Testing: 153 tests pasan, build/lint OK.
- **Documentación:** ADR-025 (Smart Polling), roadmap actualizado.

---

## Comandos útiles

```bash
# Backend
cd backend
uv run ruff check app/ --ignore B008
uv run uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm run dev
npm run build
npm run lint

# Database
cd backend
uv run alembic upgrade head
uv run alembic revision --autogenerate -m "description"
```

---

## Sprint Infra 1 (2026-07-28) — Release Hardening

### Cambios realizados

| Área | Cambio | Detalle |
|------|--------|---------|
| CORS | Configurable por entorno | `CORS_ORIGINS` en `.env` (default `*`). Backend usa `CORSMiddleware` con split por comas. |
| Rate Limiting | `/auth/login` limitado | 5 intentos por IP cada 5 min. In-memory (sin Redis). Implementado como FastAPI dependency. |
| Secrets | Validación al arranque | Log warning si `SECRET_KEY` o `INTERNAL_API_KEY` tienen valores por defecto. |
| Request-ID | Middleware en backend | `X-Request-ID` header en todas las respuestas. Toma valor del request si existe, o genera UUID. |
| Docker | Healthchecks | Backend: `curl --fail /health`. Frontend: `curl --fail /`. n8n: no tiene (external image). |
| Docker | Restart policies | Todos los servicios: `restart: unless-stopped`. |
| Frontend | ErrorBoundary | Class component que captura errores React, muestra fallback UI con botón de recarga. |
| Lint | Unused imports | 7 `F401` removidos de `tests/` backend vía `ruff check --fix`. |

## Épica F5 — Production Readiness (2026-07-30) — ✅ COMPLETADA

Toda la épica F5 está cerrada en v0.7.0. Incluye:

| Componente | Estado | Entregables |
|------------|--------|-------------|
| **F5A** — CI/CD | ✅ v0.5.0 | CI/CD GitHub Actions, deploy.sh, rollback.sh, docker-compose.prod.yml, entrypoint.sh |
| **F5B** — Caddy + TLS | ✅ v0.7.0 | Caddyfile, TLS automático Let's Encrypt |
| **F5C** — Docker Hardening | ✅ v0.7.0 | Resource limits, HEALTHCHECK, restart policies, non-root, cap_drop, log rotation |
| **F5C.1** — RLS | ✅ v0.7.0 | RLS + default-deny en 4 tablas, FORCE RLS, migración Alembic |
| **F5D** — Monitoring & Backups | ✅ v0.7.0 | Uptime Kuma, backup.sh, restore.sh, backup.cron, .env.example actualizado |

### Setup VPS (una vez, post-deploy)

```bash
# Configurar secrets en GitHub Actions:
# SSH_HOST, SSH_USER, SSH_KEY, DATABASE_URL, SECRET_KEY,
# INTERNAL_API_KEY, N8N_ENCRYPTION_KEY, WHATSAPP_*, GROQ_API_KEY

# En el VPS:
git clone https://github.com/samuelbaenamejia/flowdesk-ai.git ~/flowdesk-ai
cp infra/.env.example backend/.env
# Editar backend/.env con valores reales

# El deploy automático via GitHub Actions ejecuta:
#   docker compose -f infra/docker-compose.yml pull
#   docker compose -f infra/docker-compose.yml up -d
#   bash infra/scripts/backup.sh via cron (02:00 daily)

# Verificar monitoreo:
#   http://<vps-ip>:3001 — Uptime Kuma dashboard
#   /var/backups/flowdesk/ — backups diarios (retención 7 días)
#   /var/log/flowdesk-backup.log — log de backups
```

## Qué sigue (próxima épica)

La infraestructura F5 está COMPLETADA. El proyecto está listo para comenzar desarrollo de funcionalidad:

- **Backend:** Nuevos endpoints, lógica de negocio, integraciones
- **Frontend:** Nuevas pantallas, componentes, features de usuario
- **Base de datos:** Nuevos modelos, migraciones, consultas
- **Testing:** Tests unitarios, de integración y E2E

No hay infraestructura pendiente. Todo deploy continúa vía CI/CD existente.

---

## Épica F6 — Product Features (2026-08-03) — ✅ COMPLETADA (v0.14.0)

| Componente | Estado | Entregables |
|------------|--------|-------------|
| **F6A** — Auth & Profile | ✅ v0.10.0 | Login/refresh/logout, perfil, cambio de contraseña |
| **F6B** — Inbox (2 PRs) | ✅ v0.11.0–v0.13.0 | Conversaciones + filtros + paginación, búsqueda global, mensajes + filtros |
| **F6C** — Dashboard KPIs | ✅ v0.14.0 | KPIs, mensajes por día, contactos top |
| **F6D** — Docs & Decisión | ✅ v0.14.0 | DEPLOY, PROJECT_DECISIONS, ROADMAP actualizados |
| **F6E** — Deploy | ✅ v0.14.0 | deploy.sh multi-servicio, Caddyfile, .env.example |
| **F6F** — Critical Review | ✅ v0.14.0 | docs/F6F-DESIGN.md — brechas + plan de corrección |
| **F6G** — Final Audit | ✅ Sin commit (en revisión) | Auditoría final: bugs, UX, a11y, dead code; Delta Report entregado |

### F6G — Resumen de fixes (working tree, pendientes de commit)

- **Backend:** `deps.py` — UUID malformado en `sub` devuelve 401 (antes 500); `webhooks.py` — 9 strings corruptos (mojibake chino) reescritos en español.
- **Frontend:** `api.ts` — 6 funciones cambian a `requestVoid` (evita parsear 204 de DELETE/change-password); títulos por página (`_document.tsx` default + `<Head>` en 7 páginas); confirmación antes de borrar contacto; `aria-label` en búsqueda de contactos y creación de tags.

### Suite completa (F6G)

- Backend: pytest **164/164** ✅
- Frontend: vitest **312/312** (35 archivos) ✅ · tsc **0 errores fuera de `.test.*`** (1196 pre-existentes en tests por globals de vitest) ✅ · `git diff --check` limpio ✅

### Riesgos conocidos (fuera de alcance F6G, recomendaciones)

- Sin rate-limit en `/auth/register` (solo login).
- `CORS_ORIGINS=*` por defecto — restringir en producción vía `.env`.
- Warning Pydantic `class Config` → `ConfigDict` (deprecado V2, migrar en F7).
- Warnings `act(...)` en tests de hooks (uso de RTL sin act — cosmético).

---

## Reglas permanentes

- Cada PR = una responsabilidad
- Auto Code Review obligatorio antes de crear cualquier PR
- No merge a main sin verificación completa
- No crear archivos que no se usen en el mismo PR
- Ruff sin errores (con `--ignore B008`)
- npm run build sin errores
- npm run lint sin errores
- Documentación actualizada después de cada merge
- Post-Merge Report obligatorio después de cada merge
- Seguir `docs/AI_DEVELOPMENT_GUIDE.md` como flujo oficial de desarrollo
