# F4A — Responsive Design

## 1. Objetivos

### Qué resuelve

- La aplicación actual solo es usable en pantallas ≥1024px. El sidebar (`w-16`) ocupa espacio horizontal en todos los viewports. La tabla de conversaciones no tiene scroll horizontal ni ocultamiento de columnas. El workspace de conversación no se adapta a pantallas estrechas.
- No hay soporte para dispositivos móviles (<768px). El menú hamburguesa, los overlays de navegación y la compactación de layouts no existen.
- No hay ningún uso de breakpoints de Tailwind (`sm:`, `md:`, `lg:`, `xl:`) en todo el frontend. Todo es desktop-first puro.

### Qué NO resuelve

- Dark mode (F4B).
- Realtime / polling / WebSocket (F4C).
- Nuevas funcionalidades (cards, infinite scroll, virtualización).
- Cambios en la lógica de negocio (hooks, API, contextos, tipos).
- Nuevas dependencias npm.
- Cambios en el backend, infra o n8n.

---

## 2. Alcance

### Archivos que se modificarán

| Archivo | Cambio |
|---------|--------|
| `frontend/src/components/layout/AppShell.tsx` | Agregar estado `sidebarOpen`, renderizar backdrop overlay para móvil, pasar `onToggleSidebar` a Header y `isOpen` + `onClose` a Sidebar |
| `frontend/src/components/layout/Sidebar.tsx` | Agregar props `isOpen` y `onClose`. En móvil: overlay fijo con transición. En desktop: mismo comportamiento actual (`relative w-16`). Agregar info de usuario al final (email desde AuthContext) para que esté disponible sin Header en móvil. |
| `frontend/src/components/layout/Header.tsx` | Agregar prop `onToggleSidebar: () => void`. Renderizar botón hamburguesa (lucide `Menu`/`X`) en móvil. Envolver email+logout en contenedor `max-md:hidden`. |
| `frontend/src/components/dashboard/ConversationTable.tsx` | Envolver `<Table>` en `<div className="overflow-x-auto">`. Columnas "Último mensaje" y tiempo se ocultan en móvil con clases responsive. El mapeo de columnas se adapta al breakpoint usando CSS (no JS). |
| `frontend/src/components/workspace/ConversationHeader.tsx` | En móvil, el botón "Volver" se muestra siempre con label. Agregar clases responsive para apilar elementos si el ancho es insuficiente. |
| `frontend/src/components/workspace/MessageBubble.tsx` | Ajustar `max-w-[70%]` → `max-w-[85%]` en móvil para que los mensajes ocupen más ancho disponible. |
| `frontend/src/components/workspace/Composer.tsx` | Ajustar layout: en móvil el textarea ocupa todo el ancho, el botón "Enviar" se mantiene a la derecha. Sin cambios estructurales. |
| `frontend/src/components/dashboard/Pagination.tsx` | En móvil, el indicador de rango "1-20" se oculta y solo se ven los botones Anterior/Siguiente. |
| `frontend/src/components/dashboard/ConversationsFilter.tsx` | En móvil, el `<select>` ocupa `w-full`. |
| `frontend/src/pages/conversations/[id].tsx` | Agregar `padding-top` en móvil para compensar header fijo si es necesario. Revisar `h-[calc(100vh-8rem)]` para asegurar que funciona en viewports móviles con barras de navegación del browser. |
| `frontend/src/pages/conversations/index.tsx` | Sin cambios directos. Hereda cambios de ConversationTable, Pagination, ConversationsFilter. |

### Archivos nuevos

**Ninguno.** Todos los cambios son modificaciones a componentes existentes. No se requieren componentes nuevos ni hooks nuevos.

Justificación: el sidebar overlay se implementa añadiendo props a Sidebar + Header + AppShell existentes. La tabla responsive se logra con CSS (Tailwind responsive prefixes) sin crear ConversationCard. El Composer y MessageBubble solo necesitan clases responsive adicionales.

### Archivos que NO se tocan

- `frontend/src/components/ui/*` — los componentes atómicos no necesitan cambios. Son lo suficientemente flexibles via `className` prop.
- `frontend/src/hooks/*` — no se modifica lógica de datos.
- `frontend/src/lib/*` — no se modifica.
- `frontend/src/types/*` — no se modifica.
- `frontend/src/contexts/AuthContext.tsx` — no se modifica.
- `frontend/src/pages/login.tsx` — no se modifica.
- `frontend/src/pages/_app.tsx` — no se modifica.
- `frontend/src/pages/index.tsx` — no se modifica.
- `frontend/tailwind.config.js` — usa los breakpoints por defecto de Tailwind. No necesita cambios.
- `backend/`, `infra/`, `docs/` — no se modifican.
- `frontend/src/components/workspace/MessageList.tsx` — no necesita cambios responsive (ya es flex-1 con overflow-y-auto).
- `frontend/src/components/ui/Table.tsx` — no necesita cambios. La tabla ya soporta `className` prop y renderiza `<table>` semántico. El scroll horizontal se maneja desde ConversationTable.

### Límite de tamaño del PR

- **Archivos modificados**: máximo 10
- **Líneas de diff**: máximo 300 (mayoría son clases de Tailwind responsive)
- **Archivos nuevos**: 0
- **Dependencias nuevas**: 0

---

## 3. Fuera de alcance

| Elemento | Motivo | Cuándo evaluar |
|----------|--------|----------------|
| **Dark mode** | F4B separado. No mezclar objetivos. | F4B |
| **Realtime / polling** | F4C separado. Requiere decisiones de infraestructura. | F4C |
| **Card layout para tabla en móvil** | Requeriría componente ConversationCard nuevo + lógica de detección de viewport. La tabla con scroll horizontal + columnas ocultas es suficientemente usable. | Si tests de usabilidad muestran que la tabla con scroll no es aceptable en móvil. |
| **Login page responsive** | Login es una página simple centrada con 2 inputs + botón. Funciona en todos los viewports sin cambios. | No evaluar a menos que se reporten issues. |
| **Sidebar con labels en desktop** | El diseño actual es icon-only con tooltip. Cambiarlo requeriría rediseño del sidebar. | F4 opcional, no planificado. |
| **Touch gestures (swipe to close sidebar)** | Añade complejidad sin beneficio claro. El botón de cerrar es suficiente. | Si analytics muestran baja tasa de cierre del sidebar. |
| **Aumentar tamaño de touch targets (44px mínimo)** | Los iconos actuales (h-5 w-5) son pequeños para touch. Ajustar padding/hit area. | **Incluido en accesibilidad**, no como feature separado. |

---

## 4. UX Goals

