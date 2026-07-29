# PROJECT DECISIONS - FlowDesk-AI

> Registro de Decisiones de Arquitectura (ADR)
> Cada decisión técnica relevante debe registrarse aquí con fecha, contexto, alternativas y razón.

---

## ADR-001: FastAPI como Framework Backend

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-22 |
| **Contexto** | Necesitamos un backend que reciba webhooks de WhatsApp (alta concurrencia, baja latencia), exponga API REST, se comunique con n8n y PostgreSQL, y sea mantenible por un dev junior. |
| **Problema** | Elegir framework backend que cumpla: async nativo, validación automática, OpenAPI docs, performance, tipado estricto, baja curva de aprendizaje. |
| **Alternativas** | Django, NestJS, Express (Node), Flask, Gin (Go), Axum (Rust) |
| **Razón** | FastAPI es async nativo (crítico para webhooks), genera OpenAPI automáticamente con Pydantic v2, tiene performance de clase Node/Go, y su tipado estricto reduce bugs. Django es sincrónico sin async bien soportado. NestJS/Express añaden complejidad JS/TS sin ventaja clara. Flask es síncrono. Gin/Axum son más complejos para perfil junior. |
| **Consecuencias** | + OpenAPI gratis, + validación automática, - ecosistema menor que Django/NestJS, - menos "batteries included" (ORM, admin, auth). |

---

## ADR-002: Next.js App Router como Frontend

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-22 |
| **Contexto** | Necesitamos un dashboard web responsive con WebSocket en tiempo real, autenticación, y actualizaciones live. |
| **Problema** | Elegir framework frontend con SSR/SSG, WebSocket nativo, auth integrable, y buena DX. |
| **Alternativas** | Vite + React, Remix, Nuxt (Vue), SvelteKit, Astro |
| **Razón** | Next.js 14 App Router ofrece Server Components (menos JS bundle), Server Actions (mutaciones simples), WebSocket nativo, middleware de auth, image optimization, y despliegue tanto en Vercel como self-hosted. Remix es similar pero con menos ecosistema. Nuxt (Vue) se sale del stack definido (React). SvelteKit es genial pero menor ecosistema. Astro es mejor para contenido estático. |
| **Consecuencias** | + Server Components reducen JS, + WebSocket soportado, + auth middleware edge, - complejidad RSC, - hydration overhead, - lock-in parcial con features Vercel. |

---

## ADR-003: Supabase Self-hosted sobre Auth0/Firebase

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-22 |
| **Contexto** | Necesitamos auth, DB, realtime y storage. El proyecto debe ser self-hosted (data sovereignty). |
| **Problema** | Elegir plataforma backend que unifique auth + DB + realtime + storage en un stack autogestionable. |
| **Alternativas** | Firebase, Auth0 + PG puro, Clerk + PG puro, Supabase Cloud |
| **Razón** | Supabase self-hosted (Docker) proporciona: GoTrue auth (email, magic link, OAuth), PostgreSQL 16 con PostgREST API automática, Realtime via WebSocket (basado en pg_replication), Storage S3-compatible (MinIO), RLS (Row Level Security) nativo para multi-tenant futuro. Firebase es vendor lock-in y datos en Google. Auth0 es caro y externo. Supabase Cloud viola data sovereignty. |
| **Consecuencias** | + Auth + DB + Realtime + Storage unificados, + RLS listo para multi-tenant, + PostgreSQL estándar (sin lock-in), - más peso Docker, - GoTrue menos features que Auth0 enterprise, - mantenimiento de self-hosted. |

---

