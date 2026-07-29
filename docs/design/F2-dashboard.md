# F2 — Dashboard (Lista de Conversaciones)

## 1. Objetivo

### Qué resuelve

- La página de conversaciones actual (`pages/conversations/index.tsx`) usa HTML nativo (`<table>`, `<select>`, `<button>`) en vez del design system de F1.
- No hay separación entre lógica de datos y presentación: el fetch, filtro y paginación están en el mismo componente de página (211 líneas).
- No hay hook `useConversations` reutilizable — F3 necesitará la misma lógica.
- Los estados loading/empty/error están implementados inline con estilos arbitrarios, no con los componentes de F1.
- No hay accesibilidad (foco, aria, teclado).
- No hay indicadores visuales que diferencien estados sin leer texto.

### Qué NO resuelve

- El workspace de conversación con chat bubbles y composer (F3).
- El envío de mensajes desde el dashboard.
- La paginación infinita o virtualización (F4 si es necesario).
- El dark mode (F4).
- El responsive completo más allá de 768px (F4).

---

## 2. Alcance

### Componentes nuevos

| Componente | Ruta | Justificación |
|-----------|------|---------------|
| `ConversationTable` | `src/components/dashboard/ConversationTable.tsx` | Tabla que envuelve `Table` de F1 y maneja: mapeo `Conversation → fila`, variante de Badge según status, texto de EmptyState contextual, y formateo de fecha/hora. La página no conoce la estructura interna de las filas. |
| `ConversationsFilter` | `src/components/dashboard/ConversationsFilter.tsx` | Filtro por estado con <select> accesible |
| `Pagination` | `src/components/dashboard/Pagination.tsx` | Navegación anterior/siguiente con indicador de rango, exclusivo para F2 |

### Hooks nuevos

| Hook | Ruta | Justificación |
|------|------|---------------|
| `useConversations` | `src/hooks/useConversations.ts` | Encapsula fetch, filtro, paginación, loading, error. Exclusivo para F2. |
| `index.ts` (actualizar) | `src/hooks/index.ts` | Barrel export para `useConversations` |

### Componentes reutilizados de F1

| Componente | Uso en F2 |
|-----------|-----------|
| `Table` | Usado dentro de `ConversationTable` con headers predefined + onRowClick |
| `Badge` | Estado de cada conversación (active→success, human_takeover→warning, closed→default, cualquier otro→default). El fallback a `default` garantiza que status desconocidos nunca rompan la UI |
| `Skeleton` | State loading (variant="row", 5 filas) |
| `EmptyState` | State vacío, usado dentro de `ConversationTable` (icon=Inbox, título y descripción varían según statusFilter) |
| `ErrorState` | State error (message dinámico + onRetry), usado en la página |
| `Button` | Botones Anterior/Siguiente en paginación (variant="secondary"), deshabilitados durante loading |
| `Sidebar` | Sin cambios |
| `Header` | Sin cambios |
| `AppShell` | Sin cambios |

### Archivos que se modificarán

| Archivo | Cambio |
|---------|--------|
| `frontend/src/pages/conversations/index.tsx` | Refactorizar usando `useConversations` + `ConversationTable` + `ConversationsFilter` + `Pagination` + `ErrorState` |
| `frontend/src/hooks/index.ts` | Agregar export de `useConversations` |
| `frontend/src/lib/index.ts` | Agregar export de `formatRelativeTime` |

### Archivos nuevos

```
frontend/src/
├── components/
│   └── dashboard/
│       ├── ConversationTable.tsx
│       ├── ConversationsFilter.tsx
│       └── Pagination.tsx
├── hooks/
│   └── useConversations.ts
├── lib/
│   └── formatRelativeTime.ts
└── __tests__/
    ├── dashboard/
    │   ├── ConversationTable.test.tsx
    │   ├── ConversationsFilter.test.tsx
    │   └── Pagination.test.tsx
    └── hooks/
        └── useConversations.test.tsx
```

### Scope excluido explícitamente

