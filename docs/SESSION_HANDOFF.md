# SESSION_HANDOFF — FlowDesk-AI

> Fecha: 2026-07-22
> Sesión: 2026-07-22 — Sesión inicial (Fase 0 + Sprint 1 + Architecture Review)
> Sesión: 2026-07-22 — PR #1: database bootstrap (feature/database-bootstrap)

---

## Resumen de la sesión

### Qué se hizo hoy

1. **Arquitectura inicial (Fase 0):** Se crearon 6 documentos de planificación (PROJECT_VISION, SCOPE, ROADMAP, DECISIONS, ARCHITECTURE_REVIEW, MVP_DEFINITION) definiendo el alcance, stack, ADRs y MVP del proyecto.

2. **Architecture Review:** Se recalibró el proyecto eliminando sobrearquitectura. Se redujo el stack de 16+ tecnologías a 8 esenciales. Se eliminaron: Ollama, pgvector, RAG, Traefik, Redis, Supabase self-hosted, Hexagonal Architecture, App Router, Loki/Grafana/Prometheus. Se reemplazaron por: Groq API, Supabase Cloud, Caddy, Pages Router, Clean Layers.

3. **Sprint 1 — Base del proyecto:** Se crearon 24 archivos que conforman la base mínima funcional: backend FastAPI con endpoint `/health`, frontend Next.js con placeholder, Docker Compose con 2 servicios, .env.example, .gitignore, README profesional.

4. **Sprint 2 — Planificación:** Se diseñó la capa de persistencia (SQLAlchemy + Alembic + Supabase async) y se dividió en 2 PRs pequeños. Pendiente de implementación.

### Decisiones importantes tomadas

| Decisión | Resolución |
|----------|-----------|
| Stack backend | FastAPI (no Django, no Express) |
| Stack frontend | Next.js Pages Router (no App Router) |
| Base de datos | Supabase Cloud (no self-hosted, no Firebase) |
| Modelo IA | Groq API (no Ollama local, no OpenAI pago) |
| Orquestación | n8n self-hosted (main mode, sin Redis queue) |
| Proxy | Caddy (no Traefik, no Nginx) |
| Arquitectura backend | Clean Layers (Controller → Service → Repository) |
| Persistencia | SQLAlchemy 2.0 async + asyncpg + Alembic |
| Estructura proyecto | Monorepo simple (no turborepo, no multis repo) |
| Contenedores | Docker Compose (no K8s) |
| Despliegue frontend | Vercel (self-hosted opcional después) |

### Qué se descartó

| Tecnología | Razón del descarte |
|-----------|-------------------|
| Ollama + Llama 3.1 local | Complejidad operativa (GPU/RAM), misma calidad vía Groq |
| pgvector + RAG + Embeddings | MVP no necesita búsqueda vectorial; system prompt basta |
| Traefik | Overkill para 2 servicios; Caddy es más simple |
| Redis / Queue Mode | Volumen del MVP no lo justifica; n8n main mode basta |
| Supabase self-hosted | 5+ servicios Docker extras; Cloud es más simple y suficiente |
| Hexagonal Architecture | YAGNI para implementaciones únicas; Clean Layers basta |
| Next.js App Router | Complejidad innecesaria para dashboard de 4 pantallas |
| Loki / Prometheus / Grafana | docker logs basta para MVP |
| GitHub Actions | Se añadirá cuando haya código que testear |
| Multi-tenant / Multi-agente | Fuera de alcance del MVP |
| RAG / Búsqueda semántica | Se añadirá post-MVP si se necesita |

---

## Estado actual del proyecto

### Backend

- **FastAPI** funcionando, endpoint `GET /health` responde `200 OK`
- Estructura de capas lista: `api/` (vacío), `core/` (config, database, logging), `models/` (vacío)
- Dependencias instalables via pip (`pyproject.toml`)
- Dockerfile publica puerto 8000 con uvicorn
- **Capa de persistencia configurada:** SQLAlchemy 2.0 async + asyncpg + Alembic
- **Conectado a:** Supabase PostgreSQL (via `DATABASE_URL`)

### Frontend

- **Next.js 14** (Pages Router) funcionando, build exitoso
- Placeholder en index: "FlowDesk-AI / Dashboard / Coming soon"
- TailwindCSS configurado
- Dockerfile multi-stage, standalone output
- **Próximo:** crear páginas reales cuando exista backend que consumir

### Infraestructura

- `docker-compose.yml` con 2 servicios (backend + frontend)
- Frontend depende de backend (`depends_on`)
- **DB externa:** Supabase Cloud (no Docker)
- Sin reverse proxy (Caddy se añadirá cuando haya dominios)
- `.env.example` con `DATABASE_URL` placeholder

### Documentación

