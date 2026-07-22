# ARCHITECTURE REVIEW — FlowDesk-AI

> Fecha: 2026-07-22
> Tipo: Post-MVP Architecture Recalibration
> Objetivo: Revisión crítica de cada ADR para eliminar sobrearquitectura y complejidad innecesaria.

---

## Resumen Ejecutivo

El proyecto fue inicialmente planteado con 16 ADRs. De esas, **8 se mantienen**, **1 se modifica sustancialmente**, **4 se eliminan**, **3 quedan pendientes de decisión simplificada** y **1 es reemplazada**.

El problema principal no fue que las decisiones fueran incorrectas, sino que **respondían a un problema que no existe todavía**: escalar a miles de usuarios, multi-tenant, RAG avanzado, alta concurrencia. Este es un MVP de demostración. No una plataforma enterprise en producción.

La filosofía cambia de *"poner todas las tecnologías que conozco"* a *"usar solo las necesarias para el MVP, bien hechas"*.

---

## Revisión Crítica de ADRs

### ADR-001: FastAPI → ✅ MANTENER

**Diagnóstico:** Correcta. No hay alternativa mejor para este stack.

| Aspecto | Evaluación |
|---------|------------|
| ¿Aporta valor directo al MVP? | Sí — es el backend |
| ¿Alternativa más simple? | No — Flask es peor para async |
| ¿Overengineering? | No — es elección estándar |
| **Veredicto** | Sin cambios |

---

### ADR-002: Next.js App Router → ⚠️ MODIFICAR

**Diagnóstico:** Next.js es correcto. Pero App Router (Server Components, Server Actions) añade complejidad que no aporta valor en un dashboard interno con 3-4 pantallas.

**Problema:** App Router tiene una curva de aprendizaje alta. Server Actions, RSC, 'use client' vs 'use server' — para un dashboard con fetch + render es complejidad innecesaria.

**Opción más simple:** Next.js con Pages Router. El 90% de las pantallas del dashboard serán client-side con fetch a FastAPI. Pages Router es más simple, más documentado, y más fácil de mantener para un dev junior.

**Cambio:** Migrar de App Router → Pages Router.

| Aspecto | Evaluación |
|---------|------------|
| ¿Aporta valor directo al MVP? | Sí — es el frontend |
| ¿Alternativa más simple? | Sí — Pages Router |
| ¿Overengineering? | Sí — App Router es excesivo para un dashboard |
| **Veredicto** | Usar Pages Router en lugar de App Router |

---

### ADR-003: Supabase Self-hosted → ❌ ELIMINAR

**Diagnóstico:** Esta es la decisión con más sobreingeniería del proyecto.

**Problema:** Self-hosted Supabase requiere correr 5+ servicios Docker (gotrue, kong, postgrest, realtime, studio, meta). Cada uno necesita mantenimiento, version matching, actualizaciones. Para un MVP donde necesitamos PostgreSQL + Auth + Realtime, es una cantidad brutal de complejidad operativa.

**Opción más simple:** Supabase Cloud. Gratis para el alcance del MVP (500MB DB, 50k usuarios, 2GB bandwidth). Setup en 5 minutos. Auth, DB, Realtime funcionando sin operar nada.

**Razones para el cambio:**
- Self-hosted: ~5 servicios extra que administrar
- Cloud: 0 servicios que administrar
- MVP no necesita data sovereignty (no hay datos reales de clientes)
- El free tier de Supabase Cloud cubre el alcance del MVP sin problemas
- Migrar a self-hosted es trivial si se necesita después (PostgreSQL estándar)

| Aspecto | Evaluación |
|---------|------------|
| ¿Aporta valor directo al MVP? | No — añadiría 5+ servicios que operar |
| ¿Alternativa más simple? | Sí — Supabase Cloud, 5 min setup |
| ¿Overengineering? | Alto — self-hosted para un MVP |
| **Veredicto** | Eliminar. Usar Supabase Cloud |

---

### ADR-004: n8n Self-hosted → ⚠️ PENDIENTE DE DECIDIR

**Diagnóstico:** n8n como herramienta es correcta. La pregunta es si self-hosted o cloud.

**Opciones:**
- n8n Cloud (free tier): 0€, 20 workflows activos, 5 ejecuciones activas
- n8n self-hosted Docker: gratuito, sin límites, pero requiere mantenimiento

**Análisis:** Para un MVP con un solo flujo de trabajo, el free tier de n8n cloud es suficiente. Pero si el MVP requiere webhooks expuestos (WhatsApp → n8n → FastAPI), self-hosted da más control sobre URLs, TLS, y latencia.

**Recomendación:** Mantener self-hosted por el control de webhooks, pero simplificar al máximo (sin Redis queue, sin workers extra).

