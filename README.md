# FlowDesk-AI

Plataforma de atención automática empresarial vía WhatsApp.

Automatiza respuestas a clientes usando IA, con supervisión humana cuando sea necesario.

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | FastAPI (Python 3.12) |
| Frontend | Next.js 14 (Pages Router, React 18, TailwindCSS) |
| Base de Datos | PostgreSQL 17.6 via Supabase Cloud |
| Orquestación | n8n |
| IA | Groq API (Llama 3) |
| Proxy | Caddy |
| Contenedores | Docker Compose |

## Estructura

```
FlowDesk-AI/
├── backend/                  # FastAPI
│   └── app/
│       ├── main.py
│       ├── api/v1/           # Endpoints (auth, contacts, conversations, messages, webhooks)
│       ├── clients/          # External APIs (WhatsApp, Groq)
│       ├── core/             # Config, database
│       ├── models/           # SQLAlchemy (User, Contact, Conversation, Message)
│       ├── schemas/          # Pydantic request/response
│       └── services/         # Business logic (auth, messages)
├── frontend/                 # Next.js
│   └── src/
│       ├── __tests__/        # Test suite (153 tests, 21 files)
│       ├── components/       # Design system (ui/), layout, dashboard, workspace (MessageList, MessageBubble, ConversationHeader, Composer)
│       ├── contexts/         # AuthContext (login, token, session)
│       ├── hooks/            # useConversations, useConversation, useMessages
│       ├── lib/              # API client, formatTime, formatRelativeTime
│       ├── pages/            # Routes (Pages Router) — login, conversations (list + detail)
│       ├── styles/           # Global CSS
│       └── types/            # TypeScript interfaces
├── infra/                    # Docker Compose, .env.example
├── docs/                     # Project documentation
├── planning/                 # Sprint planning
└── notes/                    # Session notes
```

## Requisitos

- Docker y Docker Compose

## Ejecución

```bash
docker compose -f infra/docker-compose.yml up --build
```

- Backend: http://localhost:8000
- Health: http://localhost:8000/health
- Frontend: http://localhost:3000

## Roadmap

| Fase | Estado |
|------|--------|
| Base del proyecto (FastAPI + Next.js + Docker) | Completada |
| Base de datos y API Core (Contacts, Conversations, Messages) | Completada |
| WhatsApp Cloud API (webhook + envío) | Completada |
| Integración Groq (LLM auto-responses) | Completada |
| Dashboard — Lista de conversaciones | Completada |
| Detalle de conversación | Completada |
| Conversation Composer (envío desde dashboard) | Completada |
| Human takeover | Completada |
| Autenticación — User Model (1/3) | Completada |
| Autenticación — Auth Backend (2/3) | Completada |
| Autenticación — Frontend Auth (3/3) | Completada |
| n8n infraestructura (PR A) | Completada |
| n8n — Internal API (PR B) | Completada |
| n8n — Webhook trigger (PR C) | Completada |
| n8n — AI Responder workflow (PR D) | Completada |
| n8n — Human Approval workflow (PR E) | Completada |
| Frontend Foundation — Design System + Layout + Testing (#21) | Completada |
| F2 — Dashboard (lista de conversaciones) | Completada |
| F3 — Conversation Workspace (chat bubbles, composer, takeover) | Completada |
| F4 — Responsive (F4A) + Dark Mode (F4B) + Realtime Smart Polling (F4C) | Completada |
| Testing avanzado — TESTING_GUIDELINES.md | Completada |
| Documentación final — DEPLOY.md, CHANGELOG.md | Completada |
| F5A — CI/CD Pipeline (GitHub Actions, deploy, rollback) | Completada |
| F5B — Reverse Proxy (Caddy + TLS automático Let's Encrypt) | Completada |
| F5C — Docker Hardening (resource limits, healthchecks, non-root, cap_drop) | Completada |
| F5C.1 — Row Level Security (RLS default-deny en 4 tablas) | Completada |
| F5D — Monitoring & Backups (Uptime Kuma, backup.sh, restore.sh, cron) | Completada |
