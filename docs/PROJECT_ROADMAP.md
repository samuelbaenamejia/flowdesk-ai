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
| #19 | Internal API endpoint (PR B) | `feature/internal-api` | POST /api/v1/internal/conversations/{id}/trigger-ai + X-Internal-Key |
| #20 | n8n Human Approval workflow (PR E) | `feature/n8n-human-approval` | request-human-approval + escalamiento automático en AI Responder |
| #21 | Frontend Foundation (F1) | `feature/f1-frontend-foundation` | Design system, layout (AppShell/Sidebar/Header), testing infra (Vitest + RTL), UI components (Button/Input/Badge/Table/Skeleton/EmptyState/ErrorState), 58 tests, 96.42% branch coverage |
| — | F2 — Dashboard (refactor) | `feature/f2-dashboard` (fast-forward merge local) | Refactor completo: useConversations hook, filtros, paginación, ConversationTable, 102 tests, 100% statements, 94.73% branches |
| — | F3 — Conversation Workspace | `feature/f3-conversation-workspace` (fast-forward merge local) | Workspace de conversación: ConversationHeader, MessageBubble, MessageList, Composer, useConversation, useMessages, 153 tests, lint clean, 3 High/3 Medium/7 Low issues resueltos |
| — | F4A — Responsive Design | main (consolidated v0.4.0) | AppShell sidebar state + backdrop mobile, tablas overflow-x-auto, dvh, hamburger menu |
| — | F4B — Dark Mode | main (consolidated v0.4.0) | Tailwind `darkMode: "class"`, ThemeContext + useTheme, anti-flicker, 22 archivos con `dark:` |
| — | F4C — Realtime (Smart Polling) | main (consolidated v0.4.0) | Polling 5s/10s/15s, `after` timestamp, Set dedup, visibility pause, 0 nuevas deps |

> **Nota:** Los PRs #5/#6 y #7/#8 son re-merges del mismo trabajo (artifacto del proceso de desarrollo). F1 es excepción de tamaño por ser fundacional (34 archivos). F2, F3, F4A, F4B y F4C se mergearon directamente a main sin PR numerado (consolidados en v0.4.0).

---

## F5 — Production Readiness

| PR | Funcionalidad | Estado | Branch |
|----|---------------|--------|--------|
| F5A | CI/CD Pipeline | ✅ Cerrado — merged a main (v0.5.0) | `main` |
| F5B | Reverse proxy (Caddy + TLS) | ✅ Cerrado — merged a main (v0.7.0) | `main` |
| F5C | Docker hardening + RLS | ✅ Cerrado — merged a main (v0.7.0) | `main` |
| F5D | Monitoring, Backups & Observability | ✅ Cerrado — merged a main (v0.7.0) | `main` |

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
