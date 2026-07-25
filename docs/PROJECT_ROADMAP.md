# PROJECT ROADMAP - FlowDesk-AI

> Cada PR cubre una funcionalidad vertical completa. No se merge sin aprobación.

---

## Completado

| PR | Funcionalidad | Branch |
|----|---------------|--------|
| #1 | Database bootstrap + Alembic | `feature/database-bootstrap` |
| #2 | Contact model + migration | `feature/contact-model` |
| #3 | Contacts API (GET/PATCH) | `feature/contacts-api` |
| #4 | Conversation model + migration | `feature/conversation-model` |
| #5 | Conversations API (list, GET, PATCH) | `feature/conversations-api` |
| #6 | Message model + migration | `feature/message-model` |
| #7 | Messages API (list, create) | `feature/messages-api` |
| #8 | WhatsApp Cloud API Webhook (verify + receive) | `feature/whatsapp-webhook` |
| #9 | WhatsApp Send Message API (send_text_message) | `feature/whatsapp-send-message` |
| #10 | Groq LLM Integration (auto-responses) | `feature/llm-groq-integration` |
| #11 | Dashboard — Conversations List (enriched backend + frontend page) | `feature/dashboard-conversations-list` |

---

## Pendiente

| PR | Funcionalidad | Descripción |
|----|---------------|-------------|
| #12 | Detalle de conversación | Página `/conversations/[id]` con historial de mensajes |
| #13 | Envío de mensajes desde dashboard | Endpoint POST + UI para enviar mensajes |
| #14 | Human takeover | Cambio de status + flag de intervención manual |
| #15 | n8n workflow | Webhook → FastAPI → Groq → WhatsApp |
| #16 | Autenticación | Login, JWT, protección de endpoints |
| #17 | Testing | Unit tests, integration tests |
| #18 | Documentación final | DEPLOY.md, CHANGELOG.md |

---

## Criterios de merge

1. PR review aprobada
2. `uv run ruff check app/ --ignore B008` sin errores
3. `npm run build` sin errores
4. `npm run lint` sin errores
5. Cada archivo nuevo debe ser usado en el mismo PR
6. Una responsabilidad por PR
