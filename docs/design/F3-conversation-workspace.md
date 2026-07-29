# F3 — Conversation Workspace

## 1. Objetivo

### Qué resuelve

- La página de detalle de conversación (`pages/conversations/[id].tsx`) usa HTML nativo (`<textarea>`, `<button>`), estilos inline, estados de carga/error/vacío con HTML arbitrario, y lógica de fetch/envío/takeover todo en un solo componente de 389 líneas.
- No hay separación entre lógica de datos y presentación: fetch de conversación, fetch de mensajes, envío de mensajes y toggle de takeover están en el mismo useEffect/useState.
- No hay hook `useMessages` reutilizable — la lógica de paginación de mensajes está inline.
- No hay componentes `MessageBubble`, `MessageList` ni `Composer` reutilizables.
- No se usa el design system de F1: Badge, Button, Skeleton, EmptyState, ErrorState.
- No hay estados de UI consistentes: loading con divs `animate-pulse`, error con div `bg-red-50`, empty con párrafo gris.
- No hay accesibilidad: falta `aria-label`, roles, focus management, navegación por teclado.
- El header de la conversación (nombre, badge, botón de takeover) está renderizado dentro del mismo componente que los mensajes y el composer.
- El back button es un `<button>` sin icono, sin aria-label, sin estilo consistente.

### Qué NO resuelve

- Sincronización en tiempo real (WebSocket/polling/Realtime). Los mensajes nuevos del bot no aparecen sin recargar. Se difiere a F4.
- Mensajes multimedia (imágenes, audio, video). Solo texto.
- Indicador "escribiendo..." del bot. No hay endpoint para esto.
- Contador de mensajes no leídos.
- Agrupación de mensajes por fecha (separadores "Hoy", "Ayer").
- Avatar del contacto (no está en el modelo de datos).
- Notificaciones de sonido al recibir mensaje.
- Responsive completo < 768px (F4).

---

## 2. Alcance

### Componentes nuevos

| Componente | Ruta | Justificación |
|-----------|------|---------------|
| `ConversationHeader` | `src/components/workspace/ConversationHeader.tsx` | Header del workspace: back button, nombre del contacto, Badge de estado, botón de takeover/return. Agrupa toda la info de cabecera en un componente. |
| `MessageList` | `src/components/workspace/MessageList.tsx` | Contenedor scrolleable de mensajes con load-more en la parte superior, auto-scroll al nuevo mensaje, estados loading/empty contextuales. |
| `MessageBubble` | `src/components/workspace/MessageBubble.tsx` | Burbuja individual de mensaje: contenido, timestamp, estado de delivery (outbound). Inbound a la izquierda (gris), outbound a la derecha (azul). Componente puro. |
| `Composer` | `src/components/workspace/Composer.tsx` | Input de texto + botón de envío. Oculto cuando el bot está activo y el humano no tiene control. Enter = enviar, Shift+Enter = nueva línea. |

### Hooks nuevos

| Hook | Ruta | Justificación |
|------|------|---------------|
| `useConversation` | `src/hooks/useConversation.ts` | Encapsula fetch de una conversación + toggle de takeover. Exclusivo para F3. |
| `useMessages` | `src/hooks/useMessages.ts` | Encapsula fetch paginado de mensajes, envío de mensaje, auto-scroll, estados loading/error. Exclusivo para F3. |

### Componentes reutilizados de F1

| Componente | Uso en F3 |
|-----------|-----------|
| `Button` | Botón "Tomar control" / "Devolver al bot" (variant según estado: active→primary, takeover→secondary). Botón "Enviar" en Composer (variant="primary", disabled si vacío o enviando). Botón "Cargar más mensajes" en MessageList (variant="ghost"). |
| `Badge` | Estado de la conversación en ConversationHeader (active→success, human_takeover→warning, closed→default). Mismo mapeo que F2. |
| `Skeleton` | State loading del workspace (variant="text" para header, variant="row" × 5 para mensajes). |
| `EmptyState` | Estado sin mensajes (icon=MessageSquare, title="No hay mensajes", description="Esta conversación no tiene mensajes todavía."). |
| `ErrorState` | Error de fetch de conversación o mensajes (message dinámico + onRetry). |
| `Sidebar` | Sin cambios |
| `Header` | Sin cambios |
| `AppShell` | Sin cambios |

### Componentes reutilizados de F2

| Componente | Uso en F3 |
|-----------|-----------|
| `useConversations` | No se reusa directamente. F3 trabaja con una sola conversación. El hook `useConversation` es específico para detalle. |

### Archivos que se modificarán

| Archivo | Cambio |
|---------|--------|
| `frontend/src/pages/conversations/[id].tsx` | Refactorizar usando ConversationHeader + MessageList + MessageBubble + Composer + useConversation + useMessages. Pasa de 389 líneas inline a ~50 líneas de composición de componentes. |
| `frontend/src/components/layout/Header.tsx` | Agregar prop opcional `title?: string` (default `"Dashboard"`). La página de detalle pasa el nombre del contacto. No rompe usos existentes. |
| `frontend/src/components/layout/AppShell.tsx` | Recibir y pasar `title` a Header. Add prop opcional `title?: string` (default `"Dashboard"`). |
| `frontend/src/hooks/index.ts` | Agregar export de `useConversation` y `useMessages` |
| `frontend/src/lib/api.ts` | Agregar parámetro opcional `signal?: AbortSignal` a `getConversationMessages` y `sendMessage` para consistencia con el patrón de AbortController de F2. No cambia firma pública. |

### Archivos nuevos

