# F6D — Inbox Search & Filtering

## Objetivo

Agregar búsqueda y filtros avanzados al inbox de FlowDesk-AI. Hoy el inbox solo permite filtrar por estado (`active`/`human_takeover`/`closed`) y paginar. Un agente que gestiona 50+ conversaciones necesita encontrar mensajes y conversaciones por contenido, contacto, rango de fechas y dirección para responder rápido sin scroll manual infinito.

**Qué problema resuelve:** Un agente humano pasando takeover de 20 conversaciones necesita buscar "cuándo llega el paquete" en todos los mensajes, o filtrar solo las conversaciones con takeover de esta semana. Sin búsqueda, tiene que abrir cada conversación y hacer scroll.

---

## Diagnóstico

### Backend — limitaciones actuales

| Endpoint | Filtros disponibles | Limitación |
|---|---|---|
| `GET /conversations` | `status`, `limit`, `offset` | Sin búsqueda por nombre de contacto. Sin rango de fechas. Sin total count. |
| `GET /conversations/{id}/messages` | `after`, `limit`, `offset` | Sin búsqueda por contenido. Sin filtro por dirección. Sin filtro por status. Sin rango de fechas. |
| Global search | No existe | No hay endpoint que busque a través de todo el inbox. |

**Modelos:**
- `Conversation`: sin índice de búsqueda. No tiene FTS.
- `Message`: índice solo en `conversation_id` y `created_at`. `content` es `Text` sin FTS.
- La relación `Conversation.contact_id → Contact` existe como FK pero sin `relationship()` ORM — las queries usan joins manuales, lo cual es correcto y se mantiene.

**Servicios:**
- No existe `conversation_service.py` — la lógica de list/get/update está inline en el route handler.
- `message_service.py` solo tiene `get_conversation_history`, `send_outgoing_message`, `process_incoming_and_respond`.

### Frontend — limitaciones actuales

| Componente | Estado | Limitación |
|---|---|---|
| `ConversationsFilter` | Dropdown de 4 opciones (Todas/Activas/Takeover/Cerradas) | Sin search input, sin date picker, sin filtros múltiples |
| `ConversationTable` | Lista de conversaciones con preview | Sin forma de buscar dentro de la lista |
| `useConversations` | `statusFilter`, `offset`, paginación | Sin `q` (search query), sin date range |
| `useMessages` | `after`, `offset`, polling | Sin `q`, sin `direction`, sin `status` |
| Página de detalle | `[id].tsx` con MessageList + Composer | Sin search dentro de mensajes |
| Layout global | AppShell + Sidebar | Sin search bar global |

---

## Arquitectura propuesta

### Backend

#### Modelos afectados

Ningún modelo nuevo. Ninguna migración. No se agregan columnas ni tablas. Todo es aditivo vía queries.

#### Estrategia de búsqueda

**`ILIKE` via SQLAlchemy `.ilike()` para máxima compatibilidad.**

Justificación:
- Las queries se ejecutan igual en PostgreSQL (producción) y SQLite (tests) sin bifurcar código.
- Para PostgreSQL en producción, si el volumen crece, se puede migrar a `pg_trgm` (GIN index) para acelerar `ILIKE '%query%'` sin cambiar queries — solo agregar un índice.
- Los volúmenes esperados (cientos de conversaciones, miles de mensajes) no justifican la complejidad de FTS (`tsvector`/`tsquery`).
- No requiere dependencias nuevas ni cambios en `alembic`.

**Todas las búsquedas usan `ILIKE` con wildcards en ambos lados:** `col.ilike(f"%{query}%")`.

#### Nuevo archivo: `backend/app/services/conversation_service.py`

Se extrae la lógica de listado de conversaciones del route handler a un service layer, siguiendo el patrón de `contact_service.py`.

```python
# Métodos
search_conversations(db, q: str | None, status: str | None, date_from: datetime | None, date_to: datetime | None, limit: int, offset: int) -> tuple[list[dict], int]
get_conversation(db, id: uuid.UUID) -> dict | None
update_conversation_status(db, id: uuid.UUID, status: str) -> Conversation
```

`search_conversations` reemplaza la query actual de `list_conversations` en el route handler. Retorna `(items, total)` para que el endpoint pueda devolver metadata de paginación.

**Queries:**