- 7 documentos en `docs/`: PROJECT_VISION, PROJECT_SCOPE, PROJECT_ROADMAP, PROJECT_DECISIONS, ARCHITECTURE_REVIEW, MVP_DEFINITION, SESSION_HANDOFF
- README.md en raíz con stack, estructura, cómo ejecutar
- `.env.example` con todas las variables futuras documentadas

---

## Sprints

| Sprint | Estado | Descripción |
|--------|--------|-------------|
| 0 — Preparación | ✅ Completado | Docs de visión, alcance, decisiones, roadmap, revisión arquitectura |
| 1 — Base del proyecto | ✅ Completado | Backend mínimo, frontend mínimo, Docker Compose, README |
| 2 — PR #1: Persistencia (base) | ✅ Completado | SQLAlchemy async, Alembic, config DATABASE_URL |
| 2 — PR #2: Modelo Contact + migración | ⏳ Pendiente | Crear modelo Contact, migración, verificar inserción |
| 3 — API Core | ⏳ Pendiente | Endpoints de conversaciones, webhooks, servicios |
| 4 — Frontend funcional | ⏳ Pendiente | Dashboard, login, conversaciones |
| 5 — n8n + WhatsApp | ⏳ Pendiente | Workflow de recepción y envío |
| 6 — Integración IA | ⏳ Pendiente | Conexión con Groq, generación de respuestas |
| 7 — Testing | ⏳ Pendiente | Tests unitarios, integración, E2E |
| 8 — Documentación + Deploy | ⏳ Pendiente | Docs finales, despliegue producción |

---

## Próximo objetivo

El siguiente trabajo será el **PR #2 del Sprint 2**.

**Objetivo del PR #2:** Crear el modelo `Contact` (SQLAlchemy), generar la primera migración con Alembic, ejecutarla contra Supabase, y verificar que puede insertarse un contacto correctamente.

**Alcance exacto:**
- Crear `backend/app/models/__init__.py`
- Crear `backend/app/models/contact.py`
- Importar modelos en `alembic/env.py` (ya configurado para detectar `Base`)
- Ejecutar `alembic revision --autogenerate -m "create contacts table"`
- Revisar y ejecutar migración
- Probar inserción de contacto con script inline

**Fuera del PR #2:**
- ❌ Endpoints
- ❌ Autenticación
- ❌ WhatsApp
- ❌ n8n
- ❌ Groq

---

## Archivos creados (24 + docs)

### Sprint 1 — Backend (7 archivos)
```
backend/app/__init__.py
backend/app/main.py
backend/app/core/__init__.py
backend/app/core/config.py
backend/app/core/logging.py
backend/Dockerfile
backend/pyproject.toml
```

### Sprint 2 — PR #1: Persistencia (5 nuevos + 2 modificados)
```
backend/app/core/database.py          # NUEVO: engine, async_session, Base
backend/alembic.ini                   # NUEVO: configuración CLI
backend/alembic/env.py                # NUEVO: entorno async para Alembic
backend/alembic/script.py.mako        # NUEVO: template de migraciones
backend/alembic/versions/.gitkeep     # NUEVO: preservar directorio
backend/app/core/config.py            # MODIFICADO: +database_url
backend/pyproject.toml                # MODIFICADO: +sqlalchemy, asyncpg, alembic
```

### Sprint 1 — Frontend (9 archivos)
```
frontend/Dockerfile
frontend/next.config.js
frontend/package.json
frontend/postcss.config.js
frontend/tailwind.config.js
frontend/tsconfig.json
frontend/src/pages/_app.tsx
frontend/src/pages/index.tsx
frontend/src/styles/globals.css
```

### Sprint 1 — Infraestructura (3 archivos)
```
infra/docker-compose.yml
infra/.env.example
.gitignore
```

### Sprint 1 — Raíz (1 archivo)
```
README.md
```

### Documentación (8 archivos)
```
docs/PROJECT_VISION.md
docs/PROJECT_SCOPE.md
docs/PROJECT_ROADMAP.md
docs/PROJECT_DECISIONS.md
docs/ARCHITECTURE_REVIEW.md
docs/MVP_DEFINITION.md
docs/SESSION_HANDOFF.md
```

---

## Riesgos conocidos

| ID | Riesgo | Probabilidad | Impacto | Mitigación |
|----|--------|-------------|---------|------------|
| R-01 | **Supabase Cloud cambia free tier** | Baja | Alto | DB es PostgreSQL estándar; migrable a cualquier host |
| R-02 | **Meta cambia WhatsApp Cloud API** | Media | Alto | Suscribirse a changelog, tests de contrato |
| R-03 | **Groq cambia free tier o cierra** | Media | Medio | API compatible OpenAI; intercambiable por OpenRouter/Gemini |
| R-04 | **n8n memory leak en main mode** | Media | Medio | Restart policy en docker-compose; migrar a queue mode si necesario |
| R-05 | **Scope creep** (querer añadir más features al MVP) | Alta | Medio | MVP_DEFINITION.md como contrato; cambios requieren aprobación |
| R-06 | **Python 3.12 vs 3.14** (entorno local vs Docker) | Baja | Bajo | Docker usa 3.12-slim; entorno local puede ser 3.12+ |

