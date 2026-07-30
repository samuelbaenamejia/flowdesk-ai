# F5C — Docker Hardening

> **Estado:** Diseño
> **Depende de:** F5B (Reverse Proxy + TLS) — v0.6.0
> **Implementa:** Resource limits, logging, security context, non-root user, port hardening, .dockerignore, n8n healthcheck

---

## 1. Objetivo

Hardening de los contenedores Docker de FlowDesk-AI. Reducir la superficie de ataque, evitar fugas de recursos (CPU/memoria/disco), y eliminar riesgos operativos como disk full por logs sin rotación o contenedores ejecutándose como root.

---

## 2. Alcance

### Entra

| Item | Justificación |
|------|---------------|
| Resource limits (memoria, CPU) | Evita que un contenedor consuma todos los recursos del VPS y degrade/derribe a los demás |
| Logging con rotación (max-size, max-file) | Evita disk full por logs sin límite |
| Non-root user en Dockerfiles | Reduce impacto de container breakout (root inside container) |
| Read-only root filesystem + tmpfs | Evita modificación del filesystem en runtime |
| Capability dropping | Elimina capacidades kernel innecesarias |
| `security_opt: no-new-privileges` | Previene escalada de privilegios vía SUID |
| Port hardening en producción | Elimina exposición directa de puertos cuando proxy está activo |
| `.dockerignore` para backend y frontend | Reduce build context, evita enviar secrets/env al Docker daemon |
| n8n healthcheck | Detecta n8n caído (missing desde F5A) |
| `init: true` para todos los servicios | Tini como PID 1 — señalización correcta, sin zombies |

### No entra

| Item | Razón |
|------|-------|
| WAF | No es hardening de contenedores, corresponde a capa de red/proxy (F6 si aplica) |
| Image scanning / vulnerability scanning | Requiere herramienta externa (Trivy, Snyk), excede alcance |
| Docker secrets (Swarm) | Docker Compose no soporta secrets mode Swarm. Usar env file existente |
| Multi-stage builds para backend | Backend single-stage es suficiente (Python). Frontend ya es multi-stage |
| seccomp / AppArmor | Perfiles personalizados, alto riesgo de breakage, overkill para MVP |
| Docker Bench Security | Auditoría completa, no implementación. Muchos ítems no aplican (Docker daemon, host config) |
| Monitoring / Observability | F5E |
| Backups | F5D |
| Healthchecks adicionales (backend, frontend) | Ya existen desde Sprint Infra 1 |
| Kubernetes / orquestación | Overkill para single VPS |
| Zero-downtime deploys | Rolling updates requieren orquestación |

---

## 3. Arquitectura

### Antes (F5B)

```
Contenedores: backend, frontend, n8n, caddy
  ─ root user en backend y frontend
  ─ sin resource limits
  ─ sin logging rotation
  ─ sin read-only rootfs
  ─ todas las capabilities por defecto
  ─ puertos expuestos en base compose (8000, 3000, 5678)
  ─ sin .dockerignore
  ─ n8n sin healthcheck
```

### Después (F5C)

```
Contenedores: backend, frontend, n8n, caddy
  ─ non-root user (appuser:appuser)
  ─ mem_limit + cpus para cada servicio
  ─ logging: json-file + max-size 10m + max-file 3
  ─ read_only: true + tmpfs: /tmp
  ─ cap_drop: ALL (caddy: cap_add NET_BIND_SERVICE)
  ─ security_opt: no-new-privileges
  ─ puertos expuestos: solo en dev (con proxy en prod, se limpian)
  ─ .dockerignore en backend/ y frontend/
  ─ n8n healthcheck: wget http://localhost:5678/
  ─ init: true (tini)
```

### Árbol de archivos

```
flowdesk-ai/
├── backend/
│   ├── .dockerignore          ← NUEVO
│   └── Dockerfile             ← MODIFICADO (USER appuser)
├── frontend/
│   ├── .dockerignore          ← NUEVO
│   └── Dockerfile             ← MODIFICADO (USER appuser en runner)
└── infra/
    ├── docker-compose.yml     ← MODIFICADO (logging, n8n healthcheck, init)
    ├── docker-compose.prod.yml← MODIFICADO (resource limits, security context)
    └── docker-compose.proxy.yml← MODIFICADO (port clearing, caddy security)
```

---

## 4. Decisiones técnicas