```python
# search_conversations
base = (
    select(
        Conversation.id,
        Conversation.contact_id,
        Conversation.status,
        Conversation.last_message_at,
        Conversation.created_at,
        Conversation.updated_at,
        Contact.name.label("contact_name"),
        last_message_subquery.c.content_preview.label("last_message_preview"),
    )
    .join(Contact, Conversation.contact_id == Contact.id)
    .outerjoin(last_message_subquery, Conversation.id == last_message_subquery.c.conversation_id)
)

# Count query (sin outerjoin a last_message para performance)
count_base = (
    select(func.count())
    .select_from(Conversation)
    .join(Contact, Conversation.contact_id == Contact.id)
)

if q:
    q_filter = Contact.name.ilike(f"%{q}%")
    base = base.where(q_filter)
    count_base = count_base.where(q_filter)

if status:
    base = base.where(Conversation.status == status)
    count_base = count_base.where(Conversation.status == status)

if date_from:
    base = base.where(Conversation.created_at >= date_from)
    count_base = count_base.where(Conversation.created_at >= date_from)

if date_to:
    base = base.where(Conversation.created_at <= date_to)
    count_base = count_base.where(Conversation.created_at <= date_to)

total = await db.scalar(count_base)
result = await db.execute(base.order_by(Conversation.last_message_at.desc().nullslast()).offset(offset).limit(limit))
items = [dict(row._mapping) for row in result]
return items, total
```

#### Endpoints modificados

**`GET /conversations`** — nuevos parámetros query:

| Parámetro | Tipo | Default | Descripción |
|---|---|---|---|
| `q` | string? | `None` | Búsqueda por nombre del contacto |
| `status` | string? | `None` | Filtro por estado (`active`, `human_takeover`, `closed`) |
| `date_from` | datetime? | `None` | Conversaciones creadas desde esta fecha |
| `date_to` | datetime? | `None` | Conversaciones creadas hasta esta fecha |
| `limit` | int (1-100) | `20` | Items por página |
| `offset` | int (≥0) | `0` | Offset para paginación |

**Response cambia** para incluir `total`:

