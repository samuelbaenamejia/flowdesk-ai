# Changelog

## v0.14.0 (2026-08-03) — F6F: Unread & Read Status

### PR 6F.1 — Backend read/unread
- Columna `unread_count` en `conversations` (migración `a7b8c9d0e1f2`, upgrade/downgrade verificadas)
- `POST /conversations/{id}/read`: marca la conversación como leída (`unread_count=0`), idempotente, responde 204, 404 si no existe, 401 sin token
- `unread_count` incluido en el serializador de conversación
- Webhook incoming incrementa `unread_count` (solo con gap entre mensajes ≤ 600 s)
- Tests: 8 nuevos (164 en total)

### PR 6F.2 — Búsqueda en conversación + agrupación por fecha
- `DateGroup`: agrupación de mensajes por día con colapsar/expandir y accesibilidad (`aria-expanded`)
- `useChatShortcuts`: Ctrl+F enfoca la búsqueda de mensajes, Escape limpia/cierra
- `MessageBubble`: `<mark>` con resaltado del término buscado; `MessageFilters` con contador "X de Y resultados"
- `SearchBar` con hint de atajo integrado
- Tests: 30 nuevos (296 en total, 34 files)

### PR 6F.3 — Smart scroll, FAB y marcado de leído en UI
- `FloatingScrollButton` (FAB): visible solo al salir del fondo del chat, badge con mensajes nuevos recibidos (cap `99+`), se limpia al pulsarlo, al volver al fondo o al activar búsqueda
- Marcar conversación como leída al abrirla (idempotente, `POST /conversations/{id}/read`)
- `ConversationTable`: dot azul + badge "N mensajes no leídos" (cap `99+`)
- Ctrl+Enter / Cmd+Enter envía el mensaje; Shift+Enter conserva salto de línea
- Auto-scroll condicional a la cercanía del fondo (no secuestra el scroll en load-more ni deep-links)
- Tests: 16 nuevos (312 en total, 35 files)

### Verificación
- Backend: 164/164 pytest · Frontend: 312/312 vitest (35 files) · tsc 0 errores

## v0.13.0 (2026-07-31) — F6E: Dashboard & KPIs

### PR 6E.1 — Dashboard API
- `GET /dashboard/stats`: total de conversaciones, mensajes hoy y esta semana (UTC), tasa de respuesta %, tiempo medio de respuesta (min) y top-5 contactos por mensajes
- `GET /dashboard/messages-over-time`: serie de 30 días completada con ceros (fechas ISO)
- Métricas definidas sobre pares primera-entrada/primera-salida por conversación; ventanas en UTC (semana inicia lunes)
- `dashboard_service.py` + schemas dedicados; endpoints protegidos con JWT
- 5 tests nuevos (156 en total)

### PR 6E.2 — Dashboard UI
- `useDashboard`: stats, gráfico y recientes con estados de carga/error/reintento independientes, abort de requests y refresco al volver a la pestaña
- `StatCard` y `MessagesChart` (SVG accesible con tooltip al hover y etiquetas de fecha)
- Nueva página `/dashboard`: 4 tarjetas KPI, gráfico de mensajes por día y últimas 5 conversaciones reutilizando `ConversationTable`; empty state con CTA a Contactos
- Navegación: ítem Dashboard en el sidebar, redirect de `/` y de login autenticado a `/dashboard`
- Formateo de miles determinista (compatible con SSR)
- Tests: 24 nuevos (266 en total, 32 files)

### Verificación
- Backend: 156/156 pytest · Frontend: 266/266 vitest (32 files) · tsc 0 errores

## v0.12.0 (2026-07-31) — F6D: Inbox Filters UI + Global Search UI