| Funcionalidad | Motivo | Cuándo evaluar |
|--------------|--------|----------------|
| Sincronización en tiempo real (WebSocket/polling) | La API actual es REST sin eventos. Añadir polling real-time aumentaría el scope y la complejidad del hook. El usuario ve datos frescos al recargar. | Cuando haya métricas de uso que muestren que los agentes necesitan ver nuevas conversaciones sin recargar. Posible F4. |

### Archivos que NO se tocan

- `frontend/src/pages/conversations/[id].tsx` — es F3
- `frontend/src/pages/login.tsx` — no cambia
- `frontend/src/pages/_app.tsx` — no cambia
- `frontend/src/components/layout/*` — no cambia
- `frontend/src/components/ui/*` — no cambia (solo se reusan)
- `frontend/src/lib/api.ts` — no cambia (la API ya soporta status, limit, offset)
- `frontend/src/lib/formatRelativeTime.ts` — se crea nuevo, ver árbol de archivos nuevos
- `frontend/src/types/index.ts` — no cambia
- `frontend/src/contexts/AuthContext.tsx` — no cambia

---

## 3. UX Goals

| Goal | Métrica | Cómo se logra |
|------|---------|---------------|
| Encontrar una conversación | < 5 segundos | Filtro por estado visible sin scroll, tabla con contacto + preview + hora, sin adornos que distraigan |
| Identificar el estado sin leer texto | < 1 segundo | Badge con color semántico: verde=activa, amarillo=takeover, gris=cerrada. El color solo ya comunica el estado |
| Navegación completa por teclado | Sin mouse | Tabindex en filas, Enter para abrir, Tab para filtro/paginación, focus visible en todos los elementos interactivos |
| No perder contexto al filtrar | offset se resetea a 0 | Al cambiar filtro, `useConversations` resetea offset automáticamente. El usuario siempre ve página 1 del nuevo filtro |
| Primera carga clara | < 2 segundos de incertidumbre | Loading state inmediato con Skeletons (sin delay). Empty state descriptivo si no hay datos. Error state con retry si falla |

---

## 4. Visual Hierarchy

| Nivel | Elemento | Estilo | Por qué |
|-------|----------|--------|---------|
| Nivel 1 | Nombre del contacto | `text-sm font-medium text-gray-900` | Es lo que el usuario busca: "¿con quién hablo?" |
| Nivel 1 | Badge de estado | `rounded-full text-xs font-medium` | Debe ser identificable al instante. Misma jerarquía que el nombre porque ambos son decisiones: "¿esta conversación necesita atención?" |
| Nivel 2 | Último mensaje | `text-sm text-gray-500 truncate max-w-xs` | Información de contexto. Menos peso visual porque confirma lo que el nombre sugiere |
| Nivel 3 | Hace cuánto tiempo | `text-sm text-gray-400` | Información temporal. Mínimo peso visual porque es complementaria: "¿sigue siendo relevante?" |
| Nivel 3 | Cantidad de mensajes no leídos | Badge contador (opcional, F4) | No implementado en F2. Se evaluará en F4 si hay métricas de uso que lo justifiquen |

**Regla:** Ninguna fila debe tener más de 2 elementos visualmente competitivos. Badge + Nombre son el par dominante. Preview + Hora son el par secundario.

---

## 5. User Flow

```
1. Usuario abre /conversations
     │
     ├── loading → 5 skeletons (variant="row")
     │
     ├── error → ErrorState + "Reintentar" → retorna a loading
     │
     ├── empty → EmptyState (Inbox icon + "No hay conversaciones")
     │
     └── success → tabla con datos
           │
           ├── 2. Usuario selecciona filtro (Todas/Activas/human_takeover/Cerradas)
           │     └── offset se resetea a 0, tabla se actualiza
           │
           ├── 3. Usuario hace clic en Anterior/Siguiente
           │     └── offset cambia, tabla se actualiza
           │
           └── 4. Usuario hace clic en una fila
                 └── router.push(`/conversations/${id}`) → F3
```

---

## 6. Wireframe ASCII