| Decisión | Elegido | Por qué |
|----------|---------|---------|
| **Resource limits** | `mem_limit` + `cpus` en compose | `deploy.resources.limits` solo es aplicado por `docker compose up` en modo Swarm o con flag `--compatibility`. `mem_limit` y `cpus` son la sintaxis directa (deprecada en spec pero soportada universalmente). Backend 512M/0.5CPU, frontend 512M/0.5CPU, n8n 1G/1CPU, caddy 128M/0.25CPU. |
| **Logging** | yaml anchor + json-file driver | `max-size: 10m`, `max-file: 3`. Reduce riesgo de disk full. Aplica a todos los entornos (dev + prod). |
| **Non-root UID** | 1001 appuser | Consistente entre backend y frontend. GID 1001 appgroup. uid/gid no conflictivos con usuarios del sistema. |
| **Read-only rootfs** | `read_only: true` + `tmpfs: /tmp` | Previene escritura no autorizada al filesystem. tmpfs para /tmp cubre temp files de Python, Node, etc. |
| **Capability dropping** | `cap_drop: ALL` + `cap_add` explícito | Caddy necesita NET_BIND_SERVICE para 80/443. Ningún otro servicio necesita capabilities. |
| **Port hardening** | `ports: []` en proxy.yml | Dev sin proxy: puertos expuestos. Prod con proxy: puertos limpios. No requiere archivos nuevos. |
| **n8n healthcheck** | `wget -q http://localhost:5678/ -O /dev/null` | n8n expone su web UI en `/` (redirect 302 → login → 200). `wget` es portable (disponible en Alpine, base de n8n). curl puede no estar instalado en la imagen. |
| **.dockerignore** | Excluir .git, .env, node_modules, __pycache__, .venv, tests | Reduce build context size. Evita enviar secrets (env local) al Docker daemon. |
| **init** | `init: true` en todos los servicios | Agrega tini como PID 1 (señalización correcta, zombie reaping). Mínimo overhead (<1MB). |
| **tmpfs size** | 64M para /tmp (por defecto), 128M para /app/.next/cache | 64M suficiente para temp files de Python/Node. 128M para cache de imágenes de Next.js. |

### ¿Por qué `mem_limit`/`cpus` y no `deploy.resources.limits`?

`deploy.resources.limits` solo se aplica en modo Swarm o con `--compatibility`. Como `deploy.sh` y `rollback.sh` usan `docker compose up -d` sin ese flag, los limits serían ignorados. `mem_limit` y `cpus` son la sintaxis directa que `docker compose` aplica siempre a los contenedores locales, sin flags adicionales.

### ¿Por qué n8n healthcheck ahora y no antes?

F5A estableció healthchecks para backend y frontend. n8n quedó fuera porque es imagen externa y el endpoint exacto de health no se documentó. El root `/` de n8n siempre retorna HTTP 200 (redirect al login, seguida por wget). `wget` disponible en Alpine, base de la imagen n8n. Bajo riesgo.

### ¿Por qué tmpfs separado para Next.js cache?

Next.js escribe cache de imágenes optimizadas en `.next/cache/`. Con `read_only: true`, esto falla. La solución menos invasiva es montar tmpfs específico para ese directorio. Alternativa considerada y descartada: `images.unoptimized: true` — cambia comportamiento funcional de la app.

---

## 5. Seguridad

| Medida | Cómo se aplica | Afecta a |
|--------|----------------|----------|
| **Non-root user** | `USER appuser` en Dockerfile | backend, frontend |
| **Read-only rootfs** | `read_only: true` en compose | todos |
| **Capability dropping** | `cap_drop: ALL` (caddy: +NET_BIND_SERVICE) | todos |
| **No new privileges** | `security_opt: no-new-privileges:true` | todos |
| **Logs acotados** | `logging: max-size 10m, max-file 3` | todos |
| **Resource limits** | `mem_limit` + `cpus` | todos |
| **Build context minimizado** | .dockerignore | backend, frontend |
| **Sin puertos directos en prod** | `ports: []` override en proxy.yml | backend, frontend, n8n cuando proxy activo |
| **init container** | `init: true` | todos |

### Matriz de capabilities

| Servicio | Cap needed | Razón |
|----------|-----------|-------|
| backend | ninguna | Puerto 8000 (>1024, no privilegiado) |
| frontend | ninguna | Puerto 3000 (>1024, no privilegiado) |
| n8n | ninguna | Puerto 5678 (>1024, no privilegiado) |
| caddy | NET_BIND_SERVICE | Puerto 80 y 443 (<1024, privilegiados) |