```
frontend/src/
├── components/
│   └── workspace/
│       ├── ConversationHeader.tsx
│       ├── MessageList.tsx
│       ├── MessageBubble.tsx
│       └── Composer.tsx
├── hooks/
│   ├── useConversation.ts
│   └── useMessages.ts
├── lib/
│   └── formatTime.ts
└── __tests__/
    ├── workspace/
    │   ├── ConversationHeader.test.tsx
    │   ├── MessageList.test.tsx
    │   ├── MessageBubble.test.tsx
    │   └── Composer.test.tsx
    └── hooks/
        ├── useConversation.test.tsx
        └── useMessages.test.tsx
```

### Scope excluido explícitamente

| Funcionalidad | Motivo | Cuándo evaluar |
|--------------|--------|----------------|
| Realtime / polling | La API actual es REST sin eventos. Los mensajes nuevos del bot no aparecen hasta que el usuario recarga o navega. Añadir polling o Realtime aumenta el scope significativamente (nuevo hook, manejo de conexión, cleanup). | F4, si hay métricas que muestren que los agentes necesitan ver updates sin recargar. |
| Mensajes multimedia | El modelo `Message` soporta `content_type` pero F3 solo maneja `text`. | F4, si el backend empieza a recibir mensajes con imágenes. |
| Separadores de fecha | Mejora estética sin impacto funcional. | F4. |
| Avatar del contacto | El modelo `Conversation` no expone `avatar_url`. | F4, si se agrega al modelo. |
| Edición/eliminación de mensajes | No hay endpoints para esto. | Fuera de roadmap actual. |

### Archivos que NO se tocan

- `frontend/src/pages/conversations/index.tsx` — F2, no cambia
- `frontend/src/pages/login.tsx` — no cambia
- `frontend/src/pages/_app.tsx` — pasa `title` a AppShell desde cada página (ver cambios en Header/AppShell)
- `frontend/src/components/ui/*` — no cambia (solo se reusan)
- `frontend/src/components/dashboard/*` — no cambia
- `frontend/src/hooks/useConversations.ts` — no cambia
- `frontend/src/types/index.ts` — no cambia
- `frontend/src/contexts/AuthContext.tsx` — no cambia

---

## 3. UX Goals

| Goal | Métrica | Cómo se logra |
|------|---------|---------------|
| Leer el contexto de la conversación | < 3 segundos | El historial de mensajes ocupa el área visual principal (flex-1). El nombre y estado del contacto están visibles sin scroll. |
| Identificar si el bot o humano está a cargo | < 1 segundo | Badge de estado + botón de takeover con texto explícito ("Tomar control" vs "Devolver al bot"). El Composer solo es visible cuando el humano tiene el control. |
| Enviar una respuesta | < 2 segundos desde que decide | Composer visible y enfocable inmediatamente si el humano tiene control. Enter para enviar sin mover el mouse. Feedback visual de envío (Button loading, mensaje aparece en lista). |
| Cambiar estado takeover/return | < 2 toques | Botón único en ConversationHeader con texto que cambia según estado actual. Loading state mientras se procesa. |
| Navegar de vuelta a la lista | < 1 toque | Back button siempre visible en ConversationHeader. |
| Cargar historial antiguo | Sin perder contexto | "Cargar más mensajes" al inicio de la lista, los mensajes se prependen sin perder el scroll actual. |

---

## 4. Visual Hierarchy

| Nivel | Elemento | Estilo | Por qué |
|-------|----------|--------|---------|
| Nivel 1 | Nombre del contacto | `text-xl font-semibold text-gray-900` | Es la identidad de la conversación. El usuario necesita saber con quién está hablando. |
| Nivel 1 | Badge de estado | `rounded-full text-xs font-medium` | "¿El bot o el humano está a cargo?" es la decisión más importante. Misma jerarquía que el nombre. |
| Nivel 2 | Mensajes del contacto (inbound) | `bg-gray-100 text-gray-900` max-w-[70%] | Contenido principal del workspace. Área gris clara para distinguir del fondo blanco. |
| Nivel 2 | Mensajes del agente (outbound) | `bg-blue-600 text-white` max-w-[70%] | Alineados a la derecha, color azul para diferenciar de mensajes del contacto. Solo visible si el humano o bot han respondido. |
| Nivel 3 | Timestamp del mensaje | `text-xs` (gris en inbound, azul claro en outbound) | Información contextual secundaria. |
| Nivel 3 | Estado de delivery (outbound) | `text-xs capitalize` | Solo en mensajes enviados por el agente/bot. "sent", "delivered", "read", "failed". |

**Regla:** El área de mensajes debe ocupar al menos el 70% del viewport vertical. El header de la conversación es compacto (altura fija ~64px). El Composer es la última zona visual, fijo al fondo.

**Resolución del conflicto con Header de F1:** El Header de F1 actual NO tiene botón "Volver" (solo muestra etiqueta "Dashboard" + email + logout). ConversationHeader es la ÚNICA navegación hacia atrás. No hay duplicación. El Header recibe un `title` opcional: la página de detalle pasa el nombre del contacto para que el Header muestre contexto en lugar de "Dashboard".

---

## 5. Pre-flight Questions

### 1. ¿Cuál es la acción principal que debe realizar el usuario?

Leer el historial de la conversación para entender el contexto y, si es necesario, responder al cliente (o tomar control si el bot está activo).

**Validación:** La acción principal es leer. La secundaria es responder. El diseño prioriza el área de mensajes (flex-1, scroll), con el Composer visible solo cuando el humano tiene control.

### 2. ¿Qué información necesita ver primero?

- **Nombre del contacto** — para saber con quién habla.
- **Estado actual** (bot activo / takeover / cerrada) — para saber si necesita intervenir.
- **Últimos mensajes** — para entender el contexto inmediato.

**Validación:** Los 3 elementos están en el viewport inicial sin scroll. El ConversationHeader muestra nombre + badge. El MessageList carga los mensajes más recientes y auto-scroll al fondo.