```
┌──────────────────────────────────────────────────────────────┐
│  Header                                                      │
│  ┌────┐  Conversaciones                    user@mail.com  ── │
│  │    │                                                      │
│  │    │  ┌──────────────────────────────────────────────────┐│
│  │    │  │  Toolbar                                        ││
│  │    │  │  [Filtrar: Todas ▼]                             ││
│  │    │  └──────────────────────────────────────────────────┘│
│  │    │                                                      │
│  │    │  ┌──────────────────────────────────────────────────┐│
│  │    │  │  CONTACTO    │ ESTADO    │ ÚLTIMO MENSAJE    │   ││
│  │    │  ├──────────────┼───────────┼───────────────────────││
│  │    │  │ Juan Pérez   │ [Activa] │ Hola, necesito...  │ 2m││
│  │    │  │ María García │[Takeover]│ Ya le dije que... │ 1h││
│  │    │  │ Carlos López │ [Cerrada] │ Gracias, quedó... │ 2d││
│  │    │  └──────────────────────────────────────────────────┘│
│  │    │                                                      │
│  │    │  ┌──────────────────────────────────────────────────┐│
│  │    │  │  ← Anterior            1-3              Sgte → ││
│  │    │  └──────────────────────────────────────────────────┘│
│  │    │                                                      │
│  └─────┘                                                      │
└──────────────────────────────────────────────────────────────┘
```

### Loading State (5 filas de skeleton)

```
┌──────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────┐│
│  │  ████████████████████████████████████████████████████████ ││
│  │  ████████████████████████████████████████████████████████ ││
│  │  ████████████████████████████████████████████████████████ ││
│  │  ████████████████████████████████████████████████████████ ││
│  │  ████████████████████████████████████████████████████████ ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### Empty State

Dos variantes según el contexto:

**Sin filtro activo (statusFilter = "")**

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                    [Inbox Icon] (h-12 w-12, text-gray-400)   │
│                                                              │
│                   No hay conversaciones                       │
│                                                              │
│              Las conversaciones aparecerán                   │
│              cuando los clientes escriban.                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Con filtro activo (statusFilter = "active", "human_takeover" o "closed")**

El título y descripción se adaptan al filtro. La lógica en la página:

- `statusFilter === "active"` → "No hay conversaciones activas" / "Vuelve más tarde o cambia el filtro"
- `statusFilter === "human_takeover"` → "No hay conversaciones en takeover" / "Ninguna conversación necesita intervención humana"
- `statusFilter === "closed"` → "No hay conversaciones cerradas" / "Todas las conversaciones están abiertas"

### Error State

```
┌──────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────┐│
│  │ [!] Error al cargar conversaciones                       ││
│  │                                                          ││
│  │ No pudimos conectar con el servidor.                     ││
│  │                                                          ││
│  │ [Reintentar]                                             ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

---

## 7. Estados

| Estado | Representación visual | Componente | Condición |
|--------|----------------------|------------|-----------|
| **loading** | 5 skeletons (variant="row") con animate-pulse | `Skeleton` | `loading === true` (fetch inicial o cambio de filtro/página) |
| **success (con datos)** | Tabla con filas, badge, paginación | `Table` + `Badge` + `Pagination` | `!loading && !error && conversations.length > 0` |
| **empty** | EmptyState contextual: título y descripción cambian según `statusFilter` | `EmptyState` | `!loading && !error && conversations.length === 0` |
| **error** | ErrorState con mensaje + botón reintentar | `ErrorState` | `error !== null` |
| **pagination (primera página)** | Botón "Anterior" deshabilitado | `Button (disabled)` | `offset === 0` |
| **pagination (última página)** | Botón "Siguiente" deshabilitado | `Button (disabled)` | `!hasMore` |
| **filter active** | Select con valor distinto de "todas" | `ConversationsFilter` | `statusFilter !== ""` |
| **refreshing** | No aplica en F2 (sin refetch periódico) | — | — |

**Transiciones:**
- `idle → loading`: inmediato, skeletons aparecen
- `loading → success`: fade-in de tabla (sin animación)
- `loading → error`: ErrorState reemplaza skeletons
- `success → loading` (cambio de filtro/página): skeletons reemplazan tabla, sin flash de error intermedio
- `error → loading` (reintentar): skeletons, nuevo fetch

