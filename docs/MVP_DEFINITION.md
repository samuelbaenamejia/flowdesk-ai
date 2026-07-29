# MVP DEFINITION — FlowDesk-AI

> Versión: 1.0
> Fecha: 2026-07-22
> Alcance: MVP funcional para demostración

---

## Qué Hará el Sistema (MVP)

El sistema recibirá mensajes de WhatsApp entrantes, los procesará con un LLM (Groq), guardará el historial en PostgreSQL (Supabase), y permitirá a un agente humano visualizar y tomar control de conversaciones desde un dashboard web.

### Funcionalidades Concretas

1. **Recepción de mensajes WhatsApp**
   - Webhook configurado con WhatsApp Cloud API
   - Recepción de mensajes de texto
   - Validación de integridad (verify token + signature)
   - Parsing y normalización del payload

2. **Procesamiento con LLM (Groq)**
   - Llamada a Groq API con el mensaje del usuario
   - System prompt con contexto de la empresa
   - Generación de respuesta natural
   - Fallback: respuesta genérica si el LLM falla

3. **Gestión de conversaciones**
   - Creación automática de conversación por contacto nuevo
   - Asociación de mensajes a conversación
   - Etiquetado de estado: activa, derivada a humano, cerrada
   - Historial cronológico de mensajes

4. **Dashboard web**
   - Lista de conversaciones activas
   - Detalle de conversación con historial de mensajes
   - Indicador de estado (bot / humano)
   - Botón de "tomar control" (human takeover)
   - Botón de "devolver a IA"

5. **Autenticación**
   - Login de agente con email + contraseña (Supabase Auth)
   - Protección de rutas del dashboard

6. **Logging**
   - Logs estructurados en backend (stdout)
   - Timestamps, IDs de conversación, niveles de severidad

---

## Qué NO Hará el Sistema (exclusiones explícitas del MVP)

| Funcionalidad | Razón |
|--------------|-------|
| RAG (base de conocimiento vectorial) | No necesario. FAQs en system prompt. |
| Clasificación de intenciones | No necesario. El LLM clasifica implícitamente. |
| Extracción de entidades | No necesario. El LLM extrae si se le pide. |
| Mensajes multimedia (imágenes, audio, video) | Complejidad adicional sin valor en MVP. Solo texto. |
| Mensajes salientes proactivos (broadcast) | Anti-spam Meta + fuera de alcance. |
| Dashboard analytics (KPIs, gráficos) | No necesario. Dashboard básico de conversaciones. |
| Multi-tenant / multi-agente | Una sola empresa, un solo agente. |
| WebSocket en tiempo real | Se usa polling simple de Supabase Realtime. |
| Notificaciones push / sonido | Añadir si sobra tiempo. |
| Exportación de datos | Fuera de alcance. |
| Roles y permisos | Un solo rol: agente. |
| API pública | Solo interna (consumida por n8n y frontend). |
| Pruebas automatizadas E2E | Unitarias + integración sí, E2E no (futuro). |

---

## Pantallas del Dashboard

### 1. Login
- Formulario email + contraseña
- Redirección a dashboard tras autenticación
- Protección de ruta (redirect si no autenticado)

### 2. Dashboard (inicio)
- **Header:** nombre del agente, botón de logout
- **Sidebar:** Home, Conversaciones
- **Contenido:** Resumen de conversaciones activas

### 3. Lista de Conversaciones
- Tabla con columnas: Contacto, Último mensaje, Estado, Última actividad
- Filtro por estado (activa / derivada a humano / cerrada)
- Click en fila → abre detalle de conversación

### 4. Detalle de Conversación
- **Panel izquierdo:** Historial de mensajes (burbujas, como WhatsApp web)
- **Panel derecho:** Info del contacto, selector de estado
- **Botón "Tomar Control":** Cambia estado a "human_takeover", desactiva el bot
- **Botón "Devolver a IA":** Reactiva el bot
- **Input de texto:** Solo visible cuando el humano tiene el control

### 5. Carga / Vacío / Error
- **Loading:** Skeleton mientras cargan datos
- **Empty:** "No hay conversaciones aún" con ilustración simple
- **Error:** "Error al cargar conversaciones" con botón de reintentar
- **Edge:** 200+ conversaciones -> paginación simple