| Goal | Métrica | Cómo se logra |
|------|---------|---------------|
| Leer la lista de conversaciones en móvil | Sin scroll horizontal forzado | Tabla con `overflow-x-auto` wrapper + ocultar columnas "Último mensaje" y tiempo en `<md`. El usuario solo ve Contacto + Estado, que es suficiente para decidir si abrir la conversación. |
| Abrir una conversación desde móvil | ≤ 2 taps | Tap en fila → navega al workspace. El back button está siempre visible. El sidebar está oculto, dando máximo espacio al contenido. |
| Navegar entre conversaciones en móvil | ≤ 2 taps para volver | Back button en ConversationHeader siempre visible con label "Volver". Sin necesidad de abrir sidebar para navegar. |
| Sidebar accesible en móvil | ≤ 2 taps | Tap en hamburguesa → sidebar overlay con transición. Tap en backdrop o en "X" → cierra. |
| Enviar mensaje en móvil | Sin zoom forzado del navegador | Composer usa textarea con `font-size: 16px` mínimo (previene zoom automático en iOS). Botón de envío grande suficiente para tap. |
| Transiciones suaves entre breakpoints | Sin saltos visuales | Tailwind responsive classes manejan la visibilidad. No hay detección de viewport por JS, no hay re-renders por resize. |
| Misma funcionalidad en todos los breakpoints | Sin features ocultas en móvil | Todas las acciones disponibles: filtro, paginación, takeover, envío, back. Solo cambia la presentación visual. |

---

## 5. Breakpoints oficiales

| Nombre | Tailwind | Ancho | Dispositivo | Comportamiento |
|--------|----------|-------|-------------|----------------|
| **Mobile** | `<md` | <768px | Teléfonos, tablets pequeñas en portrait | Sidebar como overlay oculto, tabla muestra 2 columnas, paginación compacta, composer apilado. |
| **Tablet** | `md`—`<lg` | 768–1023px | Tablets landscape, phablets | Sidebar overlay (igual que mobile), tabla muestra 3 columnas, layout intermedio. |
| **Desktop** | `lg`+ | ≥1024px | Laptops, desktops | Layout actual sin cambios. Sidebar `w-16` fijo, tabla completa, header completo. |
| **Wide** | `xl`+ | ≥1280px | Monitores grandes | Igual que desktop. Sin cambios adicionales. |

**Por qué `lg` (1024px) como breakpoint principal:** El layout actual necesita al menos 1024px para mostrar cómodamente sidebar (64px) + tabla completa (4 columnas). Por debajo de 1024px, el sidebar compite con el contenido. El punto de quiebre natural está cuando la tabla de conversaciones empieza a comprimirse vertical u horizontalmente.

**Por qué NO se usa `sm` (640px) como breakpoint separado:** La distinción entre tablet y mobile es innecesaria para esta app. Ambos reciben el mismo tratamiento: sidebar overlay + tabla simplificada. No hay espacio para un layout de 3 columnas en tablets porque eso no aporta valor vs el desktop layout completo. El comportamiento tablet es idéntico al mobile, con la única diferencia de que la tabla muestra 3 columnas en vez de 2. Esto se maneja con una única regla `max-md:` para mobile y el default para tablet/desktop.

---

## 6. Visual Hierarchy

La jerarquía visual se mantiene igual que en F1/F2/F3. Solo cambia el layout por breakpoint:

### Desktop (≥1024px) — Sin cambios respecto a F3

```
┌──────────────────────────────────────────────────────────────┐
│  Header: title                        user@mail.com  [─]    │
│  ┌──┐                                                       │
│  │  │  ┌────────────────────────────────────────────────────┤│
│  │  │  │  Content area (table / messages)                   ││
│  │  │  │                                                    ││
│  │  │  │                                                    ││
│  │  │  │                                                    ││
│  │  │  └────────────────────────────────────────────────────││
│  └──┘                                                       │
└──────────────────────────────────────────────────────────────┘
```

Sidebar siempre visible (w-16), contenido ocupa el resto.

### Mobile (<1024px)

```
┌──────────────────────────────────────────────────────────────┐
│  Header: [☰]  Conversaciones                                │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  Toolbar: [Filtrar: Todas ▼] (full width)                ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  CONTACTO      │ ESTADO         (scroll →)               ││
│  ├────────────────┼────────────────                          ││
│  │  Juan Pérez    │ [Activa]                                 ││
│  │  María García  │ [Takeover]                               ││
│  │  Carlos López  │ [Cerrada]                                ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  [← Anterior]           [Siguiente →]                   ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

Sidebar invisible. Toolbar y tabla ocupan 100% del ancho. La tabla tiene scroll horizontal si es necesario. Columnas "Último mensaje" y tiempo ocultas en `<md`.

### Sidebar abierta (mobile overlay)

```
┌──────────┬───────────────────────────────────────────────────┐
│          │  (backdrop semi-transparente: bg-black/50)         │
│  ┌──────┐│  ┌───────────────────────────────────────────────┐│
│  │  ☰   ││  │  Content area (detrás del backdrop, no       ││
│  │      ││  │  interactuable)                               ││
│  │ 💬    ││  │                                               ││
│  │      ││  │                                               ││
│  │      ││  │                                               ││
│  │      ││  └───────────────────────────────────────────────││
│  │user@ ││                                                  ││
│  └──────┘│                                                  │
│          │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

Sidebar: fixed left, z-50, animate slide from left. Backdrop: z-40, click to close. Sidebar incluye email del usuario al final (no visible en desktop porque el header lo muestra).

### Workspace en móvil