### 3. ¿Puede tomar una decisión correcta en menos de 3 segundos?

Sí. Al ver el estado "active" sabe que el bot está respondiendo. Al ver "human_takeover" sabe que debe responder. Al ver el badge + botón de takeover, puede decidir si intervenir o no.

---

## 6. User Flows

```
1. Usuario llega a /conversations/{id}
     │
     ├── loading → ConversationHeader skeleton + 5 MessageBubble skeletons
     │
     ├── error → ErrorState (fetch conversación o mensajes) + "Reintentar"
     │     └── reintento → retorna a loading
     │
     ├── 404 → EmptyState "Conversación no encontrada" + botón "Volver"
     │
     ├── empty (sin mensajes) → ConversationHeader + EmptyState "No hay mensajes"
     │
     └── success → ConversationHeader + MessageList + Composer (si takeover)
           │
           ├── 2. Usuario hace scroll hacia arriba
           │     └── "Cargar más mensajes" → prepende mensajes antiguos
           │
           ├── 3. Usuario hace clic en "Tomar control"
           │     └── PATCH → status = human_takeover → Composer aparece
           │     └── Error → Error temporal con toast/mensaje
           │
           ├── 4. Usuario escribe mensaje + Enter
           │     └── POST → mensaje aparece en lista, auto-scroll
           │     └── Error → mensaje de error sobre el composer
           │
           ├── 5. Usuario hace clic en "Devolver al bot"
           │     └── PATCH → status = active → Composer desaparece
           │
           └── 6. Usuario hace clic en "← Volver"
                 └── router.push("/conversations")
```

---

## 7. Wireframe ASCII

### Layout general

```
┌──────────────────────────────────────────────────────────────┐
│  Header                                                      │
│  ┌────┐  Conversaciones                  user@mail.com  ──  │
│  │    │                                                      │
│  │    │  ┌──────────────────────────────────────────────────┐│
│  │    │  │ ConversationHeader                               ││
│  │    │  │  ← Volver                                        ││
│  │    │  │  Juan Pérez              [Activa]  [Tomar...]    ││
│  │    │  │  Creado: 12 jul 2026                             ││
│  │    │  ├──────────────────────────────────────────────────┤│
│  │    │  │ MessageList                                      ││
│  │    │  │                                                  ││
│  │    │  │  [Cargar más mensajes]                           ││
│  │    │  │                                                  ││
│  │    │  │  ┌──────────────────────┐                        ││
│  │    │  │  │ Hola, necesito       │ ← inbound (gris, izq)  ││
│  │    │  │  │ información sobre... │                        ││
│  │    │  │  │           10:30      │                        ││
│  │    │  │  └──────────────────────┘                        ││
│  │    │  │                                                  ││
│  │    │  │           ┌──────────────────────┐               ││
│  │    │  │           │ Claro, ¿qué necesita?│ → outbound    ││
│  │    │  │           │ saber en concreto?   │   (azul, der) ││
│  │    │  │           │           10:30 sent │               ││
│  │    │  │           └──────────────────────┘               ││
│  │    │  │                                                  ││
│  │    │  ├──────────────────────────────────────────────────┤│
│  │    │  │ Composer (solo si takeover)                      ││
│  │    │  │  ┌──────────────────────────────────┐ [Enviar]  ││
│  │    │  │  │ Escribe un mensaje...            │           ││
│  │    │  │  └──────────────────────────────────┘           ││
│  │    │  └──────────────────────────────────────────────────┘│
│  └─────┘                                                      │
└──────────────────────────────────────────────────────────────┘
```

### Loading state

```
┌──────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────┐│
│  │  ████████████░░░░░░░░                                   ││
│  │  ████████████░░░░░░░░  (skeleton header: 2 líneas)      ││
│  ├──────────────────────────────────────────────────────────┤│
│  │  ████████████████████████████████████████████████████████ ││
│  │  ████████████████████████████████████████████████████████ ││
│  │  ████████████████████████████████████████████████████████ ││
│  │  ████████████████████████████████████████████████████████ ││
│  │  ████████████████████████████████████████████████████████ ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### Empty state (sin mensajes)

```
┌──────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────┐│
│  │  ← Volver                                               ││
│  │  Juan Pérez              [Activa]  [Tomar control]      ││
│  ├──────────────────────────────────────────────────────────┤│
│  │                                                          ││
│  │                    [MessageSquare Icon]                  ││
│  │                                                          ││
│  │                 No hay mensajes                          ││
│  │                                                          ││
│  │          Esta conversación no tiene                      ││
│  │          mensajes todavía.                               ││
│  │                                                          ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### Error state

```
┌──────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────┐│
│  │  [!] Error al cargar la conversación                     ││
│  │                                                          ││
│  │  No pudimos conectar con el servidor.                    ││
│  │                                                          ││
│  │  [Reintentar]                                            ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### 404 state

```
┌──────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────┐│
│  │  ← Volver                                               ││
│  ├──────────────────────────────────────────────────────────┤│
│  │                                                          ││
│  │              Conversación no encontrada                  ││
│  │                                                          ││
│  │         [Volver a conversaciones]                        ││
│  │                                                          ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

---

## 8. Estados