### PR3 — Inbox Filters UI
- `SearchBar`: input de búsqueda reutilizable con icono, botón limpiar y hint de atajo
- `ConversationFilters`: filtros de búsqueda, estado (Todas/Activas/Takeover/Cerradas) y fechas para el dashboard
- `MessageFilters`: búsqueda, dirección, estado y fechas para el workspace de conversación
- `ConversationTable`: empty states contextuales (sin conversaciones / sin resultados de filtro)
- `Pagination`: muestra rango "1 – 20 de 42" cuando se conoce el total
- `MessageList`: muestra hint del término de búsqueda activo sobre los resultados
- Página de conversaciones y detalle conectadas a los filtros (Limpiar filtros)
- Se elimina el antiguo `ConversationsFilter` (reemplazado por `ConversationFilters`)

### PR4 — Global Search UI
- `useGlobalSearch` integrado en el Header: dropdown con resultados agrupados (conversaciones + mensajes)
- Dropdown accesible: `role="listbox"`, `aria-activedescendant`, navegación con ArrowUp/Down, Enter, Escape, click fuera
- Atajo de teclado `/` para enfocar la búsqueda desde cualquier página
- Resultados con fragmento resaltado (highlight) del backend y badge de estado
- Nueva página `/search`: resultados completos agrupados, skeletons, empty state y error con reintento
- Deep-link `?msg=` al abrir un mensaje: scroll automático y resaltado del mensaje en la conversación
- `MessageBubble`: `data-message-id` + prop `highlight` (ring amber) para el deep-link
- Bugfix: `aria-expanded` recibía el texto del query en lugar de booleano

### Verificación
- Backend: 151/151 pytest · Frontend: 242/242 vitest (27 files) · tsc 0 errores


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

## v0.7.0 (2026-07-30) — F5: Production Readiness (Infrastructure)

### F5A — CI/CD Pipeline
- CI: lint + test + build en cada PR y push (GitHub Actions)
- CD: build + push a GHCR + deploy vía SSH en push a main
- docker-compose.prod.yml: override para usar imágenes pre-construidas
- deploy.sh: pull + retag + migrations + restart + healthcheck + cron install
- rollback.sh: rollback por tag de commit

### F5B — Reverse Proxy (Caddy + TLS)
- Caddy reverse proxy con TLS automático (Let's Encrypt)
- Caddyfile con routing: backend (8000), n8n (5678) + TLS automático
- HTTP/3, security headers

### F5C — Docker Hardening
- Resource limits (mem_limit, cpus) en todos los servicios
- HEALTHCHECK en backend (curl /health) y frontend (curl /)
- restart: unless-stopped en todos los servicios
- Non-root users en backend y frontend Dockerfiles
- cap_drop: ALL + no-new-privileges en servicios
- Log rotation: json-file driver, max-size 10m, max-file 3

### F5C.1 — Row Level Security (RLS)
- RLS habilitado con default-deny en 4 tablas (users, contacts, conversations, messages)
- FORCE ROW LEVEL SECURITY para defense-in-depth
- Migración Alembic: rol postgres con rolbypassrls=true, sin impacto en la app

### F5D — Monitoring, Backups y Observability
- Uptime Kuma: monitoring stack (docker-compose.mon.yml) con healthchecks
- backup.sh: pg_dump (custom format), n8n volume backup, workflow export via API, config backup, retention 7 días
- restore.sh: pg_restore --clean, n8n volume restore, workflow import manual
- Cron: backup diario 02:00 (backup.cron), instalación idempotente en deploy
- .env.example: nuevas vars N8N_URL, N8N_API_KEY para workflow export
- `mkdir -m 700` en directorios de backup (seguridad de secrets)
- `N8N_URL=http://localhost:5678` para compatibilidad host-cron

### Fixes incluidos
- F5A: B008 ignorado en CI, rutas compose con prefijo `infra/`, deploy.sh retagea SHA→latest
- F5A: DATABASE_URL sin +asyncpg para pg_dump compatibilidad
- F5C: Corrección de braces en docker-compose (env_file: [])
- F5C: Image pull policy ajustada para evitar caché obsoleto
- F5D: Solo los bugs confirmados — mkdir permisos + N8N_URL host-cron

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