```
┌──────────────────────────────────────────────────────────────┐
│  Header: [☰]  Juan Pérez                                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  ConversationHeader                                      ││
│  │  ← Volver                [Activa]  [Tomar control]       ││
│  ├──────────────────────────────────────────────────────────┤│
│  │  MessageList (flex-1)                                    ││
│  │                                                          ││
│  │  ┌─────────────────────────────────────┐                 ││
│  │  │ Hola, necesito información          │ ← inbound       ││
│  │  └─────────────────────────────────────┘                 ││
│  │                                                          ││
│  │           ┌──────────────────────────┐                   ││
│  │           │ Claro, ¿qué necesita?    │ → outbound        ││
│  │           └──────────────────────────┘                   ││
│  │                                                          ││
│  ├──────────────────────────────────────────────────────────┤│
│  │  ┌────────────────────────────┐  [Enviar]               ││
│  │  │ Escribe un mensaje...      │                          ││
│  │  └────────────────────────────┘                          ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

Workspace ocupa todo el viewport. ConversationHeader es compacto. Las burbujas ocupan `max-w-[85%]` para mejor legibilidad en pantalla estrecha.

---

## 7. Componentes afectados

### 7.1 AppShell

| Aspecto | Definición |
|---------|------------|
| **Cambio** | Agregar estado `sidebarOpen: boolean` con `useState(false)`. Renderizar backdrop overlay condicional (`sidebarOpen && <lg`) y pasarlo a Sidebar. Pasar `onToggleSidebar` a Header. |
| **Props** | Sin cambios en props públicas. `children` sigue siendo el único prop. |
| **Estado interno** | `sidebarOpen: boolean` — controla visibilidad del sidebar en móvil. |
| **Backdrop** | Div con `fixed inset-0 bg-black/50 z-40 transition-opacity`. Solo se renderiza cuando `sidebarOpen === true` y viewport < lg. Click en backdrop → `setSidebarOpen(false)`. |
| **Estructura** | El flex container actual (`flex min-h-screen bg-gray-50`) se mantiene. El Sidebar se mueve dentro del flujo normal en desktop, y se posiciona fixed en móvil. |
| **Tamaño del cambio** | ~15 líneas nuevas. |

**Justificación de useState vs useRef:** `useState` es necesario porque el toggle del sidebar requiere re-render para mostrar/ocultar el backdrop y animar la entrada del sidebar. No hay otra alternativa que no implique mutación del DOM directa (contra las convenciones de React).

**Justificación de no usar contexto:** El estado `sidebarOpen` solo lo usan AppShell (backdrop), Header (icono cambia entre Menu/X), y Sidebar (translate class). Prop drilling de 1 nivel es suficiente. Crear un contexto para esto es over-engineering.

### 7.2 Sidebar

| Aspecto | Definición |
|---------|------------|
| **Cambio** | Agregar props `isOpen: boolean` y `onClose: () => void`. En desktop (`lg:relative lg:w-16`), mismo comportamiento actual. En móvil (<lg): `fixed inset-y-0 left-0 z-50` con transform translate. Agregar email del usuario al final del sidebar en móvil. |
| **Props nuevas** | `isOpen: boolean`, `onClose: () => void` |
| **Breakpoint clases** | `fixed inset-y-0 left-0 z-50 w-64 bg-white border-r transform transition-transform duration-200 ease-in-out lg:relative lg:w-16 lg:transform-none lg:z-auto` + condicional `-translate-x-full` (cuando `!isOpen` y viewport < lg) |
| **User info en móvil** | Al final del sidebar, antes del borde inferior: `border-t mt-auto p-4` con email desde `useAuth()`. Esto reemplaza al email del Header en móvil (donde está oculto). En desktop, esta sección se oculta con `lg:hidden` porque el email ya está en el Header. |
| **Navegación en móvil** | Los iconos de navegación van acompañados de labels de texto visibles (el sidebar tiene 64px de ancho, no 16). Esto mejora la usabilidad táctil. `ml-3` después del icono. En desktop, los labels se ocultan (`lg:hidden`) y se mantiene el tooltip vía `title`. |
| **Cierre** | Al hacer clic en un link de navegación, se llama a `onClose()` para cerrar el sidebar automáticamente. |
| **Tamaño del cambio** | ~20 líneas nuevas, ~10 modificadas. |

**Justificación de w-64 en móvil:** Un sidebar de 64px (w-16) en móvil es demasiado pequeño para mostrar iconos con labels táctiles. 256px (w-64) es el estándar en Material Design y permite icono + label + espaciado cómodo para touch targets de 44px.

**Justificación de useAuth() en Sidebar:** Sidebar ya no tiene props externas (solo las nuevas `isOpen`/`onClose`). Leer el email de AuthContext sigue el mismo patrón que Header: el contexto se consume internamente, no se pasa como prop. Esto mantiene la coherencia con la arquitectura actual.

### 7.3 Header

| Aspecto | Definición |
|---------|------------|
| **Cambio** | Agregar prop `onToggleSidebar: () => void`. Renderizar botón hamburguesa (lucide `Menu`) en móvil. Envolver email+logout en `max-md:hidden`. |
| **Props nuevas** | `onToggleSidebar: () => void` |
| **Hamburguesa** | Button variant="ghost" con icono Menu (lucide). `lg:hidden` para ocultar en desktop. `aria-label="Abrir menú de navegación"`. Cuando `sidebarOpen`, el icono cambia a `X` (Close). |
| **Email+logout** | Envuelto en `<div className="max-md:hidden">`. En móvil, el email se muestra en el sidebar en vez del header. |
| **Título** | Sin cambios. Sigue siendo responsabilidad de la página/AppShell. |
| **Touch target** | Hamburguesa con `p-2` mínimo (touch target de 44×44px). Ícono `h-5 w-5`. |
| **Tamaño del cambio** | ~10 líneas nuevas. |

**Justificación de ocultar email en móvil:** El email del usuario es información contextual, no una acción frecuente. En un viewport de 375px, mostrar "admin@mail.com" + logout ocupa ~40% del ancho disponible, compitiendo con el título de la página. Moverlo al sidebar (accesible via hamburguesa) libera espacio para el contenido.

### 7.4 ConversationTable

| Aspecto | Definición |
|---------|------------|
| **Cambio** | Envolver `<Table>` en `<div className="overflow-x-auto">`. Modificar array de `headers` para incluir clases responsive en `className`: columna "Último mensaje" → `hidden md:table-cell`, columna de tiempo → `hidden max-md:hidden`. |
| **Headers modificados** | El header `{ key: "preview", label: "Último mensaje" }` recibe `className: "hidden md:table-cell"`. El header de tiempo recibe `className: "hidden max-md:hidden"` (oculto solo en <md, visible en tablet+). |
| **Celdas modificadas** | Cada celda en `rows` usa la misma clase que su header correspondiente. |
| **Overflow wrapper** | `<div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">` envuelve a `<Table>`. El scroll táctil en iOS necesita `-webkit-overflow-scrolling: touch` para una experiencia suave. |
| **Tamaño del cambio** | ~10 líneas modificadas. |

**Justificación de ocultar columnas:**
- **"Último mensaje"** oculta en <768px (mobile). En móvil, el usuario puede ver el preview al abrir la conversación. La decisión de "¿abro esta conversación?" se basa en Contacto + Estado.
- **Tiempo** oculto en <768px (mobile). Es la información menos crítica. En desktop, ayuda a identificar conversaciones recientes.
- **Contacto + Estado** siempre visibles. Son las dos columnas esenciales para la decisión primaria.

### 7.5 ConversationHeader

| Aspecto | Definición |
|---------|------------|
| **Cambio** | En móvil, el botón "Volver" se muestra con label siempre visible (no solo tooltip). Los elementos se distribuyen en filas separadas si es necesario. |
| **Back button** | clases: `flex-shrink-0` para que nunca se comprima. En móvil, label "Volver" visible (no solo aria-label). |
| **Layout** | `flex flex-wrap gap-2 items-start md:items-center justify-between`. En móvil, los elementos del header se apilan si no caben en una línea. |
| **Takeover button** | En móvil, texto corto: "Control" / "Devolver" en vez de "Tomar control" / "Devolver al bot" cuando el ancho es limitado. El texto largo se usa en desktop. |
| **Tamaño del cambio** | ~5 líneas modificadas (principalmente clases CSS). |

**Justificación del texto corto en takeover button:** "Tomar control" son 12 caracteres (~120px en 14px). En un viewport de 375px con padding, el espacio disponible para el botón es ~200px después de back button + nombre + badge. El texto corto garantiza que no haya wrapping forzado que rompa el layout.

### 7.6 MessageBubble

