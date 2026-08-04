# F5B — Reverse Proxy + TLS (Caddy)

> **Estado:** Diseño
> **Depende de:** F5A (CI/CD Pipeline) — v0.5.0
> **Implementa:** ADR-021 (Caddy sobre Traefik)

---

## 1. Objetivo

Agregar un reverse proxy con TLS automático frente a los servicios de FlowDesk-AI. Reemplazar la exposición directa de puertos por un punto único de entrada con HTTPS, seguridad de headers, y configuración mantenible.

---

## 2. Alcance

### Entra
- Caddy 2 como reverse proxy (un solo binario, TLS por defecto)
- Let's Encrypt automático para certificados TLS
- HTTP/2 y HTTP/3 (QUIC) habilitados
- Redirección forzosa HTTP → HTTPS
- Security headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Proxy de 3 servicios: frontend (3000), backend (8000), n8n (5678)
- Frontend: `app.flowdesk.ai` → Caddy → frontend + `/api/*` → backend
- n8n: `n8n.flowdesk.ai` → Caddy → n8n
- Archivos: `infra/Caddyfile`, `infra/docker-compose.proxy.yml`
- Modificaciones mínimas a `docker-compose.yml` (solo network explícita)
- Actualización de `deploy.sh` y `rollback.sh` para incluir proxy
- Nuevo secret `NEXT_PUBLIC_API_URL` para build arg en CD
- Documentación: DEPLOY.md, CHANGELOG, ROADMAP, SESSION_HANDOFF

### No entra
- WAF (Web Application Firewall) — se añade en F5C si aplica
- Rate limiting a nivel proxy — ya existe en backend (F4B)
- DDoS protection — fuera del alcance del MVP
- Multi-entorno (staging/prod separados) — mismo approach que F5A
- CDN (Cloudflare, CloudFront) — el VPS sirve directamente
- Autenticación a nivel proxy — ya existe en backend (JWT)
- Dashboard de monitoreo de tráfico — se considera en F5D

---

## 3. Arquitectura

### Flujo completo

```
Internet :443
    │
    ▼
┌──────────────┐
│   Caddy 2    │  ← Puerto 80 → 301 redirect :443
│   :80/:443   │
│  TLS/QUIC    │
└──────┬───────┘
       │
       ├──── app.flowdesk.ai ───────────────────────┐
       │                                             │
       │  ┌────────────────────────────────────┐     │
       │  │  Caddyfile rule:                   │     │
       │  │  app.flowdesk.ai {                 │     │
       │  │    handle_path /api/* {            │     │
       │  │      reverse_proxy backend:8000    │     │
       │  │    }                               │     │
       │  │    reverse_proxy frontend:3000     │     │
       │  │  }                                 │     │
       │  └────────────────────────────────────┘     │
       │                                             │
       ├── /api/* ──────────► backend:8000 ─────► Supabase Cloud
       │                                             │
       └── /* ─────────────► frontend:3000           │
                                                     │
       ┌──── n8n.flowdesk.ai ────────────────────┐   │
       │  reverse_proxy n8n:5678 ────────────────┼───┤
       └─────────────────────────────────────────┘   │
                                                     ▼
                                              PostgreSQL (externo)
```

### Capas

| Capa | Componente | Puerto interno | Puerto externo |
|------|-----------|---------------|----------------|
| 1 — Edge | Caddy 2 | 80/443 | 80/443 |
| 2 — Web | Frontend (Next.js) | 3000 | — (solo vía Caddy) |
| 3 — API | Backend (FastAPI) | 8000 | — (solo vía Caddy) |
| 4 — Workflow | n8n | 5678 | — (solo vía Caddy) |
| 5 — DB | Supabase PostgreSQL | — | Externo |

### Red Docker

Todos los servicios comparten la red por defecto de Docker Compose (`flowdesk_default`). No se requiere red adicional. Caddy resuelve los servicios por nombre de servicio (`backend`, `frontend`, `n8n`).

---

## 4. Decisiones técnicas