---

## Decisiones arquitectónicas vigentes

| ID | Decisión | Justificación |
|----|----------|---------------|
| ADR-001 | FastAPI | Async nativo, OpenAPI automático, tipado estricto |
| ADR-002 (mod) | Next.js Pages Router | Más simple que App Router; dashboard no necesita RSC |
| ADR-003 (reemp) | Supabase Cloud | Zero mantenimiento, free tier suficiente, PG estándar |
| ADR-004 | n8n self-hosted | Control de webhooks, visual, 400+ nodos, gratis |
| ADR-005 (reemp) | Groq API | Gratis, ultrarrápido, sin infraestructura, misma calidad que Llama |
| ADR-006 (elim) | Sin RAG/pgvector | System prompt suficiente para MVP |
| ADR-007 (reemp) | Caddy | 5 líneas de config, TLS automático, simple |
| ADR-008 | Monorepo | Un repo, CI unificado, PR único |
| ADR-009 | Docker Compose | Simple, single command, suficiente para MVP |
| ADR-010 | Alembic | Estándar Python+SQLAlchemy, autogenerate, versionado |
| ADR-011 (reemp) | Clean Layers | Controller → Service → Repository. Simple, testeable |
| ADR-012 | Pydantic v2 | Viene con FastAPI, validación automática |
| ADR-013 (pend) | Zustand o Context | Se decide durante implementación frontend |
| ADR-014 (elim) | Sin Redis Queue | n8n main mode suficiente para volumen MVP |
| ADR-015 | structlog | Logs estructurados a stdout; sin Loki/Grafana |
| ADR-016 | Ruff | Linter+formatter unificado, rápido (Rust) |

---

## Cómo levantar el proyecto

```bash
# Requisito: Docker y Docker Compose

# 1. Clonar / navegar al proyecto
cd FlowDesk-AI

# 2. Copiar variables de entorno
cp infra/.env.example infra/.env
# (editar .env con valores reales si es necesario)

# 3. Buildear y levantar
docker compose -f infra/docker-compose.yml up --build

# 4. Verificar
curl http://localhost:8000/health
# → {"status": "ok", "environment": "development"}

# 5. Abrir frontend
# http://localhost:3000 → "FlowDesk-AI • Dashboard • Coming soon"

# Para desarrollo local (sin Docker):
# Backend
cd backend
python -m venv .venv
.venv\Scripts\pip install -e .
.venv\Scripts\uvicorn app.main:app --reload --port 8000

# Frontend (otra terminal)
cd frontend
npm install
npm run dev
```

---

## Checklist para la próxima sesión

**Sprint 2 — PR #1: Conexión a Supabase** ✅ Completado

- [x] Añadir `DATABASE_URL` a `backend/app/core/config.py`
- [x] Crear `backend/app/core/database.py` (async engine, session, Base)
- [x] Añadir dependencias: `sqlalchemy`, `asyncpg`, `alembic` a `pyproject.toml`
- [x] Crear `backend/alembic.ini`
- [x] Crear `backend/alembic/env.py` (configuración async)
- [x] Crear `backend/alembic/script.py.mako`
- [x] Crear `backend/alembic/versions/.gitkeep`
- [x] Instalar dependencias y verificar import sin errores
- [x] Ruff linting: all checks passed
- [x] Commit: `feat(database): bootstrap sqlalchemy and alembic`
- [x] Rama: `feature/database-bootstrap`

**Sprint 2 — PR #2: Modelo Contact + migración (próximo PR)**

- [ ] Crear `backend/app/models/__init__.py`
- [ ] Crear `backend/app/models/contact.py` (modelo SQLAlchemy)
- [ ] Importar modelos desde `alembic/env.py` para detección automática
- [ ] Ejecutar `alembic revision --autogenerate -m "create contacts table"`
- [ ] Revisar migración generada
- [ ] Ejecutar `alembic upgrade head`
- [ ] Verificar tabla creada en Supabase
- [ ] Probar inserción con script inline
- [ ] Ruff linting
- [ ] Code review
- [ ] Commit y push previa aprobación

---

## CONTEXTO PARA LA PRÓXIMA SESIÓN

### Estado actual

