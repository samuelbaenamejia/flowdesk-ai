# PROJECT ROADMAP - FlowDesk-AI

> Cada fase debe ser aprobada antes de continuar a la siguiente.

---

## FASE 0 — Preparación del Entorno (COMPLETADA ✔️)

**Duración estimada**: 1 día real
**Entregables**:
- [x] Carpetas docs/, planning/, notes/
- [x] PROJECT_VISION.md
- [x] PROJECT_SCOPE.md
- [x] PROJECT_ROADMAP.md
- [x] PROJECT_DECISIONS.md
- [x] ARCHITECTURE_REVIEW.md (recalibración post-review)
- [x] MVP_DEFINITION.md (alcance preciso del MVP)
- [ ] Git init + commit inicial
- [ ] Entorno Python (.venv, pyproject.toml, requirements.txt)
- [ ] Entorno Node (.nvmrc, package.json)
- [ ] Editor config (.editorconfig, .prettierrc)
- [ ] Pre-commit hooks (ruff + prettier)

---

## FASE 1 — Análisis de Requisitos

**Duración estimada**: 2 días
**Objetivo**: Validar que el MVP_DEFINITION.md cubre todos los casos de uso antes de codificar.

**Entregables**:
- [ ] Casos de uso detallados para cada funcionalidad del MVP
- [ ] Matriz de estados de conversación (active → human_takeover → closed)
- [ ] Definición de system prompt para Groq
- [ ] Estrategia de manejo de errores (LLM falla, WhatsApp falla, webhook falla)
- [ ] Flujo alternativo: qué pasa si el contacto ya está en takeover

---

## FASE 2 — Diseño de Base de Datos

**Duración estimada**: 1 día
**Objetivo**: Esquema SQL completo para Supabase.

**Entregables**:
- [ ] Tablas: contacts, conversations, messages, agents
- [ ] Migraciones SQL (Alembic)
- [ ] Políticas RLS en Supabase (si aplica)
- [ ] Índices y constraints

---

## FASE 3 — Diseño de la API

**Duración estimada**: 1 día
**Objetivo**: Contratos de API antes de codificar.

**Entregables**:
- [ ] Schemas Pydantic para cada endpoint
- [ ] Validación de request/response
- [ ] Códigos de error estandarizados
- [ ] Documentación OpenAPI

---

## FASE 4 — Diseño del Flujo n8n

**Duración estimada**: 1 día
**Objetivo**: Workflow de n8n diagramado antes de implementar.

**Entregables**:
- [ ] Workflow: Webhook WhatsApp → FastAPI
- [ ] Manejo de verify token
- [ ] Transformación de payload
- [ ] Manejo de errores y retry

---

## FASE 5 — Diseño Frontend

**Duración estimada**: 1 día
**Objetivo**: Mockups del dashboard.

**Entregables**:
- [ ] Wireframes: Login, Dashboard, Lista Conversaciones, Detalle
- [ ] Estados: loading, empty, error, edge
- [ ] Flujo de takeover humano

---

## FASE 6 — Implementación

**Duración estimada**: 3-4 semanas
**Objetivo**: Código del MVP.

**Sprints**:
- **Sprint 1** (semana 1): Infraestructura + DB + Auth
  - Docker Compose (backend + n8n + caddy)
  - Supabase setup (DB + Auth)
  - Modelos SQLAlchemy + Alembic
  - Health check endpoint
- **Sprint 2** (semana 2): Backend Core
  - Endpoints de conversaciones, mensajes, contactos
  - Webhook receiver (n8n → FastAPI)
  - Servicio Groq (LLM)
  - Servicio WhatsApp (envío)
- **Sprint 3** (semana 3): n8n Workflows + Frontend
  - Workflow WhatsApp webhook → FastAPI
  - Dashboard (listado + detalle conversaciones)
  - Human takeover flow
- **Sprint 4** (semana 4): Integración + Testing
  - End-to-end: WhatsApp → n8n → FastAPI → Groq → WhatsApp
  - Tests unitarios backend
  - Tests de integración
  - Debugging y polish

---

## FASE 7 — Testing

**Duración estimada**: 3 días
**Entregables**:
- [ ] Tests unitarios backend (>80% coverage)
- [ ] Test de integración: webhook → LLM → respuesta
- [ ] Prueba manual: enviar WhatsApp, recibir respuesta, ver en dashboard
- [ ] Prueba de takeover humano

---

## FASE 8 — Documentación

**Duración estimada**: 2 días
**Entregables**:
- [ ] README.md (cómo configurar, ejecutar, desplegar)
- [ ] DEPLOY.md (paso a paso para producción)
- [ ] CHANGELOG.md
- [ ] API docs (OpenAPI)

---

## FASE 9 — Preparación Demo

**Duración estimada**: 1 día
**Entregables**:
- [ ] Datos de prueba precargados
- [ ] Script de demo (5 min, casos clave)
- [ ] Entorno demo funcionando

---

## FASE 10 — Refactor Final

**Duración estimada**: 1 día
**Entregables**:
- [ ] Revisión de código completa
- [ ] Linting/typing sin errores
- [ ] Deuda técnica documentada
- [ ] Propuesta de mejoras futuras
