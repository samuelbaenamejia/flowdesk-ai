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
| #13 | Auth — User Model + Migration + Config | `feature/auth-user-model` | PR 1/3 de Autenticación |
| #14 | Auth — Backend: Service + Endpoints + Seed | `feature/auth-backend` | PR 2/3 de Autenticación |
| #15 | Auth — Frontend: Login + Context + Protected Routes | `feature/auth-frontend` | PR 3/3 de Autenticación — JWT localStorage, ruteo protegido |
| #16 | Webhook → n8n trigger (PR C) | `feature/webhook-n8n-trigger` | _notify_n8n() con asyncio.create_task() |
| #17 | n8n AI Responder workflow (PR D) | `feature/n8n-ai-responder` | Workflow JSON + README |
| #18 | n8n infrastructure (PR A) | `feature/n8n-infrastructure` | docker-compose + .env.example + infra/n8n/ |
| #19 | Internal API endpoint (PR B) | `feature/internal-api` | POST /internal/conversations/{id}/trigger-ai + X-Internal-Key |
| #20 | n8n Human Approval workflow (PR E) | `feature/n8n-human-approval` | request-human-approval + escalamiento automático en AI Responder |

> **Nota:** Los PRs #5/#6 y #7/#8 son re-merges del mismo trabajo (artifacto del proceso de desarrollo).

---

## Pendiente

| Funcionalidad | Descripción | Depende de |
|---------------|-------------|------------|
| Testing | Unit tests, integration tests | — |
| Documentación final | DEPLOY.md, CHANGELOG.md | — |

### Roadmap n8n (completado)

| PR | Estado | Branch |
|----|--------|--------|
| PR A — Infraestructura | ✅ Merged (#18) | `feature/n8n-infrastructure` |
| PR B — Internal API | ✅ Merged (#19) | `feature/internal-api` |
| PR C — Webhook → n8n trigger | ✅ Merged (#16) | `feature/webhook-n8n-trigger` |
| PR D — AI Responder workflow | ✅ Merged (#17) | `feature/n8n-ai-responder` |
| PR E — Human Approval workflow | ✅ Merged (#20) | `feature/n8n-human-approval` |

El roadmap de integración de n8n está completo. Los 5 PRs (A–E) están en main.

---

## Criterios de merge

1. PR review aprobada
2. `uv run ruff check app/ --ignore B008` sin errores
3. `npm run build` sin errores
4. `npm run lint` sin errores
5. Cada archivo nuevo debe ser usado en el mismo PR
6. Una responsabilidad por PR
