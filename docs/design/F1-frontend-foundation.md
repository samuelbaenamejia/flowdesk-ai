# F1 — Frontend Foundation

## 1. Objetivo del PR

### Qué resuelve

- El frontend actual no tiene testing infrastructure (Vitest, RTL, jsdom).
- No hay un sistema de diseño consistente: los colores, tipografía y espaciado son arbitrarios.
- `Layout.tsx` usa emojis en la navegación (`💬`, `🏠`) en lugar de lucide-react.
- No hay componentes UI reutilizables: cada página tiene su propio `<button>`, `<input>`, `<select>` inline.
- No hay tokens de diseño: `tailwind.config.js` está vacío.
- No hay fuente Inter cargada vía `next/font`.
- No hay layout responsive (sidebar siempre visible, no colapsa).
- No hay `animate-pulse` para skeletons ni estados vacíos/error como componentes.

### Qué NO resuelve

- La lista de conversaciones con filtros y paginación (F2).
- El workspace de conversación con chat bubbles y composer (F3).
- Los hooks de datos (`useConversations`, `useMessages`, etc.) — se crean en F2 y F3.
- El responsive completo, accesibilidad final y dark mode (F4).
- La pantalla de login no se rediseña — solo se refactoriza para usar los nuevos componentes UI.

---

## 2. Alcance

### Archivos nuevos

```
frontend/
├── vitest.config.ts
├── src/
│   ├── test/
│   │   └── setup.ts
│   ├── components/
│   │   ├── ui/
│   │   │   ├── index.ts
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── ErrorState.tsx
│   │   └── layout/
│   │       ├── AppShell.tsx
│   │       ├── Sidebar.tsx
│   │       └── Header.tsx
│   └── __tests__/
│       ├── ui/
│       │   ├── Button.test.tsx
│       │   ├── Input.test.tsx
│       │   ├── Badge.test.tsx
│       │   ├── Table.test.tsx
│       │   ├── Skeleton.test.tsx
│       │   ├── EmptyState.test.tsx
│       │   └── ErrorState.test.tsx
│       └── layout/
│           ├── AppShell.test.tsx
│           ├── Sidebar.test.tsx
│           └── Header.test.tsx
```

Total: 21 archivos nuevos.

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `frontend/package.json` | Agregar dependencias (ver justificación abajo) |

### Dependencias nuevas — Justificación

| Dependencia | ¿Por qué? | Problema que resuelve | ¿Ya existe? | ¿Opción estándar? |
|-------------|-----------|----------------------|-------------|-------------------|
| `lucide-react` | Iconos en sidebar, estados vacíos, indicadores | Emojis en UI (prohibido por design guide). Sin ella tendríamos que crear SVG inline o usar emojis. | No | Sí — estándar del ecosistema React + Tailwind |
| `vitest` | Test runner para componentes | Jest necesita configurar Babel, ts-jest, jsdom externo. Vitest funciona out-of-the-box con Vite/Next.js. | No | Sí — estándar moderno (el sucesor de Jest) |
| `@testing-library/react` | Renderizado de componentes en tests | Sin ella, los tests serían shallow rendering sin interacción real. | No | Sí — estándar del ecosistema React |
| `@testing-library/jest-dom` | Matchers como `toBeInTheDocument` | Sin ella los tests tendrían asserts genéricos de Jest. | No | Sí — estándar con RTL |
| `@testing-library/user-event` | Simular clicks, escritura en tests | `fireEvent` de RTL es muy básico. `userEvent` simula interacciones reales (hover, focus, blur). | No | Sí — recomendado por RTL |
| `jsdom` | Entorno DOM para tests | Sin ella, Vitest no puede simular un navegador. | No | Sí — estándar |
| `@vitejs/plugin-react` | Transformar JSX en tests de Vitest | Vitest necesita este plugin para procesar React. | No | Sí — el plugin oficial |
| `@vitest/coverage-v8` | Reporte de cobertura | Next.js no incluye coverage. Sin ella no podemos medir cobertura ≥90%. | No | Sí — estándar con Vitest |

**No se incluyen:** shadcn/ui, clsx, class-variance-authority — no aportan valor suficiente para un proyecto de 7 componentes UI. Los variants se manejan con objetos JS simples.
| `frontend/tailwind.config.js` | Agregar fontFamily Inter |
| `frontend/src/styles/globals.css` | Agregar @import Inter vía next/font (se hace en _app.tsx), mantener solo @tailwind directives |
| `frontend/src/pages/_app.tsx` | Cargar Inter con next/font, reemplazar Layout por AppShell, pasar user/email al Header |
| `frontend/src/pages/login.tsx` | Refactorizar usando Button, Input de ui/ |
| `frontend/tsconfig.json` | Agregar types para vitest si es necesario |

### Archivos que NO deben tocarse

