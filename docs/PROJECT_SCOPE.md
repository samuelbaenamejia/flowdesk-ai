# PROJECT SCOPE - FlowDesk-AI

## Objetivos (In Scope)

### MVP v1.0 (Semanas 1-8)
| ID | Objetivo | Criterio de Aceptación |
|----|----------|------------------------|
| OBJ-01 | Recibir/enviar mensajes WhatsApp Cloud API | Webhook verificado, envío/lectura confirmada |
| OBJ-02 | Clasificar intención con LLM local (Ollama/Llama.cpp) | >85% accuracy en 20 intenciones base |
| OBJ-03 | RAG sobre base de conocimiento (PDF/WEB/FAQ) | Respuesta correcta >80% en 50 preguntas test |
| OBJ-04 | Orquestación n8n: webhook → clasificar → RAG → responder/derivar | Flujo end-to-end <3s latencia P95 |
| OBJ-05 | API FastAPI: CRUD conversaciones, mensajes, contactos, KB | OpenAPI docs, tests >80% coverage |
| OBJ-06 | Dashboard Next.js: lista conversaciones, detalle, takeover humano | Tiempo real via WebSocket, <200ms latencia |
| OBJ-07 | PostgreSQL + Supabase: persistencia, auth, realtime | Migraciones versionadas, RLS configurado |
| OBJ-08 | Docker Compose: dev + staging en un comando | `docker compose up` levanta todo en <3min |
| OBJ-09 | CI/CD GitHub Actions: lint, test, build, deploy staging | Pipeline pasa en <10 min |
| OBJ-10 | Documentación técnica + guía deploy | README, ADRs, runbooks, API docs |

### Objetivos de Calidad (No Funcionales)
| ID | Atributo | Target |
|----|----------|--------|
| NFR-01 | Latencia P95 webhook→respuesta | <3s |
| NFR-02 | Disponibilidad | 99.5% (staging) |
| NFR-03 | Throughput | 100 msg/min single instance |
| NFR-04 | Seguridad | OWASP Top 10, secrets en vault, RLS |
| NFR-05 | Observabilidad | Logs estructurados, métricas, traces |
| NFR-06 | Mantenibilidad | Cyclomatic complexity <10, coverage >80% |

---

## No Objetivos (Out of Scope v1.0)

| Categoría | Excluido | Razón |
|-----------|----------|-------|
| **Canales** | Email, Webchat, Instagram, Telegram, Voice | MVP = WhatsApp only |
| **Multi-tenancy** | Multi-organización, white-label, billing | Single-tenant primero |
| **IA Avanzada** | Fine-tuning, RAG avanzado (reranking, agents), voice | MVP usa RAG básico + LLM local |
| **CRM Features** | Pipeline, deals, forecasting, reporting avanzado | Foco en conversación, no ventas |
| **Marketing** | Broadcasts, campañas, plantillas marketing | Anti-spam policy Meta |
| **Analytics Avanzado** | Cohortes, funnel, atribución, BI | MVP: métricas básicas conversacionales |
| **Integraciones** | HubSpot, Salesforce, Pipedrive, Zapier nativo | Webhooks genéricos sí, natives no |
| **Multi-idioma** | i18n completo, detección idioma | Español only v1 |
| **Mobile App** | App nativa iOS/Android | Responsive web only |
| **SSO/SAML** | Enterprise auth | Supabase Auth (email/magic link) suficiente |

---

## Supuestos (Assumptions)

| ID | Supuesto | Validación |
|----|----------|------------|
| ASM-01 | Cliente tiene WhatsApp Business Account verificado | Validar en onboarding |
| ASM-02 | Cliente acepta self-hosted (VPS/Cloud propio) | Validar en discovery |
| ASM-03 | LLM local (Llama 3.1 8B) alcanza >85% accuracy intenciones | Benchmark previo |
| ASM-04 | n8n self-hosted maneja carga (100 msg/min) | Load test previo |
| ASM-05 | Cliente tiene VPS/Cloud con 8GB RAM + 4 vCPU mínimo | Requisitos mínimos doc |
| ASM-06 | Meta no cambia breaking changes WhatsApp API v21+ | Monitorear changelog |
| ASM-07 | Equipo cliente tiene conocimientos Docker básicos | Documentación + runbook |
| ASM-08 | Volumen <10k conversaciones/mes single tenant | Escalado vertical v1 |
| ASM-09 | Datos sensibles रहن en infra del cliente (data sovereignty) | Arquitectura self-hosted |
| ASM-10 | Equipo dev interno puede mantener stack (Docker, Python, JS) | Handoff + docs |

---

## Restricciones (Constraints)