| Estado | Representación visual | Componente | Condición |
|--------|----------------------|------------|-----------|
| **loading (conversación)** | Skeleton: 2 bloques (header), 5 bloques (mensajes) | `Skeleton` | `conversationLoading === true` |
| **loading (mensajes)** | 5 skeletons variant="row" en MessageList | `Skeleton` | `messagesLoading === true` (después de que conversación cargó) |
| **not found (404)** | EmptyState centrado con mensaje + botón volver | `EmptyState` + `Button` | `notFound === true` (API responde 404) |
| **error (conversación)** | ErrorState con mensaje + onRetry | `ErrorState` | `conversationError !== null` |
| **error (mensajes)** | ErrorState con mensaje + onRetry | `ErrorState` | `messagesError !== null` |
| **empty (sin mensajes)** | EmptyState "No hay mensajes" debajo del header | `EmptyState` | `!loading && messages.length === 0` |
| **success (con mensajes)** | ConversationHeader + MessageList con burbujas | Todos los componentes | `!loading && messages.length > 0` |
| **bot activo (no takeover)** | Composer oculto. Badge "Activa" verde. Botón "Tomar control" | `Badge` + `Button` | `conversation.status === "active"` |
| **human takeover** | Composer visible. Badge "Takeover" amarillo. Botón "Devolver al bot" | `Badge` + `Button` + `Composer` | `conversation.status === "human_takeover"` |
| **conversación cerrada** | Composer oculto. Badge "Cerrada" gris. Sin botón de takeover. | `Badge` | `conversation.status === "closed"` |
| **enviando mensaje** | Button loading, textarea deshabilitado | `Button(loading=true)` | `sending === true` |
| **error de envío** | Mensaje de error sobre el composer | div `bg-red-50` | `sendError !== null` |

**Transiciones:**
- `loading → success`: fade-in de componentes (sin animación). Auto-scroll al último mensaje.
- `loading → error`: ErrorState reemplaza skeletons.
- `loading → 404`: EmptyState con botón volver.
- `success → sending`: Button cambia a loading, textarea se deshabilita.
- `sending → success`: Mensaje nuevo aparece en MessageList, auto-scroll, textarea se limpia.
- `success → takeover toggle`: Badge cambia, botón cambia texto, Composer aparece/desaparece.

---

## 9. Componentes

### 9.1 ConversationHeader

| Aspecto | Definición |
|---------|------------|
| **Responsabilidad** | Mostrar información de la conversación (nombre, estado, fecha de creación) y acciones (back, takeover/return). |
| **Props** | `conversation: Conversation`, `onBack: () => void`, `onToggleStatus: () => void`, `toggling: boolean` |
| **Estados** | Normal, takeover (badge cambia, botón cambia texto), closed (sin botón de takeover) |
| **Mapeo de status a Badge** | `active` → `success`, `human_takeover` → `warning`, `closed` → `default`. Mismo mapeo que F2. |
| **Eventos** | `onBack` → navega a /conversations, `onToggleStatus` → PATCH status |
| **Back button** | Button variant="ghost" con icono ArrowLeft de lucide + texto "Volver". `aria-label="Volver a conversaciones"`. |
| **Takeover button** | Button cuya variante y texto cambian según estado: `active`→primary "Tomar control", `human_takeover`→secondary "Devolver al bot". Deshabilitado si `toggling`. |
| **Closed state** | Si `status === "closed"`, el botón de takeover no se renderiza. No se puede cambiar el estado de una conversación cerrada desde F3. |
| **Dependencias** | `Badge`, `Button` (F1). `ArrowLeft` de lucide-react. |
| **Accesibilidad** | Back button con aria-label. Takeover button con texto descriptivo que cambia según acción. Badge con texto visible. |

### 9.2 MessageBubble

| Aspecto | Definición |
|---------|------------|
| **Responsabilidad** | Renderizar un mensaje individual con estilo según dirección (inbound/outbound). Componente puro. |
| **Props** | `message: Message` |
| **Estilos** | Inbound: `bg-gray-100 text-gray-900`, alineado a la izquierda. Outbound: `bg-blue-600 text-white`, alineado a la derecha. |
| **Timestamp** | Formato `HH:mm` con helper `formatTime` en `@/lib/formatTime.ts`. En outbound, se muestra también el estado de delivery (`sent`, `delivered`, `read`, `failed`). |
| **Contenido** | `whitespace-pre-wrap break-words` para preservar saltos de línea. |
| **Ancho máximo** | `max-w-[70%]` para evitar burbujas que ocupen todo el ancho. |
| **Mensaje fallido** | Si `message.status === "failed"`, la burbuja outbound muestra un indicador visual (borde rojo o icono de error). |
| **Dependencias** | Helper `formatTime` en `@/lib/formatTime.ts`. Sin dependencias externas. |
| **Tamaño estimado** | ~30 líneas |
| **Accesibilidad** | La burbuja es un `<div>` con texto plano. No se necesita rol adicional. El timestamp usa `<time>` con `dateTime` si es posible. |

### 9.3 MessageList

| Aspecto | Definición |
|---------|------------|
| **Responsabilidad** | Contenedor scrolleable que renderiza `MessageBubble[]`. Maneja loading (skeletons), empty (EmptyState contextual), y "cargar más" al inicio. |
| **Props** | `messages: Message[]`, `loading: boolean`, `hasMore: boolean`, `onLoadMore: () => void`, `emptyMessage?: string`, `children` (opcional, para el auto-scroll anchor) |
| **Scroll management** | Al recibir mensajes nuevos (envío), auto-scroll al fondo via `useEffect` + `scrollIntoView`. Al cargar más (historial), NO hacer scroll (el usuario está viendo mensajes superiores). |
| **Load more** | Botón "Cargar más mensajes" visible solo si `hasMore === true`. Aparece al inicio de la lista (primer mensaje visible). Al hacer clic, se prependen más mensajes. |
| **Empty state** | Si `messages.length === 0 && !loading`, renderiza `EmptyState` con icono `MessageSquare`. |
| **Loading state** | 5 skeletons `variant="row"` mientras `loading === true`. |
| **Dependencias** | `Skeleton`, `EmptyState`, `Button` (F1). `MessageBubble` (F3). |
| **Tamaño estimado** | ~60 líneas |
| **Accesibilidad** | `aria-live="polite"` en el contenedor para anunciar carga de mensajes. Rol `log` para la lista de mensajes. |