## ADR-004: n8n Self-hosted como Orquestador

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-22 |
| **Contexto** | Necesitamos orquestar el flujo: WhatsApp webhook → clasificar → RAG → responder/derivar. Debe ser visual, extensible, y self-hosted. |
| **Problema** | Elegir orquestador de workflows que sea visual (no-code para ops), conecte WhatsApp API, LLM, PostgreSQL, y FastAPI. |
| **Alternativas** | Temporal, Prefect, Airflow, Node-RED, Make (Integromat), Zapier, Custom orchestrator |
| **Razón** | n8n self-hosted: visual workflow editor con 400+ nodos prebuilt (WhatsApp, HTTP, OpenAI compat, PostgreSQL, Redis, Webhook), webhook nativo con signature verification, execution history, retry policies, queue mode con Redis, gratis y self-hosted. Temporal/Prefect/Airflow requieren código, no visual. Node-RED es menos robusto. Make/Zapier son SaaS con límites y costos. Custom orchestrator sería overkill. |
| **Consecuencias** | + Visual, + 400+ nodos, + webhook nativo, + retry/queue, - memory leaks conocidos (mitigación: restart policy + queue mode), - debugging limitado contra código puro, - licencia Sustainable Use (limitaciones comerciales si > revenue). |

---

## ADR-005: Ollama + Llama 3.1 8B como LLM

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-22 |
| **Contexto** | Necesitamos clasificar intenciones y generar respuestas sin depender de APIs externas (costo, privacidad, latencia). |
| **Problema** | Elegir modelo LLM y runtime que sea gratuito, local, privado, y con calidad suficiente. |
| **Alternativas** | OpenAI GPT-4o-mini, Anthropic Claude Haiku, Google Gemini, Mistral 7B, Gemma 2 9B, Phi-3, Llama 3.1 8B |
| **Razón** | Ollama + Llama 3.1 8B (Q4_K_M): API compatible con OpenAI, ~5GB RAM en cuantizado 4-bit, ~50 tok/s en CPU moderna, >85% MMLU, licencia Comunidad (gratis comercial hasta 700M usuarios/mes). Correr local =  inference cost, datos nunca salen del servidor, latencia predecible (sin red). OpenAI/Claude son excelentes pero costosos y envían datos a terceros. Mistral 7B es buena alternativa pero menor accuracy en benchmarks. |
| **Consecuencias** | +  costo inferencia, + privacidad total, + latencia predecible, + offline-capable, - calidad < GPT-4o, - requiere CPU/GPU potente (8GB RAM mínimo, GPU recomendada), - sin function calling nativo (workaround: structured output con JSON mode). |

---

## ADR-006: pgvector como Vector Database

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-22 |
| **Contexto** | Necesitamos almacenar y consultar embeddings para RAG sobre base de conocimiento. |
| **Problema** | Elegir vector DB que se integre con PostgreSQL, permita ACID, y no requiera infraestructura adicional. |
| **Alternativas** | Pinecone, Qdrant, Weaviate, Chroma, Milvus |
| **Razón** | pgvector es una extensión de PostgreSQL: una sola base de datos para todo (operar, monitorizar, backup), ACID transaccional para vectors+metadata, HNSW index con ~10ms para 1M vectores (ANN), joins SQL directos con metadatos, cero infraestructura adicional. Pinecone/Qdrant/Weaviate son excelentes pero añaden otro servicio que operar, backup separado, latencia de red, y costo. |
| **Consecuencias** | + Un solo stack DB, + ACID, + joins con metadata, + HNSW performante, - menos features que vector DBs dedicados (sin hybrid search nativo, sin multi-tenancy nativo), - escalado vertical (no sharding automático). |

---