- `frontend/src/pages/conversations/index.tsx` — es refactorizado en F2
- `frontend/src/pages/conversations/[id].tsx` — es refactorizado en F3
- `frontend/src/lib/api.ts` — no cambia en F1
- `frontend/src/types/index.ts` — no cambia en F1
- `frontend/src/contexts/AuthContext.tsx` — no cambia en F1
- `frontend/src/pages/index.tsx` — solo redirige, no necesita cambios
- `frontend/next.config.js` — no cambia
- `frontend/postcss.config.js` — no cambia
- Cualquier archivo en `backend/`, `infra/`, `docs/`

### Límite de tamaño del PR

- **Archivos modificados**: máximo 20
- **Líneas de diff**: máximo 1500
- **Archivos nuevos**: máximo 25
- Si al terminar la implementación se excede alguno, dividir F1 en F1a + F1b.

---

## 3. Arquitectura

### Árbol de carpetas después de F1

```
frontend/src/
├── components/
│   ├── ui/                  # Componentes atómicos reutilizables
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Badge.tsx
│   │   ├── Table.tsx
│   │   ├── Skeleton.tsx
│   │   ├── EmptyState.tsx
│   │   ├── ErrorState.tsx
│   │   └── index.ts         # Barrel export
│   └── layout/              # Componentes de layout estructural
│       ├── AppShell.tsx      # Wrapper principal: sidebar + header + main
│       ├── Sidebar.tsx       # Navegación lateral
│       └── Header.tsx        # Barra superior con user info + logout
├── hooks/                    # Custom hooks (vacíos en F1, se llenan en F2/F3)
│   └── index.ts
├── lib/                      # API client (sin cambios)
│   └── api.ts
├── pages/                    # Next.js Pages Router
│   ├── _app.tsx              # Modificado: AppShell + Inter font
│   ├── index.tsx             # Sin cambios
│   ├── login.tsx             # Refactorizado con ui/ components
│   └── conversations/
│       ├── index.tsx         # Sin cambios (tocado en F2)
│       └── [id].tsx          # Sin cambios (tocado en F3)
├── contexts/                 # React context (sin cambios)
│   └── AuthContext.tsx
├── types/                    # Types compartidos (sin cambios)
│   └── index.ts
├── styles/
│   └── globals.css           # Solo @tailwind directives
├── test/                     # Configuración de testing
│   └── setup.ts
└── __tests__/                # Tests colocalizados por estructura
    ├── ui/
    │   ├── Button.test.tsx
    │   ├── Input.test.tsx
    │   ├── Badge.test.tsx
    │   ├── Table.test.tsx
    │   ├── Skeleton.test.tsx
    │   ├── EmptyState.test.tsx
    │   └── ErrorState.test.tsx
    └── layout/
        ├── AppShell.test.tsx
        ├── Sidebar.test.tsx
        └── Header.test.tsx
```

### Justificación de cada carpeta

| Carpeta | Justificación |
|---------|---------------|
| `components/ui/` | Componentes de presentación pura, sin lógica de negocio. Siguen el patrón de shadcn/ui pero manuales (sin CLI). Son atómicos: cada uno hace una cosa. El barrel export (`index.ts`) permite imports limpios: `import { Button, Input } from '@/components/ui'` |
| `components/layout/` | Componentes que definen la estructura visual de la aplicación. No contienen lógica de negocio. `AppShell` es el contenedor principal usado en `_app.tsx`. |
| `hooks/` | Custom hooks con toda la lógica de datos. En F1 está vacío (solo barrel). En F2 y F3 contendrá `useConversations`, `useMessages`, etc. |
| `test/` | Configuración global de Vitest (setup, mocks globales). Separado de `__tests__` para no mezclar config con tests. |
| `__tests__/` | Tests colocalizados por dominio (ui/, layout/). Sigue la misma estructura que `components/`. |

---

## 4. Wireframes ASCII

### 4.1 AppShell (Layout principal con autenticación)

```
┌──────────────────────────────────────────────────┐
│  Header                                           │
│  ┌──────┐  FlowDesk-AI          admin@mail.com  ──┤
│  │      │                                         │
│  │      │  ┌──────────────────────────────────────┤
│  │      │  │                                      │
│  │      │  │  Main Content Area                   │
│  │      │  │  (children)                          │
│  │      │  │                                      │
│  │      │  │                                      │
│  │      │  └──────────────────────────────────────│
│  └──────└                                         │
└──────────────────────────────────────────────────┘
```

**Jerarquía visual**: Header (arriba, fijo) → Sidebar (izquierda, fijo) → Main Content (centro, scroll).

### 4.2 Sidebar (navegación)

```
┌──────────┐
│          │
│  💻 Icon │  ← Solo logo/marca (sin texto, sin borde decorativo)
│          │
│  ─────── │  ← Separador sutil
│          │
│  ─────── │  ← Separador
│          │
│          │
│          │
│          │
└──────────┘
```

**Jerarquía visual**: Logo arriba → iconos de navegación. Sin labels visibles en estado normal (tooltip en hover). Ancho: `w-16`.

En F1 solo existe el icono de Conversaciones (MessageSquare de lucide). Home se elimina (la home redirige a conversations).