### 9.4 Composer

| Aspecto | Definición |
|---------|------------|
| **Responsabilidad** | Input multilínea + botón de envío. Solo visible si el humano tiene control de la conversación. |
| **Props** | `onSend: (content: string) => Promise<void>`, `disabled: boolean`, `sending: boolean`, `error: string | null` |
| **Estados** | idle (textarea vacío, botón deshabilitado), typing (textarea con texto, botón habilitado), sending (textarea y botón deshabilitados, button loading), error (mensaje de error visible encima del composer) |
| **Enter para enviar** | `onKeyDown`: si `e.key === "Enter" && !e.shiftKey`, previene default y llama `onSend`. |
| **Auto-resize** | El textarea se auto-redimensiona verticalmente hasta un máximo de 6 líneas (usando `rows={1}` y ajustando vía `scrollHeight`). Sin scroll interno. |
| **Placeholder** | "Escribe un mensaje..." |
| **Botón de envío** | Button variant="primary", texto "Enviar". Deshabilitado si `!content.trim() || sending`. |
| **Error de envío** | Si `error !== null`, se renderiza un div `bg-red-50` con el mensaje de error encima del textarea. Desaparece al empezar a escribir. |
| **Dependencias** | `Button` (F1). Sin dependencias externas de texto. |
| **Tamaño estimado** | ~50 líneas |
| **Accesibilidad** | Textarea con `aria-label="Mensaje"`. Placeholder descriptivo. Botón con texto "Enviar mensaje" visible. Enter explícito como atajo documentado (no oculto). |

---

## 10. Hooks

### 10.1 useConversation

```typescript
interface UseConversationReturn {
  conversation: Conversation | null;
  loading: boolean;
  error: string | null;
  notFound: boolean;
  toggleStatus: () => Promise<void>;
  toggling: boolean;
}
```

| Aspecto | Definición |
|---------|------------|
| **Estado interno** | `conversation`, `loading`, `error`, `notFound`, `toggling` |
| **API utilizada** | `getConversation(id)` de `@/lib/api` |
| **Parámetro** | `id: string` — ID de la conversación |
| **Efecto** | `useEffect` dispara fetch cuando cambia `id`. Usa `AbortController` para cancelar peticiones previas. Cleanup aborts. |
| **toggleStatus** | Llama `updateConversation(id, newStatus)`. Si `status === "active"`, envía `"human_takeover"`. Si `status === "human_takeover"`, envía `"active"`. Si `status === "closed"`, no hace nada (no se puede cambiar una conversación cerrada desde F3). Actualiza `conversation` con el resultado. |
| **404 handling** | Si `getConversation` lanza un error con código 404, `notFound = true`. Esto permite a la página mostrar un estado 404 específico. |
| **Tamaño estimado** | ~60 líneas |
| **Test** | Mock de `getConversation` y `updateConversation`. Probar: fetch inicial, toggleStatus, 404, error de red, AbortController. |

### 10.2 useMessages

```typescript
interface UseMessagesReturn {
  messages: Message[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  sendMessage: (content: string) => Promise<void>;
  sending: boolean;
  sendError: string | null;
}
```

| Aspecto | Definición |
|---------|------------|
| **Estado interno** | `messages`, `loading`, `error`, `hasMore`, `offset`, `sending`, `sendError` |
| **API utilizada** | `getConversationMessages(id, { limit, offset }, signal)`, `sendMessage(id, content)` de `@/lib/api` |
| **Parámetro** | `conversationId: string` |
| **Límite** | `LIMIT = 50`. Justificación: una conversación típica de MVP tiene <50 mensajes. Con 50 se carga la conversación completa en un solo fetch. Si hay más, el usuario puede cargar más. |
| **Efecto inicial** | `useEffect` dispara fetch de mensajes en mount con `offset = 0`. |
| **loadMore** | Incrementa `offset` en `LIMIT`. El useEffect dispara un nuevo fetch con el offset actualizado. Los nuevos mensajes se **prependen** al array existente (`[...newData, ...prev]`). Esto preserva el orden cronológico. |
| **hasMore** | `hasMore = data.length === LIMIT`. Misma heurística que F2. |
| **sendMessage** | Llama `sendMessage(id, content)`. En caso de éxito, **apendiza** el nuevo mensaje (`[...prev, newMessage]`). El componente MessageList detecta el cambio en `messages.length` y hace auto-scroll al fondo. No se necesita un contador separado (`messageVersion` eliminado por innecesario). |
| **Auto-scroll signal** | MessageList usa un `useEffect` que compara `messages.length` (previo vs actual). Si la longitud aumentó (nuevo mensaje enviado), hace scroll al fondo. Si cambió por loadMore (prepend), no hace scroll — en ese caso preserva la posición manualmente (ver scroll management en MessageList). |
| **AbortController** | El fetch inicial y `loadMore` usan `AbortController` para cancelar peticiones en vuelo. El cleanup del efecto aborta. |
| **Manejo de errores** | Errores de fetch → `error`. Errores de envío → `sendError` (el mensaje permanece en el textarea). Errores de AbortController se ignoran. |
| **Tamaño estimado** | ~90 líneas |
| **Test** | Mock de `getConversationMessages` y `sendMessage`. Probar: fetch inicial, loadMore, hasMore, sendMessage, error de fetch, error de envío, AbortController. |

---

## 11. Integración con Backend

F3 no crea ni modifica endpoints del backend. Todos los endpoints necesarios existen:

| Acción | Endpoint | Método | Hook que lo usa |
|--------|----------|--------|-----------------|
| Obtener conversación | `/api/v1/conversations/{id}` | GET | `useConversation` |
| Cambiar estado | `/api/v1/conversations/{id}` | PATCH | `useConversation` (toggleStatus) |
| Obtener mensajes | `/api/v1/conversations/{id}/messages?limit=&offset=` | GET | `useMessages` |
| Enviar mensaje | `/api/v1/conversations/{id}/messages` | POST | `useMessages` (sendMessage) |

