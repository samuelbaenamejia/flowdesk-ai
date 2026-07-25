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
│       ├── api/v1/           # Endpoints (contacts, conversations, messages, webhooks)
│       ├── clients/          # External APIs (WhatsApp, Groq)
│       ├── core/             # Config, database
│       ├── models/           # SQLAlchemy (Contact, Conversation, Message)
│       ├── schemas/          # Pydantic request/response
│       └── services/         # Business logic
├── frontend/                 # Next.js
│   └── src/
│       ├── components/       # Layout, UI components
│       ├── lib/              # API client
│       ├── pages/            # Routes (Pages Router)
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
| Autenticación — Auth Backend (2/3) | Pendiente |
| Autenticación — Frontend Auth (3/3) | Pendiente |
| n8n (orquestación) | Pendiente |
| Testing y documentación final | Pendiente |