---

## Endpoints del Backend (FastAPI)

### Conversaciones

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/conversations` | Listar conversaciones (paginado, filtro por estado) |
| `GET` | `/api/v1/conversations/{id}` | Obtener detalle de conversación |
| `PATCH` | `/api/v1/conversations/{id}` | Cambiar estado (takeover / return to bot / close) |

### Mensajes

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/conversations/{id}/messages` | Listar mensajes de una conversación |
| `POST` | `/api/v1/conversations/{id}/messages` | Enviar mensaje como agente humano |

### Contactos

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/contacts/{wa_id}` | Obtener info de contacto |
| `PATCH` | `/api/v1/contacts/{wa_id}` | Actualizar info de contacto |

### Webhooks (n8n → FastAPI)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/webhooks/whatsapp` | Verificación de webhook WhatsApp (verify token) |
| `POST` | `/api/v1/webhooks/whatsapp` | Recepción de mensajes WhatsApp entrantes |
| `POST` | `/api/v1/internal/conversations/{id}/trigger-ai` | n8n → disparar IA (Internal API, auth X-Internal-Key) |
| `POST` | `/api/v1/internal/conversations/{id}/request-human-approval` | Escalamiento a humano (idempotente) |

### Salud

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Health check del backend |

---

## Módulos del Backend

```
backend/app/
├── main.py                    # Entry point FastAPI
├── core/
│   ├── config.py              # Settings (pydantic-settings)
│   ├── database.py            # Supabase/DB session
│   ├── logging.py             # Logging config (structlog)
│   └── security.py            # Auth helpers (JWT verification)
├── api/
│   └── v1/
│       ├── __init__.py
│       ├── conversations.py   # Endpoints de conversaciones
│       ├── messages.py        # Endpoints de mensajes
│       ├── contacts.py        # Endpoints de contactos
│       ├── webhooks.py        # Endpoints para n8n
│       ├── llm.py             # Endpoints para LLM
│       └── health.py          # Health check
├── services/
│   ├── conversation_service.py # Lógica de conversaciones
│   ├── message_service.py     # Lógica de mensajes
│   ├── contact_service.py     # Lógica de contactos
│   ├── llm_service.py         # Lógica de LLM (Groq)
│   └── whatsapp_service.py    # Lógica de envío WhatsApp
├── repositories/
│   ├── conversation_repo.py   # CRUD conversaciones en Supabase
│   ├── message_repo.py        # CRUD mensajes
│   └── contact_repo.py        # CRUD contactos
├── models/
│   ├── conversation.py        # SQLAlchemy model
│   ├── message.py             # SQLAlchemy model
│   └── contact.py             # SQLAlchemy model
├── schemas/
│   ├── conversation.py        # Pydantic schemas
│   ├── message.py
│   └── contact.py
└── tests/
    ├── test_conversations.py
    ├── test_messages.py
    ├── test_llm.py
    └── conftest.py
```

---

## Flujo de un Mensaje (de principio a fin)