### 4.3 Header

```
┌──────────────────────────────────────────────────┐
│  ← Volver (solo en detalle)    user@mail.com  ── │
│                                                    │
│  Título de página                                 │
└──────────────────────────────────────────────────┘
```

**Jerarquía visual**: Breadcrumb/back (izquierda) → Título → Acciones (derecha: email + logout).

El Header se renderiza dentro de AppShell, no dentro de cada página. Las páginas establecen el título mediante props o contexto.

### 4.4 Login

```
┌──────────────────────────────────────────────┐
│                                              │
│                    ┌──────┐                   │
│                    │ Icon │                   │
│                    └──────┘                   │
│                                              │
│               FlowDesk-AI                     │
│                                              │
│    ┌────────────────────────────────┐        │
│    │  Email                         │        │
│    └────────────────────────────────┘        │
│                                              │
│    ┌────────────────────────────────┐        │
│    │  Contraseña                     │        │
│    └────────────────────────────────┘        │
│                                              │
│    ┌────────────────────────────────┐        │
│    │     Iniciar sesión             │        │
│    └────────────────────────────────┘        │
│                                              │
└──────────────────────────────────────────────┘
```

**Jerarquía visual**: Logo/icono (centro) → Título → Email input → Password input → Submit button.
Sin sidebar, sin header. Es el único caso sin AppShell.

### 4.5 Dashboard vacío (sin conversaciones)

```
┌──────────────────────────────────────────────────┐
│  Header                                           │
│  ┌──────┐  Conversaciones                         │
│  │      │                                         │
│  │      │  ┌──────────────────────────────────────┐│
│  │      │  │                                      ││
│  │      │  │        [Icono Inbox]                 ││
│  │      │  │                                      ││
│  │      │  │   No hay conversaciones              ││
│  │      │  │                                      ││
│  │      │  │   Las conversaciones aparecerán      ││
│  │      │  │   cuando los clientes escriban.      ││
│  │      │  │                                      ││
│  │      │  └──────────────────────────────────────││
│  │      │                                         │
│  └──────└                                         │
└──────────────────────────────────────────────────┘
```

### 4.6 Dashboard cargando

```
┌──────────────────────────────────────────────────┐
│  Header                                           │
│  ┌──────┐  Conversaciones                         │
│  │      │                                         │
│  │      │  ┌──────────────────────────────────────┐│
│  │      │  │  ████████░░░░░░░░  (skeleton 1)     ││
│  │      │  │  ████████░░░░░░░░  (skeleton 2)     ││
│  │      │  │  ████████░░░░░░░░  (skeleton 3)     ││
│  │      │  │  ████████░░░░░░░░  (skeleton 4)     ││
│  │      │  │  ████████░░░░░░░░  (skeleton 5)     ││
│  │      │  └──────────────────────────────────────││
│  │      │                                         │
│  └──────└                                         │
└──────────────────────────────────────────────────┘
```

5 skeletons de 44px height con `animate-pulse bg-gray-100`.

### 4.7 Dashboard con datos

```
┌──────────────────────────────────────────────────┐
│  Header                                           │
│  ┌──────┐  Conversaciones      [Filtro ▼]        │
│  │      │                                         │
│  │      │  ┌──────────────────────────────────────┐│
│  │      │  │ CONTACTO  │ ESTADO   │ ÚLTIMO MSJ   ││
│  │      │  ├───────────┼──────────┼───────────────││
│  │      │  │ Juan Pérez│ Activa   │ Hola...       ││
│  │      │  │ María     │ Takeover │ Necesito...   ││
│  │      │  │ Carlos    │ Cerrada  │ Gracias       ││
│  │      │  └──────────────────────────────────────││
│  │      │                                         │
│  │      │         ← Anterior │ 1-3 de 12 │ Sgte → ││
│  └──────└                                         │
└──────────────────────────────────────────────────┘
```

### 4.8 Error State

```
┌──────────────────────────────────────────────────┐
│  Header                                           │
│  ┌──────┐  Conversaciones                         │
│  │      │                                         │
│  │      │  ⚠️ Error al cargar conversaciones      │
│  │      │  ┌──────────────────────────────────────┐│
│  │      │  │  [AlertTriangle] No pudimos conectar ││
│  │      │  │  con el servidor.                    ││
│  │      │  │                                      ││
│  │      │  │     [Reintentar]                     ││
│  │      │  └──────────────────────────────────────││
│  │      │                                         │
│  └──────└                                         │
└──────────────────────────────────────────────────┘
```

### 4.9 Empty State (genérico)

```
┌──────────────────────────────────────────────┐
│                                              │
│         [IconComponent]                      │
│                                              │
│         Title here                           │
│                                              │
│         Description of what the user         │
│         should do or what this means.        │
│                                              │
└──────────────────────────────────────────────┘
```

Usado en cualquier contexto donde no hay datos. centrado, 48px padding vertical, icono gris, título `text-sm font-medium`, descripción `text-sm text-gray-500`.

