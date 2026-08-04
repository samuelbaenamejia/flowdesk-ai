# F6F — Chat Productivity

## Objetivo

Mejorar la experiencia de mensajería en la pantalla más usada del producto: el detalle de conversación y la lista de conversaciones. Cuatro mejoras concretas:

1. **Búsqueda dentro de la conversación** — encontrar un mensaje por contenido sin salir de la vista de chat.
2. **Agrupación por fecha** — cabeceras sticky ("Hoy", "Ayer", "lun 14 jul") que colapsan/expanden, para orientarse en historiales largos.
3. **Scroll inteligente** — auto-scroll al fondo solo cuando el usuario está al fondo; botón flotante con contador de mensajes nuevos al hacer scroll hacia arriba.
4. **Marcadores de no leídos** — punto y contador de no leídos en la lista de conversaciones; se marca como leído al abrir la conversación.

**Qué problema resuelve:** Un agente en takeover con 20+ conversaciones abiertas pierde el hilo: no puede buscar un mensaje puntual dentro de una conversación larga, se desorienta con historiales de días, el auto-scroll lo "jalonea" cuando hace scroll hacia atrás, y no sabe qué conversaciones tienen mensajes nuevos del cliente sin abrirlas una por una.

**Fuente del scope:** `docs/F6-IMPLEMENTATION-PLAN-v2.md` → sección F6F (PR 6F.1 "Message Search + Date Grouping", PR 6F.2 "Scroll Behavior + Unread Markers"). Dependencias declaradas: F6A (pagination, toast, error boundaries) y F6D (inbox search) — ambas completas. F6E (Dashboard) no es requerida por F6F.

---

## Diagnóstico

### Backend — estado actual

| Endpoint / flujo | Estado | Limitación para F6F |
|---|---|---|
| `GET /conversations/{id}/messages?q=` | ✅ Implementado en F6D (filtros `q`, `direction`, `status`, `date_from`, `date_to`, `after`; response paginado `{items,total,limit,offset}`; orden asc; `total` disponible) | Ninguna. La búsqueda dentro de conversación **ya tiene endpoint** — el plan v2 la pedía como trabajo de backend, pero F6D lo adelantó. Solo falta la UX de frontend. |
| `GET /conversations` | ✅ F6D: filtros + paginación + `total` | Falta exponer `unread_count` en el response. |
| `GET /conversations/{id}` | ✅ Detalle | Falta exponer `unread_count`. |
| Webhook `_process_message` (incoming) | ✅ Persiste mensaje + actualiza `last_message_at` en el mismo commit (atómico) | No incrementa contador de no leídos. |
| Envío outgoing (`send_outgoing_message`) | ✅ | No debe afectar no leídos (mensajes propios). |
| Modelo `Conversation` | `id, contact_id, status, last_message_at, created_at, updated_at` | Sin columna de no leídos. |
| Migraciones Alembic | 10 archivos, patrón `xxx_name.py` | Nueva migración requerida (única en F6F). |

**Nota:** el endpoint de búsqueda del plan (PR 6F.1 backend: `GET /conversations/{id}/search`) **no se implementa**: F6D ya cubre el caso con `q` en el endpoint de mensajes, con `total` para el contador de resultados. Añadir un endpoint nuevo duplicaría lógica. Se documenta como desviación justificada del plan.

### Frontend — estado actual

| Componente | Estado | Limitación para F6F |
|---|---|---|
| `pages/conversations/[id].tsx` | ✅ Conecta `useConversation` + `useMessages`, header, `MessageFilters`, `MessageList`, `Composer` | Sin atajos de teclado de chat; sin marcar como leído al abrir; sin track de near-bottom. |
| `useMessages` | ✅ F6D: `search` con debounce 300ms, **polling pausado cuando hay filtros activos**, `total`, `hasMore`, `loadMore` | Reutilizable tal cual para búsqueda in-conversación. Sin near-bottom tracking. |
| `MessageList` | ✅ Auto-scroll al fondo en carga inicial y mensajes nuevos; preserva posición en load-more; `searchActive` desactiva auto-scroll; deep-link `?msg=` con highlight | Auto-scroll **incondicional** (jalonea si el usuario hizo scroll arriba); sin agrupación por fecha; sin highlight del término buscado. |
| `MessageBubble` | ✅ `data-message-id`, ring highlight (deep-link), hora, estado | Sin render de `<mark>` para términos buscados. |
| `MessageFilters` | ✅ F6D: search + direction + status + fechas + limpiar (visible siempre) | Search no abrible por Ctrl+F; sin contador de resultados; sin hint visual del shortcut. |
| `Composer` | ✅ Enter envía, Shift+Enter nueva línea, autosize, error inline | Sin Ctrl+Enter como alias de envío. |
| `ConversationTable` | ✅ Lista con estado, preview, empty states, hover, click → detalle | Sin punto/contador de no leídos. |
| `useConversations` | ✅ F6D: filtros + polling + `total` | La fila no refleja no leídos (no viene del API). |
| `lib/api.ts` | ✅ Cliente tipado con AbortController | Falta `markConversationRead()`. |

