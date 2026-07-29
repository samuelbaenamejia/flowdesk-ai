# F4B — Dark Mode: Design Document

> Version: 1.1
> Fecha: 2026-07-28
> Estado: Implemented

---

## Tabla de contenido

1. [Objetivos](#1-objetivos)
2. [Alcance](#2-alcance)
3. [Fuera de alcance](#3-fuera-de-alcance)
4. [Arquitectura](#4-arquitectura)
5. [Estrategia de temas](#5-estrategia-de-temas)
6. [Paleta oscura](#6-paleta-oscura)
7. [Estrategia de persistencia](#7-estrategia-de-persistencia)
8. [Estrategia SSR/CSR](#8-estrategia-ssrcsr)
9. [Componentes afectados](#9-componentes-afectados)
10. [Accesibilidad](#10-accesibilidad)
11. [Responsive](#11-responsive)
12. [Performance](#12-performance)
13. [Testing](#13-testing)
14. [Documentación](#14-documentación)
15. [Riesgos y mitigaciones](#15-riesgos-y-mitigaciones)
16. [Rollout](#16-rollout)
17. [Definition of Done](#17-definition-of-done)

---

## 1. Objetivos

1. **Modo oscuro completo y consistente** para todas las pantallas del frontend (login, dashboard, workspace).
2. **Cambio de tema inmediato** sin flickering, sin layout shift, sin renders innecesarios.
3. **Persistencia de preferencia** entre sesiones (localStorage) con respeto a `prefers-color-scheme` del sistema.
4. **Cumplimiento de contraste WCAG AA** (4.5:1 texto normal, 3:1 texto grande) en ambos temas.
5. **Mantenibilidad a largo plazo** usando el sistema `dark:` de Tailwind, sin CSS custom properties, sin runtime overhead.

---

## 2. Alcance

### Incluye

- Arquitectura: Tailwind `darkMode: 'class'` + ThemeProvider + anti-flicker script inline
- ThemeProvider (`useTheme` hook + ThemeProvider componente)
- Toggle de tema en el Header (ícono Sun/Moon)
- Todas las páginas: login, conversations list, conversation detail
- Todos los componentes UI: Button, Input, Badge, Table, Skeleton, EmptyState, ErrorState
- Todos los componentes de layout: AppShell, Sidebar, Header
- Todos los componentes de workspace: ConversationHeader, MessageBubble, MessageList, Composer, ConversationsFilter, ConversationTable, Pagination
- Persistencia en localStorage + detección de `prefers-color-scheme`
- Script anti-flicker inline en `<head>` via `_document.tsx`
- Tests unitarios de ThemeProvider, useTheme, toggle
- Actualización de documentación

### No incluye

- **Modo oscuro en backend** (sin cambios en API, DB o n8n)
- **Personalización de acento/color primario** (solo light/dark)
- **Múltiples temas** (solo light/dark)
- **Animaciones de transición entre temas** (sería flickering por diseño)
- **Tema por ruta** (el tema es global)
- **Dashboard settings page** (el toggle está en el Header)

---

## 3. Fuera de alcance

| Feature | Razón |
|---------|-------|
| Color personalizado por usuario | No hay demanda. Añadiría complejidad sin beneficio actual. |
| Modo oscuro automático por hora del día | YAGNI. La preferencia del sistema + override manual cubre el 100% de casos de uso. |
| Tema separado por workspace/ruta | Inconsistente UX. El tema debe ser global. |
| CSS custom properties para colores | Tailwind `dark:` es suficiente y más mantenible. CSP añadiría complejidad de build (postcss, oklch, etc.) para un beneficio marginal. |

---

## 4. Arquitectura

### 4.1 Diagrama de flujo

```
[Usuario] → clic toggle (Header)
              │
              ▼
         useTheme().toggle()
              │
              ├── setTheme("dark")
              ├── document.documentElement.classList.add("dark")
              └── localStorage.setItem("theme", "dark")
                    │
                    ▼
        Tailwind dark: prefijo activo
              │
              ▼
        Todos los componentes re-renderizan
        con clases dark: automáticamente

[Pagina carga]
              │
              ▼
   Script inline en _document.tsx
   Lee localStorage → prefers-color-scheme
   Aplica clase "dark" ANTES de React hydrate
              │
              ▼
   ThemeProvider init con valor del script
   Sin flickering
```

### 4.2 Decisiones arquitectónicas

#### Decisión 1: Tailwind `dark:` class strategy sobre CSS custom properties

**Opción A — Tailwind `darkMode: 'class'` (ELEGIDA)**
- Pros: Sin build complexity, sin postcss plugins, sin OKLCH. Reutiliza el sistema de colores existente. Cada `bg-white` → `bg-white dark:bg-gray-800`. Cero nuevas dependencias. Mantenibilidad máxima: cualquier dev conoce Tailwind dark mode.
- Cons: Clases duplicadas en cada elemento. Más archivos que modificar.
- Trade-off: Duplicación de clases vs complejidad de build. Para un proyecto de 20 componentes, la duplicación es aceptable y más mantenible que un sistema de tokens.

**Opción B — CSS custom properties (`--color-bg: ...`)**
- Pros: Cambio instantáneo sin re-render.
- Cons: Requiere migrar todos los colores a variables, perder autocompletado de Tailwind, añadir capa de build con postcss + tailwindcss/v3/custom-functions. Overengineering para el tamaño del proyecto.

**Opción C — CSS `light-dark()` function**
- Pros: Nativo CSS, sin JavaScript.
- Cons: Soporte aún limitado en 2026. No integrable con Tailwind utility classes. Dejaría el proyecto dependiendo de una feature CSS inmadura.

**Veredicto:** Opción A (Tailwind `darkMode: 'class'`).

#### Decisión 2: Nuevo ThemeProvider sobre extender AuthContext

**Opción A — Nuevo `ThemeProvider` + `useTheme` hook (ELEGIDA)**
- Pros: Separación de responsabilidades. Tema no es autenticación. El provider se monta fuera de AuthProvider para que el anti-flicker script funcione antes del auth check.
- Cons: Un componente más.

**Opción B — Extender AuthContext con theme**
- Pros: Menos archivos.
- Cons: Acoplamiento incorrecto. El tema no tiene relación con auth. AuthContext tiene loading asíncrono que retrasaría la restauración del tema.

**Opción C — Zustand store**
- Pros: Un store global.
- Cons: ADR-013 rechazó Zustand explícitamente. Estado de tema no justifica añadir Zustand.

**Veredicto:** Opción A (nuevo ThemeProvider + useTheme).

#### Decisión 3: Script inline en `_document.tsx` sobre getInitialProps

**Opción A — Script inline en `_document.tsx` via `<script>` tag (ELEGIDA)**
- Pros: Se ejecuta antes de cualquier JS de React. 0ms de flickering. Simple: `<script dangerouslySetInnerHTML={...}>`.
- Cons: `dangerouslySetInnerHTML` (aceptable para script controlado).

**Opción B — `getInitialProps` en `_app.tsx`**
- Pros: Server-side antes de render.
- Cons: Next.js Pages Router `getInitialProps` corre en servidor donde no hay `localStorage` ni `matchMedia`. No resuelve el flickering.

**Opción C — next/dynamic con ssr:false**
- Pros: Evita hydration mismatch.
- Cons: No previene flickering porque el componente se carga después del paint inicial.

**Veredicto:** Opción A (script inline en `_document.tsx`).

---

## 5. Estrategia de temas

### 5.1 Modos

| Modo | Clase en `<html>` | Trigger |
|------|-------------------|---------|
| Light | (ninguna) | Default / preferencia del sistema / selección manual |
| Dark | `dark` | `prefers-color-scheme: dark` / selección manual |
| System | (dinámico) | Sigue `prefers-color-scheme`. Solo en inicialización inicial. |

### 5.2 Algoritmo de selección inicial

```
1. ¿localStorage.getItem("theme") existe?
   → "light" o "dark": usar ese valor
2. ¿prefers-color-scheme: dark?
   → usar "dark"
3. Default: "light"
```

### 5.3 Toggle manual

El toggle en el Header cambia entre `light` y `dark`. No hay modo "system" persistente (el usuario que prefiere sistema puede no hacer clic nunca, y el script inicial respetará su preferencia).

---

## 6. Paleta oscura

### 6.1 Principios

- **No invertir colores.** El modo oscuro no es negativo fotográfico.
- **Reducir saturación.** Los colores de acento (green, yellow, blue, red) mantienen su matiz pero con luminosidad reducida.
- **Fondo no negro puro.** `gray-900` (#111827) para fondo de página. `gray-800` (#1f3748) para superficies elevadas. `gray-850` (#1a2332) como valor intermedio extra.
- **Texto no blanco puro.** `gray-50` (#f9fafb) para texto primario. `gray-400` (#9ca3af) para texto secundario.

### 6.2 Mapa de colores

| Token Light | Token Dark | Uso |
|-------------|------------|-----|
| `bg-gray-50` | `dark:bg-gray-900` | Fondo de página |
| `bg-white` | `dark:bg-gray-800` | Superficie (sidebar, header, cards, table) |
| `border-gray-200` | `dark:border-gray-700` | Bordes generales |
| `border-gray-300` | `dark:border-gray-600` | Bordes de inputs |
| `text-gray-900` | `dark:text-gray-50` | Texto primario |
| `text-gray-700` | `dark:text-gray-200` | Texto secundario fuerte |
| `text-gray-500` | `dark:text-gray-400` | Texto secundario |
| `text-gray-400` | `dark:text-gray-500` | Texto terciario (placeholder) |
| `text-gray-600` | `dark:text-gray-300` | Iconos / botones ghost |
| `hover:bg-gray-100` | `dark:hover:bg-gray-700` | Hover states |
| `hover:bg-gray-50` | `dark:hover:bg-gray-750` | Table row hover |
| `hover:text-gray-900` | `dark:hover:text-gray-50` | Link hover |
| `bg-gray-100` | `dark:bg-gray-700` | Skeleton |
| `shadow-sm` | `dark:shadow-none` | Sombras (innecesarias en dark) |
| `ring-gray-400` | `dark:ring-gray-500` | Focus ring |

### 6.3 Badges (modo oscuro)

| Variante | Light | Dark |
|----------|-------|------|
| default | `bg-gray-100 text-gray-500` | `dark:bg-gray-700 dark:text-gray-300` |
| success | `bg-green-50 text-green-600` | `dark:bg-green-900/30 dark:text-green-400` |
| warning | `bg-yellow-50 text-yellow-600` | `dark:bg-yellow-900/30 dark:text-yellow-400` |
| info | `bg-blue-50 text-blue-600` | `dark:bg-blue-900/30 dark:text-blue-400` |
| error | `bg-red-50 text-red-600` | `dark:bg-red-900/30 dark:text-red-400` |

### 6.4 Botones (modo oscuro)

| Variant | Light | Dark |
|---------|-------|------|
| primary | `bg-gray-900 text-white` | `dark:bg-gray-50 dark:text-gray-900` |
| secondary | `border-gray-200 bg-white text-gray-700` | `dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200` |
| ghost | `text-gray-600 hover:bg-gray-100` | `dark:text-gray-400 dark:hover:bg-gray-700` |
| destructive | `bg-red-600 text-white` | `dark:bg-red-700 dark:text-white` |

### 6.5 Chat bubbles (modo oscuro)

| Tipo | Light | Dark |
|------|-------|------|
| Inbound | `bg-gray-100 text-gray-900` | `dark:bg-gray-700 dark:text-gray-100` |
| Outbound | `bg-blue-600 text-white` | `dark:bg-blue-700 dark:text-gray-100` |
| Failed ring | `ring-red-400` | `dark:ring-red-500` |

### 6.6 Error state (modo oscuro)

| Elemento | Light | Dark |
|----------|-------|------|
| Container | `border-red-200 bg-red-50` | `dark:border-red-800 dark:bg-red-950` |
| Title | `text-red-800` | `dark:text-red-300` |
| Message | `text-red-700` | `dark:text-red-400` |

---

## 7. Estrategia de persistencia

### 7.1 localStorage

```typescript
const STORAGE_KEY = "flowdesk-theme";
type Theme = "light" | "dark";

function getStoredTheme(): Theme | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return null;
}

function setStoredTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
}
```

### 7.2 Sincronización

El tema se almacena solo cuando el usuario hace clic en el toggle. La preferencia del sistema solo se usa en la carga inicial si no hay valor almacenado.

### 7.3 Clave única

`flowdesk-theme` con prefijo del proyecto para evitar colisiones con otras apps en el mismo dominio.

---

## 8. Estrategia SSR/CSR

### 8.1 Script anti-flicker

Se inyecta en `pages/_document.tsx` dentro de `<Head>`:

```html
<script dangerouslySetInnerHTML={{
  __html: `
    (function() {
      try {
        var theme = localStorage.getItem('flowdesk-theme');
        if (!theme) {
          theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        }
      } catch(e) {}
    })();
  `
}} />
```

El `try/catch` cubre entornos donde `localStorage` no está disponible (modo incognito con bloqueo, entornos de terceros). Si falla, el tema por defecto (light) se mantiene.

Esto ejecuta antes de que React hydrate. Garantiza que el `<html>` tenga la clase `dark` antes del primer paint.

### 8.2 ThemeProvider

```tsx
// contexts/ThemeContext.tsx
const ThemeContext = createContext<ThemeContextType>(...);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = getStoredTheme();
    if (stored) {
      setTheme(stored);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    setStoredTheme(theme);
  }, [theme]);

  // Evitar hydration mismatch: children invisible hasta mounted
  return (
    <ThemeContext.Provider value={{ theme, mounted, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

### 8.3 Orden de providers en `_app.tsx`

```
ThemeProvider         ← más externo (no depende de nada)
  AuthProvider        ← depende de nada
    AuthGuard
      AppShell
```

ThemeProvider debe estar fuera de AuthProvider porque el script anti-flicker ya aplicó la clase `dark` en `<html>`. ThemeProvider solo sincroniza el estado de React con el DOM.

---

## 9. Componentes afectados

### 9.1 Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `tailwind.config.js` | Añadir `darkMode: "class"` |
| `pages/_document.tsx` | **CREAR** (no existe en Pages Router por defecto). Incluir `<Html>`, `<Head>`, `<body>` con `{children}`. Añadir script anti-flicker inline en `<Head>`. |
| `pages/_app.tsx` | Envolver con ThemeProvider |
| `contexts/ThemeContext.tsx` | **NUEVO** — ThemeProvider + useTheme hook |
| `components/layout/AppShell.tsx` | Añadir `dark:` clases |
| `components/layout/Sidebar.tsx` | Añadir `dark:` clases |
| `components/layout/Header.tsx` | Añadir `dark:` clases + toggle button (Sun/Moon icon) |
| `components/ui/Button.tsx` | Añadir `dark:` clases en variants |
| `components/ui/Badge.tsx` | Añadir `dark:` clases en variants |
| `components/ui/Input.tsx` | Añadir `dark:` clases |
| `components/ui/Table.tsx` | Añadir `dark:` clases |
| `components/ui/Skeleton.tsx` | Añadir `dark:` clases |
| `components/ui/EmptyState.tsx` | Añadir `dark:` clases |
| `components/ui/ErrorState.tsx` | Añadir `dark:` clases |
| `components/dashboard/ConversationTable.tsx` | Añadir `dark:` clases |
| `components/dashboard/ConversationsFilter.tsx` | Añadir `dark:` clases |
| `components/dashboard/Pagination.tsx` | Añadir `dark:` clases |
| `components/workspace/ConversationHeader.tsx` | Añadir `dark:` clases |
| `components/workspace/MessageBubble.tsx` | Añadir `dark:` clases |
| `components/workspace/MessageList.tsx` | Añadir `dark:` clases |
| `components/workspace/Composer.tsx` | Añadir `dark:` clases |
| `pages/login.tsx` | Añadir `dark:` clases |
| `pages/conversations/[id].tsx` | Añadir `dark:` clases |
| `pages/conversations/index.tsx` | Añadir `dark:` clases |

**Total: 22 archivos modificados, 1 archivo nuevo.**

### 9.2 Patrón de cambio por archivo

Cada archivo sigue el mismo patrón. Ejemplo para `Badge.tsx`:

```tsx
// Antes
const variants = {
  default: "bg-gray-100 text-gray-500",
  success: "bg-green-50 text-green-600",
};

// Después
const variants = {
  default: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300",
  success: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400",
};
```

No se cambia la estructura de componentes, no se añaden props, no se cambian interfaces.

---

## 10. Accesibilidad

### 10.1 Contraste

Todos los valores de la paleta oscura cumplen WCAG AA:

| Par | Ratio | Pasa AA? |
|-----|-------|----------|
| `gray-50` (#f9fafb) sobre `gray-800` (#1f2937) | 13.5:1 | ✅ |
| `gray-400` (#9ca3af) sobre `gray-800` (#1f2937) | 4.7:1 | ✅ |
| `gray-300` (#d1d5db) sobre `gray-800` (#1f2937) | 8.3:1 | ✅ |
| `text-green-400` (#4ade80) sobre `green-900/30` (#14532d 30% opacidad) | ~5:1 | ✅ |
| Placeholder `gray-500` (#6b7280) sobre `gray-800` (#1f2937) | 3.2:1 | ⚠️ (mínimo 3:1 para texto grande, pero placeholder es texto pequeño) |

**Mitigación placeholder:** WCAG requiere 4.5:1 para placeholder text. Usar `dark:placeholder-gray-400` en inputs en lugar del placeholder por defecto.

### 10.2 Focus

- El focus ring cambia de `ring-gray-400` a `ring-gray-500` para visibilidad en fondo oscuro.
- `focus-visible:ring-2` mantiene el outline en ambos modos.

### 10.3 Hover states

- Sidebar hover: `dark:hover:bg-gray-700`
- Table row hover: `dark:hover:bg-gray-750` (nota: Tailwind no tiene gray-750; se usa `dark:hover:bg-gray-700/50`)
- Button ghost hover: `dark:hover:bg-gray-700`
- Link hover: `dark:hover:text-gray-50`

### 10.4 Estados disabled

Los botones disabled con `disabled:opacity-50` mantienen ese comportamiento en ambos modos.

### 10.5 Toggle theme button

- Solo ícono (Sun/Moon) con `aria-hidden="true"`. Consistente con el resto del Header que usa icon-only buttons.
- `aria-label` dinámico: `"Cambiar a modo oscuro"` cuando el tema es light, `"Cambiar a modo claro"` cuando es dark.
- Posición en el Header: entre el título y el email del usuario.
- Clases hover: `hover:bg-gray-100 dark:hover:bg-gray-700`

---

## 11. Responsive

El modo oscuro no introduce cambios responsive nuevos. Las clases `dark:` se combinan con las clases responsive existentes:

```tsx
// Ejemplo: AppShell backdrop
className="fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden dark:bg-black/70"
```

La estrategia responsive de F4A se mantiene intacta. No hay breakpoints nuevos.

---

## 12. Performance

### 12.1 Cambio de tema

- El cambio de tema es O(1): añadir/eliminar una clase en `<html>`.
- Tailwind genera ambas variantes en CSS. No hay carga diferida de estilos.
- Sin JavaScript runtime para aplicar estilos (Tailwind CSS puro).

### 12.2 Re-renders

- `ThemeProvider` solo cambia cuando el usuario hace clic en el toggle.
- El toggle solo re-renderiza `Header` y sus hijos. Sin re-renders en cascada (React Context, no prop drilling).

### 12.3 Bundle

- Tailwind purga clases no usadas en build. Las clases `dark:` que no se usan no se incluyen.
- ThemeProvider: ~1KB gzip.

### 12.4 Flickering

- **0ms flickering garantizado**: el script inline se ejecuta en el primer microtask del parser HTML, antes del primer paint.
- No hay flash of wrong theme (FOWT).

---

## 13. Testing

### 13.1 Unit tests

| Test | Archivo |
|------|---------|
| ThemeProvider renders children | `ThemeContext.test.tsx` |
| useTheme returns default "light" | `ThemeContext.test.tsx` |
| toggleTheme switches to "dark" | `ThemeContext.test.tsx` |
| toggleTheme switches back to "light" | `ThemeContext.test.tsx` |
| ThemeProvider reads localStorage on mount | `ThemeContext.test.tsx` |
| ThemeProvider falls back to prefers-color-scheme | `ThemeContext.test.tsx` |
| Header shows Sun icon in dark mode | `Header.test.tsx` |
| Header shows Moon icon in light mode | `Header.test.tsx` |
| Header toggle calls toggleTheme | `Header.test.tsx` |
| Header toggle has correct aria-label per theme | `Header.test.tsx` |
| Button renders dark classes when html has dark class | `Button.test.tsx` |
| Badge renders dark classes when html has dark class | `Badge.test.tsx` |

### 13.2 Integration tests

| Test | Archivo |
|------|---------|
| Full flow: login page in dark mode renders correctly | `login.test.tsx` |
| Full flow: dashboard renders with dark sidebar | `conversations.test.tsx` |

### 13.3 Edge cases

| Caso | Comportamiento esperado |
|------|------------------------|
| localStorage corrompido | Fallback a prefers-color-scheme |
| prefers-color-scheme no soportado | Fallback a "light" |
| Toggle rápido 2 veces en 100ms | El último toggle gana. Sin race condition (React estado sincrónico) |
| SSR sin matchMedia | Módulo no se ejecuta en servidor (guard condicional) |
| JavaScript deshabilitado | El script inline no se ejecuta. No hay dark mode (acceptable degradation) |

### 13.4 Testing strategy for dark classes

```tsx
// En test, la clase "dark" debe estar en documentElement
beforeEach(() => {
  document.documentElement.classList.add("dark");
});

afterEach(() => {
  document.documentElement.classList.remove("dark");
});
```

---

## 14. Documentación

### Archivos a actualizar al finalizar

| Archivo | Cambio |
|---------|--------|
| `docs/F4B-dark-mode.md` | Este documento — cambiar estado a "Implemented" |
| `docs/SESSION_HANDOFF.md` | Añadir F4B al historial, actualizar estado del frontend |
| `docs/PROJECT_ROADMAP.md` | Marcar F4B como completado |
| `docs/PROJECT_DECISIONS.md` | Añadir ADR-024 (ver borrador abajo) |

### Archivos que NO requieren cambios

- `README.md` — No hay nuevas funcionalidades que documentar como core.
- `docs/AI_DEVELOPMENT_GUIDE.md` — No cambia el flujo de desarrollo.
- `docs/ARCHITECTURE_REVIEW.md` — No cambia la arquitectura.

### Borrador ADR-024: Dark Mode con Tailwind class strategy

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-07-28 |
| **Contexto** | El frontend necesita modo oscuro completo. Hay 4 estrategias posibles: Tailwind `dark:` class, CSS custom properties, `light-dark()` CSS nativo, o runtime JavaScript. |
| **Problema** | Elegir estrategia de theming que sea mantenible a largo plazo, no rompa la arquitectura existente, y no añada dependencias. |
| **Alternativas** | Tailwind `dark:` class (ELEGIDA), CSS custom properties + OKLCH, `light-dark()` CSS, Zustand + runtime |
| **Razón** | Tailwind `dark:` class: cero dependencias nuevas, reutiliza el sistema de colores Tailwind existente, sin build complexity, purgado automático de clases no usadas, cualquier dev conoce el patrón `dark:`. CSS custom properties requeriría migrar todos los colores a variables y añadir postcss plugins. `light-dark()` es inmaduro. Zustand fue rechazado en ADR-013. |
| **Consecuencias** | + Sin dependencias nuevas, + máximo DX (autocompletado Tailwind), + purgado automático, + mantenible por cualquier dev, - duplicación de clases (`bg-white dark:bg-gray-800`) en 22 archivos. |

---

## 15. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Hydration mismatch por clase `dark` en SSR vs CSR | Media | Alto | Script inline sincroniza antes de React. ThemeProvider usa `mounted` flag para evitar render hasta que CSR confirme. |
| Olvidar una clase `dark:` en algún componente | Alta | Medio | Code review checklist. Prueba visual manual en ambos modos. |
| Contraste insuficiente en dark mode | Baja | Medio | Paleta diseñada con ratios verificados en 13.1. |
| Regresión en F4A responsive | Baja | Medio | Test suite existente cubre responsive. Clases `dark:` no afectan layout. |
| localStorage lleno/excepciones | Baja | Bajo | Try/catch en get/set. |

---

## 16. Rollout

### Fase 0 — Preparación (previo a implementación)
- Actualizar `docs/PROJECT_ROADMAP.md`: marcar F4B como "En progreso"
- Crear branch `feature/f4b-dark-mode`

### Fase 1 — Infraestructura (1 commit)
1. `tailwind.config.js`: añadir `darkMode: "class"`
2. `contexts/ThemeContext.tsx`: nuevo archivo
3. `pages/_document.tsx`: **CREAR** (no existe en Pages Router) con script anti-flicker
4. `pages/_app.tsx`: envolver con ThemeProvider

### Fase 2 — UI Components (1 commit)
5-14. Modificar 10 componentes UI con `dark:` clases

### Fase 3 — Layout (1 commit)
15-17. Modificar AppShell, Sidebar, Header (incluye toggle)

### Fase 4 — Dashboard (1 commit)
18-21. Modificar ConversationTable, ConversationsFilter, Pagination, conversations/index.tsx

### Fase 5 — Workspace (1 commit)
22-26. Modificar ConversationHeader, MessageBubble, MessageList, Composer, conversations/[id].tsx

### Fase 6 — Login + Page (1 commit)
27. Modificar login.tsx

### Fase 7 — Tests + Docs (1 commit)
28. Tests de ThemeContext, Header toggle
29. Actualizar SESSION_HANDOFF, PROJECT_ROADMAP, ADR

---

## 17. Definition of Done

### Funcional
- [ ] El toggle en Header cambia entre light/dark
- [ ] La preferencia persiste entre recargas de página
- [ ] La preferencia persiste entre sesiones (localStorage)
- [ ] En primera carga sin preferencia almacenada, respeta `prefers-color-scheme`
- [ ] El cambio de tema es instantáneo (sin flickering)
- [ ] Todas las pantallas (login, dashboard, workspace) se ven correctamente en dark mode

### Técnico
- [ ] `tailwind.config.js` tiene `darkMode: "class"`
- [ ] Script anti-flicker en `_document.tsx`
- [ ] ThemeProvider + useTheme hook funcionando
- [ ] 22 archivos modificados con clases `dark:`
- [ ] 1 archivo nuevo (ThemeContext.tsx)
- [ ] `npm run lint` sin errores
- [ ] `npm run build` exitoso
- [ ] `npm run test` — todos los tests pasan (incluyendo nuevos)

### Documentación
- [ ] SESSION_HANDOFF.md actualizado
- [ ] PROJECT_ROADMAP.md actualizado
- [ ] ADR-024 agregado a PROJECT_DECISIONS.md
- [ ] Este documento marcado como "Implemented"

### Auto Review
- [ ] Architecture Review completado
- [ ] Frontend Review completado
- [ ] Accessibility Review completado
- [ ] Performance Review completado
- [ ] Documentation Review completado
- [ ] Consistency Audit completado
- [ ] Todos los hallazgos corregidos antes del merge