**Cambio mínimo en `api.ts`:** Agregar `signal?: AbortSignal` opcional a `getConversationMessages` y `sendMessage`, siguiendo el mismo patrón que `getConversations` en F2. Esto no cambia la firma pública ni rompe compatibilidad.

---

## 12. API Contract

### Conversaciones

| Método | Ruta | Descripción | Hook |
|--------|------|-------------|------|
| `GET` | `/api/v1/conversations/{id}` | Obtener detalle de conversación | `useConversation` |
| `PATCH` | `/api/v1/conversations/{id}` | Cambiar estado (takeover / return) | `useConversation` |

### Mensajes

| Método | Ruta | Descripción | Hook |
|--------|------|-------------|------|
| `GET` | `/api/v1/conversations/{id}/messages` | Listar mensajes (paginado) | `useMessages` |
| `POST` | `/api/v1/conversations/{id}/messages` | Enviar mensaje como agente | `useMessages` |

**Contrato esperado de `GET /api/v1/conversations/{id}/messages`:**

```
Parámetros query: limit (int, default 50), offset (int, default 0)
Respuesta: Message[] ordenado por created_at ASC
```

**Contrato esperado de `POST /api/v1/conversations/{id}/messages`:**

```
Body: { content: string }
Respuesta: Message (el mensaje creado, con id, created_at, direction="outgoing")
```

---

## 13. Accesibilidad

| Aspecto | Implementación |
|---------|---------------|
| **Navegación teclado** | Tab navega: Back button → Takeover button → MessageList (skip si vacía) → Composer (textarea → send button). Enter/Space activa botones. Enter en Composer envía mensaje. |
| **Focus management** | Al abrir la página, el foco va al header (h1 con nombre de contacto) para que un screen reader anuncie el contexto. Al enviar mensaje, el foco vuelve al textarea. Al cambiar takeover, el foco se mantiene en el botón de takeover. Al cargar más mensajes, el foco se mantiene en la posición actual. |
| **aria-live** | El MessageList tiene `aria-live="polite"`. Anuncia: al cargar → "Cargando mensajes". Al completar → "N mensajes cargados". Al recibir mensaje nuevo → "Nuevo mensaje de [contacto]" o "Mensaje enviado". |
| **aria-label** | Back button: `aria-label="Volver a conversaciones"`. Takeover button: `aria-label="Tomar control de la conversación"` / `"Devolver control al bot"`. Send button: `aria-label="Enviar mensaje"`. |
| **Rol log** | MessageList tiene `role="log"` y `aria-label="Mensajes de la conversación"`. |
| **Contraste** | Inbound: gray-100/gray-900 (contraste >10:1). Outbound: blue-600/white (contraste ~4.5:1). Badge: mismos colores que F2 (todos ≥4.5:1). |
| **Screen readers** | Badge lee el texto del estado. Los mensajes no tienen roles especiales (son texto plano). El timestamp usa `<time>` con formato legible. |
| **Foco visible** | Todos los elementos interactivos tienen `focus-visible:ring-*` (heredado de F1). |
| **Composer** | Textarea con `aria-label="Escribe un mensaje"`. Error de envío con `role="alert"`. |

---

## 14. Responsive

| Breakpoint | Comportamiento |
|------------|---------------|
| **≥1024px** | Layout completo: sidebar (w-16) + ConversationHeader + MessageList + Composer. Ancho completo del contenido. |
| **768px** | Mismo layout. La tabla de mensajes ocupa el 100% del ancho disponible. El ConversationHeader puede apilar elementos si es necesario (sin desbordamiento). |
| **<768px** | Diferido a F4. En F3 se asegura que no haya desbordamiento horizontal ni contenido cortado. El Composer debe ser usable incluso en viewports estrechos (textarea + botón siempre visibles). |

**Regla:** Desktop primero. F3 no implementa menú hamburguesa, sidebar colapsable ni layout alternativo para móvil. F4 manejará responsive completo.

---

## 15. Testing Strategy

### Tests de hooks

| Hook | Test | Descripción |
|------|------|-------------|
| `useConversation` | fetch inicial | Renderiza hook con id, verifica que llama a getConversation |
| | 404 | getConversation lanza error 404, verifica notFound=true |
| | error de red | getConversation lanza error, verifica error state |
| | toggleStatus (active→takeover) | Llama toggleStatus, verifica updateConversation con "human_takeover" |
| | toggleStatus (takeover→active) | Llama toggleStatus, verifica updateConversation con "active" |
| | AbortController | Cambiar id rápidamente, verificar que el fetch anterior se aborta |
| `useMessages` | fetch inicial | Renderiza hook, verifica getConversationMessages con offset=0 |
| | loadMore | Llama loadMore, verifica offset incrementado y nuevo fetch |
| | hasMore | Mock retorna LIMIT elementos, verifica hasMore=true. Mock retorna <LIMIT, verifica hasMore=false. |
| | sendMessage exitoso | Llama sendMessage, verifica que el mensaje se apendiza a la lista |
| | sendMessage error | Llama sendMessage, mock rechaza, verifica sendError |
| | sendMessage con conversationId inválido | Llama sendMessage con id vacío/null, verifica que NO llama a la API |
| | AbortController | loadMore rápido, verificar que el fetch anterior se aborta |

### Tests de componentes