| Decisión | Elegido | Por qué |
|----------|---------|---------|
| **Reverse proxy** | Caddy 2 | ADR-021 ya decidió Caddy sobre Traefik/Nginx. Un binario, TLS automático, configuración declarativa (Caddyfile). Para 3 servicios, Caddy es la opción más simple y profesional. |
| **TLS** | Let's Encrypt (ACME) | Automático, gratuito, ampliamente soportado. Caddy integra ACME nativamente — no requiere certbot ni cron jobs. |
| **HTTP/2** | Sí | Caddy lo habilita por defecto. Mejor rendimiento que HTTP/1.1 (multiplexing, header compression, server push). |
| **HTTP/3 (QUIC)** | Sí | Caddy lo habilita por defecto. Reduce latency en conexiones nuevas (0-RTT), mejora rendimiento en redes con pérdida de paquetes (móvil). |
| **Subdominios vs paths** | Subdominios | `app.flowdesk.ai` para frontend+API, `n8n.flowdesk.ai` para n8n. Permite aislar configuraciones de seguridad, facilita escalado futuro a microservicios, y evita conflictos de rutas con frameworks. |
| **Puertos directos** | Eliminados en producción | Backend:8000, frontend:3000, n8n:5678 dejan de exponerse al host en producción. Solo Caddy expone puertos. |
| **Frontend API URL** | Build arg en CD | `NEXT_PUBLIC_API_URL` debe ser `https://app.flowdesk.ai` en producción. Se pasa como build arg durante el build de la imagen Docker en CI/CD. |
| **LET'S ENCRYPT** | Caddy lo maneja | Sin certbot. Sin cron. Sin manual steps. Caddy obtiene y renueva certificados automáticamente. |

### ¿Por qué no Nginx?

Nginx requiere configuración manual para TLS (certbot + cron), no tiene HTTP/3 nativo (requiere compilación con módulo QUIC+), y los security headers requieren módulos adicionales (`ngx_http_headers_module`). Caddy hace todo por defecto con menos líneas de configuración.

### ¿Por qué no Traefik?

ADR-021 ya documenta la decisión: Traefik requiere Docker labels, Go templates, y ofrece decenas de features que no usamos. Caddy resuelve el mismo problema con un Caddyfile de 15 líneas.

---

## 5. Seguridad

| Medida | Configuración | Implementación |
|--------|--------------|----------------|
| **HTTPS obligatorio** | Sí | Caddy redirect HTTP:80 → HTTPS:443 |
| **HTTP→301 redirect** | `redir https://{host}{uri} permanent` | Caddy global |
| **HSTS** | `max-age=31536000; includeSubDomains; preload` | Caddy header directive |
| **X-Frame-Options** | `DENY` | Caddy header directive |
| **X-Content-Type-Options** | `nosniff` | Caddy header directive |
| **Referrer-Policy** | `strict-origin-when-cross-origin` | Caddy header directive (frontend) |
| **Permissions-Policy** | `camera=(), microphone=(), geolocation=()` | Caddy header directive (frontend) |
| **TLS mínimo** | TLS 1.2 (1.3 preferido) | Default de Caddy 2 |
| **Cipher suites** | Default de Caddy 2 (moderno, seguro) | Sin override necesario |
| **Compresión segura** | Gzip, no Zstandard (sin configuración adicional) | Default de Caddy |
| **CSP** | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'` | Enfrontado: CSP estricto rompe Next.js (inline styles, scripts de framework). Se implementa como report-only inicialmente. |

### Nota sobre CSP

CSP estricto (`'self'` sin `'unsafe-inline'`) rompe Next.js porque el framework inyecta estilos inline y scripts con hashes. La configuración recomendada es `'unsafe-inline'` para scripts y estilos. Si se requiere CSP estricto, debe implementarse con nonces o hashes desde Next.js (no desde Caddy). Para el MVP, se omite CSP (Caddy no aplica CSP; el frontend puede implementarlo si es necesario).

---

## 6. Archivos nuevos

```
infra/
├── Caddyfile                    → Configuración del reverse proxy
└── docker-compose.proxy.yml     → Servicio Caddy + override de puertos
```

---

## 7. Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `infra/deploy.sh` | Agregar `-f docker-compose.proxy.yml` a comandos compose |
| `infra/rollback.sh` | Agregar `-f docker-compose.proxy.yml` a comando compose |
| `infra/.env.example` | Agregar `CADDY_DOMAIN=app.flowdesk.ai` y `N8N_SUBDOMAIN=n8n` |
| `.github/workflows/deploy.yml` | Agregar `build-args` para `NEXT_PUBLIC_API_URL` en frontend build |
| `frontend/Dockerfile` | Agregar `ARG NEXT_PUBLIC_API_URL` y `ENV` |
| `docs/DEPLOY.md` | Sección 9: Caddy + proxy, actualizar tabla de puertos |
| `docs/CHANGELOG.md` | v0.6.0 entry |
| `docs/PROJECT_ROADMAP.md` | Marcar F5B como completado |
| `docs/SESSION_HANDOFF.md` | Agregar F5B section |

---

## 8. Docker

### Red

Todos los servicios comparten la red por defecto de Docker Compose. No se requiere configuración adicional de red.

### Puertos