---

## 8. Componentes

### 8.1 ConversationTable

| Aspecto | Definición |
|---------|------------|
| **Responsabilidad** | Envuelve `Table` de F1. Recibe `Conversation[]` y produce las filas listas para renderizar, incluyendo Badge con variante correcta y fecha formateada. También renderiza EmptyState contextual cuando no hay datos. |
| **Props** | `conversations: Conversation[]`, `statusFilter: string`, `onSelectConversation: (id: string) => void`, `loading: boolean` |
| **Estados** | loading (5 skeletons), empty (contextual según statusFilter), success (tabla con filas) |
| **Mapeo de status a Badge** | `active` → `success`, `human_takeover` → `warning`, `closed` → `default`, cualquier otro valor → `default` (fallback). Esto garantiza que status nuevos del backend nunca rompan la UI. |
| **Mapeo de filas** | `headers` fijos: `[{ key: "contact", label: "Contacto" }, { key: "status", label: "Estado" }, { key: "preview", label: "Último mensaje" }, { key: "time", label: "" }]`. La columna `contact` incluye el nombre; `status` incluye el Badge; `preview` incluye `last_message_preview` truncado; `time` incluye la fecha relativa. |
| **Eventos** | `onRowClick` → `onSelectConversation(conversations[i].id)` |
| **Formato de fecha** | Helper `formatRelativeTime` en `@/lib/formatRelativeTime.ts` usando `Intl.RelativeTimeFormat` (nativo, sin dependencias). Si `last_message_at` es `null`, no se renderiza nada en esa celda. |
| **Dependencias** | `Table`, `Badge`, `Skeleton`, `EmptyState` de F1. Helper `formatRelativeTime`. |
| **Tamaño estimado** | ~50 líneas |
| **Accesibilidad** | Hereda `role="button"` y `tabIndex` de `Table`. Los Badges tienen texto visible para screen readers. Las celdas de fecha vacía no renderizan contenido engañoso. |

### 8.2 ConversationsFilter

| Aspecto | Definición |
|---------|------------|
| **Responsabilidad** | Renderizar un <select> con opciones de filtro por estado. Disparar onChange al seleccionar. |
| **Props** | `value: string`, `onChange: (value: string) => void` |
| **Opciones** | `""` → "Todas", `"active"` → "Activas", `"human_takeover"` → "Human Takeover", `"closed"` → "Cerradas" |
| **Estados** | default, focus, disabled (no aplica en F2) |
| **Eventos** | `onChange` — dispara cambio de filtro |
| **Dependencias** | Ninguna (HTML nativo <select> con Tailwind) |
| **Tamaño estimado** | ~20 líneas |
| **Accesibilidad** | `<label htmlFor="status-filter">` + `<select id="status-filter">` con focus-visible ring |

### 8.3 Pagination

La API de conversaciones retorna `Conversation[]` sin metadatos de paginación (no hay `total`). La paginación es orientativa: "hay más resultados si la respuesta tiene tantos elementos como el límite solicitado". El indicador muestra el rango visible sin total ("1-20"), no "1-20 de X".

| Aspecto | Definición |
|---------|------------|
| **Responsabilidad** | Renderizar botones Anterior/Siguiente con indicador de rango visible ("1-20"). Exclusivo para F2; F3 usará su propio componente si lo necesita. |
| **Props** | `offset: number`, `limit: number`, `hasMore: boolean`, `loading: boolean`, `onPrevious: () => void`, `onNext: () => void` |
| **Estados** | idle, first page (`offset === 0`, prev disabled), last page (`!hasMore`, next disabled), **loading** (ambos botones deshabilitados mientras `loading === true` para evitar fetch duplicados) |
| **Eventos** | `onPrevious`, `onNext` |
| **Dependencias** | `Button` de F1 (variant="secondary") |
| **Tamaño estimado** | ~30 líneas |
| **Accesibilidad** | Botones con `aria-label="Página anterior"` / `"Página siguiente"`, `aria-disabled` cuando corresponde, indicador de rango visible como texto no interactivo |

---

## 9. Hooks

### 9.1 useConversations