---

## Objetivos

### Funcionales

- **F1.** Ctrl+F (o Cmd+F) en el detalle de conversación abre/enfoca la búsqueda dentro de los mensajes; Escape la cierra.
- **F2.** Al buscar, los mensajes coincidentes muestran el término resaltado con `<mark>`; se muestra "X resultados"; el polling queda pausado mientras la búsqueda está activa.
- **F3.** Los mensajes se agrupan por día con cabecera sticky: "Hoy", "Ayer", día de la semana (si está en la semana actual), "14 jul", y "14 jul 2025" si no es el año actual.
- **F4.** Las cabeceras de grupo son clicables y colapsan/expanden el grupo; colapsado muestra resumen "12 mensajes · 14 jul".
- **F5.** Auto-scroll al fondo solo cuando el usuario está cerca del fondo (<120 px); si hizo scroll arriba, no se mueve la vista con mensajes nuevos.
- **F6.** Botón flotante "scroll to bottom" aparece al hacer scroll arriba, con badge del número de mensajes nuevos recibidos desde que dejó el fondo; click → scroll suave y resetea badge.
- **F7.** La lista de conversaciones muestra un punto azul y contador (hasta "99+") en filas con mensajes no leídos.
- **F8.** Abrir una conversación la marca como leída (API + estado local optimista); el contador de la lista se limpia en el siguiente poll.
- **F9.** Ctrl+Enter envía el mensaje (alias de Enter, que ya envía); Shift+Enter sigue siendo nueva línea.

### No funcionales

- **NF1.** Cero dependencias nuevas (frontend y backend).
- **NF2.** Backward compatible: ningún parámetro o campo existente se elimina ni modifica; solo se añaden.
- **NF3.** Rendimiento: contador de no leídos O(1) por operación; agrupación y resaltado en cliente O(n) sin reflows; sin índices nuevos.
- **NF4.** Accesibilidad: cabeceras de grupo como botones accesibles, `<mark>` semántico, `aria-live` para contador de resultados, FAB con `aria-label`.
- **NF5.** Responsive: FAB y grupos funcionan en 375/768/1280 px.
- **NF6.** Dark mode: todos los componentes nuevos respetan `dark:`.
- **NF7.** Calidad: tests backend y frontend completos por PR, tsc 0 errores en `src`, sin TODO/FIXME/debug.

---

## Arquitectura propuesta

### Backend

#### Cambio de esquema (justificado)

Se agrega una columna a `conversations`:

| Columna | Tipo | Default | Propósito |
|---|---|---|---|
| `unread_count` | `INTEGER` | `0` (NOT NULL) | Nº de mensajes entrantes no leídos. |

**Justificación (requisito: solo si está plenamente justificado):**
- El indicador de no leídos es un criterio de aceptación explícito del plan (PR 6F.2, criterios 4 y 5) y no existe ningún dato en el esquema que permita derivarlo.
- Alternativas descartadas:
  - **Derivar con `COUNT(messages WHERE created_at > last_read_at)`**: requiere igualmente una columna (`last_read_at`) y convierte cada render de la lista en un COUNT por conversación (N+1 o agregación pesada). El producto es de **usuario único** (FlowDesk-AI es single-agent), así que el contador denormalizado no tiene problemas de multi-usuario ni de permisos.
  - **Sin backend, todo en cliente**: no persiste entre sesiones/dispositivos y no refleja los mensajes entrantes del webhook cuando el agente no tiene la app abierta.
- **Atomicidad:** el webhook persiste `Message` + toca `Conversation` en el mismo commit; el incremento es transaccional con la inserción del mensaje (sin ventanas de drift).
- **Corrección del drift:** el único estado de entrada es el webhook (incremento); el único reset es el endpoint de lectura. Ambos son atómicos. Un mensaje entrante +1 y una lectura = 0: el contador siempre es exacto por definición operacional.
- **Migración:** 1 migración Alembic (`add_unread_count_to_conversations`, `server_default="0"` + `nullable=False` → los registros existentes quedan en 0). Costo mínimo.

