# PROJECT ROADMAP - FlowDesk-AI

> Cada PR cubre una funcionalidad vertical completa. No se merge sin aprobación.

---

## Historial de PRs (merged a main)

> **Convención:** Cada PR = una funcionalidad vertical. El número de PR es el asignado por GitHub.

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
| #10 | Conversation Detail page | `feature/conversation-detail` | |
| #11 | Conversation Composer | `feature/conversation-composer` | |
| #12 | Human Takeover | `feature/human-takeover` | Status check + UI toggle |

> **Nota:** Los PRs #5/#6 y #7/#8 son re-merges del mismo trabajo (artifacto del proceso de desarrollo).

---

## Pendiente

| Funcionalidad | Descripción |
|---------------|-------------|
| n8n workflow | Webhook → FastAPI → Groq → WhatsApp |
| Autenticación | Login, JWT, protección de endpoints |
| Testing | Unit tests, integration tests |
| Documentación final | DEPLOY.md, CHANGELOG.md |

---

## Criterios de merge

1. PR review aprobada
2. `uv run ruff check app/ --ignore B008` sin errores
3. `npm run build` sin errores
4. `npm run lint` sin errores
5. Cada archivo nuevo debe ser usado en el mismo PR
6. Una responsabilidad por PR