| Aspecto | Evaluación |
|---------|------------|
| ¿Aporta valor directo al MVP? | Sí — es el orquestador central |
| ¿Alternativa más simple? | n8n Cloud free tier — válida pero menos control |
| ¿Overengineering? | No, si se simplifica (sin Redis queue) |
| **Veredicto** | Mantener self-hosted, simplificar config |

---

### ADR-005: Ollama + Llama 3.1 8B → ❌ ELIMINAR — Reemplazar por API Cloud

**Diagnóstico:** Esta es la segunda decisión más sobreingenierada.

**Problema:** Ollama requiere:
- GPU o CPU potente (8GB RAM extra para el modelo)
- Descargar modelo (~4.7GB)
- Mantener el servicio corriendo
- Latencia variable en CPU (10-50 tok/s)
- Sin function calling nativo
- Setup adicional en Docker

Todo esto para un MVP que necesita consultar un LLM. No necesitamos procesar 1000 requests por segundo. Necesitamos que un mensaje de WhatsApp reciba una respuesta coherente.

**Opciones:**
1. **Gemini Flash (Google):** Gratis (60 requests/minuto), 1M tokens de contexto, excelente calidad, API simple. Sin costo.
2. **Groq:** Gratis (30 requests/minuto), inferencia ultrarrápida (~800 tok/s), modelos abiertos (Llama 3, Mistral). Sin costo.
3. **OpenRouter:** Free tier con límites, acceso a múltiples modelos, API unificada. Sin costo.

**Recomendación:** Groq es la mejor opción. Usa Llama 3 (el mismo modelo que Ollama) pero corre en sus GPUs. La latencia es 10-50x menor que Ollama en CPU. Setup: un API key. Sin infraestructura que mantener.

**Beneficios del cambio:**
- Elimina un servicio Docker completo (ollama)
- Elimina necesidad de GPU/CPU potente en servidor
- Elimina ~5GB de descarga de modelo
- Latencia <500ms (vs 3-10s en CPU local)
- Misma calidad de respuesta (o mejor, Groq usa Llama 3 70B/8B en GPUs)
- Setup: 5 minutos vs 1 hora

| Aspecto | Evaluación |
|---------|------------|
| ¿Aporta valor directo al MVP? | Sí — necesitamos LLM |
| ¿Alternativa más simple? | Sí — Groq/Gemini Flash son API calls |
| ¿Overengineering? | Alto — correr LLM local para un MVP |
| **Veredicto** | Eliminar Ollama. Reemplazar por Groq API |

---

### ADR-006: pgvector + RAG + Embeddings → ❌ ELIMINAR

**Diagnóstico:** RAG + pgvector + embeddings + chunking para un MVP que solo necesita consultar un LLM no tiene sentido.

**Análisis funcional:** El MVP debe "consultar un modelo LLM". No dice "implementar un sistema de Retrieval Augmented Generation con vector database, chunking, embeddings, reranking, y pipelines de ingesta".

Para el MVP, el conocimiento de la empresa se puede pasar directamente en el prompt del LLM. Si hay 20 FAQs, se incluyen en el system prompt. Simple. Funcional. Sin infraestructura extra.

**Opción futura:** Si el MVP demuestra funcionalidad y se necesita escalar a miles de documentos, entonces se añade pgvector + embeddings + RAG. Pero no antes.

| Aspecto | Evaluación |
|---------|------------|
| ¿Aporta valor directo al MVP? | No — el MVP puede funcionar con prompt engineering |
| ¿Alternativa más simple? | Sí — FAQs en el system prompt |
| ¿Overengineering? | Muy alto — sistema completo de RAG para un MVP |
| **Veredicto** | Eliminar completamente. Añadir en v2 si se necesita. |

---

### ADR-007: Traefik → ❌ ELIMINAR — Reemplazar por Caddy

**Diagnóstico:** Traefik para 2-3 servicios auto-contenidos es una motosierra para cortar pan.

**Análisis:** El MVP necesitará:
- FastAPI en un VPS (con Docker)
- n8n en el mismo VPS (con Docker)
- Frontend en Vercel (sin proxy)
- Supabase en Cloud (sin proxy)

Necesitamos un reverse proxy que simplemente: (1) sirva TLS/HTTPS, (2) enrute tráfico a FastAPI y n8n. Nada más. Sin rate limiting complejo, sin wildcard certs, sin descubrimiento dinámico, sin dashboard de métricas.