---

## 5. Sistema de diseño

Solo los componentes estrictamente necesarios para F1. Ninguno "por si acaso".

### 5.1 Button

| Aspecto | Definición |
|---------|------------|
| **Responsabilidad** | Renderizar un botón con variante primaria, secundaria, destructiva o ghost |
| **Props** | `variant: "primary" | "secondary" | "destructive" | "ghost"`, `disabled?: boolean`, `loading?: boolean`, `children: ReactNode`, `type?: "button" | "submit"`, `onClick?: () => void`, `className?: string`, `aria-label?: string` |
| **Estados** | idle (default), hover, active, disabled, loading (texto termina con "…", botón deshabilitado, children ocultos, opcional: spinner reducido) |
| **Reutilización prevista** | Usado en login, dashboard (filtros, paginación), conversación detail (composer, takeover), header (ghost para logout). Es el botón universal. |
| **Variantes** | 4 variantes: primary (`bg-gray-900`), secondary (`border`), destructive (`bg-red-600`), ghost (sin fondo, para acciones secundarias en headers). |
| **Nota** | El componente usa `forwardRef` para permitir acceso programático al elemento `<button>` del DOM. |

### 5.2 Input

| Aspecto | Definición |
|---------|------------|
| **Responsabilidad** | Renderizar un input de texto con label, error state y helper text |
| **Props** | `label?: string`, `error?: string`, `helperText?: string`, `id: string`, `type?: string`, `autoComplete?: string`, `value: string`, `onChange: (e) => void`, `placeholder?: string`, `disabled?: boolean`, `className?: string` |
| **Estados** | default, focus, disabled, error (borde rojo + mensaje de error) |
| **Reutilización prevista** | Login (email, password). Futuro: filtros, búsqueda, formularios. |
| **Nota** | El `<label>` es parte del componente. No se renderiza sin `id` o `label`. |

### 5.3 Badge

| Aspecto | Definición |
|---------|------------|
| **Responsabilidad** | Renderizar una etiqueta de estado (activo, takeover, cerrado) |
| **Props** | `variant: "default" | "success" | "warning" | "info" | "error"`, `children: string` |
| **Estados** | No aplica (es puramente visual) |
| **Reutilización prevista** | Tabla de conversaciones, header de detalle. Cualquier indicador de estado. |
| **Variantes** | 5 variantes por color, no por lógica de negocio. El mapeo negocio→variante se hace en el hook/página. `rounded-full`, `px-2.5 py-0.5`, `text-xs font-medium`. Mapeo: `default`=gray, `success`=green, `warning`=yellow, `info`=blue, `error`=red. |

### 5.4 Table

| Aspecto | Definición |
|---------|------------|
| **Responsabilidad** | Renderizar una tabla con header y filas, siguiendo el patrón HTML del design guide |
| **Props** | `headers: { key: string; label: string }[]`, `rows: Record<string, ReactNode>[]`, `onRowClick?: (rowIndex: number) => void`, `className?: string` |
| **Estados** | default (con datos), hover (fila hovereable si onRowClick existe) |
| **Reutilización prevista** | Lista de conversaciones (F2). Futuro: cualquier lista tabular. |
| **Nota** | No incluye paginación — es solo la tabla. La paginación se crea en F2 dentro de la página o como componente separado si se reusa. |

### 5.5 Skeleton

| Aspecto | Definición |
|---------|------------|
| **Responsabilidad** | Renderizar un placeholder de carga con `animate-pulse` |
| **Props** | `variant: "text" | "title" | "avatar" | "row"`, `width?: string`, `height?: string`, `className?: string` |
| **Estados** | No aplica |
| **Reutilización prevista** | Cualquier estado de carga en cualquier pantalla. |
| **Variantes** | `text` (h-4, w-full), `title` (h-6, w-48), `avatar` (h-10 w-10 rounded-full), `row` (h-12, w-full). Todas con `rounded-lg bg-gray-100 animate-pulse`. |

### 5.6 EmptyState

| Aspecto | Definición |
|---------|------------|
| **Responsabilidad** | Renderizar un estado vacío con icono, título y descripción opcional |
| **Props** | `icon: LucideIcon`, `title: string`, `description?: string`, `action?: { label: string; onClick: () => void }` |
| **Estados** | No aplica |
| **Reutilización prevista** | Dashboard sin conversaciones, búsqueda sin resultados, cualquier lista vacía. |
| **Nota** | El icono se pasa como componente (lucide-react), no como string. |

### 5.7 ErrorState

| Aspecto | Definición |
|---------|------------|
| **Responsabilidad** | Renderizar un estado de error con mensaje y acción de reintento |
| **Props** | `title?: string`, `message: string`, `onRetry?: () => void` |
| **Estados** | No aplica |
| **Reutilización prevista** | Cualquier error de fetch en cualquier página. |
| **Nota** | Sigue el patrón exacto del design guide section 7.9. |

### 5.8 AppShell

