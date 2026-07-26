# n8n — FlowDesk-AI

n8n orquesta los flujos de atención al cliente: recibe notificaciones de FastAPI, genera respuestas con IA y envía mensajes vía WhatsApp.

## Levantar n8n

```bash
docker compose -f infra/docker-compose.yml up n8n -d
```

También se levanta automáticamente con todos los servicios:

```bash
docker compose -f infra/docker-compose.yml up -d
```

## Acceder

http://localhost:5678

La primera vez crea una cuenta de administrador local (solo para desarrollo).

## Variables de entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `N8N_PORT` | Puerto del host | `5678` |
| `N8N_WEBHOOK_URL` | URL pública para webhooks | `http://localhost:5678` |
| `N8N_ENCRYPTION_KEY` | Clave de cifrado de credenciales | Requerida |
| `N8N_ENABLED` | Habilita notificación a n8n desde FastAPI | `false` |
| `N8N_MODE` | `disabled` / `mirror` / `primary` | `disabled` |
| `INTERNAL_API_KEY` | Clave para comunicación n8n ↔ FastAPI | Requerida |

### INTERNAL_API_KEY en el contenedor n8n

n8n necesita acceder a `INTERNAL_API_KEY` para autenticarse contra la Internal API.
Agrega la variable al servicio `n8n` en `infra/docker-compose.yml`:

```yaml
n8n:
  environment:
    - INTERNAL_API_KEY=${INTERNAL_API_KEY}
    # ... resto de variables
```

O, alternativamente, usa un archivo `.env` común a todos los servicios.

## Webhook URL del workflow AI Responder

FastAPI envía la notificación a n8n mediante `settings.n8n_webhook_url`.
Configura esta variable en el archivo `.env` del backend apuntando al webhook del workflow:

```
N8N_WEBHOOK_URL=http://n8n:5678/webhook/ai-responder
```

## Persistencia de datos

- **SQLite** (por defecto): los datos se guardan en el volumen `n8n_data` (Docker).
- Los datos persisten entre reinicios del contenedor.

### Migración futura a PostgreSQL

El servicio está preparado para migrar de SQLite a PostgreSQL. Solo se necesita:

1. Configurar las variables `DB_POSTGRESDB_*` en el archivo `.env`.
2. Establecer `N8N_DB_TYPE=postgresdb`.
3. Reiniciar el contenedor.

Variables disponibles:

| Variable | Descripción |
|----------|-------------|
| `N8N_DB_TYPE` | `sqlite` o `postgresdb` |
| `N8N_DB_HOST` | Host de PostgreSQL |
| `N8N_DB_PORT` | Puerto (default: 5432) |
| `N8N_DB_DATABASE` | Nombre de la base de datos |
| `N8N_DB_USER` | Usuario |
| `N8N_DB_PASSWORD` | Contraseña |

Actualmente n8n usa SQLite. PostgreSQL no está activado.

## Importar workflows

1. Coloca los archivos `.json` de workflow en `infra/n8n/workflows/` (en el host).
2. En la UI de n8n, haz clic en **Import from File**.
3. Selecciona el archivo desde el sistema de archivos del host (la ruta es `infra/n8n/workflows/` relativa al repositorio).

Los workflows importados se pueden exportar desde la UI y guardar en `infra/n8n/workflows/` para versionarlos en git.

### AI Responder

Workflow que procesa los mensajes delegados por FastAPI mediante la Internal API.

**Archivo:** `infra/n8n/workflows/ai-responder.json`

**Importación:**
1. Abre la UI de n8n → **Import from File** → selecciona `infra/n8n/workflows/ai-responder.json`
2. Verifica que las conexiones entre nodos sean correctas
3. Activa el workflow con el toggle **Active**
4. El webhook queda disponible en `http://n8n:5678/webhook/ai-responder`

**Configuración previa:**
- `INTERNAL_API_KEY` debe estar disponible en el entorno del contenedor n8n
- `N8N_WEBHOOK_URL` en el `.env` del backend debe apuntar a `http://n8n:5678/webhook/ai-responder`

**Flujo:**