```typescript
interface UseConversationsReturn {
  conversations: Conversation[];
  loading: boolean;
  error: string | null;
  statusFilter: string;
  offset: number;
  hasMore: boolean;
  setStatusFilter: (value: string) => void;
  handlePrevious: () => void;
  handleNext: () => void;
  retry: () => void;
}
```

| Aspecto | Definición |
|---------|------------|
| **Estado interno** | `conversations`, `loading`, `error`, `statusFilter`, `offset`, `hasMore` |
| **API utilizada** | `getConversations({ status, limit: 20, offset })` de `@/lib/api` |
| **Límite** | `LIMIT = 20`. Justificación: una pantalla de escritorio 1280px muestra ~12-15 filas; pedir 20 cubre la pantalla + un buffer para evitar paginación innecesaria. Suficientemente pequeño para ser rápido, suficientemente grande para minimizar viajes al servidor. |
| **Sorting** | La API ordena por `last_message_at DESC` (implícito en backend). Las conversaciones sin mensaje (`last_message_at = null`) aparecen al final. Si el backend añade sort explícito en el futuro, el hook recibirá el parámetro pero no se implementa en F2. |
| **Efecto** | `useEffect` dispara fetch cuando cambia `statusFilter` o `offset`. Usa `AbortController` para cancelar peticiones en vuelo: si el usuario cambia filtro o página rápidamente, la petición anterior se aborta. El efecto retorna cleanup que aborta. |
| **Refetch on focus** | Segundo `useEffect` suscribe `document.addEventListener("visibilitychange", ...)`. Si la pestaña pasa de oculta a visible, dispara refetch con los mismos parámetros. Esto sin polling, sin WebSocket, sin timer. |
| **Cálculo de hasMore** | `hasMore = conversations.length >= LIMIT`. Como la API no retorna `total`, `has_more` ni `next_cursor`, la heurística es la única opción. El contrato backend actual no expone metadatos de paginación; esto se registra como limitación y se evaluará en un futuro PR de API. |
| **Reseteo** | `setStatusFilter` resetea `offset` a 0 |
| **Manejo de errores** | Catch genérico: `err instanceof Error ? err.message : "Error al cargar conversaciones"`. Ignora errores de AbortController (no se muestran al usuario). |
| **Retry** | `retry()` re-ejecuta el fetch con los mismos parámetros |
| **Tamaño estimado** | ~80 líneas |
| **Test** | Mock de `getConversations`, probar: fetch inicial, cambio de filtro, paginación, error, retry, AbortController (simular cambio rápido de filtro), refetch on focus (simular visibilitychange) |

---

## 10. Accesibilidad

| Aspecto | Implementación |
|---------|---------------|
| **Navegación teclado** | Criterio verificable: (1) Tab navega secuencialmente por filtro → tabla (skip si vacía) → paginación. (2) Enter/Space en filas abre la conversación. (3) Las filas tienen `tabIndex={0}` cuando hay datos. (4) Shift+Tab retrocede correctamente. |
| **Focus management** | Al cambiar filtro, el foco se mantiene en el select (comportamiento nativo). Al cambiar página, el foco se mantiene en los botones de paginación. Al abrir una conversación, el foco pasa al heading del workspace (F3). |
| **aria-live** | Se aplica `aria-live="polite"` en el contenedor que envuelve la tabla/skeleton/empty/error. Anuncia: al cargar → `"Cargando conversaciones"` (una vez al inicio). Al completar → `"5 conversaciones cargadas"` o `"No hay conversaciones"` según el resultado. No anuncia en cambios de página o filtro para evitar spam. Implementación: el texto se inyecta en un `<span>` dentro del contenedor `aria-live` usando un estado derivado. |
| **Contraste** | Badge: green-50/green-700, yellow-50/yellow-700, gray-100/gray-700. Todos cumplen ≥4.5:1. Verificable con axe DevTools. |
| **Screen readers** | Badge lee el texto del estado. No usar solo color para comunicar estado. Tabla con `<th>` semánticos. |
| **Foco visible** | Todos los elementos interactivos tienen `focus-visible:ring-*` (heredado de F1). Verificable: tab a través de todos los elementos, el anillo de foco es visible en cada uno. |