#### Lógica de no leídos

```
webhook (incoming)  ──►  _process_message: conversation.unread_count += 1   (mismo commit que el Message)
GET /conversations       response incluye unread_count por fila
GET /conversations/{id}  response incluye unread_count
POST /conversations/{id}/read  →  unread_count = 0  (204 No Content)
```

- Los mensajes **outgoing** (envío manual del agente) **no** incrementan el contador: solo entrantes del cliente.
- Conversaciones en `closed` no reciben mensajes nuevos (comportamiento actual del webhook: solo busca `active`/`human_takeover`) → el contador no puede crecer en cerradas.

#### Endpoints

| Endpoint | Cambio |
|---|---|
| `GET /conversations` | Response: campo `unread_count` añadido a cada ítem. Nada más cambia. |
| `GET /conversations/{id}` | Response: campo `unread_count` añadido. |
| `POST /conversations/{id}/read` | **NUEVO** — `204 No Content`; 404 si la conversación no existe; requiere JWT (patrón de los demás). Idempotente. |
| `GET /conversations/{id}/messages` | **Sin cambios** (F6D ya soporta `q`). |
| Webhook interno | Comportamiento: incremento de `unread_count` en `_process_message`. |

**¿Por qué endpoint dedicado y no `PATCH /conversations/{id}`?** `PATCH` existe para cambiar `status` con semántica de update parcial; "marcar leído" es una acción (idempotente, sin body) y un endpoint dedicado expresa la intención, evita tocar el schema de `ConversationUpdate` y permite optimismo simple en el cliente.

### Frontend

#### Componentes nuevos

| Componente | Ruta | Responsabilidad |
|---|---|---|
| `DateGroup.tsx` | `components/conversations/` | Cabecera sticky + colapso/expansión de grupo de mensajes de un día. |
| `FloatingScrollButton.tsx` | `components/conversations/` | FAB "ir al fondo" con badge de mensajes nuevos (aparece solo al scroll arriba, en modo normal, no en búsqueda). |

#### Componentes modificados

| Componente | Cambio |
|---|---|
| `MessageList.tsx` | Agrupa por fecha (modo normal) vía `DateGroup`; pasa término a `MessageBubble` para `<mark>`; auto-scroll condicional por near-bottom; expone callback de near-bottom; en modo búsqueda: vista plana (sin grupos). |
| `MessageBubble.tsx` | Prop `highlightTerm?: string` → renderiza `<mark>` (texto escapado, case-insensitive, todos los matches). |
| `MessageFilters.tsx` | Search enfocable por Ctrl+F; contador "X de Y resultados" cuando hay búsqueda; hint `<kbd>Ctrl+F</kbd>`. |
| `ConversationTable.tsx` | Punto azul + badge `unread_count` (99+). |
| `Composer.tsx` | Ctrl+Enter como alias de envío. |
| `pages/conversations/[id].tsx` | Marca como leído al montar (con fallback silencioso); integra shortcuts (Ctrl+F, Escape); track de near-bottom; render de FAB. |

#### Hooks

| Hook | Cambio |
|---|---|
| `useMessages.ts` | Sin cambios (ya tiene search + pausa de polling + `total`). |
| `useConversations.ts` | Sin cambios (los no leídos llegan en el type). |
| `useChatShortcuts.ts` | **NUEVO** (`hooks/useChatShortcuts.ts`) — registra/desregistra Ctrl+F / Cmd+F (preventDefault del find del navegador) y Escape en el contexto del detalle. Devuelve `{ searchOpen, setSearchOpen, searchInputRef }`. |

#### Flujo de no leídos (frontend)

```
ConversationTable (lista, polling 5-10s)          pages/conversations/[id].tsx
  row.unread_count > 0 ─► dot + badge                    mount ─► markConversationRead(id)
  click fila ─► push /conversations/{id}                  (optimista: limpia badge local)
                                                          fallback: reintento silencioso si falla
  vuelta a la lista ─► poll actualiza fila (unread 0)
```

- El refresco de la lista ya existe (polling de `useConversations`); no se añade lógica nueva de sincronización.
- **Mientras la conversación está abierta:** los entrantes nuevos no se acumulan en el contador servidor (se marcó leído al abrir); aparecen en el chat vía polling y, si el agente subió arriba, el FAB cuenta los nuevos **desde que dejó el fondo** (delta local, no servidor). Ambos contadores son independientes por diseño: el servidor responde "¿hay algo sin ver?"; el FAB responde "¿llegaron mensajes mientras no miraba el fondo?".

## UX

### Búsqueda dentro de la conversación