```json
{
  "items": [ConversationResponse, ...],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

Esto requiere un nuevo schema `ConversationListResponse(items: list[ConversationResponse], total: int, limit: int, offset: int)`.

**`GET /conversations/{id}/messages`** — nuevos parámetros query:

| Parámetro | Tipo | Default | Descripción |
|---|---|---|---|
| `q` | string? | `None` | Búsqueda en contenido del mensaje |
| `direction` | string? | `None` | `incoming` o `outgoing` |
| `status` | string? | `None` | `pending`, `sent`, `delivered`, `read`, `failed` |
| `date_from` | datetime? | `None` | Mensajes creados desde esta fecha |
| `date_to` | datetime? | `None` | Mensajes creados hasta esta fecha |
| `after` | datetime? | `None` | Solo mensajes después de este timestamp (para polling) |
| `limit` | int (1-200) | `50` | Items por página |
| `offset` | int (≥0) | `0` | Offset |

**Response también cambia** a formato paginado con `total`:

```json
{
  "items": [MessageResponse, ...],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

Requiere nuevo schema `MessageListResponse`.

#### Endpoints nuevos

**`GET /search`** — búsqueda global (conversaciones + contactos):

| Parámetro | Tipo | Default | Descripción |
|---|---|---|---|
| `q` | string | requerido | Texto de búsqueda |
| `scope` | string? | `all` | `all`, `conversations`, `messages` |
| `limit` | int (1-50) | `20` | Items por tipo |
| `offset` | int (≥0) | `0` | Offset |

```json
{
  "conversations": {
    "items": [ConversationResponse, ...],
    "total": 5
  },
  "messages": {
    "items": [SearchMessageResult, ...],
    "total": 12
  }
}
```

`SearchMessageResult` incluye: `id`, `conversation_id`, `contact_name`, `content`, `direction`, `created_at`, `highlight` (fragmento alrededor del match).

**Implementación de `SearchMessageResult`:**
```python
class SearchMessageResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    conversation_id: uuid.UUID
    contact_name: str
    content: str
    direction: str
    created_at: datetime
    # highlight es un fragmento de ~100 chars alrededor del match
    highlight: str

class GlobalSearchConversations(BaseModel):
    items: list[ConversationResponse]
    total: int

class GlobalSearchMessages(BaseModel):
    items: list[SearchMessageResult]
    total: int

class GlobalSearchResponse(BaseModel):
    conversations: GlobalSearchConversations
    messages: GlobalSearchMessages
```

#### Índices necesarios

Ninguno nuevo para ILIKE básico. Si en producción se necesita acelerar:
- `CREATE INDEX ix_contacts_name_trgm ON contacts USING GIN (name gin_trgm_ops);`
- `CREATE INDEX ix_messages_content_trgm ON messages USING GIN (content gin_trgm_ops);`
- Requiere `CREATE EXTENSION pg_trgm;`

Estos índices NO se implementan en F6D. Se documentan como mejora futura.

#### Paginación

Todos los endpoints que retornan listas ahora retornan `{items, total, limit, offset}`. Esto permite al frontend:
- Saber cuántas páginas hay (`Math.ceil(total / limit)`)
- Mostrar "Resultado X de Y"
- Deshabilitar "Siguiente" cuando `offset + limit >= total`

#### Filtros

- **q (search):** ILIKE case-insensitive en ambos lados. Aplica a `Contact.name` en conversaciones, `Message.content` en mensajes.
- **status:** Exact match en `Conversation.status` o `Message.status`.
- **direction:** Exact match en `Message.direction`.
- **date_from/date_to:** Rango en `created_at`. Inclusivo en ambos extremos (`.where(col >= date_from)` y `.where(col <= date_to + timedelta(days=1))`).
- **after:** Filtro exclusivo para polling (`col > after`).

#### Performance

| Aspecto | Decisión | Justificación |
|---|---|---|
| Search method | `ILIKE %q%` | Compatible SQLite+PG, simple, sin deps. |
| Count query | `SELECT COUNT(*)` separado | Necesario para paginación metadata. No afecta performance en volúmenes esperados. |
| N+1 | Ya resuelto en F6B (consultas con joins/subqueries) | Sin cambios. |
| Limite de resultados | 100 conversaciones, 200 mensajes | Suficiente para UI con scroll/paginación. |
| Polling | Sin cambios | El filtro `after` sigue funcionando. Search + polling no tienen sentido juntos. |

---

### Frontend

#### Types nuevos y modificados

```typescript
// Modificado: GetConversationsParams
export interface GetConversationsParams {
  q?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

// Nuevo: ConversationListResponse
export interface ConversationListResponse {
  items: Conversation[];
  total: number;
  limit: number;
  offset: number;
}

// Modificado: GetMessagesParams
export interface GetMessagesParams {
  q?: string;
  direction?: "incoming" | "outgoing";
  status?: string;
  date_from?: string;
  date_to?: string;
  after?: string;
  limit?: number;
  offset?: number;
}

// Nuevo: MessageListResponse
export interface MessageListResponse {
  items: Message[];
  total: number;
  limit: number;
  offset: number;
}

// Nuevo: SearchMessageResult
export interface SearchMessageResult {
  id: string;
  conversation_id: string;
  contact_name: string;
  content: string;
  direction: "incoming" | "outgoing";
  created_at: string;
  highlight: string;
}

// Nuevo: GlobalSearchResponse
export interface GlobalSearchResponse {
  conversations: {
    items: Conversation[];
    total: number;
  };
  messages: {
    items: SearchMessageResult[];
    total: number;
  };
}
```

#### API Client — funciones nuevas y modificadas

```typescript
// Modificada: ahora acepta q, date_from, date_to y retorna ConversationListResponse
getConversations(params?: GetConversationsParams, signal?: AbortSignal): Promise<ConversationListResponse>

// Modificada: ahora acepta q, direction, status, date_from, date_to y retorna MessageListResponse
getConversationMessages(conversationId: string, params?: GetMessagesParams, signal?: AbortSignal): Promise<MessageListResponse>

// Nueva
globalSearch(q: string, scope?: "all" | "conversations" | "messages", signal?: AbortSignal): Promise<GlobalSearchResponse>
```

#### Hooks

**`useConversations` — modificado:**
```typescript
interface UseConversationsReturn {
  conversations: Conversation[];
  total: number;
  loading: boolean;
  error: string | null;
  statusFilter: string;
  searchQuery: string;          // nuevo
  dateFrom: string | null;      // nuevo
  dateTo: string | null;        // nuevo
  offset: number;
  hasMore: boolean;
  setStatusFilter: (value: string) => void;
  setSearchQuery: (value: string) => void;  // nuevo
  setDateFrom: (value: string | null) => void;  // nuevo
  setDateTo: (value: string | null) => void;    // nuevo
  handlePrevious: () => void;
  handleNext: () => void;
  retry: () => void;
}
```

El hook se actualiza para:
- Aceptar `q`, `date_from`, `date_to` en la llamada API.
- Incorporar debounce (300ms) para `searchQuery` antes de disparar la llamada.
- Usar el campo `total` de la respuesta para calcular `hasMore`.
- Reseteo de búsqueda: cuando `searchQuery` cambia, resetear `offset` a 0.
- Los filtros status/search/date_from/date_to se orquestan: cualquiera activa la búsqueda filtrada.

**Nuevo hook: `useGlobalSearch` (opcional):**
```typescript
interface UseGlobalSearchReturn {
  results: GlobalSearchResponse | null;
  loading: boolean;
  error: string | null;
  search: (q: string) => void;
  clear: () => void;
}
```

Este hook se usa desde un SearchBar global en el layout. Debounce 300ms. Aborta request anterior si el usuario sigue escribiendo.

**`useMessages` — modificado:**
```typescript
interface UseMessagesReturn {
  messages: Message[];
  total: number;
  loading: boolean;
  error: string | null;
  searchQuery: string;          // nuevo
  directionFilter: string;      // nuevo
  statusFilter: string;         // nuevo
  hasMore: boolean;
  loadMore: () => void;
  setSearchQuery: (value: string) => void;      // nuevo
  setDirectionFilter: (value: string) => void;   // nuevo
  setStatusFilter: (value: string) => void;      // nuevo
  sendMessage: (content: string) => Promise<void>;
  sending: boolean;
  sendError: string | null;
}
```

Cuando `searchQuery` o `directionFilter` o `statusFilter` están activos, el hook desactiva el polling (no tiene sentido buscar + polling simultáneamente).

#### Componentes nuevos

**`SearchBar`:**
- Input de texto con icono de lupa, botón de limpiar (X).
- Placeholder contextual: "Buscar conversaciones..." o "Buscar mensajes...".
- Debounce de 300ms.
- Atajo de teclado: `/` enfoca el search bar (global), `Escape` limpia y desenfoca.
- Estados: vacío, escribiendo (debounce activo), resultados cargando, error, sin resultados, con resultados.

Ubicación: `src/components/ui/SearchBar.tsx` (reutilizable).

**`ConversationFilters`:**
- Reemplaza a `ConversationsFilter` (componente existente).
- Agrega: SearchBar + DatePicker (date_from / date_to) + Status dropdown (existente) + botón "Limpiar filtros".
- Layout responsive: en mobile los filtros se apilan verticalmente.
- Los DatePickers son inputs `type="date"` nativos (sin librería externa).

Ubicación: `src/components/dashboard/ConversationFilters.tsx` (reemplaza el anterior).

**`MessageSearchBar`:**
- SearchBar integrado en la cabecera de la conversación (dentro o debajo de `ConversationHeader`).
- Permite buscar dentro de los mensajes de la conversación actual.
- Cuando está activo, reemplaza la lista de mensajes con resultados filtrados.
- Tiene botón "Cerrar búsqueda" (X) que vuelve a la vista normal de mensajes.

Ubicación: `src/components/workspace/MessageSearchBar.tsx`.

**`SearchResultsDropdown`:**
- Dropdown global que aparece al buscar desde el layout.
- Muestra resultados agrupados: "Conversaciones" y "Mensajes".
- Cada resultado es clickeable y navega a la conversación correspondiente.
- Si hay muchos resultados, muestra "Ver todos los resultados" que navega a `/search?q=...`.

Ubicación: `src/components/layout/SearchResultsDropdown.tsx`.

**`SearchPage`:**
- Página `/search?q=...` para resultados completos.
- Muestra dos secciones: Conversaciones encontradas y Mensajes encontrados.
- Cada mensaje resultado muestra: contacto, preview del mensaje con highlight, fecha.
- Paginación independiente por sección.
- Estados: carga, sin resultados, error.

Ubicación: `src/pages/search/index.tsx`.

#### Componentes modificados

- **`Sidebar`**: agrega SearchBar global en la parte superior (colapsable en mobile).
- **`AppShell`**: sin cambios (el search global vive en Sidebar o en un header separado).
- **`ConversationTable`**: sin cambios estructurales, solo recibe datos filtrados desde el hook.
- **`MessageList`**: cuando hay `searchQuery`, desactiva el scroll-to-bottom automático y el polling.

#### Flujo de datos

```
SearchBar (Sidebar)
  │
  ├── debounce 300ms ──> useGlobalSearch ──> GET /search?q=...
  │                                               │
  │                                      ┌────────┴────────┐
  │                                      ▼                 ▼
  │                              Conversaciones         Mensajes
  │                              (navegar a /conv)   (navegar a /conv/{id})
  │
  └── onSubmit / Enter ──> router.push(`/search?q=${q}`)


ConversationFilters (página /conversations)
  │
  ├── SearchBar ──debounce 300ms──> useConversations.setSearchQuery(q)
  ├── Status dropdown ───────────> useConversations.setStatusFilter(status)
  ├── Date from ─────────────────> useConversations.setDateFrom(date)
  ├── Date to ───────────────────> useConversations.setDateTo(date)
  ├── Limpiar ───────────────────> resetear todos los filtros
  │
  └── useConversations.fetch() ──> GET /conversations?q=&status=&date_from=&date_to=
                                       │
                                       ▼
                                  ConversationTable


MessageSearchBar (página /conversations/[id])
  │
  ├── SearchBar ──debounce 300ms──> useMessages.setSearchQuery(q)
  ├── Direction filter ───────────> useMessages.setDirectionFilter(dir)
  ├── Status filter ──────────────> useMessages.setStatusFilter(status)
  │
  └── useMessages.fetch() ────────> GET /conversations/{id}/messages?q=&direction=&status=
                                       │
                                       ▼
                                  MessageList (filtrado, sin polling)
```

#### Estados loading/error/empty

| Componente | Loading | Empty | Error |
|---|---|---|---|
| ConversationFilters (search) | Skeleton del input + spinner | "Sin resultados para \"query\"" | "Error al buscar. Reintentar" |
| MessageSearchBar | Spinner inline | "No hay mensajes que coincidan" | Toast de error |
| SearchResultsDropdown | Spinner en el dropdown | "Sin resultados" | No se muestra (error silencioso) |
| SearchPage | Skeleton x 3 por sección | EmptyState por sección | ErrorState con retry |
| ConversationTable (filtrado) | Mismos skeletons existentes | EmptyState contextual con query | ErrorState existente |
| MessageList (filtrado) | Spinner en cabecera | EmptyState "No hay mensajes que coincidan" | Toast de error |

---

## UX

### Búsqueda global (Sidebar)

```
┌──────────────────────────────────┐
│ 🔍 Buscar en el inbox...   [ / ] │  ← placeholder + shortcut hint
└──────────────────────────────────┘

Al tipear (después de 300ms):
┌──────────────────────────────────┐
│ 🔍 ¿qué día llega...       [ ✕ ] │
│ ─────────────────────────────── │
│ 📄 Conversaciones (3)           │
│   Juan Pérez          hace 2h   │
│   María García        hace 1d   │
│ ─────────────────────────────── │
│ 💬 Mensajes (5)                 │
│   Juan: ¿qué día llega...  2h   │
│   María: el paquete lleg... 1d   │
│ ─────────────────────────────── │
│  Ver todos los resultados  →    │  ← solo si > 3 en alguna categoría
└──────────────────────────────────┘
```

- `/` en cualquier parte de la app enfoca el search bar global
- `Escape` limpia y cierra el dropdown
- Las flechas arriba/abajo navegan los resultados
- Enter abre el resultado seleccionado
- Click fuera del dropdown lo cierra

### Búsqueda en lista de conversaciones

```
┌──────────────────────────────────────────────────────┐
│  Filtros:                                            │
│  🔍 Buscar contacto...    Estado: [Todas ▼]         │
│  Desde: [📅]            Hasta: [📅]    [Limpiar]    │
├──────────────────────────────────────────────────────┤
│  Contacto         Estado        Último mensaje     │
│  Juan Pérez       Activa        ¿qué día llega...  │
│  María García     Takeover      el paquete lleg...  │
│  ...                                                │
└──────────────────────────────────────────────────────┘
  Mostrando 3 de 15 conversaciones    [< Anterior] [Siguiente >]
```

- Search con debounce 300ms
- Fecha usa input `type="date"` nativo
- Limpiar resetea TODOS los filtros a la vez (botón único)
- El placeholder del search cambia según filtros activos
- Si solo hay filtro de estado, placeholder: "Buscar contacto..."
- Si hay búsqueda activa, el paginador muestra "Mostrando X de Y resultados"

### Búsqueda dentro de una conversación

```
┌──────────────────────────────────────────────────────┐
│  ← Volver     Juan Pérez          [Activa] [Control] │
│               🔍 Buscar en mensajes...   [✕ cerrar] │
├──────────────────────────────────────────────────────┤
│  User: ¿qué día llega el pedido?               14:30 │
│  Bot: El pedido llegará mañana antes de las... 14:31 │
│  User: ¿qué día llega?                         15:00 │
│  ...                                                 │
└──────────────────────────────────────────────────────┘
```

- Al activar search, el texto "Buscar en mensajes..." reemplaza temporalmente al header de contacto
- Resultados se renderizan en el mismo MessageList pero sin auto-scroll
- Las palabras buscadas se resaltan (bold + bg amarillo) en los mensajes
- ✕ cierra la búsqueda y restaura la vista normal de mensajes
- Polling se desactiva mientras search está activo

### Página de búsqueda global

```
┌──────────────────────────────────────────────────────┐
│  🔍 ¿qué día llega?    [Buscar]                     │
├──────────────────────────────────────────────────────┤
│  📄 Conversaciones (3)                               │
│  ┌──────────────────────────────────────────────────┐│
│  │ Juan Pérez    hace 2h   Activa                   ││
│  │  ...último mensaje: "¿qué día llega el pedido?"  ││
│  └──────────────────────────────────────────────────┘│
│  ...                                                  │
│                                                       │
│  💬 Mensajes (5)                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │ Juan Pérez - hace 2h                             ││
│  │ ...¿qué día llega el pedido? Mañana nece...     ││
│  └──────────────────────────────────────────────────┘│
│  ...                                                  │
└──────────────────────────────────────────────────────┘
```

### Keyboard shortcuts

| Atajo | Acción | Contexto |
|---|---|---|
| `/` | Enfocar search bar global | Global (cualquier página) |
| `Escape` | Limpiar search / cerrar dropdown | Search activo |
| `↑` `↓` | Navegar resultados en dropdown | Dropdown abierto |
| `Enter` | Abrir resultado seleccionado | Dropdown abierto |
| `Ctrl+F` o `Cmd+F` | Enfocar búsqueda dentro de mensajes | Página de detalle de conversación |

### Responsive

| Breakpoint | Search global | Filtros conversaciones | Search mensajes |
|---|---|---|---|
| ≥1024px (desktop) | SearchBar en sidebar + dropdown | Fila horizontal de filtros | SearchBar inline en header |
| 768-1023px (tablet) | SearchBar colapsable en sidebar | Fila horizontal (wrap si necesario) | SearchBar inline |
| <768px (mobile) | SearchBar en header (sidebar oculto) | Filtros apilados verticalmente | SearchBar en cabecera compacta |

### Accesibilidad

- Todos los search inputs tienen `aria-label` descriptivo
- Los resultados del dropdown tienen `role="listbox"` con `aria-activedescendant`
- Los cambios en resultados se anuncian vía `aria-live="polite"`
- Los botones de limpiar tienen `aria-label="Limpiar búsqueda"`
- El shortcut `/` se muestra en el placeholder como `<kbd>/</kbd>`
- El highlight en mensajes usa `<mark>` con estilo semántico (no solo color)

---

## Performance

| Aspecto | Evaluación |
|---|---|
| **Índices** | No se agregan índices nuevos en F6D. Los existentes (`ix_messages_conversation_id`, `ix_messages_created_at`) son suficientes para los volúmenes actuales. |
| **ILIKE vs FTS** | `ILIKE %q%` no usa índice B-tree estándar. Para miles de registros es aceptable. Si el producto escala, migrar a `pg_trgm` (GIN index) sin cambiar queries. |
| **N+1** | Ya resuelto con subquery joins. `search_conversations` usa un solo `JOIN + OUTER JOIN`. |
| **Debounce** | 300ms en todos los search inputs. Previene llamadas innecesarias mientras el usuario tipea. |
| **AbortController** | Los hooks existentes ya abortan requests previas cuando cambian los parámetros. Se mantiene para búsqueda. |
| **Memoización** | `useCallback` en setters de filtros. React.memo opcional en `SearchBar` si el input re-renderiza demasiado. |
| **Polling desactivado** | Cuando search está activo en mensajes, el hook desactiva el polling de 5s. |
| **Count query** | `SELECT COUNT(*)` es rápido con índices en PostgreSQL. En SQLite es casi instantáneo. |
| **Renders** | Cada cambio de filtro dispara un fetch + re-render. Con debounce de 300ms y estados de carga, la UI responde sin saltos. |
| **Sin memorización de resultados** | Los resultados de búsqueda no se cachean. Cada cambio en filtros dispara nueva request. Aceptable para volúmenes pequeños. |

---

## Compatibilidad

| Fase | Afectado? | Detalle |
|---|---|---|
| **F5A** (Webhooks + AI) | Compatible | Sin cambios en webhooks ni Groq. La búsqueda es solo consulta. |
| **F5B** (Inbox) | Compatible | Se modifican `GET /conversations` y `GET /conversations/{id}/messages` con NUEVOS parámetros opcionales. Backward compatible. |
| **F5C** (Status management) | Compatible | `PATCH /conversations/{id}` sin cambios. |
| **F5D** (N8N) | Compatible | Endpoints `/internal/*` sin cambios. |
| **F6A** (Auth/Toast) | Compatible | Auth sin cambios. Toast se usa para errores de búsqueda. |
| **F6B** (Contacts) | Compatible | Contact service no se modifica. Se reusa `search_conversations` con join a Contact. |
| **F6C** (Profile) | Compatible | Sin cambios en profile. |
| **Tests existentes** | Compatible | Todos los tests existentes siguen pasando. Los nuevos parámetros son opcionales. |

**Aditividad estricta:** No se eliminan ni modifican parámetros existentes. Solo se agregan nuevos query params opcionales y nuevas rutas.

---

## Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| **ILIKE %q% lento en producción** | Baja (volumen pequeño) | Medio | Documentar migración a `pg_trgm`. No implementar hasta que sea necesario. |
| **SQLite no soporta `ILIKE`** | Ninguna | — | SQLite soporta `ILIKE` desde 3.x. Verificado. |
| **Search + polling conflictos** | Media | Bajo | Desactivar polling cuando search está activo en `useMessages`. |
| **Debounce con teclado rápido** | Alta | Mínimo | 300ms es estándar. Si el usuario tipea rápido, solo se envía la última llamada. |
| **DatePicker nativo inconsistente** | Media | Bajo | `type="date"` tiene soporte universal. En Safari se ve diferente pero es funcional. |
| **Overfetching en búsqueda global** | Media | Bajo | `limit` por defecto pequeño (5 por categoría en dropdown, 20 en página). |
| **SQL injection** | Ninguna | — | SQLAlchemy `.ilike()` escapa parámetros. No hay concatenación manual de strings. |

---

## Roadmap interno

### F6D PR1: Backend — Search endpoints + service layer

**Objetivo:** Extraer `conversation_service.py`, agregar parámetros de búsqueda a endpoints existentes, agregar `GET /search` global.

**Archivos:**

| Archivo | Cambio |
|---|---|
| `backend/app/services/conversation_service.py` | **NUEVO** — `search_conversations()`, `get_conversation()`, `update_conversation_status()` |
| `backend/app/api/v1/conversations.py` | **MODIFICADO** — usa `conversation_service.search_conversations()`, nuevos params: `q`, `date_from`, `date_to`. Response con formato paginado. |
| `backend/app/api/v1/messages.py` | **MODIFICADO** — nuevos params: `q`, `direction`, `status`, `date_from`, `date_to`. Response con formato paginado. |
| `backend/app/api/v1/search.py` | **NUEVO** — `GET /search` global. |
| `backend/app/api/v1/__init__.py` | **MODIFICADO** — incluir `search_router`. |
| `backend/app/schemas/conversation.py` | **MODIFICADO** — agregar `ConversationListResponse` |
| `backend/app/schemas/message.py` | **MODIFICADO** — agregar `MessageListResponse`, `SearchMessageResult` |
| `backend/app/schemas/search.py` | **NUEVO** — `GlobalSearchResponse`, `GlobalSearchConversations`, `GlobalSearchMessages` |

**Esfuerzo:** ~250 líneas (service: 80, routes: 100, schemas: 40, init: 5)

**Tests nuevos:**

| Archivo | Tests |
|---|---|
| `tests/test_conversations.py` | + buscar por q, + filtrar por date_from/date_to, + response paginado, + q + status combinados |
| `tests/test_messages.py` | + buscar por q, + filtrar por direction, + filtrar por status, + filtrar por date_from/date_to, + combinar q + direction |
| `tests/test_search.py` | **NUEVO** — search global retorna resultados, search sin resultados, search sin q retorna 422, search solo conversations, search solo messages |

**Criterios de aceptación:**
- `GET /conversations?q=juan` retorna solo conversaciones cuyo contacto contiene "juan"
- `GET /conversations?date_from=2026-01-01&date_to=2026-06-30` retorna solo conversaciones en ese rango
- `GET /conversations/{id}/messages?q=pedido` retorna solo mensajes con "pedido"
- `GET /conversations/{id}/messages?direction=incoming` retorna solo entrantes
- `GET /conversations/{id}/messages?status=failed` retorna solo fallidos
- `GET /search?q=juan` retorna conversaciones con "juan" y mensajes con "juan"
- Todos los tests existentes pasan sin modificaciones
- 119+ tests → ~135 tests

---

### F6D PR2: Frontend — Types + API + Hooks

**Objetivo:** Actualizar types, API client y hooks para soportar los nuevos parámetros y responses.

**Archivos:**

| Archivo | Cambio |
|---|---|
| `frontend/src/types/index.ts` | **MODIFICADO** — `GetConversationsParams` extendido, nuevo `ConversationListResponse`, `GetMessagesParams` extendido, nuevo `MessageListResponse`, nuevo `SearchMessageResult`, nuevo `GlobalSearchResponse` |
| `frontend/src/lib/api.ts` | **MODIFICADO** — `getConversations()` retorna `ConversationListResponse`, `getConversationMessages()` retorna `MessageListResponse`, nuevo `globalSearch()` |
| `frontend/src/hooks/useConversations.ts` | **MODIFICADO** — agrega `searchQuery`, `dateFrom`, `dateTo`, debounce 300ms, usa `total` de response, `setSearchQuery`, `setDateFrom`, `setDateTo` |
| `frontend/src/hooks/useMessages.ts` | **MODIFICADO** — agrega `searchQuery`, `directionFilter`, `statusFilter`, desactiva polling cuando search activo |
| `frontend/src/hooks/index.ts` | **MODIFICADO** — exporta `useGlobalSearch` |

**Esfuerzo:** ~200 líneas (types: 30, api: 30, hooks: 120, index: 1)

**Criterios de aceptación:**
- `useConversations.searchQuery` se refleja en `GET /conversations?q=...`
- `useConversations.dateFrom/dateTo` se reflejan en query params
- `useConversations.total` es accesible y correcto
- `useMessages.searchQuery` desactiva polling
- `globalSearch()` retorna estructura correcta
- Typecheck: 0 source errors

---

### F6D PR3: Frontend — SearchBar + ConversationFilters

**Objetivo:** Implementar componentes SearchBar reutilizable y ConversationFilters mejorado.

**Archivos:**

| Archivo | Cambio |
|---|---|
| `frontend/src/components/ui/SearchBar.tsx` | **NUEVO** — Input con lupa, limpiar, debounce, keyboard shortcut hint, `aria-label` |
| `frontend/src/components/dashboard/ConversationFilters.tsx` | **NUEVO** — Reemplaza `ConversationsFilter`. SearchBar + Status dropdown + Date pickers + Limpiar. |
| `frontend/src/components/dashboard/ConversationTable.tsx` | **MODIFICADO** — Muestra query en empty state cuando hay búsqueda activa |
| `frontend/src/pages/conversations/index.tsx` | **MODIFICADO** — Pasa searchQuery, dateFrom, dateTo a ConversationFilters y a useConversations |

**Esfuerzo:** ~200 líneas (SearchBar: 80, ConversationFilters: 80, modificaciones: 40)

**Criterios de aceptación:**
- SearchBar con debounce 300ms
- `/` enfoca el search global
- `Escape` limpia
- ConversationFilters con todos los filtros funciona
- "Limpiar" resetea todos los filtros
- Empty state del ConversationTable cambia cuando hay búsqueda activa
- Typecheck: 0 source errors

---

### F6D PR4: Frontend — Global search + Search page

**Objetivo:** Search global en sidebar, SearchResultsDropdown, y página `/search`.

**Archivos:**

| Archivo | Cambio |
|---|---|
| `frontend/src/components/layout/SearchResultsDropdown.tsx` | **NUEVO** — Dropdown con resultados agrupados, keyboard navigation |
| `frontend/src/pages/search/index.tsx` | **NUEVO** — Página de búsqueda completa con resultados paginados |
| `frontend/src/components/layout/Sidebar.tsx` | **MODIFICADO** — Agrega SearchBar en la parte superior |
| `frontend/src/components/layout/AppShell.tsx` | **MODIFICADO** — Si se prefiere search en header en vez de sidebar |

**Esfuerzo:** ~200 líneas (SearchResultsDropdown: 70, SearchPage: 100, modificaciones: 30)

**Criterios de aceptación:**
- SearchBar en sidebar funciona
- Dropdown aparece con resultados al tipear
- Navegación con teclado en dropdown
- Enter abre resultado
- Página `/search?q=...` carga y muestra resultados
- Estados vacío y error funcionan
- Typecheck: 0 source errors

---

### F6D PR5: Frontend — Message search dentro de conversación

**Objetivo:** Búsqueda dentro de los mensajes de una conversación específica.

**Archivos:**

| Archivo | Cambio |
|---|---|
| `frontend/src/components/workspace/MessageSearchBar.tsx` | **NUEVO** — SearchBar contextual en la conversación |
| `frontend/src/pages/conversations/[id].tsx` | **MODIFICADO** — Integra MessageSearchBar, pasa filtros a useMessages |
| `frontend/src/components/workspace/MessageList.tsx` | **MODIFICADO** — Cuando search activo: no auto-scroll, highlight términos, no polling |
| `frontend/src/components/workspace/MessageBubble.tsx` | **MODIFICADO** — Opcional: resaltar términos con `<mark>` |

**Esfuerzo:** ~150 líneas (MessageSearchBar: 60, modificaciones: 90)

**Criterios de aceptación:**
- MessageSearchBar aparece al hacer Ctrl+F o al hacer click
- Resultados se renderizan en MessageList filtrado
- Highlight del término buscado en los mensajes
- ✕ cierra y restaura vista normal
- Polling se reanuda al cerrar search
- Typecheck: 0 source errors

---

## Checklist

- [ ] Conversaciones filtrables por `q`, `date_from`, `date_to`
- [ ] Mensajes filtrables por `q`, `direction`, `status`, `date_from`, `date_to`
- [ ] Responses paginados con `{items, total, limit, offset}`
- [ ] Endpoint `GET /search` global
- [ ] SearchBar reutilizable con debounce 300ms
- [ ] ConversationFilters con search + status + fechas + limpiar
- [ ] Global search dropdown + página `/search`
- [ ] MessageSearchBar en detalle de conversación
- [ ] Keyboard shortcuts: `/` focus, `Escape` clear, `↑↓` navigate
- [ ] Search desactiva polling en mensajes
- [ ] Highlight de términos en resultados
- [ ] Estados: loading, empty ("Sin resultados para X"), error con retry
- [ ] Accesibilidad: aria-label, aria-live, role="listbox"
- [ ] Responsive: filtros apilados en mobile
- [ ] Compatibilidad backward: tests existentes pasan sin cambios
- [ ] Typecheck: 0 source errors
- [ ] Backend tests: ~135/135 pass

---

## Veredicto

**READY FOR IMPLEMENTATION**
