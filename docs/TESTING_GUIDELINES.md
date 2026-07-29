# Testing Guidelines — FlowDesk-AI

> Versión: 1.0
> Fecha: 2026-07-28
> Estado: Oficial — Estándar de testing del proyecto
> Aplica a: F5, F6 y todas las fases futuras

---

## Tabla de contenido

1. [Objetivo](#1-objetivo)
2. [Arquitectura del testing](#2-arquitectura-del-testing)
3. [Convenciones](#3-convenciones)
4. [Filosofía](#4-filosofía)
5. [Estrategia de cobertura](#5-estrategia-de-cobertura)
6. [Patrones oficiales — Frontend](#6-patrones-oficiales--frontend)
7. [Patrones oficiales — Backend](#7-patrones-oficiales--backend)
8. [Reglas de mocking](#8-reglas-de-mocking)
9. [Regression Policy](#9-regression-policy)
10. [Test Pyramid](#10-test-pyramid)
11. [Performance](#11-performance)
12. [Accesibilidad](#12-accesibilidad)
13. [Realtime](#13-realtime)
14. [Checklist pre-merge](#14-checklist-pre-merge)
15. [Anti-patrones](#15-anti-patrones)
16. [Evolución](#16-evolución)

---

## 1. Objetivo

Este documento es la referencia oficial para todo el testing de FlowDesk-AI.

### Filosofía

- **Test behavior, not implementation.** Las pruebas deben verificar qué hace el sistema, no cómo lo hace internamente.
- **Prefer user interactions over internal state assertions.** En frontend, priorizar clicks, tecleo y eventos del usuario sobre aserciones de estado interno.
- **Mock external services only.** No mockear lógica propia del proyecto; solo lo que está fuera de nuestro control (APIs, HTTP, tiempo, browser APIs).
- **Avoid snapshot testing.** Los snapshots son frágiles, difíciles de revisar y no aportan valor semántico.
- **Every bug fix includes a regression test.** No se acepta un fix sin una prueba que demuestre el bug y verifique la solución.
- **Prefer integration tests over excessive unit tests when reasonable.** Un test que recorre varias capas reales atrapa más bugs que tests aislados.

### Principios

| Principio | Explicación |
|-----------|-------------|
| Determinismo | Mismos inputs → mismos outputs siempre |
| Aislamiento | Tests no comparten estado ni dependen del orden |
| Velocidad | Suite completa < 60s frontend, < 30s backend |
| Legibilidad | Un test = un escenario, nombre descriptivo, arrange/act/assert |
| Mantenibilidad | Sin sleeps, sin timeouts arbitrarios, sin mocks frágiles |

### Alcance

Este documento cubre:

- Frontend: Vitest + @testing-library/react + jsdom
- Backend: pytest + pytest-asyncio + httpx.AsyncClient
- No cubre: E2E (aún no implementado), pruebas de carga, seguridad

---

## 2. Arquitectura del testing

### 2.1 Frontend

| Componente | Detalle |
|------------|---------|
| **Runner** | Vitest ^4.1.10 |
| **Entorno** | jsdom (browser simulado) |
| **Librería principal** | @testing-library/react ^16.3.2 |
| **Matchers DOM** | @testing-library/jest-dom/vitest |
| **Eventos de usuario** | @testing-library/user-event ^14.6.1 |
| **Coverage** | @vitest/coverage-v8, provider v8 |
| **Globals** | `true` (describe, it, expect, vi disponibles globalmente) |
| **Setup** | `src/test/setup.ts` → importa jest-dom matchers |
| **Alias** | `@` → `src/` |
| **Patrón de test** | `src/**/*.test.{ts,tsx}` |

Configuración (`frontend/vitest.config.ts`):

```ts
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: [path.resolve(__dirname, "src/test/setup.ts")],
    passWithNoTests: true,
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/components/**/*.tsx"],
      exclude: ["src/components/**/index.ts", "src/components/**/*.test.tsx"],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

### 2.2 Backend

| Componente | Detalle |
|------------|---------|
| **Runner** | pytest 9.1.1 |
| **Async** | pytest-asyncio 1.4.0 (modo `auto`) |
| **HTTP client** | httpx 0.28.1 con ASGITransport |
| **DB testing** | SQLite in-memory (`sqlite+aiosqlite://`) |
| **Coverage** | pytest-cov 7.1.0 |
| **Linter** | Ruff (no es testing, pero se ejecuta en CI) |
| **Patrón de test** | `tests/test_*.py` |

Configuración (`backend/pyproject.toml`):

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

### 2.3 Organización de tests

```
frontend/src/__tests__/
├── dashboard/         # ConversationTable, ConversationsFilter, Pagination
├── hooks/             # useConversation, useConversations, useMessages
├── layout/            # AppShell, Header, Sidebar
├── pages/             # conversations (page-level integration)
├── ui/                # Button, Input, Badge, Table, Skeleton, EmptyState, ErrorState
└── workspace/         # Composer, ConversationHeader, MessageBubble, MessageList

backend/tests/
├── conftest.py        # Fixtures compartidas (DB, client, auth, mocks)
├── test_auth.py       # Login + Me
├── test_contacts.py   # GET/PATCH contacts
├── test_conversations.py  # List, GET, PATCH
├── test_health.py     # Smoke test
├── test_internal.py   # Internal API endpoints
├── test_messages.py   # List, Create messages
└── test_webhooks.py   # Verify + Receive webhooks
```

---

## 3. Convenciones

### 3.1 Nombres de archivos

- Frontend: `ComponentName.test.tsx` (PascalCase)
- Backend: `test_nombre.py` (snake_case)
- Las utilidades se testean junto al archivo que las usa

### 3.2 Nombres de describe/it

```
describe("ComponentName")       # PascalCase, nombre del componente
describe("hookName")            # camelCase, nombre del hook
describe("POST /endpoint")      # Método HTTP + ruta

it("renders [estado]")          # Componente en estado específico
it("shows [elemento]")          # Elemento visible bajo condición
it("calls [callback] when [evento]")  # Interacción
it("handles [edge case]")       # Caso borde
it("sets [state] on [evento]")  # Cambio de estado (hooks)
it("[action] returns [status]") # Backend: acción + código HTTP esperado
```

**Ejemplos del proyecto:**

```typescript
// Componente
describe("Button")
it("renders children")                          // ✓
it("disables button when disabled")             // ✓
it("calls onClick when clicked")                // ✓
it("shows loading text when loading")           // ✓

// Hook
describe("useMessages")
it("fetches messages on mount with conversationId")     // ✓
it("aborts in-flight request on unmount")               // ✓
it("sets error when fetch fails")                       // ✓

// Backend
class TestListMessages:
    async def test_list_messages_returns_list(...)       // ✓
    async def test_list_messages_conversation_not_found_returns_404(...)  // ✓
```

### 3.3 Estructura de cada test

```
// Frontend (AAA pattern: Arrange, Act, Assert)
it("calls onSend when Enter is pressed", async () => {
  // Arrange
  const onSend = vi.fn().mockResolvedValue(undefined);
  render(<Composer onSend={onSend} ... />);

  // Act
  await user.type(textarea, "Mensaje");
  await user.keyboard("{Enter}");

  // Assert
  expect(onSend).toHaveBeenCalledWith("Mensaje");
});
```

```python
# Backend (GWT pattern: Given, When, Then)
async def test_create_message_returns_201(
    self, client, auth_headers, test_conversation, mock_whatsapp,
):
    # Given: conversación existente + WhatsApp mockeado

    # When: POST mensaje
    response = await client.post(
        f"/api/v1/conversations/{TEST_CONVERSATION_ID}/messages",
        json={"content": "Hello from test"},
        headers=auth_headers,
    )

    # Then: 201 + content correcto
    assert response.status_code == 201
    data = response.json()
    assert data["content"] == "Hello from test"
```

### 3.4 Organización en frontend

- Un archivo por componente/hook
- Agrupar por directorio funcional (dashboard/, hooks/, ui/, workspace/)
- Los test de página van en `pages/`
- No crear test para `index.ts` barrel files

### 3.5 Organización en backend

- Una clase por endpoint group (e.g., `TestListMessages`, `TestCreateMessage`)
- Métodos `test_{action}_{scenario}_returns_{expected_status}`
- Fixtures compartidas en `conftest.py`
- Fixtures específicas dentro del mismo archivo si solo se usan allí

---

## 4. Filosofía

### 4.1 Testear comportamiento, no implementación

```typescript
// ✅ Bien: verificar que el botón está deshabilitado cuando loading=true
it("disables button when loading", () => {
  render(<Button loading>Save</Button>);
  expect(screen.getByRole("button")).toBeDisabled();
});

// ❌ Mal: verificar una prop interna
it("passes disabled prop", () => {
  const { container } = render(<Button loading>Save</Button>);
  expect(container.querySelector("button")?.getAttribute("disabled")).toBe("");
});
```

### 4.2 Preferir interacciones de usuario sobre aserciones de estado interno

```typescript
// ✅ Bien: simular click y verificar callback
await userEvent.click(screen.getByRole("button"));
expect(onClick).toHaveBeenCalledTimes(1);

// ❌ Mal: invocar función interna directamente
button.props.onClick();
expect(onClick).toHaveBeenCalledTimes(1);
```

### 4.3 Un test = un escenario

```typescript
// ✅ Bien: tests separados para cada estado
it("renders loading skeletons")
it("renders empty state")
it("renders messages")
it("calls onLoadMore when clicked")

// ❌ Mal: un test que verifica todo
it("renders correctly in all states")
```

### 4.4 Evitar snapshots

Los snapshots (`toMatchSnapshot`) están **prohibidos** en el proyecto porque:

- Son frágiles: cualquier cambio de formato rompe el test
- Son difíciles de revisar: `git diff` de un snapshot no es semántico
- No verifican comportamiento, solo representación textual
- Se aceptan automáticamente con `--updateSnapshot` sin revisión real

```typescript
// ❌ Mal: snapshot
expect(container).toMatchSnapshot();

// ✅ Bien: aserción semántica
expect(screen.getByRole("button")).toHaveTextContent("Guardando…");
expect(screen.getByRole("button")).toBeDisabled();
```

---

## 5. Estrategia de cobertura

### 5.1 Thresholds actuales

| Métrica | Threshold | Scope |
|---------|-----------|-------|
| Statements | 90% | `src/components/**/*.tsx` |
| Branches | 90% | `src/components/**/*.tsx` |
| Functions | 90% | `src/components/**/*.tsx` |
| Lines | 90% | `src/components/**/*.tsx` |

### 5.2 Prioridades

| Prioridad | Capa | Justificación |
|-----------|------|---------------|
| 🔴 Crítica | Hooks | Contienen lógica de negocio, polling, data fetching |
| 🔴 Crítica | API layer (`lib/`) | Comunicación con backend, serialización |
| 🔴 Crítica | Autenticación | AuthContext, login, token management |
| 🔴 Crítica | Realtime (polling) | F4C: visibilidad, intervalos, dedup, abort |
| 🟡 Media | Layout (AppShell, Sidebar, Header) | Estructural, cambia poco |
| 🟡 Media | Dashboard (tabla, filtros, paginación) | Visual pero con lógica |
| 🟢 Baja | Presentacionales puros (Badge, Skeleton) | Sin lógica, solo render |

### 5.3 Coverage NO es objetivo

El coverage es una **guía**, no un objetivo. Preferimos 80% bien testeado que 95% con tests frágiles. Si un componente es puramente presentacional y su render está cubierto por tests de integración de páginas, no es necesario un test unitario específico.

```
Regla: si no hay lógica condicional (if, ternario, switch), 
no necesita test unitario propio. Los tests de integración 
lo cubren.
```

---

## 6. Patrones oficiales — Frontend

### 6.1 render() — Componentes

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

it("renders and responds to clicks", async () => {
  const onClick = vi.fn();
  render(<Button onClick={onClick}>Click me</Button>);

  expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button"));
  expect(onClick).toHaveBeenCalledTimes(1);
});
```

### 6.2 renderHook() — Hooks

```typescript
import { renderHook, waitFor, act } from "@testing-library/react";

it("fetches data on mount", async () => {
  getMock.mockResolvedValue(data);

  const { result } = renderHook(() => useMyHook());

  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.data).toEqual(data);
});
```

### 6.3 waitFor() — Esperar cambios asíncronos

```typescript
// Estado que cambia después de una promesa
await waitFor(() => expect(result.current.loading).toBe(false));

// Múltiples aserciones
await waitFor(() => {
  expect(mockFn).toHaveBeenCalledTimes(2);
  expect(result.current.items).toHaveLength(3);
});
```

### 6.4 act() — Mutaciones de estado síncronas

```typescript
// Síncrono
act(() => {
  result.current.loadMore();
});

// Asíncrono
await act(async () => {
  await result.current.sendMessage("Hola");
});

// Con promesa pendiente
const promise = result.current.sendMessage("Hola");
await waitFor(() => expect(result.current.sending).toBe(true));
await act(async () => { await promise; });
```

### 6.5 userEvent — Interacciones realistas

```typescript
// Setup (si se necesita múltiples interacciones)
const user = userEvent.setup();

// Click
await userEvent.click(screen.getByRole("button"));

// Type
await userEvent.type(textarea, "Mensaje de prueba");

// Teclas especiales
await userEvent.keyboard("{Enter}");
await userEvent.keyboard("{Shift>}{Enter}{/Shift}");  // Shift+Enter
```

### 6.6 vi.mock() — Mock de módulos

```typescript
// Al inicio del archivo (hoisted automáticamente por Vitest)
vi.mock("@/lib/api", () => ({
  getConversationMessages: vi.fn(),
  sendMessage: vi.fn(),
}));

// Acceder al mock
import { getConversationMessages } from "@/lib/api";
const getMessagesMock = vi.mocked(getConversationMessages);

// Configurar respuestas
getMessagesMock.mockResolvedValue([mockMessage]);
getMessagesMock.mockRejectedValue(new Error("Network error"));
getMessagesMock.mockReturnValue(new Promise(() => {}));  // Pending forever
```

### 6.7 vi.mock() — Mock de hooks hijos

```typescript
vi.mock("@/hooks/useConversations", () => ({
  useConversations: vi.fn(),
}));

import { useConversations } from "@/hooks/useConversations";
const mockUseConversations = vi.mocked(useConversations);

mockUseConversations.mockReturnValue({ loading: true, conversations: [] });
```

### 6.8 vi.mock() — Mock de componentes hijos

```typescript
vi.mock("@/components/layout/Sidebar", () => ({
  default: function MockSidebar() {
    return React.createElement("div", { "data-testid": "sidebar" }, "FlowDesk-AI");
  },
}));

// Luego:
expect(screen.getByTestId("sidebar")).toBeInTheDocument();
```

### 6.9 Fake timers — Tiempo controlado

```typescript
// Para fechas fijas (ej: formatRelativeTime)
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FIXED_NOW);
});
afterAll(() => { vi.useRealTimers(); });

// Para temporizadores (ej: polling, setTimeout)
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

// Avanzar tiempo
await vi.advanceTimersByTimeAsync(5000);  // 5 segundos
expect(mockFn).toHaveBeenCalledTimes(2);
```

### 6.10 AbortController — Señales de cancelación

```typescript
// Mockear con promesa que nunca se resuelve
getMock.mockReturnValue(new Promise(() => {}));

const { result, unmount } = renderHook(() => useMyHook("1"));

// Capturar la señal
const signal = getMock.mock.calls[0][1] as AbortSignal;
expect(signal.aborted).toBe(false);

// Unmount → debe abortar
unmount();
expect(signal.aborted).toBe(true);
```

### 6.11 Visibilidad (visibilitychange)

```typescript
it("pauses polling when page is hidden", async () => {
  vi.useFakeTimers();
  renderHook(() => useMessages("conv-1"));

  Object.defineProperty(document, "visibilityState", { value: "hidden" });
  document.dispatchEvent(new Event("visibilitychange"));

  await vi.advanceTimersByTimeAsync(10000);
  expect(fetchMock).toHaveBeenCalledTimes(1); // solo initial fetch

  vi.useRealTimers();
});
```

---

## 7. Patrones oficiales — Backend

### 7.1 Fixtures en conftest.py

```python
# DB aislada por test (in-memory SQLite)
@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite://", ...)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()

# Cliente HTTP con app FastAPI real y DB mockeada
@pytest_asyncio.fixture
async def client(db_session):
    from app.main import app
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
```

### 7.2 Test de endpoint — Happy path

```python
class TestCreateMessage:
    async def test_create_message_returns_201(
        self, client, auth_headers, test_conversation, mock_whatsapp,
    ):
        response = await client.post(
            f"/api/v1/conversations/{TEST_CONVERSATION_ID}/messages",
            json={"content": "Hello from test"},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["content"] == "Hello from test"
        assert data["direction"] == "outgoing"
```

### 7.3 Test de endpoint — Error cases

```python
# 404
async def test_list_messages_conversation_not_found_returns_404(
    self, client, auth_headers,
):
    response = await client.get(
        f"/api/v1/conversations/{uuid4()}/messages",
        headers=auth_headers,
    )
    assert response.status_code == 404

# 401 (no auth)
async def test_list_messages_requires_auth(self, client):
    response = await client.get(
        f"/api/v1/conversations/{TEST_CONVERSATION_ID}/messages",
    )
    assert response.status_code == 401

# 422 (invalid input)
async def test_create_message_empty_content_returns_422(
    self, client, auth_headers, test_conversation,
):
    response = await client.post(
        f"/api/v1/conversations/{TEST_CONVERSATION_ID}/messages",
        json={"content": "   "},
        headers=auth_headers,
    )
    assert response.status_code == 422
```

### 7.4 Mock de servicios externos

```python
# Mock via monkeypatch (pytest nativo)
@pytest.fixture
def mock_groq(monkeypatch):
    async def mock_generate_response(messages):
        return "This is a mock response from Groq"
    monkeypatch.setattr(
        "app.services.message_service.generate_response",
        mock_generate_response,
    )

# Mock con error específico
@pytest.fixture
def mock_whatsapp_error(monkeypatch):
    async def mock_send_error(to, text):
        raise WhatsAppSendError(400, "Bad request")
    monkeypatch.setattr(
        "app.services.message_service.send_text_message",
        mock_send_error,
    )
```

### 7.5 Test de paginación / filtros

```python
async def test_list_messages_after_filter(
    self, client, auth_headers, test_conversation, db_session,
):
    # Arrange: crear múltiples mensajes con timestamps conocidos
    old_msg = Message(conversation_id=test_conversation.id, ...,
                      created_at=datetime(2026, 1, 1, tzinfo=UTC))
    new_msg = Message(conversation_id=test_conversation.id, ...,
                      created_at=datetime(2026, 7, 28, tzinfo=UTC))
    db_session.add_all([old_msg, new_msg])
    await db_session.commit()

    # Act: filtrar por after
    response = await client.get(
        f"/api/v1/conversations/{TEST_CONVERSATION_ID}/messages"
        f"?after=2026-06-01T00:00:00Z",
        headers=auth_headers,
    )

    # Assert: solo mensajes nuevos
    assert len(response.json()) == 1
    assert response.json()[0]["id"] == str(new_msg.id)
```

---

## 8. Reglas de mocking

### 8.1 Siempre mockear

| Qué | Por qué |
|-----|---------|
| HTTP requests | Llamadas reales hacen el test lento, frágil y dependiente de red |
| APIs externas | WhatsApp, Groq, n8n — fuera de nuestro control |
| Tiempo | `Date.now()`, `setInterval`, `setTimeout` — para tests deterministas |
| Browser APIs | `document.visibilityState`, `localStorage`, `navigator` — no disponibles en jsdom sin mock |
| External SDKs | Cualquier SDK de terceros (Meta, OpenAI, Supabase client) |

### 8.2 Nunca mockear

| Qué | Por qué |
|-----|---------|
| Pure utility functions | `formatTime`, `formatRelativeTime` — testeables sin mock |
| React components under test | El componente bajo prueba debe renderizarse real |
| Domain models | Modelos SQLAlchemy, tipos TypeScript — son datos, no dependencias |
| Lógica interna | Si se mockea lógica propia, se está testeando el mock, no el sistema |

### 8.3 Cómo mockear

**Frontend (Vitest):**

```typescript
// ✅ Bien: mock del módulo completo
vi.mock("@/lib/api", () => ({ myFunc: vi.fn() }));

// ✅ Bien: mock parcial con implementación real para lo no mockeado
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getConversationMessages: vi.fn(),
}));
```

**Backend (pytest):**

```python
# ✅ Bien: monkeypatch para reemplazar función específica
monkeypatch.setattr("app.services.x.external_func", mock_func)
```

**Evitar:**

```python
# ❌ Mal: mockear con unittest.mock.patch (estilo no usado en el proyecto)
with patch("app.services.x.external_func") as mock:
    ...
```

---

## 9. Regression Policy

Cada bug corregido debe incluir:

```
1. Test que falla (reproduce el bug)
2. Fix (código que resuelve el bug)
3. Test que pasa (verifica la solución)
```

**Regla:** No se acepta un fix sin prueba de regresión. Si el bug no es reproducible en un test, el fix no está completo.

**Formato del commit:**

```
fix: [descripción del bug]

- Test que reproduce el bug
- Fix implementado
- Verificación: test pasa
```

---

## 10. Test Pyramid

```
         ╱╲
        ╱  ╲
       ╱ E2E╲           < 10% — aún no implementado
      ╱──────╲
     ╱        ╲
    ╱Integration╲       ~20% — httpx.AsyncClient + in-memory DB
   ╱──────────────╲
  ╱                ╲
 ╱      Unit        ╲    ~70% — renderHook + mocks de API
╱──────────────────────╲
```

### Justificación

| Nivel | Proporción | Ejemplos |
|-------|-----------|----------|
| **Unit (frontend)** | 70% | Hooks con API mockeada, componentes puros, utilidades |
| **Integration (backend)** | 20% | Endpoints con httpx + DB real (SQLite in-memory) |
| **E2E** | < 10% | Aún no implementado. Se añadirá cuando haya flujos críticos que justifiquen Playwright/Cypress |

La pirámide favorece tests unitarios rápidos y deterministas. Los tests de integración backend son "casi E2E" porque usan la app FastAPI real con DB real, pero sin servicios externos (WhatsApp, Groq, n8n mockeados).

---

## 11. Performance

### 11.1 Reglas

| Regla | Explicación |
|-------|-------------|
| Tests independientes | No dependen del orden de ejecución |
| Sin estado compartido | Cada test crea/limpia su propio estado |
| Sin internet | Todas las dependencias externas están mockeadas |
| Sin sleeps | Usar `waitFor` o `vi.advanceTimersByTimeAsync` en lugar de `setTimeout` |
| Deterministas | Mismo resultado siempre, sin falsos positivos/negativos |
| Rápidos | Suite frontend < 60s, backend < 30s |

### 11.2 Tiempos objetivo

| Suite | Tiempo actual | Objetivo |
|-------|---------------|----------|
| Frontend (153 tests) | ~25s | < 60s |
| Backend (48 tests) | ~10s | < 30s |

### 11.3 Lo que ralentiza los tests

- **Re-renders innecesarios**: Preferir `waitFor` sobre `act()` excesivo
- **Mocks pesados**: No mockear módulos enteros si solo se necesita una función
- **setUp costoso**: Las fixtures de conftest.py son function-scoped (se crean por test). Para fixtures pesadas, considerar `scope="module"`

---

## 12. Accesibilidad

### 12.1 Qué verificar siempre

```typescript
it("has correct accessibility attributes", () => {
  const { container } = render(<MessageList ... />);

  const log = container.querySelector('[role="log"]');
  expect(log).toHaveAttribute("aria-live", "polite");
  expect(log).toHaveAttribute("aria-label", "Mensajes de la conversación");
});
```

### 12.2 Checklist de accesibilidad en tests

| Aspecto | Cómo verificarlo |
|---------|-----------------|
| `role` | `screen.getByRole("button")`, `screen.getByRole("alert")` |
| `aria-label` | `toHaveAttribute("aria-label", "...")` |
| `aria-live` | `toHaveAttribute("aria-live", "polite")` |
| Keyboard navigation | `userEvent.tab()`, `userEvent.keyboard("{Enter}")` |
| Focus management | `toHaveFocus()` |
| Screen reader text | `toHaveTextContent()` en elementos con clase `sr-only` |
| Disabled state | `toBeDisabled()` |

### 12.3 Roles más usados en el proyecto

```typescript
screen.getByRole("button")              // Botones
screen.getByRole("alert")               // Errores y notificaciones
screen.getByRole("log")                 // Live regions (MessageList)
screen.getByRole("textbox")             // Inputs, textareas
screen.getByRole("table")               // Tablas
screen.getByRole("row")                 // Filas de tabla
screen.getByRole("columnheader")        // Headers de tabla
```

---

## 13. Realtime

### 13.1 Polling (F4C)

Los hooks con polling (useMessages, useConversations, useConversation) deben testear:

```typescript
it("polls interval de 5s", async () => {
  vi.useFakeTimers();
  renderHook(() => useMessages("conv-1"));

  await vi.advanceTimersByTimeAsync(5000);
  expect(fetchMock).toHaveBeenCalledTimes(2); // initial + 1 poll

  await vi.advanceTimersByTimeAsync(5000);
  expect(fetchMock).toHaveBeenCalledTimes(3);

  vi.useRealTimers();
});

it("pauses polling when hidden", async () => {
  vi.useFakeTimers();
  renderHook(() => useMessages("conv-1"));

  Object.defineProperty(document, "visibilityState", { value: "hidden" });
  document.dispatchEvent(new Event("visibilitychange"));

  await vi.advanceTimersByTimeAsync(10000);
  expect(fetchMock).toHaveBeenCalledTimes(1); // solo initial

  vi.useRealTimers();
});

it("resumes polling on visibility visible", async () => {
  vi.useFakeTimers();
  renderHook(() => useMessages("conv-1"));

  Object.defineProperty(document, "visibilityState", { value: "hidden" });
  document.dispatchEvent(new Event("visibilitychange"));

  Object.defineProperty(document, "visibilityState", { value: "visible" });
  document.dispatchEvent(new Event("visibilitychange"));

  await vi.advanceTimersByTimeAsync(5000);
  expect(fetchMock).toHaveBeenCalledTimes(2); // initial + refetch on visible

  vi.useRealTimers();
});

it("does not produce duplicates", async () => {
  vi.useFakeTimers();
  fetchMock
    .mockResolvedValueOnce([msg1])     // initial fetch
    .mockResolvedValueOnce([msg1, msg2]); // poll returns 1 dup + 1 new

  const { result } = renderHook(() => useMessages("conv-1"));
  await vi.advanceTimersByTimeAsync(0);
  await waitFor(() => expect(result.current.loading).toBe(false));

  await vi.advanceTimersByTimeAsync(5000);

  expect(result.current.messages).toHaveLength(2); // no duplicate
  vi.useRealTimers();
});
```

### 13.2 Duplicate events

```typescript
it("handles duplicate messages on append", async () => {
  // El hook debe usar Set por id para evitar duplicados
  fetchMock.mockResolvedValue([msg1]);       // initial
  fetchMock.mockResolvedValue([msg1, msg2]); // poll con dup

  // Verificar que msg1 no aparece dos veces
});
```

### 13.3 Disconnect / AbortController

```typescript
it("cleans up interval and aborts on unmount", () => {
  const { unmount } = renderHook(() => useMessages("conv-1"));

  unmount();

  // No debe haber errores de "setState after unmount"
  // El cleanup del efecto debe cancelar el intervalo
});
```

---

## 14. Checklist pre-merge

Antes de cerrar cualquier PR, verificar:

```
□ npm run lint         — 0 errores ESLint
□ npm run build        — Compilación exitosa
□ npm run test         — 100% tests pasando
□ npm run test -- --coverage — thresholds ≥ 90%
□ uv run ruff check app/ --ignore B008  — 0 errores backend
□ No hay tests skipped (comprobar con --bail)
□ No hay .only() en tests
□ No hay console.log() en código de producción
□ No hay flaky tests (ejecutar suite 2x seguidas)
□ Docs actualizadas (ROADMAP, SESSION_HANDOFF, CHANGELOG)
□ Delta report generado
□ Auditoría de consistencia completada
```

---

## 15. Anti-patrones

### 15.1 Snapshots innecesarios

```typescript
// ❌ Mal
expect(container).toMatchSnapshot();

// ✅ Bien
expect(screen.getByText("No hay mensajes")).toBeInTheDocument();
```

### 15.2 Mocks excesivos

```typescript
// ❌ Mal: mockear utilidad pura
vi.mock("@/lib/formatTime", () => ({ formatTime: vi.fn() }));

// ✅ Bien: usar la función real
import { formatTime } from "@/lib/formatTime";
expect(formatTime(date)).toBe("10:30");
```

### 15.3 Sleeps y timeouts arbitrarios

```typescript
// ❌ Mal: sleep frágil
await new Promise((r) => setTimeout(r, 1000));
expect(fn).toHaveBeenCalled();

// ✅ Bien: waitFor robusto
await waitFor(() => expect(fn).toHaveBeenCalled());
```

### 15.4 Tests frágiles por acoplamiento a implementación

```typescript
// ❌ Mal: aserción sobre nombre de clase
expect(btn.className).toContain("bg-gray-900");  // se rompe si cambia Tailwind

// ✅ Bien: aserción semántica
expect(btn).toBeDisabled();
```

### 15.5 Duplicación de lógica

```typescript
// ❌ Mal: duplicar la lógica del componente en el test
const expected = messages.filter(m => m.status === "active").length;
expect(activeCount).toBe(expected);

// ✅ Bien: verificar el resultado, no la lógica
expect(screen.getAllByRole("row")).toHaveLength(3);
```

### 15.6 Tests dependientes del orden

```python
# ❌ Mal: depende de un test anterior
def test_create():
    ...

def test_list():
    # Asume que test_create ya creó datos
    response = client.get("/items")
    assert len(response.json()) == 1

# ✅ Bien: cada test crea sus propios datos
def test_list_with_items():
    # Arrange
    create_item_in_db()
    # Act
    response = client.get("/items")
    # Assert
    assert len(response.json()) == 1
```

### 15.7 console.log en producción o tests

```typescript
// ❌ Mal: debug left in test
it("renders", () => {
  console.log("rendering test");  // ← eliminar
  render(<Component />);
});
```

---

## 16. Evolución

### 16.1 F5 — Próximas fases

| Área | Acción esperada |
|------|-----------------|
| Nuevos hooks | Seguir patrón `renderHook` + `vi.mock` de API |
| Nuevos componentes | Seguir patrón `render` + `userEvent` + `screen` |
| Nuevos endpoints backend | Seguir patrón clase `TestXxx` + fixtures compartidas |
| Nuevos servicios externos | Añadir fixture mock en `conftest.py` |

### 16.2 F6 — Testing avanzado

| Área | Objetivo |
|------|----------|
| Backend `after` param | Tests de filtro por timestamp (pendiente) |
| Backend `limit`/`offset` | Tests de paginación completa (pendiente) |
| Multi-message fixtures | Fixtures para crear N mensajes con timestamps |
| Polling tests frontend | Tests con fake timers para F4C (pendiente) |
| ThemeContext tests | Toggle, localStorage, system preference (pendiente) |
| formatTime tests | Edge cases, locale, relative time (pendiente) |

### 16.3 Futuro — E2E

Cuando el proyecto justifique E2E:

- Playwright (recomendado por robustez y debug)
- Máximo 10-15 tests E2E para flujos críticos
- Login → ver conversaciones → abrir detalle → enviar mensaje → ver takeover
- No sustituir tests unitarios/integración, solo complementar

### 16.4 Mantenimiento del documento

- Este documento debe actualizarse cuando se añadan nuevos patrones de testing
- Cualquier desviación del estándar debe documentarse con justificación
- Las reglas aquí definidas tienen prioridad sobre preferencias personales

---

> **Fin del documento.** Este es el estándar oficial de testing de FlowDesk-AI. Cualquier duda o sugerencia, actualizar este documento vía PR.