```
┌──────────────────────────────────────────────────────────────┐
│ ← Volver   Juan Pérez            [Activa] [Takeover/Humano]   │
│ 🔍 Buscar en mensajes...   [✕]   3 resultados   [Ctrl+F]      │
├──────────────────────────────────────────────────────────────┤
│ User: ¿cómo va mi <mark>pedido</mark>?              14:30     │
│ Bot: El <mark>pedido</mark> llega mañana…             14:31    │
│ (los mensajes que no coinciden no se muestran)                │
└──────────────────────────────────────────────────────────────┘
```

- El campo de búsqueda ya existe en `MessageFilters` (F6D); F6F lo convierte en *modo búsqueda*: Ctrl+F lo enfoca, al tipear se muestra el contador "X de Y" (usa `total` del API) y los términos se resaltan.
- Escape limpia y restaura; ✕ cierra el modo.
- El polling sigue pausado con filtros activos (comportamiento F6D existente, sin cambios).

### Agrupación por fecha

```
┌──────────────────────────────────────────────────────────────┐
│ ▾ Hoy                                    (sticky, azul tenue) │
│  User: ¿qué día llega el pedido?                  14:30       │
│  Bot: Mañana antes de las 11.                         14:31    │
│ ▸ Ayer                                      (colapsado)       │
│ ▾ lun 14 jul                                                 │
│  User: Gracias                                         09:02   │
└──────────────────────────────────────────────────────────────┘
```

| Etiqueta | Condición |
|---|---|
| "Hoy" | misma fecha local |
| "Ayer" | día anterior |
| "lun 14 jul" (dd MMM) | cualquier otra fecha del año actual |
| "14 jul 2025" (dd MMM yyyy) | año distinto al actual |

- Zonas horarias: el backend entrega `created_at` en UTC ISO; la agrupación se calcula en **hora local del navegador** (el agente "ve" sus días locales).
- Cabeceras sticky con `position: sticky; top: 0` dentro del contenedor scrollable.
- Click en la cabecera colapsa/expande (estado por fecha, `aria-expanded`). Colapsado: fila resumen "N mensajes · 14 jul".
- Colapso y load-more: al cargar mensajes más antiguos entran grupos nuevos por arriba; el estado de colapso de los grupos ya existentes se conserva (key por fecha).
- En modo búsqueda no hay grupos: la vista es plana (resultados).

### Scroll inteligente + FAB

```
                    ┌─────┐
  (arriba, hay      │  ↓  │  ← FloatingScrollButton
   mensajes nuevos) │ 3   │    (badge = nuevos desde que dejó el fondo)
                    └─────┘
  ┌───────────────────────────┐
  │ ...mensajes...            │
  │ (al fondo: sin botón)     │
  └───────────────────────────┘
```

- **Near-bottom:** `scrollTop + clientHeight >= scrollHeight - 120`.
- Auto-scroll al fondo: solo en carga inicial (primeros mensajes) y cuando el usuario está near-bottom al llegar mensajes nuevos (polling). Si no está near-bottom: **no** se mueve la vista; el FAB aparece con badge.
- El badge del FAB cuenta los mensajes entrantes nuevos recibidos desde la última vez que el usuario estuvo al fondo (contador local, reseteado al hacer click o al volver al fondo).
- El FAB se oculta en modo búsqueda (no hay auto-scroll en resultados).
- "Cargar más mensajes" conserva la posición de scroll (comportamiento F6D existente, se mantiene intacto).

### No leídos en la lista

```
│ ● Juan Pérez   Activa    ¿cómo va el pedido…?   hace 5m   [3] │
│   María García Takeover  ok                         1h        │
```

- Punto azul `●` + badge con el número (`99+` si > 99) en la fila cuando `unread_count > 0`.
- Al abrir la conversación: `markConversationRead` en mount (idempotente, fallo silencioso con reintento) + limpieza optimista local.

### Atajos de teclado

| Atajo | Acción | Contexto |
|---|---|---|
| `Ctrl+F` / `Cmd+F` | Abrir/enfocar búsqueda en mensajes (previene el find del navegador) | Detalle de conversación |
| `Escape` | Cerrar búsqueda (limpia y restaura vista normal) | Búsqueda activa |
| `Enter` | Enviar mensaje | Composer |
| `Ctrl+Enter` / `Cmd+Enter` | Enviar mensaje (alias) | Composer |
| `Shift+Enter` | Nueva línea | Composer |
| `/` | Search global (existente F6D, sin cambios) | Global |

### Responsive