```
FastAPI (webhook)
  │
  └─ POST /webhook/ai-responder ──► n8n AI Responder
                                       │
                                       ├─ Check Keywords ($env.ESCALATION_KEYWORDS)
                                       │     │
                                       │     ├─ ¿coinciden? → POST /internal/.../request-human-approval → Escalated
                                       │     │
                                       │     └─ no → POST /internal/conversations/{id}/trigger-ai
                                       │                │
                                       │                ├─ ¿status == "ok"? → 200 OK
                                       │                │
                                       │                └─ error → POST /internal/.../request-human-approval → Escalated
```

**Modos de operación:**

| `N8N_MODE` | Comportamiento |
|------------|----------------|
| `disabled` | Sin notificación a n8n. Auto-respuesta directa desde FastAPI. |
| `mirror`   | Auto-respuesta desde FastAPI + notificación paralela a n8n. |
| `primary`  | Solo n8n orquesta la respuesta. FastAPI delega completamente. |

Para activar `primary`:

```env
N8N_ENABLED=true
N8N_MODE=primary
```

Para activar `mirror`:

```env
N8N_ENABLED=true
N8N_MODE=mirror
```

### Human Approval

El AI Responder incluye escalamiento automático a un agente humano cuando se cumplen las reglas definidas.

**Reglas de escalamiento (orden de prioridad):**

| Prioridad | Regla | Dónde se evalúa | Comportamiento |
|-----------|-------|-----------------|----------------|
| 1 | Usuario solicita explícitamente un humano | Workflow (Check Keywords node + `ESCALATION_KEYWORDS`) | Escala sin ejecutar Groq |
| 2 | `trigger-ai` devuelve error HTTP | Workflow (Success? IF node) | Escala después del fallo |
| 3 | Timeout del modelo | Workflow (HTTP Request timeout) | Escala después del timeout |
| 4 | Retries agotados | Workflow (HTTP Request maxRetries) | Escala después de N reintentos |

**Variable de entorno:**

| Variable | Descripción | Default |
|----------|-------------|---------|
| `ESCALATION_KEYWORDS` | Lista separada por comas de palabras que activan escalamiento | `humano,asesor,agente` |

Las keywords se comparan contra `message_preview` (recibido en el webhook). Si el mensaje contiene alguna keyword, el workflow escala inmediatamente sin ejecutar `trigger-ai`.

**Flujo:**

```
Webhook
  │
  ▼
Check Keywords (lee $env.ESCALATION_KEYWORDS)
  │
  ▼
¿Keywords coinciden?
  │
  ├─ SÍ → request-human-approval → Respond Escalated
  │
  └─ NO → trigger-ai
            │
            ├─ OK → Respond OK
            │
            └─ Error → request-human-approval → Respond Escalated
```

**Endpoint `request-human-approval`:**

```
POST /api/v1/internal/conversations/{id}/request-human-approval
Header: X-Internal-Key
```

| Estado actual | HTTP | Respuesta |
|---------------|------|-----------|
| active → human_takeover | 200 | `{"status":"ok","conversation_status":"human_takeover"}` |
| human_takeover (ya escalada) | 200 | `{"status":"ok","conversation_status":"human_takeover"}` (idempotente) |
| closed | 409 | `{"detail":"Conversation is closed"}` |
| No existe | 404 | `{"detail":"Conversation not found"}` |

**Importación:**
1. El workflow `ai-responder.json` ya incluye los nodos de Human Approval.
2. Configura `ESCALATION_KEYWORDS` en el entorno del contenedor n8n.
3. Activa el workflow normalmente.

## Red Docker

Todos los servicios (backend, frontend, n8n) comparten la misma red Docker.
n8n se comunica con FastAPI usando el nombre del servicio: `http://backend:8000`.
FastAPI se comunica con n8n usando: `http://n8n:5678/webhook/ai-responder`.

## Troubleshooting

### 1. El workflow no responde