### Matriz de tmpfs

| Servicio | Punto de montaje | Tamaño | Propósito |
|----------|-----------------|--------|-----------|
| backend | /tmp | 64M | Python tempfile, uuid temp |
| frontend | /tmp | 64M | Node temp files |
| frontend | /app/.next/cache | 128M | Next.js image optimization cache |
| n8n | /tmp | 64M | Node temp files |
| caddy | /tmp | 64M | Temp files |

---

## 6. Archivos nuevos

```
backend/.dockerignore
frontend/.dockerignore
```

---

## 7. Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `backend/Dockerfile` | Agregar `RUN addgroup/adduser` + `USER appuser` |
| `frontend/Dockerfile` | Agregar `RUN addgroup/adduser` + `chown` + `USER appuser` en runner stage |
| `infra/docker-compose.yml` | Agregar `x-logging` anchor + `logging:` en backend/frontend/n8n + n8n healthcheck + `init: true` |
| `infra/docker-compose.prod.yml` | Agregar `mem_limit` + `cpus` + `read_only: true` + `tmpfs` + `security_opt` + `cap_drop` + `init` + `PYTHONDONTWRITEBYTECODE` |
| `infra/docker-compose.proxy.yml` | Agregar port clearing (backend, frontend, n8n) + Caddy resource limits + security context |

---

## 8. Docker

### 8.1 Logging config (docker-compose.yml + proxy.yml)

```yaml
# docker-compose.yml
x-logging: &default-logging
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"

services:
  backend:
    logging: *default-logging
  frontend:
    logging: *default-logging
  n8n:
    logging: *default-logging
```

```yaml
# docker-compose.proxy.yml (Caddy — anchor no cruza archivos)
services:
  caddy:
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

### 8.2 Resource limits (docker-compose.prod.yml + proxy.yml)

```yaml
# docker-compose.prod.yml
services:
  backend:
    mem_limit: 512M
    cpus: "0.5"
  frontend:
    mem_limit: 512M
    cpus: "0.5"
  n8n:
    mem_limit: 1G
    cpus: "1.0"

# docker-compose.proxy.yml
services:
  caddy:
    mem_limit: 128M
    cpus: "0.25"
```

### 8.3 Security context (docker-compose.prod.yml + proxy.yml)

```yaml
# docker-compose.prod.yml — backend
services:
  backend:
    security_opt:
      - "no-new-privileges:true"
    cap_drop:
      - ALL
    read_only: true
    tmpfs:
      - /tmp:size=64M,noexec,nosuid
    environment:
      - PYTHONDONTWRITEBYTECODE=1  # no .pyc con read-only rootfs

# docker-compose.prod.yml — frontend
services:
  frontend:
    security_opt:
      - "no-new-privileges:true"
    cap_drop:
      - ALL
    read_only: true
    tmpfs:
      - /tmp:size=64M,noexec,nosuid
      - /app/.next/cache:size=128M,noexec,nosuid  # Next.js image cache

# docker-compose.prod.yml — n8n
services:
  n8n:
    security_opt:
      - "no-new-privileges:true"
    cap_drop:
      - ALL
    read_only: true
    tmpfs:
      - /tmp:size=64M,noexec,nosuid

# docker-compose.proxy.yml — caddy
services:
  caddy:
    security_opt:
      - "no-new-privileges:true"
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE  # necesita bind a puertos <1024 (80,443)
    read_only: true
    tmpfs:
      - /tmp:size=64M,noexec,nosuid
```

### 8.4 Port hardening (docker-compose.proxy.yml)

```yaml
services:
  backend:
    ports: []
  frontend:
    ports: []
  n8n:
    ports: []
```

Cuando el proxy está activo, los servicios internos no exponen puertos al host. Dev sin proxy mantiene puertos del base compose.

### 8.5 n8n healthcheck (docker-compose.yml)

```yaml
n8n:
  healthcheck:
    test: wget -q http://localhost:5678/ -O /dev/null || exit 1
    interval: 30s
    timeout: 5s
    start_period: 15s
    retries: 3