| Breakpoint | FAB | Grupos | Search |
|---|---|---|---|
| ≥1024px | Inferior derecha del área de mensajes | Sticky dentro del scroll | Fila de filtros existente |
| 768–1023px | Igual | Igual | Igual |
| <768px | Igual, con margen seguro sobre el Composer | Igual | Igual |

### Accesibilidad

- Cabeceras de grupo: `<button>` real con `aria-expanded`; estado colapsado anunciado.
- `<mark>` semántico para términos buscados (no solo color).
- Contador de resultados con `aria-live="polite"`.
- FAB: `aria-label="Ir al final y ver mensajes nuevos"`, focusable, respeta `prefers-reduced-motion` (sin scroll suave en ese caso).
- Badges de no leídos: `aria-label` descriptivo ("3 mensajes no leídos"); el punto decorativo `aria-hidden`.

---

## Performance

| Aspecto | Evaluación |
|---|---|
| **No leídos** | Contador denormalizado: incremento y reset O(1), atómicos con el commit existente del webhook. Sin índices nuevos. |
| **Lista de conversaciones** | `unread_count` es una columna de la fila: cero joins extra, cero coste adicional. |
| **Agrupación por fecha** | Cálculo en cliente O(n) por render con `useMemo` keyed por `messages`; cabeceras sticky sin JS de posición (CSS puro). |
| **Highlight de búsqueda** | Regex con escape de caracteres especiales, case-insensitive; se renderiza una vez por mensaje con `<mark>`; listas típicas < 500 mensajes. |
| **Near-bottom / FAB** | Listener `scroll` con throttling por `requestAnimationFrame`; sin reflow (solo lectura de scrollTop/scrollHeight y escritura de estado). |
| **Búsqueda in-conversación** | Reutiliza el endpoint de F6D: sin round-trips extra; debounce 300ms ya implementado; `total` ya viene en la respuesta. |
| **Polling** | Pausado con filtros activos (F6D). El FAB badge es un delta local, no un request adicional. |

---

## Compatibilidad

| Fase | Afectado? | Detalle |
|---|---|---|
| **F5A** (Webhooks + AI) | Compatible | El webhook solo gana un incremento de contador en el mismo commit existente. Groq sin cambios. |
| **F5B** (Inbox / conversaciones) | Compatible | `GET /conversations` y `GET /conversations/{id}` **añaden** un campo al response. Ningún campo existente cambia. |
| **F5C** (Status management) | Compatible | `PATCH /conversations/{id}` sin cambios. |
| **F5D** (N8N) | Compatible | Endpoints `/internal/*` y notificación a n8n sin cambios. |
| **F6A** (Auth/Toast) | Compatible | Auth sin cambios; el nuevo endpoint sigue el patrón `get_current_user`. |
| **F6B** (Contacts) | Compatible | Contact service sin cambios. |
| **F6C** (Profile) | Compatible | Sin cambios. |
| **F6D** (Inbox Search) | Compatible | El endpoint de mensajes con `q` se **reutiliza** (no se duplica). Los filtros y el debounce de `useMessages` se usan tal cual. |
| **F6E** (Dashboard) | Compatible | Dashboard sin cambios. `ConversationTable` se modifica (badge), usado también por `/dashboard` con los mismos props — cambio aditivo y opcional. |
| **Tests existentes** | Compatible | Tests de mensajes/conversaciones siguen pasando; el campo nuevo es opcional en el type de frontend. |

**Aditividad estricta:** solo se añade una columna (con default), un campo por response, un endpoint nuevo y props/comportamientos nuevos en componentes. No se elimina ni renombra nada.

---

## Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| **Drift del contador `unread_count`** | Baja | Medio | Incremento y reset atómicos con operaciones existentes (mismo commit). Tests del webhook verifican +1 por mensaje entrante y 0 tras lectura. |
| **Múltiples pestañas abiertas** | Media | Bajo | Marcar leído es idempotente; el poll de la lista refleja el estado servidor en ≤10s. Sin lógica de pestañas (producto single-agent). |
| **RegExp de highlight con caracteres especiales** | Media | Bajo | Escape previo (`escapeRegExp`) antes de construir el patrón; fallback a texto plano si el patrón falla. |
| **Auto-scroll "jalonea" al usuario** | Alta (riesgo UX) | Medio | Near-bottom obligatorio para auto-scroll con mensajes nuevos; el FAB es la salida cuando el usuario está arriba. |
| **Sticky headers con colapso en Safari** | Baja | Bajo | `position: sticky` con contenedor scrollable directo (patrón soportado); verificación manual en Safari. |
| **Colapso + load-more inconsistente** | Media | Bajo | Estado de colapso keyed por fecha; al cargar más, los grupos existentes conservan su estado; los nuevos nacen expandidos. |
| **FAB superpuesto al Composer en mobile** | Media | Bajo | Posicionamiento absoluto dentro del área de mensajes (no del viewport); margen inferior seguro. |
| **Mark-read antes de que cargue la conversación** | Baja | Bajo | Se dispara en mount con el id de la URL (no depende del fetch de la conversación); 404/error se tragan silenciosamente. |
| **SQL injection / XSS en highlight** | Ninguna | — | `ilike()` con parámetros en backend; en frontend, `<mark>` recibe texto escapado por React (no `dangerouslySetInnerHTML`). |