Proyecto FlowDesk-AI. Plataforma de atención automática empresarial vía WhatsApp. Fase 0 completada (visión, alcance, roadmap, 16 ADRs). Architecture Review completada (stack simplificado de 16 a 8 tecnologías). Sprint 1 completado (base funcional: FastAPI + Next.js + Docker Compose, 24 archivos). Sprint 2 PR #1 completado (persistencia async: SQLAlchemy + Alembic + asyncpg). Rama activa: `feature/database-bootstrap`. PR #2 pendiente: modelo Contact + migración.

### Stack definitivo

| Capa | Tecnología | Estado |
|------|-----------|--------|
| Backend | FastAPI (Python 3.12) | Funcionando, endpoint /health |
| Frontend | Next.js 14 Pages Router | Build exitoso, placeholder |
| Base de Datos | Supabase Cloud (PostgreSQL 16) | Sin conectar |
| ORM | SQLAlchemy 2.0 async + asyncpg | Sin configurar |
| Migraciones | Alembic | Sin configurar |
| Auth | Supabase Auth | Futuro |
| Orquestación | n8n self-hosted | Futuro |
| LLM | Groq API | Futuro |
| Proxy | Caddy | Futuro |
| Contenedores | Docker Compose (2 servicios) | Funcionando |

### Arquitectura

```
Frontend (Next.js/Vercel)
    │
    ▼
Backend (FastAPI/Docker)
    │
    ├── api/v1/       → Controladores HTTP
    ├── services/     → Lógica de negocio
    ├── repositories/ → Acceso a datos
    └── models/       → SQLAlchemy ORM
          │
          ▼
Supabase Cloud (PostgreSQL + Auth + Realtime)
```

### Decisiones importantes a recordar

1. **Siempre pensar en PRs pequeños.** Un PR = una unidad lógica completa y revisable. No mezclar concerns.
2. **Nada de sobrearquitectura.** Si no hace falta hoy, no se implementa. YAGNI.
3. **Async desde el día 1.** FastAPI + asyncpg + SQLAlchemy async. No sync wrappers.
4. **Alembic es la única forma de crear tablas.** Prohibido `Base.metadata.create_all()`.
5. **Sin endpoints hasta que la DB esté funcionando.** Primero conexión, luego modelos, luego endpoints.
6. **Sin IA ni WhatsApp hasta el Sprint 6.** El sistema debe funcionar sin IA (modo manual) primero.

### Qué NO hacer

- ❌ No crear modelos hasta que la conexión a Supabase esté verificada
- ❌ No crear endpoints en este sprint
- ❌ No crear auth
- ❌ No crear n8n workflows
- ❌ No conectar Groq
- ❌ No conectar WhatsApp
- ❌ No usar `create_all` — siempre Alembic
- ❌ No mezclar PRs — cada PR cambia una sola cosa

### Qué sí hacer (PR #1)

- ✅ Añadir `DATABASE_URL` a config.py
- ✅ Crear database.py con engine async, async_sessionmaker, declarative Base
- ✅ Añadir sqlalchemy, asyncpg, alembic a pyproject.toml
- ✅ Crear y configurar Alembic (alembic.ini + env.py)
- ✅ Verificar conexión a Supabase con script inline

### Objetivo del PR #1 (completado)

**Commit:**
```
feat(database): bootstrap sqlalchemy and alembic
```

**Archivos creados (5):**
- `backend/app/core/database.py` — engine, async_session, Base
- `backend/alembic.ini` — configuración CLI
- `backend/alembic/env.py` — entorno async
- `backend/alembic/script.py.mako` — template
- `backend/alembic/versions/.gitkeep`

**Archivos modificados (2):**
- `backend/app/core/config.py` — +database_url
- `backend/pyproject.toml` — +sqlalchemy, asyncpg, alembic

### Objetivo del PR #2 (próximo)

Crear modelo Contact (SQLAlchemy), generar migración Alembic, ejecutar contra Supabase, verificar inserción.

### Restricciones vigentes

- MVP congelado en MVP_DEFINITION.md — no añadir features extras
- Sin código que dependa de API keys externas (WhatsApp, Groq) hasta que toque
- Sin dependencias nuevas sin justificación escrita
- Sin archivos de más — si no se usa, no se crea

### Filosofía de desarrollo

> *"Un MVP profesional no es el que más tecnologías usa. Es el que resuelve el problema con la menor complejidad posible."*

- Simplicidad sobre cantidad
- No anticipar problemas de escala
- Código sobre configuración
- Documentación como prioridad
- Evolucionable, no sobrearquitecturado

### Regla permanente

> **Cada incremento debe parecer un Pull Request profesional de un desarrollador senior.**
> Pequeño, enfocado, bien nombrado, con un solo propósito, revisable en 5 minutos.

---

**=== FIN DEL CONTEXTO ===**
