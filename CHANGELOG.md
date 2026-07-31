# Changelog

## v0.11.0 (2026-07-31) — F6D: Inbox Search & Filtering

### Backend
- `GET /conversations` y `GET /conversations/{id}/messages` ahora aceptan filtros: `q` (búsqueda ILIKE sobre nombre/contacto/teléfono/contenido), `status`, `date_from`, `date_to` (+ `direction` en mensajes)
- Respuestas paginadas: `{items, total, limit, offset}` en conversaciones y mensajes
- Nuevo endpoint global `GET /search` con scope `all|conversations|messages` y `highlight` de contexto (±50 caracteres)
- `conversation_service.py`: search_conversations, get_conversation, update_conversation_status, get_contact_name
- 32 tests nuevos (151 en total, incluye `test_search.py`)

### Frontend
- Types + API client actualizados al formato paginado (`ConversationListResponse`, `MessageListResponse`, `GlobalSearchResponse`, etc.)
- `useConversations`: filtros (search/status/fechas), debounce 300ms, polling pausado con filtros activos
- `useMessages`: filtros (q/direction/status/fechas), debounce 300ms, polling pausado con filtros activos, `offset` expuesto
- Nuevo `useGlobalSearch`: debounce 300ms, cache LRU (10 entradas), abort de requests obsoletos, retry
- Tests: 171 en total (suites de hooks reescritas + `useGlobalSearch.test.tsx`)

## v0.5.0 (2026-07-28) — F5A: CI/CD Pipeline

### Infrastructure
- CI: lint + test + build en cada PR y push (GitHub Actions, ~5 min)
- CD: build + push a GHCR + deploy vía SSH en push a main (~8 min)
- docker-compose.prod.yml: override para usar imágenes pre-construidas (evita `env_file: []`)
- Backend entrypoint: ejecuta `alembic upgrade head` antes de arrancar
- Deploy script: pull + retag + migrations + restart + healthcheck
- Rollback script: pull por tag + retag a latest + healthcheck
- Fix: B008 ignorado en CI, rutas de compose con prefijo `infra/`, deploy.sh retagea SHA→latest

### Documentation
- Design doc: docs/design/F5A-cicd-pipeline.md (9/9 acceptance criteria)
- Roadmap: F5 sections agregados
- DEPLOY.md: sección 8 reescrita con CI/CD + secrets + rollback
- SESSION_HANDOFF: F5A section completa
- CHANGELOG: v0.5.0 + detalles de correcciones
- Release Gate: PASSED — 98/100, 0 blockers

## v0.4.1 (2026-07-28) — Sprint Infra 1: Release Hardening

### Infrastructure
- Backend/Frontend: Docker HEALTHCHECK + restart: unless-stopped
- Frontend Dockerfile: curl instalado para healthchecks
- Compose: healthchecks en backend y frontend, restart policies en todos los servicios

### Security
- CORS configurable por entorno (CORS_ORIGINS, default `*`)
- Rate limiting en POST /auth/login (5 intentos / 5 min, in-memory)
- Validación de secrets por defecto al arrancar (SECRET_KEY, INTERNAL_API_KEY)
- Request-ID header en todas las respuestas (traza distribuida)

### Quality
- ErrorBoundary component: evita white screen en errores de React
- Lint: 7 unused imports removidos de tests backend

## v0.4.0 (2026-07-28)

### Features
- **F2 — Dashboard**: Refactor completo con useConversations hook, filtros, paginación, ConversationTable
- **F3 — Conversation Workspace**: ConversationHeader, MessageBubble, MessageList, Composer, useConversation, useMessages
- **F4A — Responsive Design**: AppShell con sidebar state + backdrop overlay mobile, tablas overflow-x-auto, columnas responsive, dvh en lugar de vh
- **F4B — Dark Mode**: Tailwind `darkMode: "class"`, ThemeContext + useTheme, `_document.tsx` anti-flicker, 22 archivos con clases `dark:`
- **F4C — Realtime (Smart Polling)**: Polling 5s/10s/15s con `after` timestamp, Set-based dedup, visibility pause/resume, 0 nuevas dependencias
- **Testing**: 153 tests, 21 test files, coverage thresholds al 90%

### Technical
- Backend: `after` query param en GET messages para filtro incremental
- Frontend: 7 UI components (Button, Input, Badge, Table, Skeleton, EmptyState, ErrorState)
- Frontend: 3 hooks polling-aware (useMessages, useConversations, useConversation)