---

## 11. Performance

| Aspecto | Decisión |
|---------|----------|
| **Qué NO optimizar** | La lista de conversaciones tiene un máximo esperado de ~50-100 registros por página. No necesita virtualización ni infinite scroll en F2. |
| **useMemo** | No necesario. La tabla recibe arrays planos sin transformaciones costosas. |
| **useCallback** | No necesario. Los handlers se pasan a componentes simples. |
| **React.memo** | No necesario en F2. Los componentes son pequeños y las re-renderizaciones son baratas. Si F3 muestra problemas de rendimiento, evaluar. |
| **Bundle** | F2 no agrega dependencias externas. Todo es código propio + F1. |
| **Fetch** | Un solo fetch por cambio de filtro/página. Sin fetch innecesario. El hook limpia el efecto si el componente se desmonta. Los botones de paginación se deshabilitan durante loading, evitando fetch duplicados. |
| **Refetch on focus** | `visibilitychange` dispara un refetch silencioso (similar al efecto inicial, pero con skeletons breves si la pestaña estuvo oculta > 30 seg). Sin polling, sin timer, sin WebSocket. |
| **Imágenes** | No hay imágenes en F2. |

---

## 12. Responsive

| Breakpoint | Comportamiento |
|------------|---------------|
| **≥1280px** | Layout completo: sidebar (w-16) + header + tabla con todas las columnas visibles |
| **1024px** | Igual que ≥1280px. Sin cambios. |
| **768px** | La tabla puede ocultar la columna "Último mensaje" si es necesario (evaluar durante implementación). El filtro sigue visible. La paginación se adapta al ancho. |
| **<768px** | Diferido a F4. En F2 se asegura que no haya desbordamiento horizontal ni contenido cortado. |

**Regla:** Desktop primero. F2 no implementa menú hamburguesa ni sidebar colapsable. Se asegura que la página sea usable en 1024px+.

---

## 13. Risk Matrix

| Riesgo | Valor | Justificación |
|--------|-------|---------------|
| UI | Medio | Se refactoriza una página existente. Riesgo de romper la funcionalidad actual si el hook no respeta los mismos parámetros de API. Mitigación: los tests de integración del hook cubren todos los estados. |
| Backend | Ninguno | No se toca backend. La API ya soporta status, limit, offset. |
| API | Ninguno | No se crean ni modifican endpoints. |
| Testing | Medio | El hook `useConversations` requiere mock de `getConversations`. Los componentes son puros (fáciles de testear). La cobertura debe ser ≥90% en archivos nuevos. |
| Performance | Bajo | Sin imágenes, sin virtualización, sin fetch excesivo. El bundle crece marginalmente. |
| Breaking Changes | Ninguno | No se modifican contratos públicos. La página existe y sigue siendo accesible en la misma ruta. |

---

## 14. Testing Plan

### Tests del hook (useConversations)

| Test | Descripción |
|------|-------------|
| fetch inicial | Renderiza hook, verifica que llama a getConversations con parámetros por defecto |
| cambio de filtro | Llama a setStatusFilter("active"), verifica reseteo de offset y nuevo fetch |
| paginación siguiente | Llama a handleNext, verifica offset incrementado y nuevo fetch |
| paginación anterior | Llama a handlePrevious, verifica offset decrementado |
| paginación primera página | handlePrevious no baja de 0 |
| error en fetch | Mock de getConversations rechaza, verifica error state |
| retry | Llama a retry, verifica nuevo fetch con mismos parámetros |
| sin datos | getConversations retorna [], verifica conversations.length === 0 |

### Tests de ConversationTable