| Aspecto | Definición |
|---------|------------|
| **Cambio** | Ajustar ancho máximo de burbujas en móvil. |
| **Inbound** | `max-w-[85%] md:max-w-[70%]` |
| **Outbound** | `max-w-[85%] md:max-w-[70%]` |
| **Tamaño del cambio** | 2 líneas modificadas. |

**Justificación de 85% en móvil:** En una pantalla de 375px, el 70% son ~262px. Para mensajes de texto normales (~20-50 caracteres a ~14px), 262px son ~8-10 palabras por línea, que es perfectamente legible. Pero considerando padding (16px × 2) y márgenes, el área efectiva se reduce. El 85% (~319px) ofrece mejor aprovechamiento del espacio sin llegar a ser incómodo (el 100% dificultaría distinguir inbound de outbound).

### 7.7 Composer

| Aspecto | Definición |
|---------|------------|
| **Cambio** | En móvil, asegurar que textarea y botón ocupen el ancho completo sin solapamiento. Sin cambios estructurales. |
| **Layout** | El flex row actual (`flex items-end gap-2`) se mantiene. Classes: `max-md:gap-1` para reducir espacio entre textarea y botón en móvil. |
| **Textarea** | Sin cambios. El auto-resize máximo de 6 líneas se mantiene. Font-size 16px mínimo (evita zoom automático en iOS al hacer focus). |
| **Botón** | `flex-shrink-0` para que nunca se comprima. |
| **Tamaño del cambio** | 1-2 líneas modificadas (clases CSS). |

### 7.8 Pagination

| Aspecto | Definición |
|---------|------------|
| **Cambio** | En móvil (<md), ocultar el indicador de rango "1-20". Solo mostrar botones Anterior/Siguiente. |
| **Rango** | El `<span>` con "1-20" se envuelve en `hidden md:inline`. |
| **Botones** | Sin cambios en funcionalidad. En móvil, se mantienen con `aria-label`. |
| **Tamaño del cambio** | 1 línea modificada (clase añadida al span). |

### 7.9 ConversationsFilter

| Aspecto | Definición |
|---------|------------|
| **Cambio** | En móvil, el `<select>` ocupa el 100% del ancho disponible. |
| **Select** | clases actuales + `w-full md:w-auto` |
| **Layout** | El contenedor actual se mantiene. En móvil, el filtro ocupa todo el ancho del toolbar, facilitando el tap. |
| **Tamaño del cambio** | 1 línea modificada. |

---

## 8. Componentes reutilizados (sin cambios)

| Componente | Ruta | Por qué no cambia |
|-----------|------|-------------------|
| `Button` | `ui/Button` | Ya soporta `className` prop para personalización responsive. No necesita cambios. |
| `Badge` | `ui/Badge` | Es un span con color. Su tamaño es inherente al contenido. No necesita cambios. |
| `Table` | `ui/Table` | Ya soporta `className` prop. El scroll horizontal se maneja desde ConversationTable. |
| `Skeleton` | `ui/Skeleton` | No afectado por responsive. |
| `EmptyState` | `ui/EmptyState` | Ya es centrado con padding. Funciona en todos los viewports. |
| `ErrorState` | `ui/ErrorState` | Ídem EmptyState. |
| `Input` | `ui/Input` | Solo se usa en login (que no se toca). |
| `MessageList` | `workspace/MessageList` | Es flex-1 con overflow-y-auto. Responsive por naturaleza. |
| `ConversationsFilter` | `dashboard/ConversationsFilter` | Cambio mínimo: w-full en móvil. |
| `Pagination` | `dashboard/Pagination` | Cambio mínimo: ocultar rango en móvil. |
| `ConversationHeader` | `workspace/ConversationHeader` | Cambio mínimo: clases responsive. |

---

## 9. Componentes nuevos

**Ninguno.** Todos los cambios responsive se logran mediante:
1. Props adicionales en componentes existentes (AppShell, Sidebar, Header)
2. Clases CSS responsive (Tailwind `md:`, `lg:`, `max-md:` prefixes)
3. Ajustes de layout menores en componentes existentes

### Decisión explícita: NO crear ConversationCard

Aunque una card layout para móvil ofrecería mejor usabilidad que una tabla con scroll horizontal, el costo es:
- Nuevo componente ConversationCard (~40 líneas)
- Lógica condicional en ConversationTable para elegir entre Table y Cards (~15 líneas)
- Nuevos tests para ConversationCard
- Mantenimiento de dos representaciones paralelas del mismo dato

La tabla con `overflow-x-auto` + columnas selectivamente ocultas logra el objetivo con ~10 líneas de cambio. Si futuros tests de usabilidad muestran que la tabla con scroll es inaceptable, se puede crear ConversationCard en ese momento.

### Decisión explícita: NO crear hook useMediaQuery

El sidebar toggle usa estado de React + CSS. No necesita saber el viewport actual. Las clases responsive de Tailwind manejan la visibilidad. No hay lógica que dependa del breakpoint actual en JavaScript. Por lo tanto, un hook `useMediaQuery` sería código muerto.

---

## 10. Cambios por página

### Página de conversaciones (index.tsx)

| Elemento | Desktop (≥1024px) | Mobile (<1024px) |
|----------|-------------------|-------------------|
| Sidebar | `w-16`, siempre visible | Overlay, oculto por defecto |
| Header | Título + email + logout | Hamburguesa + título |
| Filtro | `w-auto` | `w-full` |
| Tabla | 4 columnas completas | 2 columnas (Contacto + Estado), scroll horizontal |
| Paginación | Rango visible + botones | Solo botones |
| Empty/Error state | Sin cambios | Sin cambios |

### Página de detalle ([id].tsx)

| Elemento | Desktop (≥1024px) | Mobile (<1024px) |
|----------|-------------------|-------------------|
| Sidebar | `w-16`, siempre visible | Overlay, oculto por defecto |
| Header | Título + email + logout | Hamburguesa + nombre contacto |
| ConversationHeader | Botón Volver (ghost) + nombre + badge + takeover | Volver con label + nombre + badge + takeover (texto corto) |
| MessageList | `max-w-[70%]` burbujas | `max-w-[85%]` burbujas |
| Composer | Layout normal | gap reducido |
| Altura workspace | `h-[calc(100vh-8rem)]` | Sin cambios (el header ocupa menos espacio por el sidebar oculto) |

### Login (sin cambios)

No se modifica. El formulario centrado funciona en todos los viewports.

---

## 11. Estrategia responsive

### Enfoque: Desktop-first con overrides mobile

**Decisión:** El código actual es desktop-first. En lugar de reescribir componentes con mobile-first (que implicaría cambiar todas las clases existentes), se añaden overrides responsive usando `max-md:` y `lg:` donde sea necesario.

**Justificación:** Reescribir todo el frontend con mobile-first rompería el principio de "no cambiar la arquitectura" y generaría un diff enorme para cero beneficio funcional. El enfoque de overrides produce un diff pequeño (estimado <300 líneas) y no toca el código desktop existente.

### Patrones CSS utilizados