**Alternativa:** Caddy. Un solo binario, TLS automático (Let's Encrypt), configuración mínima (Caddyfile de 5 líneas), HTTPS por defecto, sin dependencias. Es lo que Traefik debería ser si no estuviera sobreingenierado.

**Caddyfile para el MVP:**
```
api.flowdesk.com {
    reverse_proxy backend:8000
}

n8n.flowdesk.com {
    reverse_proxy n8n:5678
}
```

| Aspecto | Evaluación |
|---------|------------|
| ¿Aporta valor directo al MVP? | Sí — necesitamos HTTPS |
| ¿Alternativa más simple? | Sí — Caddy (5 líneas de config) |
| ¿Overengineering? | Sí — Traefik es demasiado para 2 servicios |
| **Veredicto** | Eliminar Traefik. Reemplazar por Caddy. |

---

### ADR-008: Monorepo → ✅ MANTENER

**Diagnóstico:** Correcta. Un solo repo, estructura clara, CI unificado.

| Aspecto | Evaluación |
|---------|------------|
| ¿Aporta valor directo? | Sí — organización |
| ¿Alternativa más simple? | No |
| **Veredicto** | Sin cambios |

---

### ADR-009: Docker Compose → ✅ MANTENER

**Diagnóstico:** Docker Compose sigue siendo correcto, aunque ahora con menos servicios (sin Ollama, sin Traefik, sin Redis, sin Supabase self-hosted).

**Nuevos servicios Docker Compose:**
- FastAPI backend
- n8n
- Caddy (reemplaza Traefik)

Eso es todo. 3 servicios. Sencillo.

| Aspecto | Evaluación |
|---------|------------|
| ¿Aporta valor directo? | Sí — despliegue reproducible |
| **Veredicto** | Sin cambios (pero con menos servicios) |

---

### ADR-010: Alembic → ✅ MANTENER

**Diagnóstico:** Correcta. No hay alternativa más simple que cumpla la misma función.

| Aspecto | Evaluación |
|---------|------------|
| **Veredicto** | Sin cambios |

---

### ADR-011: Hexagonal Architecture → ❌ ELIMINAR — Reemplazar por Clean Layers

**Diagnóstico:** Arquitectura Hexagonal (Ports & Adapters) para un MVP de 1-2 desarrolladores es abstracción innecesaria.

**Problema:** Hexagonal requiere interfaces (abstract classes/protocols) para cada adapter, inyección de dependencias, contenedores DI, y una estructura de carpetas más compleja. Para un MVP que solo tiene una implementación de cada cosa (un repositorio PostgreSQL, un cliente Groq, un cliente WhatsApp), las interfaces son YAGNI puro.

**Opción más simple:** Clean Layers (Controller → Service → Repository).

```
backend/app/
├── api/           # Controladores (endpoints)
│   └── v1/
├── services/      # Lógica de negocio
├── repositories/  # Acceso a datos
├── models/        # SQLAlchemy models
├── schemas/       # Pydantic schemas
└── core/          # Config, logging, db session
```

Esto es lo que el 90% de los proyectos FastAPI en producción usan. Es simple, conocido, testeable, y fácil de mantener. Si el proyecto escala, migrar a Hexagonal es trivial porque las capas ya están separadas.

| Aspecto | Evaluación |
|---------|------------|
| ¿Aporta valor directo al MVP? | No — abstracción sin beneficio tangible |
| ¿Alternativa más simple? | Sí — Clean Layers (Controller → Service → Repository) |
| ¿Overengineering? | Alto — interfaces para implementaciones únicas |
| **Veredicto** | Eliminar Hexagonal. Usar Clean Layers. |

---

### ADR-012: Pydantic v2 → ✅ MANTENER

**Diagnóstico:** Viene con FastAPI. No hay alternativa.

| Aspecto | Evaluación |
|---------|------------|
| **Veredicto** | Sin cambios |

---

### ADR-013: Zustand → ⚠️ PENDIENTE DE DECIDIR

**Diagnóstico:** Zustand es bueno, pero para un dashboard con 3-4 pantallas y estado mayormente local (cada pantalla obtiene sus datos del backend), quizás React Context + hooks sea suficiente.

**Decisión:** Diferir. Durante la implementación del frontend se decidirá si realmente se necesita estado global. Si el estado se limita a la sesión del agente, React Context basta.

| Aspecto | Evaluación |
|---------|------------|
| ¿Aporta valor directo? | Posiblemente, pero diferible |
| **Veredicto** | Pendiente — decidir durante implementación |

---

### ADR-014: Redis Queue Mode → ❌ ELIMINAR

**Diagnóstico:** Redis para un MVP que procesará decenas (no miles) de mensajes al día es completamente innecesario.

**n8n main mode:** ejecuta workflows en el mismo proceso. Es perfectamente capaz de manejar el volumen de un MVP. Si se satura (cosa que no pasará con < 100 msg/día), se añade Redis después.

**Impacto de eliminar Redis:**
- Un servicio Docker menos
- Zero configuración extra de n8n
- Sin colas que monitorear
- Sin latencia de Redis I/O

| Aspecto | Evaluación |
|---------|------------|
| ¿Aporta valor directo al MVP? | No — volumen no lo justifica |
| ¿Alternativa más simple? | Sí — n8n main mode (default) |
| ¿Overengineering? | Alto — Redis queue para tráfico de pruebas |
| **Veredicto** | Eliminar. n8n main mode es suficiente. |

---

### ADR-015: structlog → ✅ MANTENER (simplificado)

**Diagnóstico:** El logging estructurado es buena práctica. Pero la justificación de "logs parseables por Loki" asume que tendremos un stack de observabilidad completo (Loki + Grafana + Prometheus), lo cual es sobreingeniería para un MVP.

**Simplificación:** Usar structlog para logs estructurados en salida estándar (stdout). Docker los capturará. Si se necesita visualización, `docker logs` o un simple `tail` basta. No desplegar Loki/Prometheus/Grafana.

| Aspecto | Evaluación |
|---------|------------|
| ¿Aporta valor directo? | Sí — debugging y monitoreo |
| **Veredicto** | Mantener structlog, eliminar Loki/Grafana/Prometheus |

---

### ADR-016: Ruff → ✅ MANTENER

**Diagnóstico:** No hay razón para cambiarlo.

| Aspecto | Evaluación |
|---------|------------|
| **Veredicto** | Sin cambios |

---

## Resumen de Cambios

| ADR | Decisión Original | Nueva Decisión |
|-----|-------------------|----------------|
| ADR-001 | FastAPI | ✅ Mantener |
| ADR-002 | Next.js App Router | ⚠️ Pages Router (más simple) |
| ADR-003 | Supabase Self-hosted | ❌ Supabase Cloud |
| ADR-004 | n8n Self-hosted | ✅ Mantener (modo simple) |
| ADR-005 | Ollama + Llama 3.1 | ❌ Groq API |
| ADR-006 | pgvector + RAG + Embeddings | ❌ Eliminar (prompt engineering) |
| ADR-007 | Traefik | ❌ Caddy |
| ADR-008 | Monorepo | ✅ Mantener |
| ADR-009 | Docker Compose | ✅ Mantener (3 servicios) |
| ADR-010 | Alembic | ✅ Mantener |
| ADR-011 | Hexagonal Architecture | ❌ Clean Layers |
| ADR-012 | Pydantic v2 | ✅ Mantener |
| ADR-013 | Zustand | ⏳ Pendiente (decidir en implementación) |
| ADR-014 | Redis Queue Mode | ❌ Eliminar (n8n main mode) |
| ADR-015 | structlog | ✅ Mantener (sin Loki/Grafana/Prometheus) |
| ADR-016 | Ruff | ✅ Mantener |

**Tecnologías que se eliminan del stack:**
- Ollama / Llama 3.1 local
- pgvector / Embeddings / RAG
- Traefik
- Redis
- Supabase self-hosted (kong, gotrue, postgrest, realtime, studio, meta)
- Loki / Prometheus / Grafana
- MinIO

**Tecnologías que se añaden:**
- Groq API (LLM as a Service, gratuito)
- Caddy (reverse proxy simple)
- Supabase Cloud (DB + Auth + Realtime gestionado)

**Nuevo stack final:**

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js (Pages Router) en Vercel |
| Backend | FastAPI en Docker |
| Orquestación | n8n en Docker (main mode) |
| Base de Datos | PostgreSQL via Supabase Cloud |
| Auth | Supabase Auth (Cloud) |
| Realtime | Supabase Realtime (Cloud) |
| LLM | Groq API (Llama 3 / Gemma) |
| Proxy | Caddy (TLS automático) |
| Contenedores | Docker Compose (3 servicios) |

---

## Filosofía Definitiva del Proyecto

> **"Un MVP profesional no es el que más tecnologías usa. Es el que resuelve el problema con la menor complejidad posible."**

1. **Simplicidad sobre cantidad.** Cada tecnología debe estar justificada. Si no aporta valor directo al MVP, no está.
2. **No anticipar problemas de escala.** No construimos para 10k usuarios. Construimos para que funcione, se vea bien, y se entienda.
3. **Código sobre configuración.** Preferir lógica explícita en Python/JS sobre configuraciones mágicas en YAML.
4. **Buenas prácticas realistas.** Clean Code, SOLID, Conventional Commits, Testing. Pero sin abstracciones innecesarias.
5. **Documentación como prioridad.** El código se olvida. Los docs permanecen.
6. **Evolucionable, no sobrearquitecturado.** Estructura limpia que permita añadir complejidad después, no que la imponga ahora.
