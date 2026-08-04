# F5D — Monitoring, Observability & Backups

> Versión: 2.0
> Fecha: 2026-07-30
> Estado: Diseño — Pendiente de aprobación
> Costo mensual: **$0**

---

## Índice

1. [Monitoring](#1-monitoring)
2. [Logging](#2-logging)
3. [Healthchecks](#3-healthchecks)
4. [Alerting](#4-alerting)
5. [Backups](#5-backups)
6. [Disaster Recovery](#6-disaster-recovery)
7. [Security Monitoring](#7-security-monitoring)
8. [Coste](#8-coste)
9. [Cambios esperados](#9-cambios-esperados)
10. [Riesgos](#10-riesgos)

---

## 1. Monitoring

### Filosofía

El proyecto corre en un solo VPS. No necesito Prometheus + Grafana (1-2GB RAM agregados) para monitorear 4 contenedores. Uso el enfoque **"suficiente para producción en 1 servidor"** :

1. **Healthchecks enriquecidos** — el backend reporta su estado real.
2. **Uptime Kuma** — monitorea endpoints externos e internos desde afuera.
3. **Scripts ligeros** — métricas del sistema vía cron con alertas por umbral.

### ¿Qué monitorear?

| Componente | Qué medir | Cómo |
|------------|-----------|------|
| **Backend** | Up/Down, DB reachable, última migración, version, uptime, 5xx rate | Endpoint `/health` enriquecido |
| **Frontend** | Up/Down, status code, latency | Uptime Kuma monitor HTTP |
| **PostgreSQL** | Up/Down, connection count | Backend `/health` lo chequea internamente |
| **n8n** | Up/Down, workflow failures | Uptime Kuma + backend `/health` |
| **Docker** | Contenedores running vs expected | Script bash: `docker ps` vs expected list |
| **VPS** | Disco (%) , RAM (%) , CPU (load avg) | Script bash + Uptime Kuma push monitor |

### Métricas que realmente importan

- Backend 5xx rate — señal de errores de aplicación
- PostgreSQL reachable — sin DB la app no funciona
- Disco >70% — el servidor puede quedarse sin espacio (logs + backups locales)
- RAM >85% — OOM killer puede matar contenedores
- n8n workflow failures — la automatización dejó de funcionar
- TLS expiry <30 días — Caddy renueva automáticamente, pero conviene saberlo

---

## 2. Logging

### Estado actual

```
Formato: 2026-07-30 12:00:00,000  app.service  INFO  mensaje
Driver: Docker json-file (F5C)
Rotación: 10MB por archivo, 3 archivos
Destino: stdout del contenedor → Docker json-file → disco
```

### Problemas del formato actual

1. Texto plano — no parseable por máquinas.
2. Sin campos estructurados (request_id, service, duration_ms).
3. grep/search ineficiente.
4. Imposible de enviar a un agregador futuro sin reescribir.

### Solución propuesta

**Formato JSON estructurado** en el backend (Python logging → JSON lines).

```json
{"timestamp": "2026-07-30T12:00:00.000Z", "level": "INFO", "logger": "app.services.message", "message": "message processed", "request_id": "abc123", "duration_ms": 45, "conversation_id": "uuid"}
```

Razones para JSON:
- Docker json-file driver ya guarda en JSON → log estructurado anidado.
- Parseable por cualquier herramienta futura (Loki, Datadog, Axiom).
- grep con `jq` es más preciso que regex sobre texto plano.
- Compatible con log aggregation futura sin cambiar formato.

### Lo que NO se agrega

- **No Loki** para un solo VPS. No justifica 200MB RAM adicionales.
- **No Promtail** — mismo motivo.
- **No ELK** — overkill total.

Si el proyecto escala a múltiples servidores, se agrega Loki + Promtail en ese momento. El cambio será: apuntar Promtail a los archivos JSON de Docker, que ya están en el formato correcto.

### Cobertura por servicio

| Servicio | Formato actual | Formato propuesto | Cambio requerido |
|----------|---------------|-------------------|------------------|
| Backend | Texto plano stdout | JSON lines stdout | Modificar `logging.py` |
| Frontend | Next.js stdout | Texto (no justifica cambio) | Ninguno |
| n8n | JSON por defecto | JSON (ya está) | Ninguno |
| Caddy | JSON por defecto | JSON (ya está) | Ninguno |
| Docker | json-file driver | json-file (ya está en F5C) | Ninguno |

### Frontend logs

Next.js en producción no genera logs significativos. El frontend es una SPA — toda la lógica real está en el backend. Los errores de frontend se capturan via `ErrorBoundary` (ya implementado). No justifica inversión en logging estructurado.

### N8N logs

n8n ya loguea en JSON. Docker json-file lo captura automáticamente. Sin cambios.

---

## 3. Healthchecks

### Auditoría de healthchecks actuales

| Servicio | Healthcheck actual | ¿Qué verifica? | Suficiente? |
|----------|-------------------|----------------|-------------|
| **Backend** | `curl --fail http://localhost:8000/health` | Solo que el proceso responde HTTP 200 | ❌ Mejorable |
| **Frontend** | `curl --fail http://localhost:3000/` | Solo que Next.js responde | ✅ Suficiente |
| **n8n** | `node -e "require('http').get(...)"` | Solo que n8n responde HTTP | ✅ Suficiente |
| **Caddy** | Ninguno (F5C no incluyó healthcheck) | ❌ No se verifica | ❌ Falta |
| **PostgreSQL** | Ninguno (DB externa) | ❌ No se verifica | ❌ Falta |

### Mejoras propuestas

#### Backend `/health` — endpoint enriquecido

Estado actual:
```json
{"status": "ok", "environment": "production"}
```

Estado deseado:
```json
{
  "status": "ok",
  "version": "0.5.0",
  "environment": "production",
  "uptime_seconds": 3600,
  "database": {"reachable": true, "migration": "b2c3d4e5f6a7"},
  "dependencies": {"n8n": {"reachable": true, "configured": true}},
  "checks": {
    "database": {"status": "ok", "latency_ms": 3},
    "migration": {"status": "ok", "head": "b2c3d4e5f6a7"}
  }
}
```

Esto permite que Caddy (vía `healthcheck`) y Uptime Kuma validen el estado real del backend, no solo "responde HTTP".

#### Caddy healthcheck

Agregar un healthcheck a Caddy en el proxy.yml (F5C):
```yaml
healthcheck:
  test: ["CMD", "curl", "--fail", "http://localhost:80/"]
  interval: 30s
  timeout: 5s
  start_period: 10s
  retries: 3
```

#### PostgreSQL healthcheck (desde el backend)

El endpoint `/health` ejecutará `SELECT 1` contra PostgreSQL y reportará latencia. Esto verifica que la DB y el pooler de Supabase están operativos.

---

## 4. Alerting

### Propuesta de alertas

| Alerta | Disparador | Medio | Prioridad |
|--------|-----------|-------|-----------|
| **Backend caído** | 3 healthchecks fallidos consecutivos | Uptime Kuma → Telegram | Crítica |
| **Frontend caído** | 3 healthchecks fallidos consecutivos | Uptime Kuma → Telegram | Crítica |
| **DB no reachable** | `/health` retorna `database.status = error` | Backend log error + Uptime Kuma | Crítica |
| **Disco >70%** | Script cron detecta umbral | Script → Uptime Kuma push → Telegram | Alta |
| **RAM >85%** | Script cron detecta umbral | Script → Uptime Kuma push → Telegram | Alta |
| **Backup fallido** | Código de salida != 0 en backup script | Script → Telegram | Alta |
| **Contenedor caído** | `docker ps` vs lista esperada | Script cron → Telegram | Alta |
| **TLS cert <30 días** | Caddy logs o script externo | Script cron → Telegram | Media |
| **CI/CD fallando** | GitHub Actions status check | GitHub → Email (ya existe) | Alta |
| **n8n no responde** | 3 healthchecks fallidos | Uptime Kuma → Telegram | Media |

### Stack de alertas

- **Uptime Kuma** → monitoreo externo + notificaciones Telegram
- **Cron scripts** → métricas del servidor + push a Uptime Kuma
- **GitHub** → CI/CD failures (ya existe)
- **Docker healthchecks** → restart automático (ya existe en F5C)

### Razones para no agregar más

- **No PagerDuty, no OpsGenie** — overkill para 1 servidor.
- **No Grafana OnCall** — requiere Grafana.
- **No Sentry** — los errores se ven en logs y healthchecks.

---

## 5. Backups

### Estrategia: completamente local

Todos los backups se almacenan en el mismo VPS, en `/var/backups/flowdesk/`. No se usa almacenamiento externo ni servicios de pago.

### ¿Qué respaldar?

| Elemento | Tamaño | Frecuencia | Método |
|----------|--------|------------|--------|
| **PostgreSQL** | <100MB | Diaria (02:00) | `pg_dump -Fc` → comprimido |
| **Volúmenes Docker (n8n_data)** | <50MB | Diaria (02:30) | `tar` desde contenedor Alpine |
| **n8n workflows** | <1MB | Diaria (03:00) | Export vía API REST |
| **.env + config** | <1KB | Diaria (03:15) | `cp` desde directorio del proyecto |
| **Caddyfile** | <1KB | Diaria (03:15) | `cp` desde infra/ |

### ¿Qué NO necesita backup?

| Elemento | Motivo |
|----------|--------|
| Código fuente | Está en GitHub |
| Imágenes Docker | Están en GHCR (GitHub Container Registry) |
| Certificados TLS | Caddy las regenera automáticamente con Let's Encrypt |
| Logs de Docker | Se rotan solos (F5C: 10MB x 3 archivos) |
| Dependencias pip/npm | Se instalan en build time |

### Scripts

Un solo script `infra/scripts/backup.sh` orquesta todo:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/flowdesk/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# 1. PostgreSQL — pg_dump formato custom (comprimido + parallel restore)
pg_dump --no-owner --no-acl -Fc "$DATABASE_URL" -f "$BACKUP_DIR/postgres.sql.gz"

# 2. Volumen n8n_data
docker run --rm -v n8n_data:/data -v "$BACKUP_DIR":/backups alpine \
    tar czf /backups/n8n_data.tar.gz -C /data .

# 3. n8n workflows export
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/rest/workflows" \
    | gzip > "$BACKUP_DIR/n8n_workflows.json.gz"

# 4. Config files
cp "$PROJECT_DIR/backend/.env" "$BACKUP_DIR/"
cp "$PROJECT_DIR/infra/Caddyfile" "$BACKUP_DIR/"
cp "$PROJECT_DIR/infra/docker-compose.yml" "$BACKUP_DIR/"
cp "$PROJECT_DIR/infra/docker-compose.prod.yml" "$BACKUP_DIR/"
cp "$PROJECT_DIR/infra/docker-compose.proxy.yml" "$BACKUP_DIR/"
```

### Restauración

Un solo script `infra/scripts/restore.sh` que acepta la fecha del backup:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/flowdesk/$1"

# 1. PostgreSQL
pg_restore -d "$DATABASE_URL" --clean --if-exists "$BACKUP_DIR/postgres.sql.gz"

# 2. Volumen n8n_data
docker run --rm -v n8n_data:/data -v "$BACKUP_DIR":/backups alpine \
    tar xzf /backups/n8n_data.tar.gz -C /data

# 3. n8n workflows (vía API, requiere import manual opcional)
# 4. .env + config se restauran manualmente
```

Uso: `./infra/scripts/restore.sh 20260730`

### Retención

Política simple: **mantener los últimos 7 backups diarios**, eliminar el resto automáticamente.

```bash
# Al final de backup.sh: eliminar backups con más de 7 días
find /var/backups/flowdesk/ -maxdepth 1 -type d -mtime +7 -exec rm -rf {} +
```

Esto garantiza:
- Siempre puedes recuperar los últimos 7 días.
- El espacio en disco es predecible (~1GB si cada backup es ~150MB).
- No requiere mantenimiento manual.

### Almacenamiento en disco estimado

| Elemento | Por backup | 7 backups |
|----------|-----------|-----------|
| PostgreSQL dump | ~80MB | ~560MB |
| n8n_data volumen | ~40MB | ~280MB |
| n8n workflows | ~0.5MB | ~3.5MB |
| Config + .env | ~0.01MB | ~0.07MB |
| **Total** | **~120MB** | **~840MB** |

En un VPS típico de 20-40GB, 840MB para backups es aceptable (<5% del disco).

---

## 6. Disaster Recovery

### Escenario: VPS muere completamente

**Tiempo estimado de recuperación:** 1-2 horas

**Dependencias externas:**
- Supabase Cloud (PostgreSQL) — externo, no requiere restore si los datos están allí
- GitHub — código disponible inmediatamente
- GHCR — imágenes Docker disponibles inmediatamente

**Dependencia del backup local:**
- Los backups están en el disco del VPS que murió → **no accesibles**
- La recuperación depende de que los datos de PostgreSQL estén en Supabase Cloud (externo) y el código esté en GitHub

### Runbook

#### Fase 1: Nuevo VPS (15 min)

```bash
# 1. Provisionar nuevo VPS
# 2. Instalar Docker + Docker Compose
# 3. Clonar repositorio
git clone https://github.com/samuelbaenamejia/flowdesk-ai.git
cd flowdesk-ai
```

#### Fase 2: Restaurar configuración (10 min)

```bash
# 4. Reconstruir .env desde GitHub Secrets
cp infra/.env.example backend/.env
# Editar con valores reales
```

Los secrets están en GitHub → Settings → Secrets and variables → Actions:
- `DATABASE_URL`, `SECRET_KEY`, `GROQ_API_KEY`, `WHATSAPP_*`, etc.

El `.env` original se perdió con el VPS. Se reconstruye desde GitHub Secrets.

#### Fase 3: Restaurar datos (15 min)

```bash
# 5. Crear volúmenes Docker
docker volume create n8n_data

# NOTA: Los backups locales se perdieron con el VPS.
# n8n_data se inicia vacío. Los workflows se reimportan desde GitHub.
# PostgreSQL está en Supabase Cloud — no requiere restore.
```

#### Fase 4: Deploy (10 min)

```bash
# 6. Login a GHCR
echo "$GHCR_TOKEN" | docker login ghcr.io -u samuelbaenamejia --password-stdin

# 7. Deploy
bash infra/deploy.sh
```

#### Fase 5: Verificación (10 min)

```bash
curl https://app.flowdesk.ai/health
curl https://app.flowdesk.ai/api/v1/conversations
```

### Lo que se pierde si el VPS muere

| Elemento | ¿Se pierde? | ¿Se puede recuperar? |
|----------|------------|---------------------|
| PostgreSQL (Supabase Cloud) | ❌ No | Externo, sigue funcionando |
| Código fuente | ❌ No | GitHub |
| Imágenes Docker | ❌ No | GHCR |
| Certificados TLS | ❌ No | Caddy regenera automáticamente |
| **n8n_data volumen** | **⚠️ Sí** | Backup local inaccesible. Workflows reimportables desde GitHub |
| **Logs de Docker** | **⚠️ Sí** | No críticos — son históricos |
| **Backups locales** | **⚠️ Sí** | Estaban en el disco que murió |

### ¿Por qué es aceptable?

1. **PostgreSQL** está en Supabase Cloud — los datos principales (conversaciones, mensajes, usuarios, contactos) sobreviven al VPS.
2. **n8n workflows** están exportados en `infra/n8n/workflows/` que está en GitHub. Se reimportan manualmente.
3. **Código + CI/CD** están en GitHub + GHCR. Se redeploya en minutos.
4. **Lo único irremplazable** es el volumen `n8n_data` (n8n database SQLite) que almacena execution history. Las ejecuciones en curso se pierden, pero los workflows se reimportan.

---

## 7. Security Monitoring

### Sin agregar herramientas

No se agrega IDS/IPS (Snort, Suricata, Wazuh). Para un VPS con 4 contenedores y tráfico bajo, el overhead no se justifica.

### Prácticas que ya existen

- `cap_drop: ALL` + `no-new-privileges` en todos los contenedores (F5C) ✅
- Non-root users en backend y frontend (F5C) ✅
- Rate limiting disponible en Caddy (F5B) ✅
- JWT expira a las 24 horas ✅
- Caddy TLS automático con Let's Encrypt ✅

### Qué agregar

| Práctica | Implementación | Efecto |
|----------|---------------|--------|
| **Fijar CORS en producción** | `CORS_ORIGINS` en .env → dominio específico | Previene acceso desde orígenes no autorizados |
| **Monitorizar 5xx en logs** | Script grep sobre logs de Docker en busca de `"level": "ERROR"` o HTTP 5xx | Detección temprana de errores |
| **Alertas de login fallidos** | Backend loguea intentos fallidos con IP | Script detecta >5 fallos/min → alerta |
| **Fail2ban en VPS** | `fail2ban` en el host (no Docker) | Previene brute force SSH |

### Backend — loguear intentos de auth

El endpoint `/api/v1/auth/login` ya debe loguear intentos fallidos. Verificar que lo haga y que incluya IP.

Si no existe, agregar:
```python
logger.warning("auth.login.failed", extra={"ip": request.client.host, "email": email})
```

Un script cron puede grepear logs por `auth.login.failed` en el último minuto y alertar si supera un umbral.

### CORS producción

Cambiar `CORS_ORIGINS=*` en producción al dominio real. Esto previene que un script malicioso desde cualquier origen haga requests al backend si el usuario está autenticado.

---

## 8. Coste

| Componente | Complejidad | RAM | CPU | Costo $ | Necesidad |
|-----------|-------------|-----|-----|---------|-----------|
| **Backend `/health` enriquecido** | Baja (1 endpoint) | 0 | 0 | $0 | ✅ Alta |
| **Logging JSON (backend)** | Baja (cambiar formato) | 0 | 0 | $0 | ✅ Alta |
| **Uptime Kuma** | Baja (1 container) | ~50MB | Mínimo | $0 (OSS) | ✅ Alta |
| **Backup script (pg_dump)** | Media (1 script) | ~10MB durante dump | Mínimo | $0 | ✅ Alta |
| **Backup script (volúmenes)** | Media (1 script) | ~10MB durante backup | Mínimo | $0 | ✅ Alta |
| **Backup retention (find)** | Baja (1 línea) | 0 | 0 | $0 | ✅ Alta |
| **Cron scripts + push monitoring** | Baja | 0 | 0 | $0 | ✅ Media |
| **Fail2ban en host** | Baja | ~20MB | Mínimo | $0 | ✅ Media |
| **Restore script** | Media (1 script) | 0 | 0 | $0 | ✅ Alta |
| Prometheus + Grafana | Alta | ~500MB+ | Moderado | $0 | ❌ No justificado |
| Loki + Promtail | Media | ~250MB+ | Moderado | $0 | ❌ No justificado |
| ELK Stack | Alta | ~2GB+ | Alto | $0 | ❌ No justificado |
| Sentry | Baja | 0 | 0 | Gratis | ❌ Diferible |
| Backblaze B2 / S3 | Media | 0 | 0 | **ELIMINADO** | ❌ No usado |

**Costo mensual total: $0**

**RAM adicional total:** ~70MB (Uptime Kuma 50MB + Fail2ban 20MB, scripts solo durante ejecución)

---

## 9. Cambios esperados

### Archivos nuevos

| Archivo | Propósito |
|---------|-----------|
| `infra/scripts/backup.sh` | Backup PostgreSQL + volúmenes + config → `/var/backups/` |
| `infra/scripts/restore.sh` | Restore desde backup local |
| `infra/scripts/healthcheck.sh` | Monitoreo del sistema (disco, RAM, contenedores) |
| `infra/cron/backup.cron` | Configuración cron para backups diarios |
| `infra/monitoring/docker-compose.mon.yml` | Uptime Kuma service |

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `backend/app/core/logging.py` | Cambiar a formato JSON estructurado |
| `backend/app/main.py` | Endpoint `/health` enriquecido con DB check, versión, uptime |
| `backend/app/core/config.py` | Agregar `CORS_ORIGINS` producción |
| `infra/docker-compose.proxy.yml` | Agregar healthcheck para Caddy (post-F5C) |
| `.env.example` | Agregar variables para backup config |
| `docs/DEPLOY.md` | Agregar sección de backups + DR |
| `docs/PROJECT_DECISIONS.md` | Nuevo ADR para decisiones de observabilidad |

### Sin cambios

- Frontend (no requiere logging estructurado)
- n8n (ya loguea JSON)
- Caddy (ya loguea JSON)
- CI/CD pipeline (no requiere cambios)
- `infra/deploy.sh` (no requiere cambios)

---

## 10. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Backup consume disco | Baja | Medio | Rotación automática (7 días) + alerta de disco >70% |
| pg_dump falla por conexión | Media | Medio | Alertar en fallo, retry automático en próxima ejecución |
| Disco lleno por backups + logs | Baja | Alto | Alerta >70%. Separar `/var/backups/` en partición propia si es necesario |
| Restore falla por versión DB | Baja | Alto | Usar `pg_dump -Fc` (compatible entre versiones) |
| Uptime Kuma consume recursos | Baja | Bajo | ~50MB RAM, límite en compose |
| JSON logging rompe parseo existente | Baja | Bajo | Docker json-file encapsula en JSON, backward compatible |
| Fail2ban bloquea IP legítima | Baja | Bajo | Whitelist IPs conocidas (GitHub Actions) |
| **VPS muere → backups perdidos** | Baja | **Alto** | **Trade-off aceptado** (ver sección 6) |

### Riesgo principal: backup local sin copia externa

**Riesgo:** Si el VPS muere, los backups locales mueren con él. No hay copia offsite.

**Realidad:**
- PostgreSQL (el dato más importante) está en Supabase Cloud — externo, no require backup.
- Código + imágenes están en GitHub + GHCR — externos, no requieren backup.
- Sólamente el volumen `n8n_data` (execution history) se pierde. Los workflows están en GitHub.
- En un proyecto en desarrollo sin usuarios de producción, este riesgo es **aceptable**.

**Trade-off objetivo:**
- Sin backup externo: ahorras $0.50/mes y 0 complejidad operativa
- Riesgo: pierdes ~50MB de n8n execution history si el VPS muere
- El dato crítico (DB) está protegido por Supabase Cloud

**Si en el futuro hay usuarios de producción reales**, agregar backup externo (Backblaze B2, rsync.net, o un segundo VPS barato).

---

## Roadmap del Sprint

### Orden de implementación

```
Fase 1 — Foundation (no cambia comportamiento)
  1.1  Backend logging JSON
  1.2  Backend /health endpoint enriquecido
  1.3  Caddy healthcheck (post-F5C)

Fase 2 — Monitoring
  2.1  Uptime Kuma (docker-compose)
  2.2  Scripts de healthcheck del sistema
  2.3  Alertas en Telegram

Fase 3 — Backups
  3.1  Script de backup (PostgreSQL + volúmenes + config)
  3.2  Script de restore
  3.3  Cron job + rotación automática

Fase 4 — Security
  4.1  CORS producción
  4.2  Login failure logging
  4.3  Fail2ban configuración

Fase 5 — Documentación
  5.1  DEPLOY.md (backups + DR section)
  5.2  ADR en PROJECT_DECISIONS.md
```

### Acceptance Criteria

- [ ] Backend loguea en JSON estructurado con request_id, level, timestamp, message
- [ ] `/health` retorna DB status, versión, uptime, migración actual
- [ ] Uptime Kuma monitorea backend, frontend, n8n, Caddy
- [ ] Backup PostgreSQL diario funcionando en `/var/backups/flowdesk/`
- [ ] Backup volúmenes Docker diario funcionando
- [ ] Backup de config (.env, Caddyfile, compose) diario funcionando
- [ ] Rotación automática: solo últimos 7 backups
- [ ] Restore script probado (dry-run sobre DB separada)
- [ ] Alerta de disco >70% funcionando
- [ ] Alerta de backup fallido funcionando
- [ ] Login failures logueados con IP
- [ ] CORS configurado para producción
- [ ] Fail2ban instalado y configurado en VPS (documentado)
- [ ] Documentación de backups + DR en DEPLOY.md
- [ ] ADR en PROJECT_DECISIONS.md
- [ ] Tests pasan: ruff, pytest 65/65, next lint, npm test 153/153

### Plan de validación

1. **Por fase:** Testear individualmente antes de avanzar
2. **Backup:** Ejecutar `backup.sh` → verificar archivos en `/var/backups/` → probar `restore.sh 20260730` en DB separada
3. **Rotación:** Crear 8 backups falsos → ejecutar script → confirmar que solo quedan 7
4. **Monitoreo:** Apagar un servicio → Uptime Kuma lo detecta → notificación Telegram
5. **Logging:** Correr app en dev → verificar stdout en JSON → grep con `jq`
6. **Fail2ban:** Verificar que `fail2ban-client status` muestra la jail activa

### Delta Report esperado

| Archivo | Cambio |
|---------|--------|
| `backend/app/core/logging.py` | Formato JSON |
| `backend/app/main.py` | `/health` enriquecido |
| `backend/app/core/config.py` | CORS_ORIGINS |
| `infra/scripts/backup.sh` | NUEVO |
| `infra/scripts/restore.sh` | NUEVO |
| `infra/scripts/healthcheck.sh` | NUEVO |
| `infra/monitoring/docker-compose.mon.yml` | NUEVO |
| `infra/cron/backup.cron` | NUEVO |
| `infra/docker-compose.proxy.yml` | Caddy healthcheck |
| `.env.example` | Variables backup |
| `docs/DEPLOY.md` | Sección backups + DR |
| `docs/PROJECT_DECISIONS.md` | ADR observabilidad |

---

## Veredicto del Diseño

✅ **APROBADO PARA IMPLEMENTACIÓN**

Razones:
1. **$0 de costo mensual** — sin dependencias de pago, sin SaaS, sin buckets.
2. **~70MB RAM total** — Uptime Kuma + Fail2ban. El resto son scripts bash.
3. **Backups locales con rotación automática** — 7 días de retención, ~840MB en disco.
4. **Riesgo aceptable** — DB en Supabase Cloud, código en GitHub. Solo n8n execution history es local.
5. **Sin over-engineering** — Uptime Kuma para monitoreo, scripts bash para backups, cron para programación.
6. **Misma filosofía F5A-F5C** — producción real sin herramientas innecesarias ni costos recurrentes.