| Componente | Test | Descripción |
|------------|------|-------------|
| `ConversationHeader` | render con datos | Verifica nombre, badge, botón takeover |
| | render takeover | Verifica badge "warning" y botón texto "Devolver al bot" |
| | render cerrada | Verifica badge "default" y botón NO renderizado |
| | back onClick | Verifica onBack se llama |
| | toggle onClick | Verifica onToggleStatus se llama |
| | toggling disabled | Botón deshabilitado cuando toggling=true |
| `MessageBubble` | inbound | Verifica bg-gray-100, alineación izquierda, timestamp |
| | outbound | Verifica bg-blue-600, alineación derecha, timestamp+status |
| | contenido multilínea | Verifica whitespace-preservado |
| | contenido muy largo (1000+ chars sin espacios) | Verifica `break-words` evita desbordamiento horizontal |
| | mensaje fallido | Verifica indicador visual si status="failed" |
| `MessageList` | render con datos | Verifica que MessageBubble se renderiza por cada mensaje |
| | render loading | Verifica 5 skeletons |
| | render empty | Verifica EmptyState con mensaje |
| | render con hasMore | Verifica botón "Cargar más mensajes" |
| | loadMore onClick | Verifica onLoadMore se llama |
| | auto-scroll en sendMessage | Al incrementar messages.length (simula envío), verifica scroll al fondo |
| | scroll preservado en loadMore | Al prepender mensajes, verifica que scrollTop se ajusta para evitar salto visual |
| | no scroll en empty/loading | Verifica que no hay scroll cuando no hay mensajes |
| `Composer` | render idle | Textarea vacío, botón deshabilitado |
| | render typing | Textarea con texto, botón habilitado |
| | render sending | Botón loading, textarea deshabilitado |
| | doble clic en enviar | Llama onSend mientras sending=true, verifica que onSend se llama UNA sola vez |
| | Enter envía | Tipo Enter en textarea, verifica onSend |
| | Shift+Enter no envía | Tipo Shift+Enter, verifica onSend NO llamado |
| | auto-resize máximo | Simula contenido hasta 6 líneas, verifica que el textarea no excede ese límite |
| | error visible | Verifica mensaje de error cuando error prop no es null |

---

## 16. Riesgos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| **Auto-scroll conflictivo con loadMore** | Medio | Al cargar más mensajes (historial), NO hacer scroll. Solo hacer scroll cuando se envía un mensaje nuevo. Implementar con un flag `shouldAutoScroll` que solo es true cuando `sendMessage` se completa exitosamente. |
| **Composer visible en estado takeover pero botón inactivo** | Bajo | El botón de takeover y el Composer comparten el mismo estado. Si `status === "human_takeover"`, el Composer es visible. No hay caso donde el badge muestre takeover y el Composer esté oculto. |
| **Mensajes duplicados en sendMessage** | Medio | El hook apendiza el mensaje devuelto por la API inmediatamente. Si el usuario hace clic rápido dos veces, se envían dos mensajes. Mitigación: el botón se deshabilita durante `sending=true`. Además, `sendMessage` es `async` y el botón no se re-habilita hasta que termina. |
| **Race condition: sendMessage + toggleStatus simultáneos** | Medio | Si el usuario hace clic en "Enviar" e inmediatamente en "Devolver al bot", el POST sendMessage y el PATCH toggleStatus están en vuelo simultáneo. Si el PATCH completa primero, el Composer se oculta pero el POST sigue en curso: el mensaje se envía aunque el sistema muestre "bot activo". Mitigación: el botón de takeover se deshabilita (`disabled=true`) mientras `sending === true`. Esto evita el toggle durante el envío. |
| **Offset incorrecto en loadMore** | Bajo | Si la API retorna exactamente LIMIT elementos pero no hay más, `hasMore` será `true` y el usuario verá un "Cargar más" que no carga nada. Es la misma heurística de F2 y es aceptable para MVP. |
| **Pérdida de mensaje al enviar** | Alto | Si la llamada POST tiene éxito pero el fetch de regreso falla, el mensaje se perdió. El hook apendiza el mensaje devuelto por POST, no hace un fetch adicional. Si POST responde con el Message completo, no hay pérdida. Verificar que el endpoint POST retorna el mensaje creado. |
| **Estado de takeover desincronizado** | Alto | Si dos agentes (o agente + n8n) cambian el estado simultáneamente, el PATCH podría sobreescribir. Fuera del alcance de F3 (single agent MVP). Documentado como limitación. |

---

## 17. Risk Matrix

| Riesgo | Valor | Justificación |
|--------|-------|---------------|
| UI | Medio | Se refactoriza una página existente de 389 líneas. Riesgo de romper la funcionalidad actual (envío, takeover, scroll). Mitigación: tests de integración de hooks y componentes cubren todos los estados. Comparar comportamiento antes/después. |
| Backend | Ninguno | No se toca backend. |
| API | Ninguno | No se crean ni modifican endpoints. Solo se agrega `signal` opcional a funciones existentes en api.ts. |
| Testing | Medio | Los hooks requieren mock de API. Los componentes son puros (fáciles de testear). La cobertura debe ser ≥90% en archivos nuevos. |
| Performance | Bajo | Sin imágenes, sin polling, sin fetch excesivo. El bundle crece marginalmente (4 componentes, 2 hooks). |
| Breaking Changes | Ninguno | No se modifican contratos públicos. La página existe y sigue siendo accesible en la misma ruta. |

---

## 18. Definition of Done

Cada ítem debe responderse con SI/NO.

### Build y estática
- [ ] `npm run build` compila sin errores
- [ ] `npm run lint` pasa sin warnings
- [ ] `npx vitest run` pasa con ≥90% de cobertura en archivos nuevos y modificados