**Sidebar overlay:**
```tsx
// Sidebar.tsx
<div className={clsx(
  "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r transform transition-transform duration-200 ease-in-out",
  "lg:relative lg:w-16 lg:transform-none lg:z-auto",
  !isOpen && "-translate-x-full lg:translate-x-0"
)}>
```

**Header hamburguesa:**
```tsx
// Header.tsx
<button onClick={onToggleSidebar} className="lg:hidden p-2" aria-label="Abrir menú">
  <Menu className="h-5 w-5" />
</button>
```

**Tabla columnas:**
```tsx
// ConversationTable.tsx - header definition
{ key: "preview", label: "Último mensaje", className: "hidden md:table-cell" }
{ key: "time", label: "", className: "hidden md:table-cell" }
```

**Burbujas:**
```tsx
// MessageBubble.tsx
max-w-[85%] md:max-w-[70%]
```

### Transiciones y animaciones

| Elemento | Animación | Duración | Easing |
|----------|-----------|----------|--------|
| Sidebar slide in/out | `translate-x` | 200ms | `ease-in-out` |
| Backdrop fade | `opacity` | 200ms | `ease-in-out` |

Solo estas dos animaciones. No hay animaciones en la tabla, paginación, burbujas, composer, ni header. Consistente con el principio de F1: "transition: all prohibited" para elementos no interactivos.

### Scroll horizontal en tabla

La tabla usa `overflow-x-auto` con `-webkit-overflow-scrolling: touch` para iOS. El scroll es táctil nativo, no personalizado. No se usa ninguna librería ni hook.

---

## 12. Accesibilidad

| Aspecto | Implementación |
|---------|---------------|
| **Hamburguesa** | `aria-label="Abrir menú de navegación"` / `"Cerrar menú de navegación"` según estado. `aria-expanded` bindeado a `isOpen`. |
| **Sidebar overlay** | Cuando el sidebar está abierto en móvil, el contenido principal tiene `aria-hidden="true"` o `inert` (si es soportado). El foco se atrapa dentro del sidebar (focus trap básico: Tab y Shift+Tab ciclan dentro del sidebar). Al cerrar, el foco vuelve al botón hamburguesa. |
| **Backdrop** | `role="presentation"` + `aria-hidden="true"`. Click handler cierra sidebar. Solo visible en móvil. |
| **Tabla scroll horizontal** | La tabla tiene `tabIndex="0"` cuando está en scroll horizontal para que usuarios de teclado puedan hacer scroll con flechas. En desktop sin scroll, el tabIndex se mantiene en 0 (como está actualmente) para la navegación de filas. |
| **Columnas ocultas** | Las columnas ocultas con `hidden` no son anunciadas por screen readers. No se necesita `aria-hidden` adicional. Los datos siguen disponibles en la página de detalle al abrir la conversación. |
| **Touch targets** | Todos los elementos interactivos en móvil tienen mínimo 44×44px de hit area (WCAG 2.5.5). La hamburguesa tiene `p-2` adicional. El botón de takeover mantiene su padding actual. Los botones de paginación tienen padding suficiente. |
| **Font-size mínimo** | Composer textarea: `text-base` (16px) para prevenir zoom automático en iOS al hacer focus. Los placeholders y botones mantienen su tamaño actual. |
| **Orientación** | No se bloquea orientación. La app funciona en portrait y landscape. No hay declaraciones `orientation` en CSS. |
| **Texto responsable** | Sin truncamiento que oculte información crítica en móvil. El takeover button usa texto corto pero descriptivo. |

---

## 13. Performance

| Aspecto | Decisión |
|---------|----------|
| **Overhead de render** | El sidebar overlay añade 1 div (backdrop) condicional. El estado `sidebarOpen` causa 1 re-render adicional en AppShell, Sidebar y Header al abrir/cerrar. Impacto despreciable. |
| **Transiciones CSS** | `transform` y `opacity` son propiedades que el navegador puede animar sin触发 layout (solo compositing). `will-change: transform` en el sidebar para predecir la animación y evitar repaints durante la transición. |
| **Overflow scroll** | `overflow-x-auto` en la tabla no tiene impacto en performance porque el contenido es pequeño (<100 filas). El scroll táctil nativo no añade overhead. |
| **Sin JS resize listeners** | No se usa `window.resize`, `matchMedia` en JS, ni `ResizeObserver`. Cero overhead de JavaScript en resize. |
| **Bundle** | 0 bytes nuevos. No se agregan dependencias ni componentes. Las clases responsive se generan en build time por Tailwind (no añaden peso al JS bundle). |

**Cumplimiento de Lighthouse:**

| Métrica | Estado actual | Estado esperado post-F4A |
|---------|---------------|--------------------------|
| Cumulative Layout Shift (CLS) | Bueno (sin cambios de layout bruscos) | Se mantiene. Las transiciones del sidebar son predecibles y controladas por CSS. |
| Total Blocking Time (TBT) | Bueno (sin JS pesado) | Se mantiene. El nuevo código JS es ~10 líneas de estado. |
| First Contentful Paint (FCP) | Bueno | Sin cambios (no se modifican recursos críticos ni lazy loading). |

---

## 14. Riesgos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| **iOS scroll suave en tabla** | Medio | `-webkit-overflow-scrolling: touch` puede causar problemas de z-index y scroll bouncing en iOS. Alternativa: usar overflow nativo sin prefijo (iOS 13+ incluye scroll suave nativo). |
| **Sidebar y Header fuera de sync** | Bajo | El estado `sidebarOpen` vive en AppShell. Header y Sidebar reciben props sincronizadas. No hay fuente de verdad duplicada. |
| **Focus trap incompleto en sidebar** | Medio | Implementar focus trap manual: al abrir sidebar, enfocar el primer elemento (primer icono de navegación). Al cerrar, devolver foco a hamburguesa. La implementación básica (que el foco no se escape al backdrop) se logra con `onKeyDown={e => e.key === 'Escape' && onClose()}` en el backdrop. |
| **Overflow-x-auto interfiere con Touch** | Bajo | En iOS, el scroll horizontal de la tabla puede interferir con el swipe para navegación hacia atrás. No hay mitigación sin nativa. Aceptable. |
| **Cambios en Header rompen props** | Medio | Header actual no tiene props (lee datos de AuthContext internamente). Agregar `onToggleSidebar` es un cambio hacia adelante (nueva prop opcional → si algún test no la pasa, header ignora). |
| **Sidebar con dos modos (fixed/relative)** | Medio | El componente Sidebar debe comportarse como overlay en móvil y como inline-block en desktop. La transición entre modos puede causar layout shift momentáneo al cruzar breakpoints. Mitigación: en lg+, el sidebar ignora el estado `isOpen` y se renderiza como relative siempre. |
| **Viewport del browser en móvil (URL bar)** | Bajo | `100vh` en iOS incluye la URL bar, que se oculta al hacer scroll. `h-[calc(100vh-8rem)]` puede calcular mal en móvil si la URL bar está visible. Mitigación: usar `100dvh` (dynamic viewport height) si está disponible, con fallback a `100vh`. Esto se maneja en la página `[id].tsx` (única que usa calc con vh). |