---

## Casos borde

1. **Mensajes con `created_at` idénticos cruzando la medianoche (UTC vs local):** la agrupación usa fecha local del navegador; un mensaje de 23:59 UTC puede caer en el día local anterior — correcto por diseño (el agente ve su día).
2. **Búsqueda con término vacío o solo espacios:** sin fetch (debounce descarta), la vista se mantiene normal.
3. **Búsqueda sin resultados:** EmptyState existente de `MessageList` ("Sin resultados para X") se mantiene.
4. **Grupo colapsado + llegada de mensajes nuevos (polling):** el mensaje nuevo crea/actualiza el grupo de hoy; si "Hoy" está colapsado, el contador del resumen se actualiza (el mensaje no queda invisible — el resumen muestra el conteo).
5. **Deep-link `?msg=` (F6D) + grupos:** el scroll al mensaje funciona igual (los grupos son contenedores, el `data-message-id` se conserva); el grupo que contiene el mensaje se expande automáticamente si estaba colapsado.
6. **Load-more con búsqueda activa:** `hasMore`/`loadMore` se comportan como en F6D; los resultados paginan igual (sin grupos).
7. **Conversación cerrada con mensajes entrantes:** no ocurre (el webhook solo toca `active`/`human_takeover`) — el contador no crece en cerradas.
8. **`unread_count` muy alto:** badge "99+" (truncado).
9. **Mark-read sobre conversación inexistente:** 404 silencioso en el cliente (no rompe la navegación).
10. **FAB con `prefers-reduced-motion`:** scroll instantáneo en lugar de suave.
11. **Navegación rápida lista ↔ detalle:** el mount del detalle dispara mark-read una sola vez por apertura; el poll de la lista (5s) actualiza el badge — sin carreras porque el endpoint es idempotente.
12. **Ctrl+F con el foco dentro del Composer:** el atajo se intercepta a nivel de página; si el usuario está escribiendo y quiere el find nativo, hay `Escape` para cerrar (decisión: priorizar búsqueda in-chat, documentada).

---

## Estrategia de pruebas

### Backend (pytest, `tests/`)

| Archivo | Casos nuevos |
|---|---|
| `tests/test_conversations.py` | `unread_count` presente en list (default 0); presente en detail; no rompe filtros existentes |
| `tests/test_conversations_read.py` | **NUEVO** — mark-read resetea a 0; idempotente (doble llamada); 404 si no existe; requiere auth |
| `tests/test_webhooks.py` | Mensaje entrante en conversación existente → +1; conversación nueva → 1; entrante en `human_takeover` → +1; mensaje outgoing **no** incrementa; doble entrante → 2 |

Objetivo: 156 → **~172 tests**.

### Frontend (vitest)

| Suite | Casos |
|---|---|
| `DateGroup.test.tsx` | Etiquetas (Hoy/Ayer/dd MMM/dd MMM yyyy), colapso/expansión con `aria-expanded`, resumen colapsado, estado persistente por fecha |
| `MessageList.test.tsx` (extendido) | Agrupación correcta por fecha local, grupos expandidos por defecto, vista plana con búsqueda activa, auto-scroll solo near-bottom, deep-link expande su grupo |
| `MessageBubble.test.tsx` (extendido) | `<mark>` por término (case-insensitive, múltiples matches, caracteres especiales), sin `dangerouslySetInnerHTML` |
| `FloatingScrollButton.test.tsx` | Visible con badge, oculto near-bottom, click → callback, oculto en búsqueda, `aria-label` |
| `ConversationTable.test.tsx` (extendido) | Badge con `unread_count>0`, "99+", sin badge con 0 |
| `useChatShortcuts.test.tsx` | Ctrl+F previene default y abre search, Escape cierra, cleanup de listeners |
| `Composer.test.tsx` (extendido) | Ctrl+Enter envía; Shift+Enter no envía |
| `pages/conversation-detail.test.tsx` (extendido) | mark-read en mount, fallback silencioso, FAB render, contador de resultados |

