# PROJECT ROADMAP - FlowDesk-AI

> Cada PR cubre una funcionalidad vertical completa. No se merge sin aprobación.

---

## Historial de PRs (mergeados a main)

| PR | Funcionalidad | Branch | Notas |
|----|---------------|--------|-------|
| #1 | Contact model + migration | `feature/contact-model` | |
| #2 | Contacts API (GET/PATCH) | `feature/api-core` | |
| #3 | Conversation model + migration | `feature/conversation-model` | |
| #4 | Conversations API (list, GET, PATCH) | `feature/conversations-api` | |
| #5 | Message model + migration | `feature/message-model` | |
| #6 | Message model (re-merge) | `feature/message-model` | Duplicado de #5 |
| #7 | WhatsApp send message | `feature/whatsapp-send-message` | |
| #8 | WhatsApp send message (re-merge) | `feature/whatsapp-send-message` | Re-merge de #7 |
| #9 | Groq LLM integration | `feature/llm-groq-integration` | |
| #11 | Dashboard — Conversations List | `feature/dashboard-conversations-list` | Fast-forward |

> **Nota:** El historial de git contiene merges duplicados (#5/#6 y #7/#8). Esto es un artifacto del proceso de desarrollo. El siguiente PR será #12.

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