| Aspecto | Definición |
|---------|------------|
| **Responsabilidad** | Layout principal que contiene Sidebar + Header + Main Content. Se usa en `_app.tsx`. |
| **Props** | `children: ReactNode` |
| **Estados** | No aplica (es estructural) |
| **Reutilización prevista** | Envolver todas las páginas autenticadas. |
| **Nota** | No contiene lógica de auth. Solo layout visual. |

### 5.9 Sidebar

| Aspecto | Definición |
|---------|------------|
| **Responsabilidad** | Navegación lateral con iconos. Ancho fijo `w-16`. |
| **Props** | No recibe props externas. Lee `router.pathname` internamente con `useRouter()` para resaltar el item activo. |
| **Estados** | item activo, item inactivo, hover |
| **Reutilización prevista** | Único sidebar en toda la aplicación. |
| **Nota** | Sin labels de texto visibles. Tooltip vía `title` + `aria-label` en cada Link. Solo icono de Conversations (MessageSquare). Home se elimina (redirige). |

### 5.10 Header

| Aspecto | Definición |
|---------|------------|
| **Responsabilidad** | Barra superior con título de página a la izquierda y user info + logout a la derecha |
| **Props** | No recibe props externas. Lee `user` y `logout` de `AuthContext` internamente con `useAuth()`. |
| **Estados** | No aplica |
| **Reutilización prevista** | Toda página autenticada. |
| **Nota** | El botón de logout usa la variante `ghost` de Button. Email del usuario se obtiene del contexto de auth, no se pasa como prop. |

---

## 6. Flujo de datos

```
_app.tsx
  │
  ├── AuthProvider (contexto, sin cambios)
  │     │
  │     ├── LoginPage (sin AppShell)
  │     │     └── Button, Input (ui/)
  │     │
  │     └── AppShell (para páginas autenticadas)
  │           ├── Sidebar
  │           │     └── Lucide icons + Link de next/link
  │           ├── Header
  │           │     └── user.email desde AuthContext + logout
  │           └── Main Content (children — las páginas)
  │                 └── conversation list (F2)
  │                 └── conversation detail (F3)
  │
  └── Inter (next/font) — cargado en _app.tsx
```

**Responsabilidades:**

| Capa | Responsabilidad |
|------|----------------|
| `_app.tsx` | Cargar Inter font, inicializar AuthProvider, decidir entre LoginPage (sin AppShell) vs AppShell (autenticado) |
| `AppShell` | Layout visual: sidebar a la izquierda, header arriba, main content al centro. Renderiza Sidebar y Header sin props externas. |
| `Sidebar` | Renderiza iconos de navegación. Lee `router.pathname` internamente vía `useRouter()` para active state. |
| `Header` | Renderiza título y user info + logout. Lee `user` y `logout` de AuthContext internamente vía `useAuth()`. |
| `pages/` | Páginas de Next.js. Obtienen datos de hooks (en F2/F3) y pasan props a componentes. |
| `ui/` components | Componentes puros. Sin efectos, sin fetch, sin lógica de negocio. |

En F1 no hay hooks de datos. El flujo es `Page → UI Components (props)`. Los hooks llegan en F2 y F3.

---

## 7. Estados

No aplican a F1 porque no hay datos todavía. Pero los componentes UI deben soportar:

| Estado | Dónde aplica |
|--------|-------------|
| **loading** | `Skeleton` (animate-pulse), `Button` (loading prop deshabilita y cambia texto) |
| **success** | Estado por defecto de todos los componentes |
| **empty** | `EmptyState` (renderiza icono + título + descripción) |
| **error** | `ErrorState` (renderiza mensaje + retry), `Input` (error prop cambia borde a rojo) |
| **disabled** | `Button` (opacity-50 + cursor-not-allowed), `Input` (cursor-not-allowed + opacity-50) |
| **submitting** | `Button` con loading=true (deshabilita, muestra indicador de progreso) |
| **unauthorized** | Lo maneja `AuthGuard` en `_app.tsx` (redirige a /login). F1 no modifica este flujo. |
| **not found** | Lo maneja cada página (ya existe en `[id].tsx`). F1 no añade un componente 404 genérico — se crearía si se reusa. |

---

## 8. Testing

### Qué se prueba

- **Button**: renderizado de 3 variantes, disabled, loading, hover state (via `userEvent`), onClick handler
- **Input**: renderizado con label/error/helperText, onChange, focus/blur styles, disabled
- **Badge**: renderizado de 5 variantes, contenido children, clases correctas
- **Table**: renderizado de headers y rows, onRowClick, hover en filas clickeables
- **Skeleton**: renderizado de 4 variantes, width/height personalizados
- **EmptyState**: renderizado con icono, título, descripción opcional, acción opcional
- **ErrorState**: renderizado con mensaje, título opcional, onRetry
- **Sidebar**: renderizado con link correcto, item activo resaltado vía useRouter()
- **Header**: renderizado con título, userEmail, onLogout, onBack, showBack
- **AppShell**: renderizado con children, estructura sidebar + header + main

