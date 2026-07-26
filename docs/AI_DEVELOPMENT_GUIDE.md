# AI Development Guide — FlowDesk-AI

> Fuente de verdad para el flujo de desarrollo asistido por IA.
> Versión: 1.0
> Última actualización: 2026-07-26

---

## Tabla de contenido

1. [Propósito](#1-propósito)
2. [Flujo completo de desarrollo](#2-flujo-completo-de-desarrollo)
3. [Selección de Skills](#3-selección-de-skills)
4. [Implementación](#4-implementación)
5. [Auto Code Review](#5-auto-code-review)
6. [Creación del Pull Request](#6-creación-del-pull-request)
7. [Review Final del Diff](#7-review-final-del-diff)
8. [Merge Automático](#8-merge-automático)
9. [Actualización de documentación](#9-actualización-de-documentación)
10. [Verificaciones Post-Merge](#10-verificaciones-post-merge)
11. [Post-Merge Report](#11-post-merge-report)
12. [Plan técnico del siguiente PR](#12-plan-técnico-del-siguiente-pr)
13. [Estándares de calidad](#13-estándares-de-calidad)
14. [Estándares de arquitectura](#14-estándares-de-arquitectura)
15. [Estándares de documentación](#15-estándares-de-documentación)
16. [Política de manejo de errores](#16-política-de-manejo-de-errores)
17. [Progreso global del proyecto](#17-progreso-global-del-proyecto)

---

## 1. Propósito

Este documento define el flujo de trabajo obligatorio para cualquier agente de IA que desarrolle Pull Requests en el repositorio FlowDesk-AI.

Sus objetivos son:

- **Consistencia**: cada PR sigue el mismo proceso, sin depender del contexto de la sesión.
- **Calidad**: ningún PR pasa sin verificación automatizada + revisión humana + code review.
- **Automatización**: el flujo se ejecuta mediante GitHub CLI cuando está disponible.
- **Mantenibilidad**: el repositorio queda limpio después de cada merge.
- **Trazabilidad**: cada PR deja documentación actualizada y un reporte post-merge.

---

## 2. Flujo completo de desarrollo

```
1. Seleccionar Skills                 → skill tool
2. Implementar el alcance del PR      → escribir/editar código
3. Auto Code Review                   → aplicar code-review-skill
4. Corregir problemas encontrados     → editar
5. ruff / lint / build                → bash
6. Verificar conflictos con main      → git merge-base / gh pr
7. Si hay conflictos:                 → mergear main, resolver, volver a 3
8. Crear PR con gh pr create          → gh CLI
9. Review final del diff              → gh pr diff + revisión línea por línea
10. Si hay problemas:                 → corregir, commit, push, volver a 9
11. Merge automático                  → gh pr merge --merge --delete-branch
12. Post-merge:                       → git checkout main; git pull; git fetch --prune
13. Eliminar rama local               → git branch -d <feature>
14. Actualizar documentación          → README.md, PROJECT_ROADMAP.md, SESSION_HANDOFF.md
15. Commit docs + push                → git add; git commit; git push
16. Verificaciones finales            → ruff / lint / build
17. Post-Merge Report                 → entregar reporte completo
18. Plan técnico del siguiente PR     → generar automáticamente
```

Este flujo es **obligatorio**. Ningún paso puede omitirse.

---

## 3. Selección de Skills

### 3.1 Regla

Antes de comenzar cualquier PR, se debe cargar la skill `code-review-skill` y cualquier otra skill relevante para la tarea.

### 3.2 Skills disponibles

| Skill | Cuándo usarla |
|-------|---------------|
| `senior-dev` | Código limpio, arquitectura, buenas prácticas |
| `code-review-skill` | **Siempre** — antes de crear cualquier PR |
| `automatizaciones-n8n` | Workflows de n8n |
| `docker` | Infraestructura Docker |
| `web-scrolling` | Landing pages y sitios web |
| `web-design-pro` | Diseño UI profesional |
| `impeccable` | Diseño, rediseño, crítica de UI |
| `brandkit` | Branding e identidad visual |
| `react-state-management` | Estado global en React (Zustand, Redux, Jotai) |
| `token-efficiency` | Optimización de tokens en respuestas |

### 3.3 Prohibiciones

- No cargar skills innecesarias.
- No trabajar sin la skill `code-review-skill` activa durante la fase de revisión.

---

## 4. Implementación

### 4.1 Principios

- **Vertical**: cada PR implementa una funcionalidad completa, no una capa.
- **Pequeño**: máximo 400–500 líneas modificadas. Si excede, dividir en PRs más pequeños.
- **Enfocado**: un PR = una responsabilidad. No mezclar funcionalidades.
- **Compatibilidad**: no romper contratos existentes (frontend/backend, API, modelos).
- **Sin código muerto**: no dejar imports sin usar, variables sin referencia, ni archivos huérfanos.

### 4.2 Antes de escribir código

1. Leer los archivos existentes del área a modificar.
2. Entender las convenciones del proyecto (nombres, imports, estructura, estilo).
3. Verificar el roadmap para confirmar que el PR corresponde al plan.

### 4.3 Restricciones

- No crear archivos que no se usen en el mismo PR.
- No agregar dependencias nuevas sin justificación explícita.
- No modificar archivos fuera del alcance del PR.
- No dejar TODO, FIXME, HACK, ni comentarios temporales.

---

## 5. Auto Code Review

### 5.1 Obligatorio

Todo PR debe pasar por un Auto Code Review **antes de ser creado** y **nuevamente antes del merge**.

### 5.2 Checklist de revisión

| Categoría | Qué revisar |
|-----------|-------------|
| Arquitectura | ¿La solución encaja en la estructura existente? |
| Imports | ¿Hay imports sin usar? ¿Faltan imports necesarios? |
| Código muerto | ¿Variables, funciones o archivos sin referencia? |
| Breaking changes | ¿Se modificó un contrato público (endpoint, schema, modelo)? |
| Seguridad | ¿Hay inyección SQL, XSS, hardcoded secrets, auth débil? |
| Errores | ¿Todos los edge cases tienen manejo de errores? |
| Consistencia | ¿Sigue los patrones del resto del código? |
| Contratos API | ¿Los endpoints nuevos respetan el diseño REST existente? |
| Alcance | ¿Implementa exactamente lo que dice el roadmap? |
| Archivos accidentales | ¿Hay archivos modificados que no deberían estar en el PR? |
| Nombres | ¿Los nombres son claros y siguen las convenciones del proyecto? |
| Comentarios | ¿No hay comentarios temporales, debug logs o TODO/FIXME? |
| Tamaño | ¿Supera 400–500 líneas? ¿Se puede dividir? |

### 5.3 Herramientas

- `ruff check app/ --ignore B008` para Python.
- `npm run lint` para frontend.
- `npm run build` para verificar compilación.
- Revisión visual del diff con `git diff` o `gh pr diff`.

### 5.4 Corrección

Si se encuentra cualquier problema:

1. Corregir el código.
2. Commit + push.
3. Re-ejecutar ruff/lint/build.
4. Re-ejecutar Code Review.
5. Solo entonces continuar.

---

## 6. Creación del Pull Request

### 6.1 Condiciones previas

No crear un PR si:

- El Code Review no se ha ejecutado.
- Hay errores de ruff, lint o build.
- La rama no está actualizada con main.
- Existen conflictos sin resolver.

### 6.2 Uso de GitHub CLI

Si `gh` está autenticado:

```bash
gh pr create \
  --base main \
  --head <feature-branch> \
  --title "<título profesional>" \
  --body-file <archivo_body>
```

### 6.3 Descripción del PR

Debe incluir **todas** las siguientes secciones:

```markdown
## PR <Letra/Nombre> — <Título>

### Objetivo

### Alcance

### Cambios

### Archivos modificados

### Archivos NO modificados

### Dependencias del roadmap

### Cómo validar este PR

### Breaking changes

### Tamaño del PR

### Verificaciones
```

### 6.4 Si `gh` no está disponible

Indicar explícitamente que `gh` no está instalado o autenticado. No crear PRs sin descripción completa.

---

## 7. Review Final del Diff

### 7.1 Procedimiento

Después de crear el PR, realizar una revisión línea por línea del diff completo:

```bash
gh pr diff <número>
```

### 7.2 Checklist de diff

- [ ] Cambios accidentales (archivos que no deberían estar en el diff).
- [ ] Archivos inesperados.
- [ ] Cambios fuera del alcance del PR.
- [ ] Código duplicado.
- [ ] Nombres incorrectos.
- [ ] Comentarios temporales.
- [ ] TODO/FIXME/HACK olvidados.
- [ ] Logs de debugging (`print()`, `console.log()`, `logger.debug()` residual).
- [ ] Secretos o credenciales hardcodeadas.
- [ ] Cambios de formato innecesarios (espacios, saltos de línea).

### 7.3 Verificación de mergeabilidad

```bash
gh pr view <número> --json mergeable,mergeStateStatus
```

Debe retornar `"mergeable": "MERGEABLE"` y `"mergeStateStatus": "CLEAN"`.

### 7.4 Corrección

Si el diff contiene algún problema:

1. Corregir localmente.
2. Commit + push.
3. Volver al paso 7.1.

---

## 8. Merge Automático

### 8.1 Condiciones para merge

Todas deben cumplirse simultáneamente:

| Condición | Estado requerido |
|-----------|------------------|
| Code Review | Aprobado |
| ruff | All checks passed |
| lint | No ESLint warnings |
| build | Compiled successfully |
| Conflictos con main | Ninguno |
| mergeable | MERGEABLE |
| mergeStateStatus | CLEAN |
| Diff revisado | Sin problemas |
| Alcance | Correcto |

### 8.2 Ejecución

```bash
gh pr merge <número> --merge --delete-branch
```

Si el repositorio utiliza squash o rebase, usar la estrategia correspondiente.

### 8.3 Post-merge inmediato

```bash
git checkout main
git pull origin main
git fetch --prune
git branch -d <feature-branch>     # si falla: git branch -D <feature-branch>
git status                          # debe quedar: working tree clean
git branch                          # solo debe quedar: main
git branch -r                       # solo debe quedar: origin/main, origin/HEAD
git log --oneline -5
```

### 8.4 Stale branches

Si se detectan ramas feature antiguas ya mergeadas, eliminarlas automáticamente (local y remoto).

### 8.5 Si GitHub rechaza el merge

Detener el flujo inmediatamente. Mostrar el error completo. No continuar hasta resolverlo.

---

## 9. Actualización de documentación

### 9.1 Archivos a actualizar

| Archivo | Qué actualizar |
|---------|----------------|
| `README.md` | Tabla de roadmap, marcar PR como completado |
| `docs/PROJECT_ROADMAP.md` | Agregar PR al historial, actualizar pendientes y roadmap específico |
| `docs/SESSION_HANDOFF.md` | Agregar PR al historial, actualizar endpoints, infraestructura, stack, próximo PR |

### 9.2 Reglas

- No dejar documentación desactualizada.
- Si hubo cambios:

```bash
git add README.md docs/PROJECT_ROADMAP.md docs/SESSION_HANDOFF.md
git commit -m "docs: post-merge PR #<número> — <título>"
git push origin main
```

---

## 10. Verificaciones Post-Merge

### 10.1 Comandos obligatorios

```bash
cd backend
uv run ruff check app/ --ignore B008

cd frontend
npm run lint
npm run build
```

### 10.2 Si alguna falla

1. Detener el flujo inmediatamente.
2. Mostrar el error completo.
3. Explicar la causa.
4. Proponer la solución.
5. No continuar hasta resolver.

---

## 11. Post-Merge Report

### 11.1 Formato obligatorio

```markdown
# Post-Merge Report

## Pull Request
- **Número:** #<N>
- **Título:**
- **Estrategia de merge:**
- **Link:** <url>

## Commits
| SHA Corto | SHA Completo | Descripción | Link |
|-----------|-------------|-------------|------|

## SHA actual de main
<sha_completo>

## Estado del repositorio
- **Working Tree:** Clean / Dirty
- **git status:** <output>
- **git branch:** <output>
- **git branch -r:** <output>
- **git log --oneline -5:** <output>
- **Ramas eliminadas:** feature/<nombre>
- **Ramas stale eliminadas:** feature/<nombre> (si aplica)

## Documentación
- README.md: ✅ / ❌
- PROJECT_ROADMAP.md: ✅ / ❌
- SESSION_HANDOFF.md: ✅ / ❌
- Commit docs: <sha>

## Health Check
| Componente | Estado |
|------------|--------|
| Docker Compose | ✅ / ❌ |
| FastAPI | ✅ / ❌ |
| Next.js | ✅ / ❌ |
| Auth | ✅ / ❌ |
| WhatsApp | ✅ / ❌ |
| Groq | ✅ / ❌ |
| n8n | ✅ / ❌ |
| Build | ✅ / ❌ |
| Lint | ✅ / ❌ |
| Ruff | ✅ / ❌ |
| Working Tree | ✅ / ❌ |

## Roadmap Global

████████████████░░░░ XX% (barras de progreso)

| Fase | Estado |
|------|--------|

## Roadmap específico (si aplica)

## Verificaciones
| Comando | Resultado |
|---------|-----------|

## Próximo PR recomendado
- **Nombre:**
- **Objetivo:**
- **Skills:**
- **Archivos esperados:**
- **Riesgos:**
- **Criterios de aceptación:**

---

**Repositorio limpio y listo para comenzar el siguiente PR.**
```

---

## 12. Plan técnico del siguiente PR

### 12.1 Regla

Al finalizar el Post-Merge Report, **no esperar un nuevo prompt**. Generar inmediatamente el plan técnico del siguiente PR.

### 12.2 Contenido del plan

| Elemento | Descripción |
|----------|-------------|
| Nombre | Nombre del PR (ej: "PR E — Human Approval workflow") |
| Objetivo | Qué problema resuelve |
| Diseño | Arquitectura propuesta, flujo de datos |
| Alcance | Qué incluye y qué no incluye |
| Skills | Skills que se cargarán |
| Archivos esperados | Lista de archivos a crear/modificar |
| Dependencias | PRs anteriores que requiere |
| Criterios de aceptación | Cómo se validará el PR |
| Riesgos | Posibles problemas y mitigaciones |
| Checklist de implementación | Pasos concretos para comenzar |

### 12.3 Propósito

El siguiente ciclo debe poder comenzar **inmediatamente** sin necesidad de planificación adicional.

---

## 13. Estándares de calidad

### 13.1 Prioridades

Nunca sacrificar calidad por velocidad.

1. **Correctitud**: el código hace lo que debe hacer.
2. **Seguridad**: no introduce vulnerabilidades.
3. **Arquitectura**: respeta y mejora la estructura existente.
4. **Consistencia**: sigue los patrones del proyecto.
5. **Documentación**: deja el repositorio documentado.
6. **Automatización**: todo lo repetible debe estar automatizado.

### 13.2 Reglas de código

- Sin código duplicado (DRY cuando sea razonable, sin abstracciones prematuras).
- Nombres descriptivos y consistentes.
- Funciones pequeñas con una sola responsabilidad.
- Type hints en Python, TypeScript.
- Async/await para operaciones I/O.
- Manejo explícito de errores (no excepciones silenciosas).
- Sin `print()` ni `console.log()` en código de producción.

### 13.3 Reglas de PR

- Cada PR = una responsabilidad.
- No mergear código que no esté verificado.
- No mergear código con errores conocidos.
- No mergear código sin documentación actualizada.

---

## 14. Estándares de arquitectura

### 14.1 Stack actual

| Capa | Tecnología | Principios |
|------|-----------|------------|
| Backend | FastAPI (Python 3.12) | REST, async, type hints |
| Frontend | Next.js 14 (Pages Router) | React 18, TailwindCSS |
| Base de Datos | PostgreSQL 17.6 (Supabase) | SQLAlchemy 2.0 async |
| Orquestación | n8n | Workflows JSON, webhooks |
| IA | Groq API (Llama 3) | Auto-respuestas |
| Proxy | Caddy | Pendiente |
| Contenedores | Docker Compose | Desarrollo local |

### 14.2 Decisiones arquitectónicas

- Sin Service/Repository layers genéricos (YAGNI). `message_service.py` es excepción justificada.
- Webhook directo en FastAPI (no n8n intermedio para recepción).
- Cada endpoint es async con dependencia `AsyncSession` via `Depends(get_db)`.
- Autenticación: JWT en localStorage, middleware AuthGuard en frontend.
- n8n se comunica con FastAPI mediante Internal API (header `X-Internal-Key`).

### 14.3 Contratos API

- Prefijo: `/api/v1/`
- Respuestas: JSON con `{"status": "ok"}` o `{"detail": "..."}` para errores.
- Códigos HTTP estándar (200, 201, 400, 401, 404, 409, 422, 500).
- Webhook de WhatsApp: `GET /api/v1/webhooks/whatsapp` (verify) y `POST /api/v1/webhooks/whatsapp` (receive).

---

## 15. Estándares de documentación

### 15.1 Archivos de documentación

| Archivo | Propósito | Actualización |
|---------|-----------|---------------|
| `README.md` | Visión general, stack, estructura, roadmap | Cada merge |
| `docs/PROJECT_ROADMAP.md` | Historial de PRs, pendientes, criterios, roadmap específico | Cada merge |
| `docs/SESSION_HANDOFF.md` | Estado actual detallado, endpoints, stack, próximo PR | Cada merge |
| `docs/AI_DEVELOPMENT_GUIDE.md` | **Este documento** — guía para IA | Solo cuando cambie el flujo |

### 15.2 Reglas

- No crear archivos de documentación que no se mantengan.
- No documentar código obvio (el código debe ser auto-documentado).
- Toda decisión arquitectónica relevante debe estar en SESSION_HANDOFF.md.
- El roadmap debe reflejar el progreso real del proyecto.

---

## 16. Política de manejo de errores

### 16.1 GitHub CLI

Si `gh` falla:

1. Mostrar el comando ejecutado.
2. Mostrar el error completo (stdout + stderr).
3. Explicar la causa probable.
4. Proponer la solución.
5. No continuar hasta resolver.

### 16.2 Git

Si un comando git falla:

1. Mostrar el comando.
2. Mostrar el error.
3. Verificar el estado del working tree.
4. Resolver conflictos si existen.
5. Proponer la solución.

### 16.3 Docker

Si Docker Compose falla:

1. Mostrar el error.
2. Verificar que Docker esté corriendo.
3. Verificar puertos ocupados.
4. Proponer la solución.

### 16.4 Verificaciones (ruff/lint/build)

Si alguna falla:

1. Detener el flujo.
2. Mostrar el error completo.
3. Corregir el código.
4. Re-ejecutar.
5. Solo continuar cuando pase.

### 16.5 Regla general

Nunca ocultar errores. Nunca continuar el flujo con errores sin resolver.

---

## 17. Progreso global del proyecto

### 17.1 Fases completadas

| Fase | PRs | Estado |
|------|-----|--------|
| Base del proyecto (FastAPI + Next.js + Docker) | — | ✅ |
| Base de datos y API Core | #1–#6 | ✅ |
| WhatsApp Cloud API | #7–#8 | ✅ |
| Groq LLM Integration | #9 | ✅ |
| Dashboard — Conversaciones | #10–#11 | ✅ |
| Human Takeover | #12 | ✅ |
| Autenticación (3 PRs) | #13–#15 | ✅ |
| n8n — Infraestructura (PR A) | #18 | ✅ |
| n8n — Webhook trigger (PR C) | #16 | ✅ |
| n8n — AI Responder (PR D) | #17 | ✅ |
| n8n — Internal API (PR B) | #19 | ✅ |
| n8n — Human Approval (PR E) | — | 🔄 |
| Testing | — | ⏳ |
| Documentación final | — | ⏳ |

### 17.2 Cálculo de progreso

Fases totales: 13
Fases completadas: 11
Progreso: ~85%