| Test | Descripción |
|------|-------------|
| render con datos | Verifica que aparecen filas con nombre, badge, preview y fecha |
| render loading | Verifica 5 skeletons (variant="row") |
| render empty sin filtro | Verifica EmptyState con "No hay conversaciones" |
| render empty con filtro activo | Verifica mensaje contextual según statusFilter (ej: "No hay conversaciones activas") |
| mapeo de status activo | Badge variant="success" para status="active" |
| mapeo de status takeover | Badge variant="warning" para status="human_takeover" |
| mapeo de status cerrado | Badge variant="default" para status="closed" |
| mapeo de status desconocido | Badge variant="default" para status="pending" (fallback) |
| onRowClick | Verifica que onSelectConversation se llama con el id correcto |
| fecha relativa | Verifica formateo de last_message_at con Intl.RelativeTimeFormat |
| fecha null | Celda vacía cuando last_message_at es null |

### Tests de ConversationsFilter

| Test | Descripción |
|------|-------------|
| render con valor | Verifica que el select muestra el valor actual |
| onChange | Selecciona una opción, verifica que onChange se llama con el valor correcto |
| todas las opciones | Verifica que existen "Todas", "Activas", "Human Takeover", "Cerradas" con sus valores correctos |

### Tests de Pagination

| Test | Descripción |
|------|-------------|
| render con offset 0 | Botón Anterior deshabilitado |
| render con hasMore false | Botón Siguiente deshabilitado |
| render con datos | Ambos botones habilitados, indicador de rango visible |
| loading deshabilita ambos | Ambos botones deshabilitados cuando loading=true |
| onClick previous | Llama a onPrevious |
| onClick next | Llama a onNext |
| accesibilidad | Botones tienen aria-label |

### Tests de integración (página)

| Test | Descripción |
|------|-------------|
| render loading | Verifica que ConversationTable muestra skeletons |
| render success | Verifica que ConversationTable muestra filas |
| render empty | Verifica que ConversationTable muestra EmptyState contextual |
| render error | Verifica que ErrorState aparece con mensaje y botón reintentar |
| filtro + error | Cambiar filtro después de error, verifica que el error se limpia |
| click en fila | Verifica router.push a `/conversations/{id}` |
| refetch on focus | Simular visibilitychange, verificar getConversations se llama de nuevo |

---

## 15. Definition of Done

Cada ítem debe responderse con SI/NO.

### Build y estática
- [ ] `npm run build` compila sin errores
- [ ] `npm run lint` pasa sin warnings
- [ ] `npx vitest run` pasa con ≥90% de cobertura en archivos nuevos y modificados

### Hook
- [ ] `useConversations` dispara fetch en mount
- [ ] `useConversations` cancela fetch anterior via AbortController cuando cambian `statusFilter` o `offset`
- [ ] `useConversations` resetea `offset` a 0 cuando cambia `statusFilter`
- [ ] `useConversations` expone `retry()` que re-ejecuta fetch con los mismos parámetros
- [ ] `useConversations` expone `loading` durante fetch, `error` si falla, `conversations` si éxito
- [ ] `useConversations` dispara refetch cuando la pestaña recupera el foco (visibilitychange)

### Componentes
- [ ] `ConversationTable` recibe `Conversation[]` y renderiza filas con Badge + fecha + preview
- [ ] `ConversationTable` usa Badge variant `default` para cualquier status no mapeado (active→success, human_takeover→warning, closed→default, otro→default)
- [ ] `ConversationTable` renderiza EmptyState contextual cuando `conversations.length === 0`
- [ ] `ConversationTable` renderiza 5 skeletons cuando `loading === true`
- [ ] `ConversationsFilter` renderiza un `<select>` con 4 opciones (Todas, Activas, Human Takeover, Cerradas)
- [ ] `Pagination` deshabilita ambos botones cuando `loading === true`
- [ ] `Pagination` deshabilita "Anterior" cuando `offset === 0`
- [ ] `Pagination` deshabilita "Siguiente" cuando `!hasMore`
- [ ] Los componentes no agregan dependencias externas (solo react, lucide-react, F1)
- [ ] Sin `console.log`, `TODO`, `FIXME` en código de producción

### Página
- [ ] `pages/conversations/index.tsx` usa `useConversations` + `ConversationTable` + `ConversationsFilter` + `Pagination` + `ErrorState`
- [ ] La página no contiene mapeo inline de Conversation a filas, Badge variants, ni lógica de EmptyState
- [ ] No se modificaron archivos fuera del alcance (Sección 17)