| Causa | Verificación | Solución |
|-------|-------------|----------|
| `INTERNAL_API_KEY` incorrecta | Revisa `docker compose config` en el contenedor n8n | Debe coincidir con `INTERNAL_API_KEY` del backend |
| Backend no accesible | `docker compose exec n8n curl -s http://backend:8000/health` | Verifica que backend esté levantado |
| URL del webhook incorrecta | Revisa `N8N_WEBHOOK_URL` en `.env` del backend | Debe ser `http://n8n:5678/webhook/ai-responder` |
| Workflow desactivado | Abre la UI de n8n y revisa el toggle **Active** | Actívalo manualmente |

Para ver errores en tiempo real:

```bash
docker compose logs n8n -f
docker compose logs backend -f
```

### 2. Error 401

El endpoint interno devuelve 401 cuando `X-Internal-Key` no coincide.

**Causas posibles:**
- `INTERNAL_API_KEY` en el contenedor n8n no coincide con la del backend
- La variable no se pasó al contenedor n8n

**Verificar dentro del contenedor n8n:**

```bash
docker compose exec n8n printenv | grep INTERNAL_API_KEY
```

Si no aparece, agrega la variable al servicio `n8n` en `infra/docker-compose.yml`:

```yaml
n8n:
  environment:
    - INTERNAL_API_KEY=${INTERNAL_API_KEY}
```

Después de modificar variables de entorno, reinicia n8n:

```bash
docker compose up -d n8n
```

### 3. Error 404

El endpoint interno devuelve 404 cuando:

- **La conversación no existe** en la base de datos. El `conversation_id` enviado por FastAPI no se encontró. Esto puede ocurrir si el mensaje no se persistió correctamente antes de notificar a n8n. Revisa los logs del backend:

  ```bash
  docker compose logs backend | grep "conversation_id"
  ```

- **El endpoint interno es incorrecto.** Verifica que la URL en el nodo HTTP Request del workflow sea exactamente:

  ```
  http://backend:8000/api/v1/internal/conversations/{{ $json.conversation_id }}/trigger-ai
  ```

  Errores comunes: olvidar `/api/v1`, usar `localhost` en vez de `backend`, o escribir mal `conversations`.

### 4. No llegan respuestas a WhatsApp

Checklist rápida:

- [ ] `N8N_ENABLED=true` en el `.env` del backend
- [ ] `N8N_MODE=primary` o `N8N_MODE=mirror` según lo que necesites
- [ ] `N8N_WEBHOOK_URL=http://n8n:5678/webhook/ai-responder` en el `.env` del backend
- [ ] El workflow **AI Responder** está activo (toggle **Active** en la UI de n8n)
- [ ] El backend responde: `curl http://localhost:8000/health` → `{"status": "ok"}`
- [ ] Meta Webhook está funcionando: revisa en `https://developers.facebook.com` el estado del webhook
- [ ] El mensaje se persistió en la base de datos (revisa los logs del backend)

**Flujo completo de diagnóstico:**

```bash
# 1. Backend vivo
curl http://localhost:8000/health

# 2. Meta Webhook delivery (revisar en Facebook Developers)
# 3. n8n ejecutó el workflow (revisar Execution History en UI de n8n)
# 4. Internal API responde (probar manualmente, ver punto 5)
# 5. Mensaje enviado vía WhatsApp (revisar logs del backend)
```

### 5. Cómo probar manualmente

Envía un payload de prueba directamente al webhook de n8n:

```bash
curl -X POST http://localhost:5678/webhook/ai-responder \
  -H "Content-Type: application/json" \
  -d '{
    "event": "message_received",
    "conversation_id": "REEMPLAZA_CON_UN_UUID_VALIDO",
    "contact_wa_id": "521234567890",
    "message_preview": "Hola, esto es una prueba"
  }'
```

Donde `conversation_id` debe ser un UUID existente en la base de datos.

**Respuesta esperada (éxito):**

```json
{"status": "ok", "message": "Respuesta generada correctamente"}
```

**Respuesta esperada (error de configuración):**

```json
{"status": "error", "message": "Error al procesar el mensaje"}
```

Para obtener un `conversation_id` real desde la base de datos:

```bash
docker compose exec backend sqlite3 /data/flowdesk.db \
  "SELECT id FROM conversations LIMIT 1;"
```

(La ruta de la base de datos depende de la configuración de `DATABASE_URL`.)