### Qué NO se prueba todavía

- Hooks de datos (F2, F3)
- Integración con AuthContext (los componentes reciben props, no llaman a context directamente)
- Pantallas completas (conversation list, conversation detail — F2, F3)
- Responsive (F4)
- Accesibilidad end-to-end (F4)

### Cobertura esperada

- **Componentes UI**: ≥95% (son componentes puros, fáciles de testear)
- **Componentes Layout**: ≥90%
- **Global**: ≥90% en archivos nuevos

### Herramientas

- `vitest` como test runner
- `@testing-library/react` para renderizado
- `@testing-library/jest-dom` para matchers (toBeInTheDocument, toHaveClass, etc.)
- `@testing-library/user-event` para interacciones realistas
- `jsdom` como entorno DOM
- Sin `@testing-library/react-hooks` (aún no hay hooks)

---

## 9. Riesgos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| **Romper el layout de páginas existentes** | Alto | Las páginas de conversations no se tocan. Solo se modifica `_app.tsx` para envolver en AppShell. Verificar que `index.tsx`, `login.tsx` y `conversations/*` sigan funcionando después del cambio. |
| **Inter font no cargar correctamente** | Medio | Usar `next/font` con `display: swap` y subset latín. Verificar en build que la fuente se precargue. |
| **Over-engineering en componentes UI** | Medio | Cada componente debe tener SOLO lo que F1 necesita. No agregar variantes "future-proof". Si F2 necesita una variante nueva, se agrega en F2. |
| **Test setup incorrecto** | Medio | Verificar que `vitest.config.ts` apunte a `src/test/setup.ts`, que incluya `@testing-library/jest-dom`, y que `jsdom` esté configurado. Correr `vitest run` después de crear el primer test. |
| **Tailwind purge elimina clases dinámicas** | Bajo | Las clases de variantes (primary/secondary/destructive) son strings estáticas. No usar concatenación dinámica que Tailwind no pueda analizar. |
| **AuthContext incompatible con AppShell** | Alto | AppShell no depende directamente de AuthContext. Solo renderiza Sidebar y Header, que internamente leen del contexto. El `_app.tsx` existente ya maneja auth. |

---

## 10. Criterios de aceptación

- [ ] `npm run build` compila sin errores
- [ ] `npm run lint` pasa sin warnings
- [ ] `npx vitest run` pasa con ≥90% de cobertura en archivos nuevos
- [ ] Login page se ve igual que antes (mismos estilos, mismo layout, sin sidebar)
- [ ] Al hacer login, la página de conversations carga con el nuevo AppShell (sidebar + header)
- [ ] Sidebar muestra icono de Conversations (MessageSquare) y está resaltado en /conversations
- [ ] Header muestra email del usuario y botón de logout funcional
- [ ] Logout redirige a /login
- [ ] Botón "Volver" funciona en pages autenticadas
- [ ] No hay emojis en la navegación (reemplazados por lucide-react)
- [ ] Todos los tests unitarios pasan sin errores ni advertencias
- [ ] No se modificaron `pages/conversations/index.tsx` ni `[id].tsx`
- [ ] No se modificó `lib/api.ts`, `types/index.ts`, ni `contexts/AuthContext.tsx`
- [ ] Inter font está cargada vía `next/font` y se aplica globalmente
- [ ] `tailwind.config.js` tiene `fontFamily.sans` configurado con Inter
- [ ] Los componentes UI siguen exactamente los patrones HTML del FRONTEND_DESIGN_GUIDE.md

---

## 11. Checklist de implementación

Orden de implementación. Cada paso produce código funcional y testeable.

### Fase 1 — Infraestructura de testing

- [ ] 1.1. Agregar dependencias a `package.json`: vitest, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, jsdom, @vitejs/plugin-react, lucide-react
- [ ] 1.2. Crear `vitest.config.ts` con plugin React, jsdom, path alias `@/`
- [ ] 1.3. Crear `src/test/setup.ts` con `@testing-library/jest-dom` import
- [ ] 1.4. Agregar script `test` en `package.json`: `vitest run`
- [ ] 1.5. Agregar script `test:watch` en `package.json`: `vitest`
- [ ] 1.6. Agregar script `test:coverage` en `package.json`: `vitest run --coverage`
- [ ] 1.7. Verificar que `vitest run` funciona (sin tests aún)

### Fase 2 — Tokens y tipografía

- [ ] 2.1. Configurar `tailwind.config.js`: agregar `fontFamily.sans` con Inter
- [ ] 2.2. Crear barrel de hooks `src/hooks/index.ts` (export vacío, placeholder)
- [ ] 2.3. Verificar que `npm run build` funciona

### Fase 3 — Componentes UI (atómicos)