### Hooks
- [ ] `useConversation` dispara fetch de conversación en mount
- [ ] `useConversation` expone `toggleStatus()` que cambia entre active↔human_takeover
- [ ] `useConversation` expone `notFound` cuando la API responde 404
- [ ] `useConversation` usa AbortController para cancelar peticiones en vuelo
- [ ] `useMessages` dispara fetch de mensajes en mount con offset=0
- [ ] `useMessages` expone `loadMore()` que incrementa offset y prepende resultados
- [ ] `useMessages` expone `hasMore` basado en heurística de límite
- [ ] `useMessages` expone `sendMessage()` que apendiza el nuevo mensaje a la lista
- [ ] `useMessages` usa AbortController para cancelar peticiones en vuelo
- [ ] `useMessages` no envía mensajes vacíos (content.trim() no vacío)

### Componentes
- [ ] `ConversationHeader` muestra nombre, Badge, fecha de creación, back button, takeover button
- [ ] `ConversationHeader` no renderiza takeover button si status="closed"
- [ ] `ConversationHeader` usa Badge variant correcta según status (active→success, human_takeover→warning, closed→default)
- [ ] `MessageBubble` inbound usa bg-gray-100, alineación izquierda
- [ ] `MessageBubble` outbound usa bg-blue-600, alineación derecha, muestra timestamp + status
- [ ] `MessageList` renderiza MessageBubble para cada mensaje
- [ ] `MessageList` renderiza 5 skeletons cuando loading=true
- [ ] `MessageList` renderiza EmptyState contextual cuando messages.length === 0
- [ ] `MessageList` renderiza botón "Cargar más mensajes" cuando hasMore=true
- [ ] `MessageList` hace auto-scroll al fondo cuando se añade un mensaje nuevo (sendMessage)
- [ ] `MessageList` NO hace auto-scroll cuando se cargan más mensajes (loadMore)
- [ ] `Composer` es visible solo si status="human_takeover"
- [ ] `Composer` tiene textarea + send button
- [ ] `Composer` deshabilita botón si texto vacío o sending=true
- [ ] `Composer` envía con Enter (sin Shift)
- [ ] `Composer` muestra error de envío cuando sendError !== null

### Página
- [ ] `pages/conversations/[id].tsx` usa `useConversation` + `useMessages` + ConversationHeader + MessageList + MessageBubble + Composer
- [ ] La página no contiene lógica inline de fetch, takeover, envío, ni estados de UI
- [ ] La página maneja los estados: loading, 404, error, empty, success, takeover, closed, sending
- [ ] No se modificaron archivos fuera del alcance

### Accesibilidad (verificable)
- [ ] Tab navega: Back button → Takeover button → MessageList (skip si vacía) → Composer
- [ ] Enter/Space activa takeover, send, back
- [ ] Enter en Composer envía mensaje (sin Shift)
- [ ] Todos los elementos interactivos muestran focus-visible:ring-* al recibir foco
- [ ] Back button tiene aria-label, takeover button tiene aria-label dinámico, send button tiene aria-label
- [ ] MessageList tiene role="log" + aria-live="polite"
- [ ] Error de envío tiene role="alert"
- [ ] Badges tienen texto visible (no confían solo en color)
- [ ] Contraste de burbujas outbound ≥4.5:1

### Documentación
- [ ] Design document actualizado si hubo cambios durante implementación

---

## 19. Auto-crítica

### Contradicciones
- Ninguna detectada. Todas las decisiones están alineadas con F1 y F2.

### Decisiones sin justificar
- **Uso de textarea nativo en Composer (no Input):** Input de F1 es para entrada de una línea. El Composer necesita multilínea con auto-resize. Un textarea nativo estilado con Tailwind es la opción correcta. Si F4 requiere otro multilínea, se extrae a ui/Textarea.
- **Auto-scroll solo en sendMessage, no en loadMore:** Es intencional. Cuando el usuario carga más mensajes (historial), está mirando la parte superior. Hacer scroll interrumpiría su flujo. El scroll al fondo solo ocurre cuando el usuario acaba de enviar un mensaje.

### Componentes innecesarios
- Ninguno. Los 4 componentes tienen responsabilidades distintas y no solapadas.

### Reutilización insuficiente
- **Button** reusado en: takeover, send, load more, back. Correcto.
- **Badge** reusado en ConversationHeader con el mismo mapeo que F2. Correcto.
- **Skeleton** reusado para loading header + loading messages. Correcto.
- **EmptyState** reusado para vacío y 404. Correcto.
- **ErrorState** reusado para error de fetch. Correcto.
- **useConversations** de F2 no es reutilizable aquí porque maneja una lista, no un detalle. `useConversation` es específico para el workspace.

### Deuda técnica
- **Heurística de hasMore:** usa `data.length >= LIMIT` (misma limitación que F2). No hay metadatos de paginación en la API. Se documenta como limitación.
- **Sin polling/realtime:** Los mensajes nuevos del bot no aparecen sin recargar. Diferido a F4.
- **api.ts signal parameter:** Se agrega signal opcional a `getConversationMessages` y `sendMessage`. No es deuda si se implementa correctamente.

### UX
- **Prioridad correcta:** El workspace prioriza lectura (historial) sobre escritura (composer). El MessageList ocupa el espacio principal.
- **Estados cubiertos:** loading, 404, error, empty, success, takeover, closed, sending, sendError. No hay estados sin manejar.
- **Transiciones documentadas.** Sin animaciones bruscas ni cambios de layout inesperados.

### Accesibilidad
- Todos los elementos interactivos tienen aria-label o texto visible.
- Navegación por teclado completa.
- aria-live para cambios dinámicos.
- role="log" para la lista de mensajes.
- Contraste verificado.

### Mantenibilidad
- 4 componentes + 2 hooks + 1 página. Total ~7 archivos nuevos (~2 modificados). Estimación < 600 líneas totales.
- Sin dependencias externas nuevas.
- Separación clara: hooks (lógica de datos), componentes (presentación), página (composición).