```
Usuario envía WhatsApp
        │
        ▼
[1] WhatsApp Cloud API → Webhook HTTPS → n8n
    * Meta envía POST al webhook de n8n
    * n8n valida verify token
        │
        ▼
[2] FastAPI recibe webhook directo de WhatsApp Cloud API
    * Meta envía POST a /api/v1/webhooks con payload estándar
    * FastAPI valida verify token, parsea y normaliza el payload
    * Si el mensaje es de texto, guarda en DB y notifica a n8n vía Internal API
        │
        ▼
[3] FastAPI guarda en Supabase (PostgreSQL)
    * Busca contacto por wa_id (crea si no existe)
    * Busca conversación activa (crea si no existe)
    * Guarda mensaje en messages
        │
        ▼
[4] FastAPI → POST Groq API (LLM)
    * Construye system prompt con contexto de la empresa
    * Añade historial de últimos N mensajes de la conversación
    * Envía: system + historial + mensaje actual
    * Groq responde: texto generado
        │
        ▼
[5] FastAPI guarda respuesta en Supabase
    * Crea mensaje con direction="outbound"
    * Asocia a la misma conversación
        │
        ▼
[6] FastAPI → POST WhatsApp Cloud API → Usuario
    * Envía respuesta via WhatsApp Send Message API
    * Si falla, reintenta 2 veces con backoff
        │
        ▼
[7] Dashboard (Next.js) actualiza en tiempo real
    * Supabase Realtime notifica cambios en tabla messages
    * Dashboard muestra la nueva respuesta
    * Agente puede tomar control en cualquier momento

=== FLUJO DE TAKEOVER (HUMANO EN EL BUCLE) ===

[8] Agente hace click en "Tomar Control"
    * Frontend → PATCH /conversations/{id}/status
    * Estado cambia a "human_takeover"
    * n8n ya no procesa mensajes de esta conversación
    * Agente escribe respuesta desde el dashboard
    * Frontend → POST /conversations/{id}/messages
    * FastAPI envía directo a WhatsApp Cloud API

[9] Agente hace click en "Devolver a IA"
    * Estado vuelve a "active"
    * n8n reanuda procesamiento automático

=== FLUJO DE ERROR ===

[Error en LLM] Groq no responde / timeout
    → FastAPI responde con mensaje genérico de cortesía
    → Log de error con conversation_id
    → Se marca como "needs_review" en DB

[Error en WhatsApp API] Rate limit / timeout
    → FastAPI reintenta con backoff (2 intentos)
    → Si falla, guarda mensaje como "failed"
    → Log de error con wa_message_id
```

---

## Modelo de Datos (MVP)

### Tablas en Supabase

#### contacts
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | ID interno |
| wa_id | TEXT (UNIQUE) | ID de WhatsApp del contacto |
| name | TEXT | Nombre del contacto |
| phone | TEXT | Número de teléfono |
| avatar_url | TEXT | URL del avatar (opcional) |
| metadata | JSONB | Datos adicionales |
| created_at | TIMESTAMPTZ | Fecha de creación |
| updated_at | TIMESTAMPTZ | Fecha de actualización |

#### conversations
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | ID interno |
| contact_id | UUID (FK → contacts) | Contacto asociado |
| status | TEXT | active / human_takeover / closed |
| last_message_at | TIMESTAMPTZ | Última actividad |
| metadata | JSONB | Contexto adicional |
| created_at | TIMESTAMPTZ | Fecha de creación |
| updated_at | TIMESTAMPTZ | Fecha de actualización |

#### messages
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | ID interno |
| conversation_id | UUID (FK → conversations) | Conversación |
| direction | TEXT | inbound / outbound |
| content_type | TEXT | text |
| content | TEXT | Contenido del mensaje |
| wa_message_id | TEXT | ID de mensaje de WhatsApp |
| status | TEXT | sent / delivered / read / failed |
| agent_id | UUID (FK → agents, nullable) | Quién envió (null = bot) |
| created_at | TIMESTAMPTZ | Fecha de creación |

#### users
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | UUID (PK) | ID interno |
| email | TEXT (UNIQUE) | Email del agente |
| is_active | BOOLEAN | Estado activo/inactivo |
| created_at | TIMESTAMPTZ | Fecha de creación |

**Nota:** La autenticación se maneja con Supabase Auth (JWT). El modelo `User` se usa para persistencia local en la base de datos del backend.

---

## Criterios de Aceptación del MVP

| # | Criterio | Estado Esperado |
|---|----------|-----------------|
| 1 | Enviar WhatsApp a un número → recibir respuesta automática | Fin a fin |
| 2 | Respuesta coherente con el contexto de la empresa | Calidad |
| 3 | Conversación visible en dashboard en < 5 segundos | Tiempo real |
| 4 | Agente puede tomar control y responder manualmente | Human takeover |
| 5 | Agente puede devolver control a IA | Return to bot |
| 6 | Login funciona y protege rutas | Auth |
| 7 | Mensajes de error no rompen el flujo (fallback graceful) | Robustez |
| 8 | docker compose up levanta backend + n8n + caddy | Deploy |
| 9 | README documenta cómo configurar y ejecutar el proyecto | Docs |