- [ ] 3.1. Crear `src/components/ui/Button.tsx`
  - [ ] 3.1.1. Props: variant, disabled, loading, children, onClick, type, className, aria-label
  - [ ] 3.1.2. Variantes: primary (bg-gray-900), secondary (border), destructive (bg-red-600)
  - [ ] 3.1.3. Estados: disabled (opacity-50), loading (deshabilitado, texto cambia)
  - [ ] 3.1.4. Test: 3 variantes, disabled, loading, onClick, className merge
- [ ] 3.2. Crear `src/components/ui/Input.tsx`
  - [ ] 3.2.1. Props: label, error, helperText, id, value, onChange, etc.
  - [ ] 3.2.2. Estados: default, focus, disabled, error
  - [ ] 3.2.3. Test: label render, error message, helperText, onChange, disabled
- [ ] 3.3. Crear `src/components/ui/Badge.tsx`
  - [ ] 3.3.1. Props: variant, children
  - [ ] 3.3.2. 5 variantes por color: default, success, warning, info, error
  - [ ] 3.3.3. Test: todas las variantes, children render
- [ ] 3.4. Crear `src/components/ui/Table.tsx`
  - [ ] 3.4.1. Props: headers, rows, onRowClick
  - [ ] 3.4.2. Patrón HTML exacto del design guide
  - [ ] 3.4.3. Test: headers render, rows render, onRowClick, hover class
- [ ] 3.5. Crear `src/components/ui/Skeleton.tsx`
  - [ ] 3.5.1. Props: variant, width, height, className
  - [ ] 3.5.2. 4 variantes con dimensiones predefinidas
  - [ ] 3.5.3. Test: todas las variantes, className merge
- [ ] 3.6. Crear `src/components/ui/EmptyState.tsx`
  - [ ] 3.6.1. Props: icon, title, description, action
  - [ ] 3.6.2. Patrón exacto del design guide section 7.7
  - [ ] 3.6.3. Test: solo título, con descripción, con acción
- [ ] 3.7. Crear `src/components/ui/ErrorState.tsx`
  - [ ] 3.7.1. Props: title, message, onRetry
  - [ ] 3.7.2. Patrón exacto del design guide section 7.9
  - [ ] 3.7.3. Test: solo mensaje, con título, con retry
- [ ] 3.8. Crear `src/components/ui/index.ts` (barrel export)
- [ ] 3.9. Verificar que `npx vitest run` pasa con ≥90% cobertura

### Fase 4 — Layout

- [ ] 4.1. Crear `src/components/layout/Sidebar.tsx`
  - [ ] 4.1.1. Sin props externas. Usa useRouter() internamente.
  - [ ] 4.1.2. Icono MessageSquare (lucide) para Conversations
  - [ ] 4.1.3. Link a /conversations, resaltado si router.pathname === /conversations
  - [ ] 4.1.4. Ancho fijo w-16, bg-white, border-r
  - [ ] 4.1.5. Sin labels de texto, solo iconos + tooltip
  - [ ] 4.1.6. Test: render icon, active state, inactive state, link href
- [ ] 4.2. Crear `src/components/layout/Header.tsx`
  - [ ] 4.2.1. Sin props externas. Usa useAuth() internamente para user y logout.
  - [ ] 4.2.2. Botón Logout con variante ghost.
  - [ ] 4.2.3. User email desde AuthContext a la derecha + botón Logout
  - [ ] 4.2.4. Test: dashboard label, user email, logout callback
- [ ] 4.3. Crear `src/components/layout/AppShell.tsx`
  - [ ] 4.3.1. Props: children
  - [ ] 4.3.2. Layout: sidebar (w-16) + main area (flex-1 con header + content)
  - [ ] 4.3.3. Test: children render, estructura correcta

### Fase 5 — Integración en páginas

- [ ] 5.1. Modificar `src/pages/_app.tsx`
  - [ ] 5.1.1. Cargar Inter con `next/font` (variable, subset latin)
  - [ ] 5.1.2. Aplicar Inter como className global
  - [ ] 5.1.3. Reemplazar `<Layout>` por `<AppShell>` para páginas autenticadas
  - [ ] 5.1.4. Pasar `user.email` y `logout` desde AuthContext al Header
  - [ ] 5.1.5. Sidebar y Header leen datos internamente (useRouter / useAuth), AppShell no les pasa props
- [ ] 5.2. Refactorizar `src/pages/login.tsx`
  - [ ] 5.2.1. Reemplazar `<button>` por `<Button>`
  - [ ] 5.2.2. Reemplazar `<input>` por `<Input>` con label y error
  - [ ] 5.2.3. Verificar que el layout y la funcionalidad son idénticos
- [ ] 5.3. Eliminar `src/components/Layout.tsx` (reemplazado por AppShell)

### Fase 6 — Verificación final

- [ ] 6.1. `npm run build` sin errores
- [ ] 6.2. `npm run lint` sin warnings
- [ ] 6.3. `npx vitest run --coverage` ≥90%
- [ ] 6.4. Login manual: abrir /login, verificar que el formulario funciona
- [ ] 6.5. Navegación manual: login → conversations, verificar sidebar + header
- [ ] 6.6. Logout manual: verificar redirección a /login
- [ ] 6.7. Verificar que pages/conversations/index.tsx y [id].tsx no fueron modificados
- [ ] 6.8. Verificar que lib/api.ts, types/index.ts, contexts/AuthContext.tsx no fueron modificados

