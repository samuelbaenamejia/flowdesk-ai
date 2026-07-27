# SESSION_HANDOFF — FlowDesk-AI

> Última actualización: 2026-07-27

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

> **Nota:** PRs #5/#6 y #7/#8 son re-merges del mismo trabajo (artifacto del proceso de desarrollo).

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
   - `GET /api/v1/webhooks` (verify)
   - `POST /api/v1/webhooks` (receive)
   - `POST /api/v1/internal/conversations/{id}/trigger-ai` (n8n Internal API, auth X-Internal-Key)
   - `POST /api/v1/internal/conversations/{id}/request-human-approval` (escalamiento a humano, idempotente)
 
- **Modelos:** Contact, Conversation, Message, User
- **Clientes externos:** WhatsApp (whatsapp.py), Groq (groq.py)
- **Servicios:** message_service.py, auth_service.py (verify_password, hash_password, create_access_token, get_user_by_email, decode_access_token)
- **Dependencias:** get_current_user (aplicada en contacts, conversations, messages)
- **Scripts:** create_admin.py (seed: admin@flowdesk.com / admin123)

### Frontend

- **Design System:** 7 UI components (Button + forwardRef, Input + useId, Badge, Table + getRowKey, Skeleton, EmptyState, ErrorState). Variantes: 4 Button (primary/secondary/destructive/ghost), 5 Badge (default/success/warning/info/error), 4 Skeleton (text/title/avatar/row).
- **Layout:** AppShell (Sidebar w-16 icon-only + Header con user email + Logout + Main Content). Sidebar usa `useRouter()` para active state. Header usa `useAuth()` para datos de sesión.
- **Testing:** Vitest + @testing-library/react + jsdom + coverage. 58 tests, 96.42% branch coverage. Thresholds configurados en 90%.
- **Páginas:**
  - Login (refactorizado con Button + Input, role="alert" en errores, aria-labels)
  - Conversations list (sin cambios — se refactoriza en F2)
  - Conversation detail (sin cambios — se refactoriza en F3)
- **AuthContext:** Token + user state, login/logout, restauración de sesión, AuthGuard para rutas protegidas
- **Inter font:** Cargada vía `next/font/google` con CSS variable.
- **Tailwind:** `fontFamily.sans` configurado con Inter.

### Infraestructura

- Docker Compose (backend + frontend + n8n)
- Supabase Cloud (PostgreSQL 17.6)
- n8n (orquestación) — servicio en docker-compose, Internal API disponible, escalamiento automático con ESCALATION_KEYWORDS
- Caddy (pendiente para dominios)

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

## Próximo PR

**F2 — Dashboard:** Refactorizar la lista de conversaciones usando el design system de F1. Agregar `useConversations` hook, filtros, paginación, estados loading/empty/error con los componentes UI de F1.

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