Objetivo: 266 → **~300 tests**.

### Verificación transversal por PR

- pytest completo · vitest completo · `tsc --noEmit` (0 errores en `src` fuera de tests) · grep del diff sin TODO/FIXME/debugger/console.log · `git diff --check`.

## Roadmap interno

### PR 6F.1 — Backend: Unread support (migración + endpoint + webhook)

**Objetivo:** persistir el estado de no leídos y exponerlo por API.

**Archivos:**

| Archivo | Cambio |
|---|---|
| `backend/alembic/versions/<rev>_add_unread_count_to_conversations.py` | **NUEVO** — columna `unread_count INTEGER NOT NULL DEFAULT 0` |
| `backend/app/models/conversation.py` | **MODIFICADO** — `unread_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)` |
| `backend/app/schemas/conversation.py` | **MODIFICADO** — `unread_count: int` en `ConversationResponse` y en el item de `ConversationListResponse` |
| `backend/app/api/v1/conversations.py` | **MODIFICADO** — `POST /conversations/{id}/read` → `204` (set `unread_count = 0`, commit; 404 si no existe) |
| `backend/app/api/v1/webhooks.py` | **MODIFICADO** — `_process_message`: `conversation.unread_count = conversation.unread_count + 1` (mismo commit) |
| `backend/tests/test_conversations.py` | **MODIFICADO** — asserts de `unread_count` en list/detail |
| `backend/tests/test_conversations_read.py` | **NUEVO** — mark-read: reset, idempotencia, 404, auth |
| `backend/tests/test_webhooks.py` | **MODIFICADO** — casos de incremento (+1 existente, 1 nueva, no en outgoing, acumulación) |

**Criterios de aceptación:**
- `GET /conversations` y `GET /conversations/{id}` incluyen `unread_count` (0 por defecto)
- Entrante por webhook → +1; conversación nueva → 1; outgoing → sin cambio
- `POST /conversations/{id}/read` → 204 y contador a 0; repetido → 204 (idempotente); inexistente → 404; sin token → 401
- Migración aplica limpia sobre datos existentes (registros quedan en 0)
- pytest completo verde (156 + ~16 nuevos)

**Esfuerzo:** ~300 líneas (migración 25, modelo 3, schemas 6, endpoint 25, webhook 2, tests ~240).

---

### PR 6F.2 — Frontend: Búsqueda in-conversación + agrupación por fecha

**Objetivo:** modo búsqueda con highlight y grupos de fecha colapsables.

**Archivos:**

| Archivo | Cambio |
|---|---|
| `frontend/src/components/conversations/DateGroup.tsx` | **NUEVO** — cabecera sticky (etiqueta relativa/absoluta), colapso/expansión, resumen "N mensajes · fecha" |
| `frontend/src/components/workspace/MessageBubble.tsx` | **MODIFICADO** — prop `highlightTerm` → `<mark>` (escape regex, case-insensitive, múltiples matches) |
| `frontend/src/components/workspace/MessageList.tsx` | **MODIFICADO** — agrupa por fecha local (`useMemo`), sticky headers, auto-expande el grupo del deep-link, vista plana en búsqueda, mantiene auto-scroll/load-more actuales |
| `frontend/src/components/workspace/MessageFilters.tsx` | **MODIFICADO** — contador "X de Y resultados" (usa `total`), hint `<kbd>Ctrl+F</kbd>` |
| `frontend/src/pages/conversations/[id].tsx` | **MODIFICADO** — integra `useChatShortcuts` (Ctrl+F enfoca search, Escape cierra), pasa `searchQuery` a `MessageList` para highlight |
| `frontend/src/hooks/useChatShortcuts.ts` | **NUEVO** — registro de Ctrl+F/Cmd+F (preventDefault) + Escape; cleanup en unmount |
| `frontend/src/hooks/index.ts` | **MODIFICADO** — exporta `useChatShortcuts` |

**Criterios de aceptación:**
- Ctrl+F enfoca el search sin abrir el find del navegador; Escape restaura la vista
- Al buscar: contador "X de Y", términos con `<mark>` en los mensajes visibles, polling pausado (ya existe)
- Mensajes agrupados por día: "Hoy", "Ayer", "14 jul", "14 jul 2025" (hora local)
- Click en cabecera colapsa/expande; resumen con conteo; estado conservado al cargar más
- Deep-link `?msg=` con grupo colapsado: el grupo se expande y el mensaje se centra
- vitest completo verde (266 + ~22 nuevos) · tsc 0 errores