```

n8n no incluye `curl` en su imagen Alpine por defecto. `wget` está disponible en todas las imágenes Alpine. El endpoint `/` de n8n retorna 200 (redirect a web UI login, seguida por curl/wget). Mismos parámetros que backend healthcheck.

### 8.6 init: true (docker-compose.yml)

```yaml
services:
  backend:
    init: true
  frontend:
    init: true
  n8n:
    init: true
```

En docker-compose.proxy.yml para Caddy:
```yaml
services:
  caddy:
    init: true
```

### 8.7 .dockerignore

**backend/.dockerignore:**
```
.git
.github
.venv
__pycache__
*.pyc
.env
.coverage
.pytest_cache
.ruff_cache
*.egg-info
tests/
Dockerfile
.gitignore
README.md
```

**frontend/.dockerignore:**
```
.git
.github
node_modules
.next
.env
.env.local
__tests__
coverage
Dockerfile
.gitignore
next-env.d.ts
README.md
tsconfig.tsbuildinfo
*.md
```

---

## 9. Rollout

### Fase 1 — Bajo riesgo (logging + .dockerignore + n8n healthcheck)

```
Archivos: .dockerignore, docker-compose.yml (logging, n8n healthcheck, init)
Riesgo: Muy bajo
Rollback: git revert del commit
```

1. Crear `backend/.dockerignore` y `frontend/.dockerignore`
2. Agregar logging anchor y `init: true` en docker-compose.yml
3. Agregar n8n healthcheck en docker-compose.yml
4. Verificar: `docker compose config` sin errores
5. Verificar: `docker compose up -d` → healthchecks pasan
6. Push a main

### Fase 2 — Riesgo medio (resource limits + port hardening)

```
Archivos: docker-compose.prod.yml, docker-compose.proxy.yml
Riesgo: Medio (port clearing puede romper dev workflow sin proxy)
Rollback: git revert del commit de fase 2
```

1. Agregar resource limits en docker-compose.prod.yml
2. Agregar port clearing en docker-compose.proxy.yml
3. Agregar Caddy resource limits + security context en proxy.yml
4. Verificar: `docker compose config` sin errores con y sin proxy
5. Verificar: dev workflow sin proxy sigue funcionando
6. Push a main

### Fase 3 — Riesgo más alto (non-root user + read-only + cap drop)

```
Archivos: backend/Dockerfile, frontend/Dockerfile, docker-compose.prod.yml (security context)
Riesgo: Alto (puede romper servicios si necesitan escribir en filesystem)
Rollback: git revert del commit de fase 3 o switch a imágenes anteriores
```

1. Modificar backend/Dockerfile — agregar USER appuser
2. Modificar frontend/Dockerfile — agregar USER appuser en runner
3. Agregar security context (read_only, cap_drop, tmpfs) en docker-compose.prod.yml
4. Verificar: `docker compose build` sin errores
5. Verificar: contenedores inician con healthcheck OK
6. Verificar: `docker exec backend whoami` → appuser
7. Verificar: `docker exec backend touch /test.txt` → falla (read-only)
8. Push a main

---

## 10. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Non-root user rompe entrypoint (permisos de escritura) | Media | Backend no inicia | Fase 3 aislada. Rollback rápido: git revert + redeploy. Test en staging antes de prod. |
| Read-only rootfs rompe Next.js (cache, ISR) | Media | Frontend 500 en imágenes | tmpfs para .next/cache. Verificar con healthcheck. Si falla, fase 3 no se mergea sin fix. |
| Port clearing rompe dev workflow sin proxy | Baja | Frontend no accesible en dev | Dev workflow documentado: `docker compose -f infra/docker-compose.yml up`. Ports están en base compose. Se limpian SOLO cuando proxy está activo. |
| n8n healthcheck falso positivo | Baja | n8n se reporta healthy pero no funcional | Healthcheck solo verifica HTTP 200. Es el estándar. n8n no expone healthcheck más granular. |
| Resource limits muy bajos | Baja | OOM kill en picos de carga | Límites conservadores: backend 512M (uso típico ~150M), frontend 512M (~200M), n8n 1G (~300M). Se ajustan si hay OOM. |
| tmpfs lleno (Next.js cache) | Baja | Frontend falla al optimizar imágenes | 128M para cache. Si se llena, mount size mayor. Image optimization no crítica para dashboard. |

---

## 11. Rollback

### Opción A — Completo (todo F5C)

```bash
# Identificar el SHA anterior a F5C
git log --oneline | head

