# FlowDesk-AI

Plataforma de atención automática empresarial vía WhatsApp.

Automatiza respuestas a clientes usando IA, con supervisión humana cuando sea necesario.

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | FastAPI (Python 3.12) |
| Frontend | Next.js 14 (Pages Router, React 18, TailwindCSS) |
| Base de Datos | PostgreSQL via Supabase |
| Orquestación | n8n |
| IA | Groq API (Llama 3) |
| Proxy | Caddy |
| Contenedores | Docker Compose |

## Estructura

```
FlowDesk-AI/
├── backend/          # FastAPI
│   └── app/
│       ├── main.py
│       └── core/
├── frontend/         # Next.js
│   └── src/
│       ├── pages/
│       └── styles/
├── infra/            # Docker Compose, configs
├── docs/             # Documentación del proyecto
├── planning/         # Planificación de sprints
└── notes/            # Notas de sesión
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
| 0. Preparación | Completada |
| 1. Sprint 1 — Base del proyecto | En curso |
| 2. Base de datos y API Core | Pendiente |
| 3. n8n y WhatsApp | Pendiente |
| 4. Dashboard y Frontend | Pendiente |
| 5. Integración IA | Pendiente |
| 6. Testing y Documentación | Pendiente |
