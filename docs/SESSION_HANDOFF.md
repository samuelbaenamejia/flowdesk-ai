# SESSION_HANDOFF — FlowDesk-AI

> Última actualización: 2026-07-25

---

## Resumen del proyecto

FlowDesk-AI es una plataforma de atención automática empresarial vía WhatsApp. Utiliza IA (Groq) para generar respuestas automáticas, con posibilidad de intervención humana.

---

## PRs completados (merged a main)

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

> **Nota:** PRs #5/#6 y #7/#8 son re-merges del mismo trabajo.

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
  - `GET /api/v1/contacts/{wa_id}`
  - `PATCH /api/v1/contacts/{wa_id}`
  - `GET /api/v1/conversations` (enriquecido: contact_name + last_message_preview)
  - `GET /api/v1/conversations/{id}` (enriquecido: contact_name + last_message_preview)
  - `PATCH /api/v1/conversations/{id}`
  - `GET /api/v1/conversations/{id}/messages` (pagination)
  - `POST /api/v1/conversations/{id}/messages` (create + send via WhatsApp)
  - `GET /api/v1/webhooks` (verify)
  - `POST /api/v1/webhooks` (receive)

- **Modelos:** Contact, Conversation, Message
- **Clientes externos:** WhatsApp (whatsapp.py), Groq (groq.py)
- **Servicios:** message_service.py (send_outgoing_message, get_conversation_history, process_incoming_and_respond)

### Frontend

- **Layout:** Sidebar (Home, Conversaciones) + header
- **Páginas:**
  - Conversations list (con filtro, paginación, loading/empty/error states)
  - Conversation detail `/conversations/[id]` (header + historial + composer de envío)

### Infraestructura

- Docker Compose (backend + frontend)
- Supabase Cloud (PostgreSQL 17.6)
- Caddy (pendiente para dominios)

---

## Próximo PR

**PR #14: Human takeover**

- Cambio de status de conversación
- Flag de intervención manual

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
- REVIEW_PACKAGE antes de commit
- No merge a main sin aprobación
- No crear archivos que no se usen en el mismo PR
- Ruff sin errores (con `--ignore B008`)
- npm run build sin errores
- npm run lint sin errores