# Rollback al SHA anterior
git revert HEAD --no-commit  # o git revert <sha-del-commit-F5C>
bash infra/rollback.sh sha-anterior
```

### Opción B — Por fase (solo fase 3 si falla)

```bash
# Revertir solo cambios de Dockerfiles y security context
git revert <commit-de-fase-3> --no-commit

# Reconstruir imágenes sin non-root user
cd backend && docker build -t ghcr.io/flowdesk-ai/backend:latest .
cd frontend && docker build -t ghcr.io/flowdesk-ai/frontend:latest .

# Redeploy sin security context
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml -f infra/docker-compose.proxy.yml up -d
```

### Opción C — Sin proxy (desactivar hardening de red)

```bash
# Si port clearing rompe acceso, eliminar proxy.yml y hacer deploy sin él
mv infra/docker-compose.proxy.yml infra/docker-compose.proxy.yml.bak
bash infra/deploy.sh sha-anterior
# Los puertos del base compose se restauran al no estar proxy.yml
```

---

## 12. Estrategia de testing

### Tests automatizados (CI — sin cambios)

Los tests existentes continúan funcionando sin modificación:
- `ruff check app/ tests/ --ignore B008` ✅
- `pytest tests/` ✅ (65 tests)
- `npm run lint` ✅
- `npm run test` ✅ (153 tests)
- `npm run build` ✅

### Tests de build (locales, antes del push)

```bash
# Verificar que Dockerfiles compilan
docker build -t backend-test backend/
docker build -t frontend-test frontend/
```

### Tests de runtime (locales, antes del push)

```bash
# Verificar non-root user
docker run --rm backend-test whoami  # → appuser
docker run --rm frontend-test whoami # → appuser

# Verificar read-only rootfs
docker run --rm --read-only backend-test touch /test.txt  # → falla
docker run --rm --read-only frontend-test touch /test.txt  # → falla
```

### Tests de compose (locales, antes del push)

```bash
# Verificar sintaxis de todos los compose files
docker compose -f infra/docker-compose.yml config
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml config
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml -f infra/docker-compose.proxy.yml config

# Verificar healthchecks en entorno completo
docker compose -f infra/docker-compose.yml up -d
docker compose ps  # health: healthy en todos
```

### Verificación de port hardening

```bash
# Sin proxy: puertos deben estar expuestos
docker compose -f infra/docker-compose.yml up -d
curl http://localhost:8000/health  # → 200

# Con proxy: puertos no deben estar expuestos
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml -f infra/docker-compose.proxy.yml up -d
curl http://localhost:8000/health  # → connection refused
curl https://app.flowdesk.ai/health  # → 200 (via Caddy)
```

---

## 13. Criterios de aceptación

- [ ] `backend/Dockerfile` compila sin errores. `whoami` dentro del contenedor retorna `appuser`.
- [ ] `frontend/Dockerfile` compila sin errores. `whoami` dentro del contenedor retorna `appuser`.
- [ ] `.dockerignore` presente en backend/ y frontend/ con exclusiones correctas.
- [ ] `docker compose config` sin errores para todas las combinaciones de compose files.
- [ ] Backend, frontend y n8n tienen healthchecks. Todos reportan `healthy` después de startup.
- [ ] Logging configurado: `max-size: 10m`, `max-file: 3` en todos los servicios.
- [ ] `init: true` presente en todos los servicios.
- [ ] Resource limits aplicados en producción: backend 512M/0.5CPU, frontend 512M/0.5CPU, n8n 1G/1CPU, caddy 128M/0.25CPU.
- [ ] Read-only rootfs funcional: `touch /test.txt` falla en todos los contenedores.
- [ ] tmpfs montado en /tmp para todos los servicios. Frontend también tiene tmpfs en .next/cache.
- [ ] Capability dropping: backend, frontend, n8n tienen `CapBnd: 0000000000000000`. Caddy tiene solo NET_BIND_SERVICE.
- [ ] `no-new-privileges:true` presente en todos los servicios.
- [ ] Con proxy activo, puertos 8000/3000/5678 no son accesibles desde el host. Solo 80/443 están expuestos.
- [ ] Sin proxy, dev workflow funciona con puertos expuestos.
- [ ] Deploy existente (F5A + F5B) sigue funcionando después de F5C.
- [ ] CI/CD pipeline corre sin errores con los cambios.
- [ ] Documentación actualizada.
---