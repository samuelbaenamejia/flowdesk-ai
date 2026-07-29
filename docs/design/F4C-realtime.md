# F4C — Realtime: Design Document

> Version: 1.1
> Fecha: 2026-07-28
> Estado: Implemented

---

## Tabla de contenido

1. [Objetivos](#1-objetivos)
2. [Alcance](#2-alcance)
3. [Fuera de alcance](#3-fuera-de-alcance)
4. [Arquitectura](#4-arquitectura)
5. [Estrategia de realtime](#5-estrategia-de-realtime)
6. [Comparación de alternativas](#6-comparación-de-alternativas)
7. [Flujo de datos](#7-flujo-de-datos)
8. [Componentes afectados](#8-componentes-afectados)
9. [Backend](#9-backend)
10. [Frontend](#10-frontend)
11. [Performance](#11-performance)
12. [Accesibilidad](#12-accesibilidad)
13. [Testing](#13-testing)
14. [Riesgos y mitigaciones](#14-riesgos-y-mitigaciones)
15. [Rollout](#15-rollout)
16. [Definition of Done](#16-definition-of-done)

---

## 1. Objetivos

1. **Mensajes entrantes visibles sin recarga manual** — cuando un cliente de WhatsApp envía un mensaje, el agente lo ve aparecer automáticamente en la pantalla de detalle de conversación.
2. **Estado de conversaciones actualizado** — la lista de conversaciones refleja nuevos mensajes, cambios de estado (active/human_takeover/closed) y nuevos contactos sin recarga manual.
3. **Mínima latencia perceptible** — el retardo entre un evento backend y su reflejo en frontend no debe superar 10 segundos.
4. **Cero dependencias nuevas** — la solución debe usar exclusivamente el stack existente (fetch, setInterval, REST API).
5. **Sin overengineering** — la solución más simple que cumple los objetivos. Sin WebSockets, SSE, colas de eventos, ni infraestructura adicional.

---

## 2. Alcance

### Incluye

- Backend: parámetro `after` (ISO datetime) en GET `/conversations/{id}/messages` para obtener solo mensajes nuevos
- Frontend: `useMessages` con polling inteligente (intervalo 5s, `after` timestamp, append de nuevos mensajes)
- Frontend: `useConversations` con polling (intervalo 10s, reemplazo completo de lista)
- Frontend: `useConversation` con polling (intervalo 15s, reemplazo de datos de conversación individual)
- Todos los hooks respetan `document.visibilityState` (sin polling cuando la pestaña no está visible)
- Los hooks existentes preservan su API pública (compatibilidad total con F1-F4B)

### No incluye

- **WebSockets** — no hay conexión persistente bidireccional
- **Server-Sent Events** — no hay streaming HTTP server→client
- **Notificaciones push** — no hay service workers ni notificaciones del sistema
- **Indicador visual "nuevo mensaje"** — los mensajes aparecen sin animación ni badge
- **Sonido de notificación** — no hay alerta sonora para nuevos mensajes
- **Reordenamiento animado de la lista** — la lista de conversaciones se reemplaza sin transición
- **Mensajes optimistas desde webhook** — no se modifica el backend para emitir eventos

---

## 3. Fuera de alcance

| Feature | Razón |
|---------|-------|
| WebSockets | Overengineering para un dashboard interno con <10 agentes. Requiere dependencias nuevas (websockets), proxy config (Caddy), connection manager, heartbeat, reconnection logic. |
| SSE | Más simple que WebSocket pero requiere `sse-starlette` como dependencia backend y un EventManager para broadcast. El polling con `after` timestamp da la misma UX con 0 dependencias. |
| Realtime vía Supabase Realtime | El proyecto usa Supabase Cloud pero no está configurado ni integrado. Sería otra dependencia más que mantener. |
| n8n WebSocket para eventos | n8n no expone un WebSocket para eventos de workflow. Usar n8n como intermediario añadiría complejidad sin beneficio. |

---

## 4. Arquitectura

### 4.1 Estado actual (sin F4C)

```
[WhatsApp] → POST /webhooks/whatsapp → FastAPI → DB persist
                                               ↓
                                           n8n notify
                                               ↓
                                    [Frontend NO se entera]
```

### 4.2 Estado deseado (con F4C)

```
[WhatsApp] → POST /webhooks/whatsapp → FastAPI → DB persist
                                               ↓
                                           n8n notify
                                               ↓
                                    [Frontend NO se entera aún]

[Frontend] → GET /conversations/.../messages?after=... → FastAPI → DB query
                                                                    ↓
                                                            Solo mensajes nuevos
                                                                    ↓
                                                    [Frontend: append a la lista]
```

El frontend pregunta periódicamente "¿hay algo nuevo?". El backend responde solo con lo nuevo. Sin push, sin eventos, sin conexiones persistentes.

### 4.3 Diagrama de flujo

```
   useMessages                   Backend
      │                            │
      ├── useEffect on mount ──────┤
      │   GET /messages?limit=50   │
      │   ←─── messages[] ────────┤
      │   lastFetch = Date.now()   │
      │                            │
      ├── setInterval(5000) ───────┤
      │   GET /messages?after=T1   │
      │   ←─── newMessages[] ─────┤
      │   append to messages[]     │
      │   lastFetch = T2           │
      │                            │
      ├── setInterval(5000) ───────┤
      │   GET /messages?after=T2   │
      │   ←─── (empty) ───────────┤
      │                            │
      │   ... (repite cada 5s)     │
      │                            │
      ├── on visibility hidden ────┤
      │   clearInterval            │
      │                            │
      └── on visibility visible ───┤
          restart interval         │
```

---

## 5. Estrategia de realtime

### 5.1 Decisión: Smart Polling con `after` timestamp

| Criterio | Evaluación |
|----------|------------|
| **Estrategia** | Polling HTTP condicional (solo datos nuevos) |
| **Mecanismo** | `setInterval` + `visibilitychange` + `after` param |
| **Intervalo mensajes** | 5 segundos |
| **Intervalo lista** | 10 segundos |
| **Intervalo detalle** | 15 segundos |
| **Payload** | Solo mensajes creados después del timestamp conocido |
| **Nuevas dependencias** | Cero |
| **Cambios backend** | 1 endpoint modificado (messages.py) |
| **Cambios frontend** | 3 hooks modificados (useMessages, useConversations, useConversation) |

### 5.2 Por qué polling y no push

**Contexto del proyecto:**
- Dashboard interno con <10 agentes concurrentes
- Volumen: decenas de mensajes/día, no miles
- Equipo: 1-2 desarrolladores
- Stack: Next.js Pages Router + FastAPI REST + PostgreSQL

**Push (WebSocket/SSE) resolvería** el problema técnico de "notificar al frontend cuando algo cambia". Pero añade:
- 1-2 nuevas dependencias backend (`websockets` o `sse-starlette`)
- Connection manager + heartbeat + reconnection logic
- Config de proxy inverso (Caddy necesita config para WebSocket/SSE)
- Auth por WebSocket (JWT por query param o mensaje inicial)
- Testing más complejo (mock de WebSocket/SSE server)
- Mantenimiento continuo de conexiones

**Polling** resuelve el mismo problema de usuario con:
- 0 nuevas dependencias
- < 50 líneas de código nuevo
- Testing trivial con fake timers
- Sin cambios de infraestructura
- Sin estado de conexiones que mantener

**Trade-off aceptado:** 5 segundos de latencia máxima vs ~100ms con push. Para un dashboard de atención al cliente, 5s es imperceptible (el agente no está mirando fijamente la pantalla esperando un mensaje cada milisegundo).

### 5.3 Smart optimizations

1. **`after` timestamp** — El frontend envía la fecha del último mensaje conocido. El backend filtra con `created_at > after`. Así se transfieren solo los mensajes nuevos, no toda la lista.

2. **Visibility-aware** — Los 3 hooks detienen el polling cuando `document.visibilityState !== "visible"`. Se reanudan al volver. Zero tráfico en background.

3. **Intervalo diferenciado** — Mensajes (5s) es lo crítico. Lista (10s) es informativo. Detalle (15s) es secundario (el estado solo cambia por acción del agente).

4. **Sin refetch si loading/error** — No se hace fetch mientras otro fetch está en curso o hay un error activo (evita loops de error).

---

## 6. Comparación de alternativas

| Criterio | Polling simple (5s) | Smart Polling (after) | SSE | WebSocket |
|----------|---------------------|----------------------|-----|-----------|
| **Latencia** | ~5s | ~5s | <100ms | <100ms |
| **Nuevas dependencias backend** | 0 | 0 | 1 (`sse-starlette`) | 1 (`websockets`) |
| **Nuevas dependencias frontend** | 0 | 0 | 0 | 0 |
| **Cambios backend** | 0 | 1 archivo | 2 archivos (endpoint + manager) | 2+ archivos |
| **Cambios frontend** | 3 hooks | 3 hooks | 3 hooks + 1 hook SSE | 3 hooks + 1 hook WS |
| **Testing frontend** | Trivial (fake timers) | Trivial (fake timers) | Medio (mock EventSource) | Complejo (mock WS) |
| **Testing backend** | Ninguno | 1 test unitario | Medio (test streaming) | Complejo (test WS) |
| **Infraestructura** | Ninguna | Ninguna | Proxy HTTP/1.1 (Caddy OK) | Proxy WS (Caddy config) |
| **Mantenimiento** | Mínimo | Mínimo | Medio (connection pool) | Alto (heartbeat, reconnect) |
| **Costo operativo** | 0 | 0 | 0 | 0 |
| **Scroll preservation** | Auto (append) | Auto (append) | Auto (append) | Auto (append) |
| **Reconexión automática** | N/A (stateless) | N/A (stateless) | Nativa (EventSource) | Manual |
| **Carga servidor** | 1 req/5s por agente | 1 req/5s (lightweight) | 1 conexión persistente | 1 conexión persistente |

**Veredicto:** Smart Polling gana en todos los criterios relevantes para el proyecto: simplicidad, mantenibilidad, testing, y costo operativo. SSE y WebSocket apenas mejoran la latencia (5s → 100ms) pero multiplican la complejidad por 5x.

---

## 7. Flujo de datos

### 7.1 Mensaje entrante (cliente → agente)

```
1. Cliente WhatsApp envía mensaje
2. Meta envía POST /webhooks/whatsapp → FastAPI
3. FastAPI persiste Message + actualiza Conversation.last_message_at
4. FastAPI notifica n8n (asyncio.create_task)
5. (5s máximo) Frontend GET /messages?after=... recibe el nuevo mensaje
6. useMessages hace append del mensaje a la lista
7. React re-renderiza MessageBubble con el nuevo mensaje
```

### 7.2 Mensaje saliente (agente → cliente)

```
1. Agente escribe y envía en Composer
2. useMessages.sendMessage → POST /messages
3. FastAPI persiste + envía WhatsApp + retorna Message
4. useMessages hace append inmediato (optimistic, ya existente)
5. (5s máximo) Polling detecta status update (sent→delivered→read)
6. useMessages actualiza el mensaje correspondiente por id
```

### 7.3 Nueva conversación

```
1. Nuevo contacto escribe por primera vez
2. Webhook crea Contact + Conversation + Message
3. (10s máximo) useConversations polling recibe la nueva conversación
4. La lista se actualiza con el nuevo item al inicio
```

### 7.4 Cambio de estado (takeover)

```
1. Agente hace clic en "Control" o "Devolver"
2. PATCH /conversations/{id} → actualiza status
3. Respuesta inmediata (ya funciona)
4. (15s máximo) useConversation polling confirma el estado
5. (10s máximo) useConversations polling actualiza la lista
```

---

## 8. Componentes afectados

### 8.1 Backend

| Archivo | Cambio |
|---------|--------|
| `app/api/v1/messages.py` | Añadir query param `after: datetime \| None` a GET `/conversations/{id}/messages`. Filtrar por `Message.created_at > after`. |

### 8.2 Frontend

| Archivo | Cambio |
|---------|--------|
| `hooks/useMessages.ts` | Añadir `lastFetchTimestamp`. Añadir `setInterval` 5s con fetch condicional (`after`). Append resultados. Respetar visibility. |
| `hooks/useConversations.ts` | Añadir `setInterval` 10s. Refetch completo. Reemplazar lista. Respetar visibility (ya existe parcialmente). |
| `hooks/useConversation.ts` | Añadir `setInterval` 15s. Refetch single conversation. Reemplazar datos. Respetar visibility. |
| `lib/api.ts` | Añadir parámetro `after` opcional a `getConversationMessages`. |

**Total: 1 backend file, 3 frontend hooks, 1 frontend lib. 0 archivos nuevos.**

---

## 9. Backend

### 9.1 Cambio en GET /conversations/{id}/messages

```python
# Antes
async def list_messages(
    conversation_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_user),
) -> list[Message]:

# Después
async def list_messages(
    conversation_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    after: datetime | None = Query(None, description="Return only messages created after this timestamp"),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_user),
) -> list[Message]:
```

La query cambia de:

```python
query = (
    select(Message)
    .where(Message.conversation_id == conversation_id)
    .order_by(Message.created_at.asc())
    .offset(offset)
    .limit(limit)
)
```

a:

```python
query = select(Message).where(Message.conversation_id == conversation_id)

if after is not None:
    query = query.where(Message.created_at > after)

query = query.order_by(Message.created_at.asc()).offset(offset).limit(limit)
```

Cuando `after` está presente, la query filtra por `created_at > after`. El parámetro `offset` sigue siendo válido pero el frontend nunca envía `after` + `offset` simultáneamente (el polling solo usa `after`, la carga inicial solo usa `offset`). El backend aplica ambas cláusulas si están presentes, lo cual es correcto aunque el frontend no las envíe juntas.

### 9.2 Índice de base de datos

Para que la query con `after` sea eficiente, se recomienda un índice compuesto en `(conversation_id, created_at)` en la tabla `messages`. El modelo actual tiene índices separados en `conversation_id` y `created_at`, pero no uno compuesto. PostgreSQL usará el índice de `conversation_id` + filtro en memoria, que es aceptable para decenas de mensajes por conversación pero se beneficiaría de un índice compuesto. Crear migración Alembic:

```python
# migration script
op.create_index(
    "ix_message_conversation_created",
    "messages",
    ["conversation_id", "created_at"],
    postgresql_using="btree",
)
```

Sin este índice, la query haría un sequential scan filtrado por `conversation_id` cada 5s por agente. Con el índice, es un index seek O(log n).

**Nota de timezone:** El backend usa `datetime(UTC)` en Message.created_at (timezone-aware). El frontend envía `new Date().toISOString()` que es UTC. La comparación `created_at > after` es segura porque ambos lados están en UTC. No requiere conversión adicional.

### 9.3 Sin cambios en otros endpoints

Los endpoints de conversations list, conversations detail, y patch no necesitan cambios. El polling de useConversations y useConversation simplemente refetch los datos completos (20 items, payload pequeño).

---

## 10. Frontend

### 10.1 useMessages — polling de mensajes nuevos

```typescript
// Cambios en useMessages.ts

// Nuevo estado
const lastFetchRef = useRef<string | null>(null);
const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

// Efecto de polling
useEffect(() => {
  if (!conversationId) return;

  function poll() {
    if (document.visibilityState !== "visible") return;
    const after = lastFetchRef.current;
    getConversationMessages(conversationId, { after, limit: 50 })
      .then((newMessages) => {
        if (newMessages.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const unique = newMessages.filter((m) => !existingIds.has(m.id));
            return unique.length > 0 ? [...prev, ...unique] : prev;
          });
        }
        lastFetchRef.current = new Date().toISOString();
      })
      .catch(() => { /* silent: next poll will retry */ });
  }

  // Inicializar lastFetch después del primer fetch completo
  // (se setea en el fetch principal existente)

  intervalRef.current = setInterval(poll, 5000);

  // Visibility change: pause/resume
  function handleVisibility() {
    if (document.visibilityState === "visible") {
      poll(); // fetch inmediato al volver
    }
  }
  document.addEventListener("visibilitychange", handleVisibility);

  return () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}, [conversationId]);
```

### 10.2 useConversations — polling de lista

```typescript
// Cambios en useConversations.ts

useEffect(() => {
  const interval = setInterval(() => {
    if (document.visibilityState !== "visible") return;
    const controller = new AbortController();
    fetchData(controller.signal);
  }, 10000);

  // visibility change handler (ya existe, se complementa)
  return () => clearInterval(interval);
}, [fetchData]);
```

### 10.3 useConversation — polling de detalle

```typescript
// Cambios en useConversation.ts

useEffect(() => {
  if (!id) return;
  const abortRef = { current: null as AbortController | null };

  const interval = setInterval(() => {
    if (document.visibilityState !== "visible") return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    getConversation(id, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setConversation(data);
      })
      .catch(() => {});
  }, 15000);

  return () => {
    clearInterval(interval);
    abortRef.current?.abort();
  };
}, [id]);
```

### 10.4 lib/api.ts — nuevo parámetro after

```typescript
export async function getConversationMessages(
  conversationId: string,
  params?: GetMessagesParams & { after?: string },
  signal?: AbortSignal
): Promise<Message[]> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));
  if (params?.after) searchParams.set("after", params.after);
  // ...
}
```

### 10.5 types/index.ts — actualizar GetMessagesParams

```typescript
export interface GetMessagesParams {
  limit?: number;
  offset?: number;
  after?: string;
}
```

---

## 11. Performance

### 11.1 Carga del servidor

- Cada agente: 12 req/min (1 mensaje/5s + 1 lista/10s + 1 detalle/15s ≈ 12 req/min)
- 10 agentes concurrentes: 120 req/min → 2 req/segundo
- La query con `after` usa índice `ix_message_conversation_created` (índice compuesto en `(conversation_id, created_at)`, creado via migration si no existe)
- Carga despreciable para PostgreSQL

### 11.2 Payload de red

- Polling de mensajes con `after`: payload típico vacío o 1-2 mensajes nuevos (< 1KB)
- Polling de lista: 20 items, ~5KB comprimido
- Polling de detalle: 1 item, ~500B

### 11.3 Re-renders

- useMessages recibe nuevos mensajes: solo append, re-renderiza solo el nuevo MessageBubble (React keys permiten diff eficiente)
- useConversations reemplaza toda la lista: re-renderiza toda la ConversationTable. Aceptable porque ocurre cada 10s y la tabla es pequeña (20 filas).

### 11.4 Bundle

- Cero bytes añadidos al bundle (no hay nuevas dependencias)
- ~30 líneas de lógica de polling distribuidas en 3 hooks existentes

---

## 12. Accesibilidad

El polling no introduce cambios de accesibilidad porque:

- No hay contenido que se mueva automáticamente (los mensajes se añaden al final, el scroll se mantiene gracias al comportamiento existente de `useMessages`)
- No hay anuncios ARIA nuevos (el `aria-live="polite"` en la página de lista ya cubre cambios)
- No hay notificaciones que interrumpan al usuario
- Los intervalos de polling no afectan el foco del teclado ni la navegación por tab

---

## 13. Testing

### 13.1 Unit tests — useMessages con polling

```typescript
// Test: polling fetches new messages after interval
it("polls for new messages every 5 seconds", async () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useMessages("conv-1"));
  
  // Initial fetch completes
  await vi.advanceTimersByTimeAsync(0);
  expect(getConversationMessages).toHaveBeenCalledTimes(1);
  
  // Advance 5s
  await vi.advanceTimersByTimeAsync(5000);
  expect(getConversationMessages).toHaveBeenCalledTimes(2);
  
  // Advance another 5s
  await vi.advanceTimersByTimeAsync(5000);
  expect(getConversationMessages).toHaveBeenCalledTimes(3);
  
  vi.useRealTimers();
});

// Test: does not poll when page is hidden
it("pauses polling when page is hidden", async () => {
  vi.useFakeTimers();
  renderHook(() => useMessages("conv-1"));
  
  Object.defineProperty(document, "visibilityState", { value: "hidden" });
  document.dispatchEvent(new Event("visibilitychange"));
  
  await vi.advanceTimersByTimeAsync(10000);
  expect(getConversationMessages).toHaveBeenCalledTimes(1); // solo initial fetch
  
  vi.useRealTimers();
});

// Test: appends new messages without duplicates
it("appends new messages without duplicates", async () => {
  // Mock first response with 1 message
  // Mock second response with 2 messages (1 duplicate + 1 new)
  // Expect final list has 2 messages total
});
```

### 13.2 Unit tests — useConversations con polling

```typescript
it("polls for conversation list every 10 seconds", async () => {
  vi.useFakeTimers();
  renderHook(() => useConversations());
  
  await vi.advanceTimersByTimeAsync(10000);
  expect(getConversations).toHaveBeenCalledTimes(2);
  
  vi.useRealTimers();
});
```

### 13.3 Unit tests — useConversation con polling

```typescript
it("polls for single conversation every 15 seconds", async () => {
  vi.useFakeTimers();
  renderHook(() => useConversation("conv-1"));
  
  await vi.advanceTimersByTimeAsync(15000);
  expect(getConversation).toHaveBeenCalledTimes(2);
  
  vi.useRealTimers();
});
```

### 13.4 Edge cases

| Caso | Comportamiento esperado |
|------|------------------------|
| Polling durante error de red | Next interval lo reintenta. Sin spam de errores (catch silencioso) |
| Polling durante loading | Se salta el fetch (guard condicional) |
| Tab oculta 5 minutos | Sin polling. Primer fetch al volver |
| Múltiples mensajes en 1s | `after` timestamp captura todos (misma fecha) |
| Dupdo por race condition | Filtro por `id` existente en el append |
| Polling después de unmount | `clearInterval` en cleanup. Sin leaks |
| after + offset simultáneos | Backend prioriza `after` sobre `offset` |

---

## 14. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Reactividad excesiva (re-renders cada 5s) | Baja | Bajo | React key-based diff minimiza re-renders. Tabla pequeña (20 filas). |
| Carga DB por polling excesivo | Baja | Bajo | 2 req/seg para 10 agentes. PostgreSQL lo maneja sin esfuerzo. Índice en (conversation_id, created_at). |
| Mensajes duplicados por race condition | Media | Bajo | Filtro por id existente en el append (set). |
| Scroll perdido al hacer append | Baja | Medio | El comportamiento actual de scroll (bottomRef) ya maneja nuevos mensajes. Polling no interfiere. |
| Error de red continuo | Baja | Bajo | Catch silencioso. Siguiente intervalo reintenta. El usuario ve los datos anteriores. |

---

## 15. Rollout

### Fase 1 — Backend (1 commit)
1. `app/api/v1/messages.py`: añadir `after` param a GET messages
2. Verificar que tests backend existentes pasen

### Fase 2 — Frontend lib (1 commit)
3. `lib/api.ts`: añadir `after` a getConversationMessages params
4. `types/index.ts`: añadir `after` a GetMessagesParams

### Fase 3 — Hooks (1 commit)
5. `hooks/useMessages.ts`: polling 5s con after timestamp + dedup
6. `hooks/useConversations.ts`: polling 10s con visibility guard
7. `hooks/useConversation.ts`: polling 15s con visibility guard

### Fase 4 — Tests (1 commit)
8. Tests de polling en useMessages, useConversations, useConversation
9. Ejecutar full test suite

### Fase 5 — Validación (1 commit)
10. `npm run lint`
11. `npm run build`
12. `npm run test`
13. `uv run ruff check app/ --ignore B008` (si existe)

---

## 16. Definition of Done

### Funcional
- [x] Los mensajes entrantes aparecen en la pantalla de detalle sin recarga manual
- [x] La lista de conversaciones se actualiza automáticamente
- [x] Los cambios de estado (takeover) se reflejan sin recarga manual
- [x] El polling se pausa cuando la pestaña está oculta
- [x] El polling se reanuda inmediatamente al volver a la pestaña
- [x] No hay mensajes duplicados
- [x] Sin regresión en F3 (scrolling, auto-scroll, scroll preservation)

### Técnico
- [x] `after` query param implementado en GET messages
- [x] useMessages polling 5s con after timestamp
- [x] useConversations polling 10s
- [x] useConversation polling 15s
- [x] `npm run lint` sin errores
- [x] `npm run build` exitoso
- [x] `npm run test` — todos los tests pasan (153)
- [x] `uv run ruff check app/ --ignore B008` sin errores

### Documentación
- [x] SESSION_HANDOFF.md actualizado
- [x] PROJECT_ROADMAP.md actualizado
- [x] ADR-025 agregado a PROJECT_DECISIONS.md
- [x] Este documento marcado como "Implemented"

### Auto Review
- [ ] Architecture Review completado
- [ ] Frontend Review completado
- [ ] Performance Review completado
- [ ] Testing Review completado
- [ ] Documentation Review completado
- [ ] Consistency Audit completado
- [ ] Todos los hallazgos corregidos antes del merge