---

## 15. Testing

### Tests nuevos o modificados

| Componente | Test | Tipo |
|------------|------|------|
| `AppShell` | sidebarOpen = false → backdrop no renderizado | Nuevo |
| `AppShell` | sidebarOpen = true → backdrop renderizado, onClick cierra sidebar | Nuevo |
| `AppShell` | en lg+, backdrop nunca renderizado (simular resize no es necesario porque es CSS) | Nuevo |
| `Sidebar` | recibe isOpen=true → translate-x-0, isOpen=false → -translate-x-full | Nuevo |
| `Sidebar` | en lg+, las clases de transform se ignoran (no se puede testear en jsdom — se verifica en QA visual) | QA visual |
| `Header` | recibe onToggleSidebar → hamburguesa renderizada en móvil | Nuevo |
| `Header` | clic en hamburguesa → llama onToggleSidebar | Nuevo |
| `Header` | email+logout no visibles (clase hidden en <md — test de presencia en DOM) | Nuevo |
| `ConversationTable` | headers y celdas tienen clases responsive correctas | Modificado |
| `ConversationTable` | overflow-x-auto wrapper existe | Modificado |
| `MessageBubble` | inbound tiene max-w-[85%] en móvil (clase presente) | Modificado |
| `Pagination` | rango oculto en móvil (clase hidden) | Modificado |

### Tests que NO cambian