| Servicio | Antes (F5A) | Después (F5B) |
|----------|------------|---------------|
| Caddy | — | `80:80`, `443:443` |
| Backend | `8000:8000` | — (interno) |
| Frontend | `3000:3000` | — (interno) |
| n8n | `5678:5678` | — (interno) |

### Comunicación entre contenedores

- Caddy → backend: `backend:8000`
- Caddy → frontend: `frontend:3000`
- Caddy → n8n: `n8n:5678`
- Frontend → backend: `backend:8000` (server-side desde Next.js)
- Backend → n8n: `n8n:5678` (para webhooks internos)
- Frontend browser → backend: `https://app.flowdesk.ai/api/*` (vía Caddy)

### Volúmenes

- `caddy_data`: Persiste certificados de Let's Encrypt y configuración de Caddy

---

## 9. Rollout

### Paso 1 — Agregar archivos de proxy
Crear `Caddyfile` y `docker-compose.proxy.yml` en `infra/`.

### Paso 2 — Modificar deploy.sh y rollback.sh
Agregar `-f docker-compose.proxy.yml` a todos los comandos `docker compose`.

### Paso 3 — Modificar frontend Dockerfile
Agregar `ARG NEXT_PUBLIC_API_URL` y `ENV`.

### Paso 4 — Actualizar deploy.yml (CD)
Agregar `build-args` para `NEXT_PUBLIC_API_URL`.

### Paso 5 — Actualizar .env.example
Agregar `CADDY_DOMAIN` y `N8N_SUBDOMAIN`.

### Paso 6 — Desplegar
Push a main → CI pasa → CD construye nuevas imágenes (frontend con API URL correcta) → Deploy al VPS.

### Downtime
Teóricamente cero: Caddy inicia primero y redirige tráfico a los servicios existentes. Los servicios dejan de exponer puertos directos solo cuando se hace `docker compose up -d` con el override de proxy. En la práctica, hay segundos de ventana donde los servicios existentes ya no tienen puertos expuestos y Caddy aún no está listo. Mitigación: healthcheck de Caddy antes de iniciar.

---

## 10. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Certificado Let's Encrypt no emitido (dominio no apunta a VPS) | Alta si no hay DNS | ❌ Sin HTTPS | Documentar prerequisito DNS en DEPLOY.md. Caddy falla gracefulmente (sirve HTTP). |
| NEXT_PUBLIC_API_URL incorrecto en build | Media | Frontend llama a URL equivocada | Usar fallback `/api` en el frontend para que funcione sin env var. Verificar antes del deploy. |
| Caddy no inicia por Caddyfile inválido | Baja | Sin proxy, servicios no accesibles | `docker compose config` valida sintaxis. Test local antes de push. |
| n8n webhook URL no actualizada | Media | n8n no recibe webhooks | `N8N_WEBHOOK_URL` debe apuntar a `https://n8n.flowdesk.ai`. Documentar. |
| Puerto 80/443 ocupados en VPS | Baja | Caddy no puede iniciar | Verificar antes del deploy. `lsof -i :80,443`. |
| CSP rompe frontend | Media | Estilos/scripts bloqueados | CSP report-only inicialmente. No bloqueante. |

---

## 11. Rollback

### Opción A — Rápida (desactivar proxy)
```bash
# Descomentar -f docker-compose.proxy.yml de deploy.sh
# Ejecutar deploy manual con tag anterior
bash infra/deploy.sh sha-anterior
```
Esto elimina el override de proxy → servicios vuelven a exponer puertos directos → Caddy deja de recibir tráfico.

### Opción B — Completa (rollback estándar)
```bash
bash infra/rollback.sh sha-anterior
```
Igual que F5A. El rollback no incluye el proxy porque la imagen anterior se construyó sin él. Después del rollback, ejecutar:
```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml up -d
```

---

## 12. Acceptance Criteria

- [ ] Caddy inicia con Caddyfile válido (`docker compose config` sin errores)
- [ ] Caddy sirve frontend en `https://app.flowdesk.ai`
- [ ] Caddy sirve API en `https://app.flowdesk.ai/api/*`
- [ ] Caddy sirve n8n en `https://n8n.flowdesk.ai`
- [ ] HTTP:80 redirige a HTTPS:443 (301)
- [ ] TLS 1.2/1.3 funciona (SSLLabs test A o superior)
- [ ] Security headers presentes: HSTS, XFO, XCTO, RP, PP
- [ ] HTTP/3 (QUIC) habilitado
- [ ] Puertos directos (8000, 3000, 5678) no accesibles desde el host
- [ ] `deploy.sh` y `rollback.sh` funcionan con proxy
- [ ] Rollback a F5A deja el sistema funcionando sin proxy
- [ ] CHANGELOG, ROADMAP, SESSION_HANDOFF, DEPLOY actualizados
---