| Tipo | Restricción | Impacto |
|------|-------------|---------|
| **Técnica** | WhatsApp Cloud API obligatorio (no on-premise) | Dependencia Meta, webhooks HTTPS obligatorio |
| **Técnica** | LLM gratuito/local obligatorio (Ollama/Llama.cpp) | Hardware requirements, latencia vs calidad |
| **Técnica** | n8n self-hosted (no cloud) | Mantenimiento propio, escalado vertical |
| **Técnica** | Stack definido: FastAPI + Next.js + PostgreSQL + Supabase | No evaluar alternativas |
| **Técnica** | Docker Compose obligatorio (no K8s v1) | Single host, sin orchestration compleja |
| **Negocio** | Presupuesto $0 licencias (solo infra) | Solo OSS / free tiers |
| **Negocio** | Timeline 8 semanas MVP | Scope fijo, no feature creep |
| **Legal** | Datos PII en infra cliente (LGPD/Ley 1581 Colombia) | Self-hosted mandatory, no SaaS externo |
| **Legal** | Cumplimiento Meta Business Terms | Opt-in, opt-out, plantillas aprobadas |
| **Equipo** | Equipo 1-2 devs full-stack + 1 DevOps part-time | Arquitectura simple, low maintenance |

---

## Riesgos (Risks)

| ID | Riesgo | Probabilidad | Impacto | Mitigación |
|----|--------|--------------|---------|------------|
| RSK-01 | Meta cambia API / webhook breaking change | Media | Alto | Suscribirse a changelog, tests de contrato, version pinning |
| RSK-02 | LLM local no alcanza accuracy objetivo | Media | Alto | Benchmark previo, fallback a reglas, human-in-loop obligatorio |
| RSK-03 | n8n se vuelve bottleneck / memory leak | Media | Medio | Monitoring, restart policy, evaluar Redis queue mode |
| RSK-04 | WhatsApp Cloud API rate limits (1000 msg/min) | Baja | Alto | Queue en n8n, backoff exponencial, métricas de cuota |
| RSK-05 | Supabase free tier limits (500MB DB, 2GB bandwidth) | Media | Medio | Planificar migración a PostgreSQL puro si escala |
| RSK-06 | Pérdida de datos por webhook fallido | Baja | Crítico | Idempotency keys, dead letter queue, retry exponencial |
| RSK-07 | Seguridad: exposición webhook sin auth | Baja | Crítico | Verify token, HMAC validation, IP allowlist Meta |
| RSK-08 | Dependencia única de n8n (single point of failure) | Media | Alto | Health checks, backup workflows export, runbook |
| RSK-09 | Scope creep por feedback cliente early | Alta | Medio | Scope freeze week 4, change control board |
| RSK-10 | Falta de expertise n8n/FastAPI en equipo | Media | Medio | Pair programming, docs, spike técnico semana 1 |

---

## Dependencias (Dependencies)

### Externas (Third-party)
| Dependencia | Versión | Propósito | Riesgo |
|-------------|---------|-----------|--------|
| WhatsApp Cloud API | v21.0+ | Canal mensajería | Breaking changes |
| Meta Graph API | v19.0+ | Plantillas, media, phone numbers | Rate limits |
| Ollama / Llama.cpp | Latest | LLM local inference | Hardware requirements |
| n8n | 1.40+ (self-hosted) | Workflow orchestration | Memory leaks |
| Supabase | Self-hosted / Cloud | Auth, DB, Realtime, Storage | Vendor lock-in (mitigado: PG estándar) |
| PostgreSQL | 16+ | Primary DB | - |
| Redis | 7+ | n8n queue mode, cache, rate limit | - |
| Docker / Compose | 24+ | Container orchestration | - |

### Internas (Proyecto)
| Módulo | Depende de | Contrato |
|--------|------------|----------|
| FastAPI Backend | PostgreSQL, Supabase Auth, Redis | SQLAlchemy models, Pydantic schemas |
| n8n Workflows | FastAPI (webhooks), WhatsApp API, Ollama | JSON schemas, webhook contracts |
| Next.js Frontend | FastAPI (REST + WS), Supabase Realtime | OpenAPI client, types gen |
| PostgreSQL | - | Migraciones Alembic, RLS policies |
| Ollama | Modelo Llama 3.1 8B cuantizado (Q4_K_M) | /api/chat endpoint compatible OpenAI |

### Infraestructura
| Recurso | Spec Mínimo | Spec Recomendado |
|---------|-------------|------------------|
| VPS/VM | 4 vCPU, 8GB RAM, 100GB SSD | 8 vCPU, 16GB RAM, 200GB NVMe |
| OS | Ubuntu 22.04 LTS / Debian 12 | Same |
| Dominio + SSL | Requerido (Let's Encrypt) | Wildcard cert |
| DNS | A record + webhook subdomain | Cloudflare proxy |
| Backup | Daily PG dump + n8n workflows export | Automated to S3/MinIO |