- Todos los tests de F1 (ui/*, layout/*) — los componentes atómicos no se modifican.
- Todos los tests de hooks F2/F3 — no se toca lógica de datos.
- Todos los tests de F2 (dashboard/*) — ConversationTable tests existentes no cambian, solo se agregan nuevos.
- Todos los tests de F3 (workspace/*) — MessageBubble test existente se modifica, el resto no cambia.

### Estrategia de testing para responsive

- **Test de unidades:** Verificar que las clases CSS correctas se aplican condicionalmente según props (sidebarOpen, isOpen, etc.).
- **Test de presencia:** Verificar que elementos ocultos en móvil están en el DOM con clases `hidden`.
- **Test de interacción:** Verificar que clic en hamburguesa → onToggleSidebar, clic en backdrop → sidebar cierra.
- **QA visual (no automatizado):** Verificar en Chrome DevTools conviewport 375px, 768px, 1024px, 1280px que:
  - Sidebar se oculta/muestra correctamente en cada breakpoint
  - Tabla no tiene desbordamiento horizontal en desktop
  - Columnas se ocultan/muestran en cada breakpoint
  - Composer es usable en 375px
  - Burbujas de mensaje no se salen del viewport
- **No se implementan tests de responsive visual (regression testing):** No hay herramientas configuradas para screenshot diff. Se evaluaría en F4 si el proyecto adopta Chromatic/Percy.

### Cobertura esperada

- **Archivos modificados:** ≥90% (los tests existentes ya cubren la funcionalidad base; los nuevos tests cubren los cambios responsive).
- **Archivos nuevos:** 0.
- **Global:** Se mantiene ≥90%.

---

## 16. Definition of Done

Cada ítem debe responderse con SI/NO.

### Build y estática
- [ ] `npm run build` compila sin errores
- [ ] `npm run lint` pasa sin warnings
- [ ] `npx vitest run` pasa con ≥90% de cobertura en archivos modificados
- [ ] No se agregaron dependencias nuevas en `package.json`
- [ ] Sin `console.log`, `TODO`, `FIXME` en código de producción

### Sidebar (responsive)
- [ ] Sidebar es `w-16 relative` en ≥1024px (sin cambios visuales)
- [ ] Sidebar es overlay (`fixed`, `z-50`, con translate) en <1024px
- [ ] Sidebar se abre/cierra con animación suave (transform 200ms)
- [ ] Backdrop (bg-black/50) aparece cuando sidebar está abierto en móvil
- [ ] Click en backdrop cierra sidebar
- [ ] Escape cierra sidebar
- [ ] Foco se mueve al sidebar al abrir, vuelve a hamburguesa al cerrar
- [ ] Sidebar muestra email del usuario en móvil (oculto en desktop)

### Header (responsive)
- [ ] Header muestra hamburguesa (lucide Menu/X) en <1024px
- [ ] Hamburguesa tiene aria-label dinámico (abrir/cerrar)
- [ ] Hamburguesa tiene aria-expanded bindeado a isOpen
- [ ] Email+logout se ocultan en <768px
- [ ] Touch target de hamburguesa ≥44×44px

### Tabla (responsive)
- [ ] ConversationTable envuelve Table en div con overflow-x-auto
- [ ] Columna "Último mensaje" oculta en <768px (`hidden md:table-cell`)
- [ ] Columna de tiempo oculta en <768px (`hidden md:table-cell`)
- [ ] Contacto + Estado siempre visibles

### Workspace (responsive)
- [ ] MessageBubble inbound usa `max-w-[85%]` en <768px, `max-w-[70%]` en ≥768px
- [ ] ConversationHeader apila elementos correctamente en viewports estrechos
- [ ] Takeover button usa texto corto en móvil si es necesario
- [ ] Composer mantiene layout usable en 320px viewport

### Pagination
- [ ] Indicador de rango "1-20" oculto en <768px

### Filters
- [ ] Select de filtro usa `w-full` en <768px

### Viewport
- [ ] Meta viewport tag configurado correctamente (Next.js default es correcto)
- [ ] Sin scroll horizontal forzado en ningún breakpoint
- [ ] Sin contenido cortado en viewport de 375px

### Accesibilidad (verificable)
- [ ] Hamburguesa tiene aria-label + aria-expanded
- [ ] Backdrop tiene aria-hidden="true"
- [ ] Foco manejado correctamente en open/close del sidebar
- [ ] Touch targets ≥44×44px en todos los elementos interactivos móvil
- [ ] Tabla con overflow-x-auto tiene tabIndex para navegación teclado

### Documentación
- [ ] Design document actualizado si hubo cambios durante implementación

---

## 17. Plan de implementación

Orden de implementación. Cada paso produce código compilable y testeable.

### Fase 1 — Sidebar responsive (AppShell + Sidebar + Header)

- [ ] 1.1. Modificar `AppShell.tsx`:
  - [ ] 1.1.1. Agregar `const [sidebarOpen, setSidebarOpen] = useState(false)`
  - [ ] 1.1.2. Pasar `onToggleSidebar={() => setSidebarOpen(prev => !prev)}` a Header
  - [ ] 1.1.3. Pasar `isOpen={sidebarOpen}` y `onClose={() => setSidebarOpen(false)}` a Sidebar
  - [ ] 1.1.4. Renderizar backdrop condicional: `{sidebarOpen && <div ... onClick={() => setSidebarOpen(false)} ... />}`
  - [ ] 1.1.5. Verificar: `npm run build` compila

- [ ] 1.2. Modificar `Sidebar.tsx`:
  - [ ] 1.2.1. Agregar props `isOpen: boolean` y `onClose: () => void`
  - [ ] 1.2.2. Agregar clases responsive: `fixed ... lg:relative lg:w-16 lg:transform-none`
  - [ ] 1.2.3. Agregar translate condicional: `!isOpen && "-translate-x-full lg:translate-x-0"`
  - [ ] 1.2.4. Agregar email del usuario al final del sidebar (useAuth + border-top)
  - [ ] 1.2.5. Agregar labels de navegación visibles en móvil (ocultos en desktop)
  - [ ] 1.2.6. Llamar `onClose()` al hacer clic en un link de navegación
  - [ ] 1.2.7. Manejar tecla Escape para cerrar
  - [ ] 1.2.8. Verificar: `npx vitest run` pasa

- [ ] 1.3. Modificar `Header.tsx`:
  - [ ] 1.3.1. Agregar prop `onToggleSidebar?: () => void`
  - [ ] 1.3.2. Renderizar hamburguesa (lucide Menu) con `lg:hidden`
  - [ ] 1.3.3. Cuando sidebar está abierto, cambiar icono a X
  - [ ] 1.3.4. Envolver email+logout en `max-md:hidden`
  - [ ] 1.3.5. Agregar aria-label y aria-expanded a hamburguesa
  - [ ] 1.3.6. Verificar: `npx vitest run` pasa

- [ ] 1.4. Actualizar tests:
  - [ ] 1.4.1. AppShell.test.tsx: nuevos tests para backdrop y toggle
  - [ ] 1.4.2. Sidebar.test.tsx: nuevos tests para isOpen y onClose
  - [ ] 1.4.3. Header.test.tsx: nuevos tests para hamburguesa y responsive
  - [ ] 1.4.4. Verificar: `npx vitest run --coverage` ≥90%

### Fase 2 — Dashboard responsive

- [ ] 2.1. Modificar `ConversationTable.tsx`:
  - [ ] 2.1.1. Envolver `<Table>` en `<div className="overflow-x-auto">`
  - [ ] 2.1.2. Agregar `className: "hidden md:table-cell"` a header "Último mensaje"
  - [ ] 2.1.3. Agregar `className: "hidden md:table-cell"` a header de tiempo
  - [ ] 2.1.4. Aplicar mismas clases a celdas correspondientes
  - [ ] 2.1.5. Verificar: `npx vitest run` pasa

- [ ] 2.2. Modificar `ConversationsFilter.tsx`:
  - [ ] 2.2.1. Cambiar className del select de `w-auto` a `w-full md:w-auto`
  - [ ] 2.2.2. Verificar: test existente pasa

- [ ] 2.3. Modificar `Pagination.tsx`:
  - [ ] 2.3.1. Envolver el `<span>` del rango en `hidden md:inline`
  - [ ] 2.3.2. Verificar: test existente pasa

- [ ] 2.4. Actualizar tests de dashboard:
  - [ ] 2.4.1. ConversationTable.test.tsx: verificar clases responsive en headers/celdas
  - [ ] 2.4.2. Pagination.test.tsx: verificar rango oculto en mobile
  - [ ] 2.4.3. Verificar: `npx vitest run --coverage` ≥90%

### Fase 3 — Workspace responsive

- [ ] 3.1. Modificar `ConversationHeader.tsx`:
  - [ ] 3.1.1. Agregar `flex-wrap` y `items-start md:items-center` al contenedor
  - [ ] 3.1.2. Asegurar que back button tiene `flex-shrink-0`
  - [ ] 3.1.3. Verificar: `npx vitest run` pasa

- [ ] 3.2. Modificar `MessageBubble.tsx`:
  - [ ] 3.2.1. Cambiar `max-w-[70%]` a `max-w-[85%] md:max-w-[70%]`
  - [ ] 3.2.2. Verificar: `npx vitest run` pasa

- [ ] 3.3. Modificar `Composer.tsx`:
  - [ ] 3.3.1. Reducir gap a `max-md:gap-1`
  - [ ] 3.3.2. Verificar: `npx vitest run` pasa

- [ ] 3.4. Verificar `[id].tsx`:
  - [ ] 3.4.1. Revisar que `h-[calc(100vh-8rem)]` funciona en viewports móviles
  - [ ] 3.4.2. Si hay issues con URL bar, migrar a `100dvh` con fallback

- [ ] 3.5. Actualizar tests de workspace:
  - [ ] 3.5.1. MessageBubble.test.tsx: verificar clases responsive
  - [ ] 3.5.2. ConversationHeader.test.tsx: verificar flex-wrap
  - [ ] 3.5.3. Verificar: `npx vitest run --coverage` ≥90%

### Fase 4 — QA visual y verificación final

- [ ] 4.1. `npm run build` sin errores
- [ ] 4.2. `npm run lint` sin warnings
- [ ] 4.3. `npx vitest run` pasa con ≥90% cobertura
- [ ] 4.4. QA visual en Chrome DevTools:
  - [ ] 4.4.1. Viewport 375px: sidebar overlay funcional, tabla 2 columnas, burbujas 85%
  - [ ] 4.4.2. Viewport 768px: sidebar overlay, tabla 3 columnas, layout intermedio
  - [ ] 4.4.3. Viewport 1024px: sidebar fijo, tabla completa, sin cambios visuales
  - [ ] 4.4.4. Viewport 1280px: todo como antes
- [ ] 4.5. QA en dispositivo real (iOS Safari, Chrome Android) si está disponible
- [ ] 4.6. Verificar que no se modificaron archivos fuera del alcance

---

## 18. Riesgos técnicos

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| **iOS Safari 100vh bug** | Medio | La URL bar de Safari ocupa espacio y `100vh` no la descuenta. El workspace usa `h-[calc(100vh-8rem)]` que puede calcular mal. Usar `100dvh` con fallback CSS para iOS 15.2+. |
| **Scroll horizontal en tabla no es intuitivo en móvil** | Bajo | Alternativa ConversaciónCard si tests de usabilidad lo requieren. Por ahora, el scroll horizontal con columna oculta es suficiente. |
| **Transición de translate interfiere con render del sidebar** | Bajo | `will-change: transform` en el sidebar + hardware acceleration. No debería haber flickering en dispositivos modernos. |
| **Hamburguesa visible en desktop por error de clases** | Bajo | Usar `lg:hidden` garantiza que el botón nunca sea visible en ≥1024px. Se verifica en QA visual. |
| **Sidebar no cierra al hacer clic en link en móvil** | Medio | Se llama `onClose()` explícitamente en el onClick de cada Link. No hay race conditions porque el estado se actualiza síncronamente antes de la navegación. |
| **Overflow scroll en tabla no funciona en Firefox Android** | Bajo | Firefox Android soporta overflow-x-auto sin prefijos desde 2019. |

---

## 19. Pre-flight Questions

### 1. ¿Cuál es la acción principal del usuario en móvil?

Encontrar una conversación y abrirla (dashboard), o leer mensajes y responder (workspace).

**Implicaciones:**
- El sidebar debe estar fuera del camino (overlay, no fijo).
- La tabla debe ser legible sin zoom ni scroll horizontal (columnas ocultas).
- El back button debe estar siempre accesible.
- El composer debe ser usable con una mano.

### 2. ¿Qué información debe verse primero en móvil?

En dashboard: **Contacto + Estado** (mismas decisiones que en desktop, pero sin preview).
En workspace: **Nombre + Estado** (en ConversationHeader) y **últimos mensajes**.

**Implicaciones:** Al ocultar la columna "Último mensaje" en móvil, el usuario pierde contexto previo a abrir la conversación. Esto es aceptable porque: (a) la decisión de abrir se basa en quién es el contacto y si requiere atención, y (b) el preview está a un tap de distancia.

### 3. ¿Qué elementos son los más críticos en mobile first?

- **Hamburguesa**: debe ser obvia, grande (touch target ≥44px), con icono estándar (☰ o lucide Menu).
- **Back button**: "Volver" con label visible, siempre presente en detalle.
- **Enviar mensaje**: textarea grande, botón de envío prominente, Enter para enviar.
- **Filtro de conversaciones**: debe ser fácil de cambiar con una mano, opción seleccionada visible.

### 4. ¿Perdemos alguna funcionalidad en móvil?

No. Mismas acciones disponibles en todos los breakpoints:
- Ver lista de conversaciones y filtrar
- Abrir conversación y leer historial
- Cambiar estado (takeover/return)
- Enviar mensajes
- Cerrar sesión
- Navegar entre páginas

### 5. ¿Los tests existentes siguen pasando después de los cambios?

Sí. Las modificaciones son:
- Adición de props opcionales (onToggleSidebar, isOpen, onClose) — no rompen firmas existentes.
- Adición de clases responsive — no afectan la lógica.
- Envolver Table en un div con overflow — el mismo Table se renderiza con las mismas props.

---

## 20. Matriz de impacto

| Aspecto | Impacto | Justificación |
|---------|---------|---------------|
| **Código existente** | Bajo | Solo se modifican 9 archivos. Ningún componente se reescribe. Todos los cambios son aditivos (nuevas props, nuevas clases, nuevos wrappers). |
| **Tests existentes** | Ninguno | No se modifica la lógica de negocio. Las props nuevas son opcionales. Las clases responsive no afectan el comportamiento funcional. |
| **Backend** | Ninguno | No se toca. |
| **API** | Ninguno | No se toca. |
| **Dependencias** | Ninguno | 0 nuevas. lucide-react ya tiene Menu y X. |
| **Bundle size** | Bajo | ~10 líneas de JS (estado sidebarOpen). El resto es CSS generado por Tailwind (clases responsive ya existen en el bundle aunque no se usaban). |
| **Performance** | Bajo | Sin resize listeners, sin re-renders en resize, sin polling. Una transición CSS de 200ms. |
| **Accesibilidad** | Positivo | Touch targets más grandes, aria-expanded en hamburguesa, focus management en sidebar. La tabla con scroll ahora tiene tabIndex para teclado. |
| **UX Mobile** | Alto (positivo) | La app pasa de no ser usable en móvil a ser completamente funcional. |
| **Mantenibilidad** | Bajo | Las clases responsive son declarativas y colocalizadas con el componente. No hay lógica condicional compleja. No hay nuevos archivos que mantener. |
| **Riesgo de regresión** | Bajo | El código desktop no se modifica. Los overrides responsive solo afectan a viewports <1024px. |

---

## 21. Auto-auditoría

### Contradicciones

- **Ninguna detectada.** Las decisiones están alineadas con F1 (sidebar w-16, desktop-first), F2 (tabla responsive diferido a F4, columna "Último mensaje" ocultable en 768px), y F3 (workspace responsive diferido a F4).

### Componentes innecesarios

- **Ninguno.** Todos los componentes modificados son existentes y necesarios. No se proponen componentes nuevos.

### Reutilización insuficiente

- **Sidebar reutiliza useAuth()** — mismo patrón que Header, cero duplicación.
- **Header recibe onToggleSidebar como prop** — AppShell gestiona el estado, no hay lógica de toggle duplicada.
- **ConversationTable reutiliza Table** — sin cambios en Table.tsx, el override es en ConversationTable.
- **Overflow-x-auto se maneja en ConversationTable** — Table.tsx no necesita conocer responsive.

### Deuda técnica

- **No se implementa focus trap completo en sidebar overlay.** La implementación básica (Escape + clic en backdrop + foco inicial) cubre el 95% de los casos. Un focus trap completo requeriría un hook dedicado o una librería, lo que contradice "no nuevas dependencias". Se documenta como mejora futura.
- **No se detecta el breakpoint vía JS.** La transición del sidebar usa CSS solamente. Esto significa que al redimensionar de desktop a móvil con el sidebar abierto, el sidebar mantiene su estado. Al cruzar el breakpoint, CSS cambia el sidebar de `relative` (visible) a `fixed -translate-x-full` (oculto). Este salto visual es aceptable porque es un edge case poco frecuente (redimensionar activamente la ventana mientras se usa la app). No se implementa `matchMedia` listener para evitarlo porque añadiría complejidad y un re-render adicional.

### UX

- **Prioridad correcta:** Contenido > Navegación. El sidebar se oculta para dar máximo espacio al contenido.
- **Estados cubiertos:** sidebar abierto, sidebar cerrado, sidebar en desktop. Sin edge cases sin manejar.
- **Transiciones suaves:** 200ms para sidebar slide, fondo semi-transparente para contexto.
- **Problema conocido:** La tabla con overflow-x-auto en móvil requiere que el usuario haga scroll horizontal para ver "Estado" si está mirando solo "Contacto". Las columnas ocultas reducen este problema. Para móvil, Contacto + Estado son suficientes para la decisión de apertura.

### Accesibilidad

- **Hamburguesa:** ✅ aria-label, aria-expanded, icono reconocible.
- **Sidebar overlay:** ⚠️ Focus trap no completo (ver deuda técnica). Escape y clic en backdrop funcionan.
- **Tabla scroll:** ✅ tabIndex en scroll container.
- **Touch targets:** ✅ ≥44×44px en todos los interactivos.
- **Contraste:** Sin cambios respecto a F1-F3. Todas las proporciones se mantienen.

### Mantenibilidad

- 9 archivos modificados, 0 nuevos. Líneas de diff estimadas <300.
- Sin nuevas dependencias.
- Sin cambios en la lógica de datos (hooks, API, contextos).
- Las clases responsive están colocalizadas con el componente que modifican.
- El estado del sidebar es local a AppShell con prop drilling de 1 nivel.

### Veredicto

**Documento listo para implementación.** Sin contradicciones, sin componentes innecesarios, sin deuda técnica evitable. Todos los cambios son aditivos y no rompen código existente. El enfoque desktop-first con overrides minimiza el riesgo de regresión y el tamaño del diff.