## ADR-007: Traefik como Reverse Proxy

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-22 |
| **Contexto** | Necesitamos reverse proxy con TLS automático (Let's Encrypt), rate limiting, auth headers, y dashboard. |
| **Problema** | Elegir reverse proxy que gestione múltiples servicios (Next.js, FastAPI, n8n, Supabase, Ollama) con TLS automático y configuración dinámica. |
| **Alternativas** | Nginx, Caddy, Cloudflare Tunnel, HAProxy |
| **Razón** | Traefik descubre servicios automáticamente via Docker labels, integra ACME/Let's Encrypt automático (wildcard certs), tiene middlewares nativos (rate limit, auth, headers, IP whitelist), dashboard web, métricas Prometheus, y configura 100% via docker-compose. Caddy es más simple pero menos flexible (sin rate limit nativo). Nginx requiere conf manual y recarga. |
| **Consecuencias** | + Labels en docker-compose, + ACME automático, + middlewares nativos, - curva de aprendizaje labels y Go templates, - menos documentación que Nginx. |

---

## ADR-008: Estructura Monorepo

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-22 |
| **Contexto** | El proyecto tiene múltiples componentes: backend (FastAPI), frontend (Next.js), workflows (n8n), infra (Docker), docs. |
| **Problema** | Decidir si usar monorepo o repositorios separados por componente. |
| **Alternativas** | Repos separados (backend/, frontend/, infra/), monorepo con turborepo/nx, monorepo simple |
| **Razón** | Monorepo simple (sin turborepo) porque: el proyecto es pequeño (1-2 devs), facilita CI/CD unificado (un pipeline, un PR), compartir tipos/schemas, una sola release, y menor complejidad operativa. Turborepo/Nx son overkill para el tamaño actual (YAGNI). Repos separados añaden overhead de coordinación, múltiples CI, PRs cruzados. |
| **Consecuencias** | + Un solo repo, + CI unificado, + PR único, - tamaño crece con tiempo, - no aislamiento de versiones (puede migrarse a repos separados si escala). |

---

## ADR-009: Docker Compose como Orquestación (no K8s)

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-22 |
| **Contexto** | Necesitamos empaquetar y desplegar 8+ servicios en un solo host. |
| **Problema** | Elegir herramienta de orquestación para entornos dev, staging y producción inicial. |
| **Alternativas** | Kubernetes (K3s, MicroK8s), Docker Swarm, Nomad, Docker Compose |
| **Razón** | Docker Compose: simple, un solo comando (docker compose up), 8+ servicios definidos en un archivo YAML, redes aisladas, health checks, restart policies, volumes, variables de entorno. K8s es overkill para 1 host y 8 servicios (YAGNI). Docker Swarm es obsoleto. Nomad es más complejo. Si escala horizontalmente, se migrará a K3s. |
| **Consecuencias** | + Simple, + single command deploy, + red interna aislada, - single host (punto único de fallo), - sin auto-escalado ni rolling updates avanzados. |

---

## ADR-010: Alembic para Migraciones DB

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-22 |
| **Contexto** | El esquema de base de datos evolucionará durante el desarrollo. Necesitamos migraciones versionadas y reproducibles. |
| **Problema** | Elegir herramienta de migraciones de base de datos para PostgreSQL + SQLAlchemy. |
| **Alternativas** | Supabase Studio (UI), Prisma Migrate, raw SQL + scripts, Flyway, Alembic |
| **Razón** | Alembic es el estándar para Python + SQLAlchemy: migraciones automáticas (autogenerate), versionadas (revisiones), reversibles (downgrade), integración con modelos SQLAlchemy. Supabase Studio es manual (no reproducible). Prisma sería otro lenguaje. Flyway es Java. Alembic es Python, se integra con el stack backend. |
| **Consecuencias** | + Autogenerate desde modelos, + versionado, + downgrade, + integrado con SQLAlchemy, - requiere mantener revisiones a mano para cambios complejos. |

---

## ADR-011: Estructura Hexagonal (Ports & Adapters) en Backend

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-22 |
| **Contexto** | El backend manejará múltiples fuentes de datos (PostgreSQL, Redis, Ollama, WhatsApp API) y debe ser testeable y mantenible. |
| **Problema** | Elegir patrón arquitectónico para el backend FastAPI que separe responsabilidades, permita testing unitario sin infraestructura, y facilite cambios de implementación. |
| **Alternativas** | MVC (Model-View-Controller), Capas (Controller → Service → Repository), Clean Architecture completa, Hexagonal |
| **Razón** | Arquitectura Hexagonal (Ports & Adapters): separa el core (domain logic) de los adapters (DB, API, LLM). Los puertos son interfaces (protocols/ABC), los adapters son implementaciones concretas (PostgreSQLAdapter, OllamaAdapter, WhatsAppAdapter). Esto permite: testear lógica de negocio sin infraestructura, cambiar DB/LLM/API sin tocar core, y evolución a Clean Architecture si el proyecto escala. Clean Architecture completa es overkill para el tamaño actual (YAGNI). MVC mezcla lógica con presentación. |
| **Consecuencias** | + Core testeable sin infra, + fácil cambiar adapters, + separación de concerns, + evolucionable a Clean Architecture, - más archivos/interfaces al inicio, - abstracción adicional que puede ser confusa para dev junior. |

---

## ADR-012: Pydantic v2 para Validación

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-22 |
| **Contexto** | Los datos cruzan múltiples capas: webhook WhatsApp, API REST, n8n, DB, frontend. Necesitamos validación consistente en cada frontera. |
| **Problema** | Elegir librería de validación de datos para Python que sea rápida, tipada, y genere schemas. |
| **Alternativas** | Pydantic v1, Marshmallow, attrs, dataclasses + manual validation, msgspec |
| **Razón** | Pydantic v2: escrito en Rust (pydantic-core), 5-50x más rápido que v1, validación automática en borders (API, DB, config), schemas JSON Schema, integración nativa con FastAPI, tipado estricto (MyPy/Pyright compatible). Marshmallow es más lento y verboso. Msgspec es rápido pero menos ecosistema. |
| **Consecuencias** | + Validación automática en borders, + JSON Schema gratis, + integración FastAPI, + performance Rust, - curva de tipos avanzados (Field, model_validator, etc). |

---

## ADR-013: Zustand para Estado Global Frontend → ❌ RECHAZADA

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-22 |
| **Contexto** | El frontend necesita manejar estado global: sesión de agente, conversaciones activas, WebSocket connection, UI state. |
| **Problema** | Elegir librería de state management para React/Next.js que sea simple, tipada, y performante. |
| **Alternativas** | Redux Toolkit, Jotai, Valtio, React Context + useReducer, Recoil |
| **Razón** | Zustand: API mínima (< 1KB), sin boilerplate (no actions/reducers/constants), tipado completo con TypeScript, persist middleware (localStorage), subscribe/selector para re-renders controlados, compatible con Server Components (store fuera del árbol React). Redux Toolkit es más verboso (slices, thunks, configureStore). Jotai/Valtio son atómicos (cada estado individual, más archivos). React Context causa re-renders en cascada. |
| **Consecuencias** | + API minimalista, + tipado completo, + persistencia, + re-renders controlados, - ecosistema menor que Redux (middleware, devtools, comunidad), - no structure opinionada (puede derivar en stores desorganizados). |

**Decisión final (2026-07-27):** No se usó Zustand. El estado global se limitó a la sesión del agente (AuthContext con React Context). Los datos de conversaciones se manejan con hooks locales (`useConversations`) que cachean estado interno con `useState`. React Context + hooks fue suficiente para el alcance del MVP. Si F3 o F4 requieren estado global adicional (WebSocket, múltiples stores), se reevaluará.

---

## ADR-014: Redis Queue Mode para n8n

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-22 |
| **Contexto** | n8n por defecto ejecuta workflows en memoria (main mode). Con carga de 100+ msg/min, puede saturarse. |
| **Problema** | Decidir modo de ejecución de n8n para throughput, estabilidad y escalado. |
| **Alternativas** | n8n main mode (default), n8n queue mode (Redis Bull), n8n multi-main (clustering) |
| **Razón** | Queue mode con Redis Bull: los workflows se encolan en Redis, workers separados los ejecutan. Esto: desacopla recepción de ejecución, permite múltiples workers paralelos, evita memory leaks del main process al reiniciar workers periódicamente, y escala horizontalmente añadiendo workers. Main mode es simple pero frágil (memory leaks conocidos). Multi-main requiere más configuración y es overkill inicial. |
| **Consecuencias** | + Desacopla recepción/ejecución, + workers paralelos, + mitigación memory leaks, + escalable horizontal, - requiere Redis (ya en stack), - configuración adicional (export N8N_EXECUTIONS_MODE=queue). |

---

## ADR-015: Logging Estructurado con structlog

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-22 |
| **Contexto** | Necesitamos logs consistentes en backend que sean parseables por Loki y útiles para debugging. |
| **Problema** | Elegir librería de logging que produzca logs estructurados (JSON), con contexto enriquecido, y bindings dinámicos. |
| **Alternativas** | logging + json formatter manual, loguru, structlog |
| **Razón** | structlog: produce logs JSON estandarizados, binding de contexto dinámico (request_id, conversation_id, agent_id), procesadores para timestamp, nivel, caller, integración con logging estándar, y rendimiento superior a loguru en benchmarks. loguru es más simple pero produce logs en texto plano (menos parseables). |
| **Consecuencias** | + Logs JSON parseables por Loki, + contexto enriquecido, + bindings dinámicos, - arquitectura más compleja que logging básico. |

---

## ADR-016: Ruff como Linter/Formatter (reemplaza Flake8 + Black)

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-22 |
| **Contexto** | Necesitamos linter y formatter para Python que sea rápido, unificado, y con reglas modernas. |
| **Problema** | Elegir herramienta de linting/formateo para Python. |
| **Alternativas** | Flake8 + Black + isort, pylint, autopep8, Ruff |
| **Razón** | Ruff: escrito en Rust, 10-100x más rápido que Flake8+Black, unifica linting (Flake8) + formateo (Black) + import sorting (isort) + 800+ reglas, soporte pyproject.toml, integración pre-commit, auto-fix. Flake8+Black+isort son 3 herramientas separadas más lentas. |
| **Consecuencias** | + Velocidad Rust, + linter+formatter+imports en una herramienta, + 800+ reglas, - menos personalizable que Flake8+plugins. |


---

## ACTUALIZACIÓN POST-ARCHITECTURE REVIEW (2026-07-22)

Tras la revisión de arquitectura, las siguientes ADRs fueron modificadas o eliminadas:

| ADR | Decisión Original | Nueva Decisión | Estado |
|-----|-------------------|----------------|--------|
| ADR-002 | Next.js App Router | Next.js Pages Router | MODIFICADA |
| ADR-003 | Supabase Self-hosted | Supabase Cloud | REEMPLAZADA |
| ADR-005 | Ollama + Llama 3.1 | Groq API | REEMPLAZADA |
| ADR-006 | pgvector + RAG + Embeddings | Eliminado (prompt engineering) | ELIMINADA |
| ADR-007 | Traefik | Caddy | REEMPLAZADA |
| ADR-011 | Hexagonal Architecture | Clean Layers | REEMPLAZADA |
| ADR-013 | Zustand | React Context + hooks (ver nota abajo) | RECHAZADA |
| ADR-014 | Redis Queue Mode | n8n main mode | ELIMINADA |

Ver ARCHITECTURE_REVIEW.md para justificación detallada de cada cambio.

---

### ADR-017: App Router → Pages Router

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-22 (modifica ADR-002) |
| **Contexto** | El dashboard tiene 3-4 pantallas con fetch + render. No necesita Server Components ni Server Actions. |
| **Problema** | App Router añade complejidad (RSC, 'use client', Server Actions) sin beneficio tangible para un dashboard interno. |
| **Alternativas** | App Router (original), Pages Router |
| **Razón** | Pages Router es más simple, tiene más documentación, y el 90% del dashboard es client-side. Para un MVP de 4 pantallas, Pages Router es la opción profesional: menos complejidad, mismo resultado. |
| **Consecuencias** | + Menos complejidad, + más documentación, + más fácil de mantener para dev junior, - sin Server Components (innecesarios para dashboard). |

---

### ADR-018: Supabase Cloud sobre Self-hosted

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-22 (reemplaza ADR-003) |
| **Contexto** | Necesitamos PostgreSQL + Auth + Realtime. El MVP no tiene requisitos de data sovereignty (datos de demostración). |
| **Problema** | Self-hosted requiere 5+ servicios Docker (gotrue, kong, postgrest, realtime, studio). Complejidad operativa desproporcionada para un MVP. |
| **Alternativas** | Supabase Self-hosted (original), Supabase Cloud, Firebase, Auth0 + PG puro |
| **Razón** | Supabase Cloud: setup en 5 minutos, free tier (500MB DB, 50k usuarios, 2GB bandwidth) suficiente para MVP, Auth + DB + Realtime + Storage funcionando sin operar nada, PostgreSQL estándar (migrable a self-hosted en cualquier momento). |
| **Consecuencias** | + Zero mantenimiento infraestructura, + setup inmediato, + free tier suficiente, + PostgreSQL estándar (sin lock-in), - data sovereignty (irrelevante para MVP demo), - dependencia parcial de servicio cloud (mitigable: export DB y migrar). |

---

### ADR-019: Groq API sobre Ollama Local

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-22 (reemplaza ADR-005) |
| **Contexto** | Necesitamos consultar un LLM para generar respuestas. No necesitamos procesar 1000 req/s ni datos sensibles en el MVP. |
| **Problema** | Ollama requiere GPU/CPU potente, descargar modelo (~5GB), mantener servicio. Complejidad que no aporta valor al MVP. |
| **Alternativas** | Ollama + Llama 3.1 (original), OpenAI API (pago), Gemini Flash (gratis), Groq (gratis), OpenRouter (gratis) |
| **Razón** | Groq ofrece API gratuita (30 req/min) con inferencia ultrarrápida (~800 tok/s), modelos abiertos (Llama 3 70B/8B, Gemma), API compatible con OpenAI. Setup: un API key. Sin infraestructura. 0 costo. Calidad superior a Ollama en CPU (modelos más grandes, GPUs dedicadas). |
| **Consecuencias** | + 0 infraestructura, + 0 costo, + latencia <500ms, + mismos modelos (Llama 3), + setup en 5 min, - límite 30 req/min (más que suficiente para MVP), - depende de internet (no offline), - datos enviados a Groq (no hay PII real en MVP). |

---

### ADR-020: Clean Layers sobre Hexagonal Architecture

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-22 (reemplaza ADR-011) |
| **Contexto** | Backend con una implementación por cada dependencia (un repositorio PostgreSQL, un cliente Groq, un cliente WhatsApp). |
| **Problema** | Hexagonal Architecture requiere interfaces (protocols/ABC), inyección de dependencias, contenedores DI. Para implementaciones únicas, las interfaces son YAGNI puro. |
| **Alternativas** | Hexagonal (original), Clean Layers (Controller → Service → Repository), MVC, Flat structure |
| **Razón** | Clean Layers: capas simples con responsabilidades claras. Controllers (API endpoints), Services (business logic), Repositories (data access). Sin interfaces adicionales. Es el estándar de facto en FastAPI. Testeable, mantenible, y evolucionable a Hexagonal si un día se necesita una segunda implementación. |
| **Consecuencias** | + Menos archivos, + más simple, + estándar FastAPI, + testeable, - acoplamiento más fuerte entre capas que en Hexagonal (aceptable para MVP). |

---

### ADR-021: Caddy sobre Traefik

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-22 (reemplaza ADR-007) |
| **Contexto** | Necesitamos reverse proxy con TLS automático para 2 servicios (FastAPI, n8n). |
| **Problema** | Traefik requiere config con Docker labels, Go templates, y ofrece decenas de features que no usaremos (dashboard, middlewares avanzados, descubrimiento dinámico, métricas). |
| **Alternativas** | Traefik (original), Nginx, Caddy, Cloudflare Tunnel |
| **Razón** | Caddy: un binario, TLS automático (Let's Encrypt) por defecto, configuración en Caddyfile (5 líneas), HTTPS sin esfuerzo, sin dependencias. Para 2 servicios, es la opción más simple y profesional. |
| **Consecuencias** | + Config 5 líneas, + TLS automático, + sin dependencias, + binario único, - menos features que Traefik (no necesitamos ninguna), - menos documentación que Nginx. |

---

### ADR-022: n8n Main Mode (sin Redis Queue)

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-22 (elimina ADR-014) |
| **Contexto** | El MVP procesará decenas de mensajes al día. No miles. |
| **Problema** | Redis Queue mode añade un servicio completo (Redis Bull) para un volumen que n8n main mode maneja sin esfuerzo. |
| **Alternativas** | Main mode (default), Queue mode + Redis (original) |
| **Razón** | n8n main mode ejecuta workflows en el mismo proceso. Para <100 msg/día, es más que suficiente. Si en el futuro el volumen crece, se añade Redis queue mode con un cambio de variable de entorno. |
| **Consecuencias** | + Un servicio Docker menos, + 0 config extra, + misma funcionalidad, - sin paralelismo de workers (innecesario para MVP). |

---

### ADR-023: Sin RAG, sin pgvector, sin Embeddings

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-22 (elimina ADR-006) |
| **Contexto** | El MVP necesita consultar un LLM, no implementar un sistema de recuperación de información. |
| **Problema** | pgvector + embeddings + chunking + pipeline de ingesta para pasar FAQs al LLM es excesivo. Las FAQs caben en el system prompt. |
| **Alternativas** | RAG completo con pgvector (original), Prompt engineering con FAQs en system prompt |
| **Razón** | Con 20-50 FAQs, el system prompt del LLM es suficiente y más simple. No necesitamos chunking, embeddings, vector DB, ni pipeline de ingesta. Si un día el conocimiento crece a 1000+ documentos, se añade RAG. Pero no antes. |
| **Consecuencias** | + Elimina complejidad de RAG, + mismo resultado funcional, + system prompt simple, - conocimiento limitado a contexto del LLM (suficiente para MVP). |

---

### ADR-024: Dark Mode con Tailwind class strategy

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-28 |
| **Contexto** | El frontend necesita modo oscuro completo. Hay 4 estrategias posibles: Tailwind `dark:` class, CSS custom properties, `light-dark()` CSS nativo, o runtime JavaScript. |
| **Problema** | Elegir estrategia de theming que sea mantenible a largo plazo, no rompa la arquitectura existente, y no añada dependencias. |
| **Alternativas** | Tailwind `dark:` class (ELEGIDA), CSS custom properties + OKLCH, `light-dark()` CSS, Zustand + runtime |
| **Razón** | Tailwind `dark:` class: cero dependencias nuevas, reutiliza el sistema de colores Tailwind existente, sin build complexity, purgado automático de clases no usadas, cualquier dev conoce el patrón `dark:`. CSS custom properties requeriría migrar todos los colores a variables y añadir postcss plugins. `light-dark()` es inmaduro. Zustand fue rechazado en ADR-013. |
| **Consecuencias** | + Sin dependencias nuevas, + máximo DX (autocompletado Tailwind), + purgado automático, + mantenible por cualquier dev, - duplicación de clases (`bg-white dark:bg-gray-800`) en 22 archivos. |

---

### ADR-025: Smart Polling para Realtime (F4C)

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-28 |
| **Contexto** | El frontend necesita que los mensajes entrantes y cambios de estado se reflejen sin recarga manual. Sin añadir dependencias nuevas. |
| **Problema** | Elegir estrategia de realtime que cumpla: <10s latencia, 0 nuevas dependencias, testing simple, mantenimiento mínimo. |
| **Alternativas** | WebSockets, SSE (Server-Sent Events), Polling simple (cada 5s toda la lista), Smart Polling con `after` timestamp (ELEGIDA) |
| **Razón** | Smart Polling con `after`: el frontend envía `new Date().toISOString()` como `after` param. El backend filtra con `Message.created_at > after`. Esto transfiere solo mensajes nuevos (payload típico vacío o 1-2 items). 0 nuevas dependencias backend/frontend. Sin cambios de infraestructura (no requiere proxy config). Testing trivial con fake timers. Latencia 5s aceptable para dashboard de atención al cliente (~100ms con push no justifica 5x más complejidad). WebSocket añade: dependencia `websockets`, connection manager, heartbeat, reconnection, proxy config, testing complejo. SSE añade: dependencia `sse-starlette`, EventManager, connection pool. Polling simple (sin `after`) transfiere toda la lista cada vez (waste de ancho de banda y CPU). |
| **Consecuencias** | + 0 dependencias nuevas, + <50 líneas de código, + testing trivial, + sin cambios de infraestructura, - 5s latencia máxima vs ~100ms push (aceptable para el caso de uso), - polling incluso cuando no hay cambios (carga despreciable: 2 req/seg para 10 agentes). |