### Accesibilidad (verificable)
- [ ] Tab navega: filtro → ConversationTable (skip si vacía) → Pagination, sin quedar atrapado en ningún elemento
- [ ] Enter/Space en filas de ConversationTable ejecuta `onSelectConversation`
- [ ] Todos los elementos interactivos muestran `focus-visible:ring-*` al recibir foco
- [ ] Los botones de Pagination tienen `aria-label="Página anterior"` y `"Página siguiente"`
- [ ] El contenedor `aria-live="polite"` existe y anuncia la carga inicial de conversaciones
- [ ] Badges tienen texto visible (no confían solo en color)
- [ ] Contraste de Badges ≥4.5:1 (verificable con axe DevTools o similar)

### Documentación
- [ ] Design document actualizado si hubo cambios durante implementación

---

## 16. Pre-flight Questions

### 1. ¿Cuál es la acción principal del usuario?

Encontrar una conversación y hacer clic para abrirla.

**Implicaciones:** La tabla debe ser el elemento visual dominante. El filtro es secundario (toolbar). La paginación no debe robar atención. La fila debe ser clickeable en toda su área, no solo en el nombre.

### 2. ¿Qué información debe verse primero?

**Nombre del contacto** y **estado** (active / human_takeover / closed). Ambas al mismo nivel visual. El usuario necesita saber dos cosas simultáneamente: "¿quién?" y "¿requiere atención?".

**Implicaciones:** Badge + nombre en la misma línea visual. No separar en columnas distantes. La tabla de F1 soporta este orden de columnas.

### 3. ¿Qué decisión debe poder tomar en menos de 3 segundos?

"¿Esta conversación requiere mi atención ahora?"

**Implicaciones:** Los estados deben diferenciarse por color (verde/amarillo/gris) y por texto. Una conversación en takeover (amarillo) debe llamar la atención visualmente distinto de una activa (verde). Sin texto explicativo adicional.

---

## 17. Scope Validation

### Archivos modificados

| Archivo | Tipo | Estado |
|---------|------|--------|
| `frontend/src/pages/conversations/index.tsx` | Modificar | Dentro de alcance |
| `frontend/src/hooks/index.ts` | Modificar | Dentro de alcance |
| `frontend/src/lib/index.ts` | Modificar | Dentro de alcance (agregar export de `formatRelativeTime`) |

### Archivos nuevos

| Archivo | Tipo | Estado |
|---------|------|--------|
| `frontend/src/hooks/useConversations.ts` | Nuevo | Dentro de alcance |
| `frontend/src/lib/formatRelativeTime.ts` | Nuevo | Dentro de alcance |
| `frontend/src/components/dashboard/ConversationTable.tsx` | Nuevo | Dentro de alcance |
| `frontend/src/components/dashboard/ConversationsFilter.tsx` | Nuevo | Dentro de alcance |
| `frontend/src/components/dashboard/Pagination.tsx` | Nuevo | Dentro de alcance |
| `frontend/src/__tests__/hooks/useConversations.test.tsx` | Nuevo | Dentro de alcance |
| `frontend/src/__tests__/dashboard/ConversationTable.test.tsx` | Nuevo | Dentro de alcance |
| `frontend/src/__tests__/dashboard/ConversationsFilter.test.tsx` | Nuevo | Dentro de alcance |
| `frontend/src/__tests__/dashboard/Pagination.test.tsx` | Nuevo | Dentro de alcance |

### Estimación

| Métrica | Estimación | Límite | ¿Cumple? |
|---------|-----------|--------|----------|
| Archivos modificados | 3 | ≤20 | ✅ |
| Archivos nuevos | 9 | ≤25 | ✅ |
| Total archivos | 12 | ≤25 | ✅ |
| Líneas de diff estimadas | ~500-750 | ≤1500 | ✅ |
| Dependencias nuevas | 0 | 0 | ✅ |

**Veredicto:** F2 no necesita dividirse. Cumple todos los límites. Si durante la implementación el diff excede 1500 líneas por el volumen de tests, se puede ajustar, pero la estimación inicial está dentro del límite.