**Esfuerzo:** ~450 líneas (DateGroup 110, MessageList 120, MessageBubble 40, MessageFilters 40, shortcuts 40, página 30, tests ~170).

---

### PR 6F.3 — Frontend: Scroll inteligente + no leídos (UI) + atajos

**Objetivo:** auto-scroll condicional, FAB con badge y badges de no leídos en la lista.

**Archivos:**

| Archivo | Cambio |
|---|---|
| `frontend/src/components/conversations/FloatingScrollButton.tsx` | **NUEVO** — FAB con badge, `aria-label`, `prefers-reduced-motion`, oculto en búsqueda |
| `frontend/src/types/index.ts` | **MODIFICADO** — `Conversation.unread_count: number` |
| `frontend/src/lib/api.ts` | **MODIFICADO** — `markConversationRead(id)` → `POST /conversations/{id}/read` (204) |
| `frontend/src/components/dashboard/ConversationTable.tsx` | **MODIFICADO** — punto + badge de no leídos (99+) con `aria-label` |
| `frontend/src/components/workspace/Composer.tsx` | **MODIFICADO** — Ctrl+Enter/Cmd+Enter como alias de envío |
| `frontend/src/components/workspace/MessageList.tsx` | **MODIFICADO** — near-bottom tracking (rAF), auto-scroll solo si near-bottom, callback `onNearBottomChange` |
| `frontend/src/pages/conversations/[id].tsx` | **MODIFICADO** — `markConversationRead` en mount (silencioso, reintento), FAB render + badge local (delta desde que dejó el fondo), reseteo al volver al fondo |

**Criterios de aceptación:**
- Abrir conversación la marca leída (dot de la lista desaparece en ≤1 poll)
- Mensajes nuevos con el usuario arriba: la vista no se mueve, FAB aparece con el conteo de nuevos
- Click en FAB: scroll suave al fondo y badge reseteado; en reduced-motion, scroll instantáneo
- FAB oculto al estar en el fondo y en modo búsqueda
- Ctrl+Enter envía; Enter sigue enviando; Shift+Enter es nueva línea
- `unread_count` tipado; badge "99+" para >99
- vitest completo verde (266 + ~12 nuevos) · tsc 0 errores

**Esfuerzo:** ~400 líneas (FAB 90, MessageList 60, página 70, api/types 25, ConversationTable 30, Composer 10, tests ~115).

---

## Estimación total

| PR | Líneas aprox. | Dominio |
|---|---|---|
| PR 6F.1 — Backend unread | ~300 | Backend |
| PR 6F.2 — Search UX + DateGroup | ~450 | Frontend |
| PR 6F.3 — Scroll + unread UI + atajos | ~400 | Frontend |
| **Total** | **~1.150** | |

Comparación con el plan v2: ~750 líneas estimadas para F6F (PR 6F.1 ~400 + PR 6F.2 ~350). El diseño agrega ~400 líneas por: backend de no leídos (no estimado en el plan, que lo daba por supuesto) y tests explícitos por componente. La cobertura de tests por PR (~50% del esfuerzo) sigue el estándar F6D/F6E.

---

## Checklist

- [ ] Migración `unread_count` (server_default 0, NOT NULL) aplica en Postgres y SQLite
- [ ] `GET /conversations` y `GET /conversations/{id}` exponen `unread_count`
- [ ] `POST /conversations/{id}/read` (204, idempotente, 404, JWT)
- [ ] Webhook: +1 por entrante (existente y nueva), sin cambio en outgoing
- [ ] Ctrl+F/Cmd+F abre búsqueda en mensajes (sin find nativo); Escape cierra
- [ ] Contador "X de Y" y `<mark>` en resultados (escape seguro)
- [ ] DateGroup: Hoy/Ayer/dd MMM/dd MMM yyyy (hora local), sticky, colapsable, resumen
- [ ] Auto-scroll solo near-bottom; FAB con badge; oculto en búsqueda y en el fondo
- [ ] Badge de no leídos en lista (99+); mark-read en mount del detalle
- [ ] Ctrl+Enter envía; Shift+Enter nueva línea
- [ ] `aria-expanded` en grupos, `aria-live` en contador, `aria-label` en FAB/badges
- [ ] Dark mode y responsive (375/768/1280) en componentes nuevos
- [ ] Compatibilidad: tests existentes pasan sin cambios
- [ ] Backend: ~172/172 · Frontend: ~300/300 · tsc 0 errores · sin TODO/FIXME/debug

---

## Veredicto

**READY FOR IMPLEMENTATION**