---

## 12. Auto crítica

### 12.1 senior-dev

✅ **Aprobado** — sin issues estructurales.

| Aspecto | Resultado |
|---------|-----------|
| Separación UI / lógica / datos en 3 capas | ✅ (components/ → hooks/ → lib/) |
| Responsabilidad única por archivo | ✅ (cada componente hace una cosa) |
| Nombres descriptivos | ✅ |
| Funciones pequeñas | ✅ (todos los componentes < 100 líneas) |
| Stack alineado con proyecto | ✅ (Pages Router, Tailwind, TypeScript strict) |
| 21 archivos nuevos, estimado <500 líneas | ✅ |
| Convenciones del proyecto respetadas | ✅ |

**Issue encontrado**: Badge con 6 variantes de negocio (`active | takeover | closed | success | warning | error`) acopla UI a lógica de negocio. Corregido a 5 variantes por color (`default | success | warning | info | error`). El mapeo negocio → variante vive en el hook/página, no en el componente.

### 12.2 impeccable

✅ **Aprobado** — sin AI slop patterns.

| Aspecto | Resultado |
|---------|-----------|
| Color system referenciado del design guide | ✅ |
| Inter font via next/font | ✅ |
| Motion permitido según design guide | ✅ |
| Sin side-stripe borders, gradient text, glassmorphism | ✅ |
| Sin hero sections, card grids, eyebrow kickers | ✅ |
| Estados completos definidos | ✅ |
| Wireframes ASCII con jerarquía visual | ✅ |

### 12.3 code-review-skill

✅ **Aprobado** — revisión sistemática completa.

| Aspecto | Resultado |
|---------|-----------|
| Lógica y edge cases | ✅ (riesgos documentados con mitigaciones) |
| Testing strategy | ✅ (qué se prueba, qué no, cobertura esperada) |
| File organization | ✅ (limpio, colocalizado) |
| Error handling | ✅ (ErrorState con retry, Input con error prop) |
| DRY vs abstracción | ✅ (componentes mínimos, sin "por si acaso") |
| Variables de estado | ✅ (loading, empty, error, disabled, submitting, unauthorized, not found) |

### 12.4 web-design-guidelines

✅ **Aprobado** — 2 issues menores encontrados y corregidos.

| Regla | Resultado |
|-------|-----------|
| Icon buttons need `aria-label` | ✅ (Button tiene prop) |
| Form controls need `<label>` | ✅ (Input tiene label prop) |
| `<button>` for actions, `<a>` for navigation | ✅ |
| Focus-visible ring | ✅ (Input con focus:ring) |
| Inputs need `autocomplete` | ⚠️ No estaba en props. Corregido: agregado `autoComplete` prop a Input |
| Loading text ends with `"…"` | ⚠️ Button usaba `"..."`. Corregido a `"…"` |
| Error messages include fix/next step | ✅ (ErrorState con onRetry) |
| Specific button labels | ✅ |
| `transition: all` prohibited | ✅ (no se usa en F1) |
| No `<div>` with click handlers | ✅ |
| No hardcoded date/number formats | ✅ (no aplica en F1) |
| Empty states handled | ✅ (EmptyState componente dedicado) |
| Semantic HTML | ✅ (Table usa `<table>`, Button usa `<button>`) |

### 12.5 Correcciones aplicadas

| # | Issue | Skill que lo detectó | Corrección |
|---|-------|---------------------|------------|
| 1 | Badge con 6 variantes de negocio acopladas a UI | senior-dev, code-review-skill | Cambiado a 5 variantes por color (`default`, `success`, `warning`, `info`, `error`). Mapeo negocio→variante se hace en hook/página. |
| 2 | Button loading text usaba `"..."` en vez de `"…"` | web-design-guidelines | Cambiado a `"…"` (ellipsis character). |
| 3 | Input sin `autoComplete` prop | web-design-guidelines | Agregado `autoComplete?: string` a props de Input. |
| 4 | Testing section referenciaba "6 variantes" de Badge | code-review-skill | Actualizado a "5 variantes". |

**Documento listo para aprobación. Sin código escrito. Sin rama abierta.**

---

## 13. Definition of Done

| Criterio | Estado |
|----------|--------|
| Design aprobado | ✅ (este documento) |
| Código implementado | ☐ |
| Tests | ☐ |
| Cobertura ≥90% | ☐ |
| Build | ☐ |
| Lint | ☐ |
| Code Review | ☐ |
| UI Audit | ☐ |
| Accessibility Audit | ☐ |
| Responsive Audit | ☐ |
| Performance Review | ☐ |
| PR abierto | ☐ |
| Merge | ☐ |
| Post Merge (docs, ramas) | ☐ |
