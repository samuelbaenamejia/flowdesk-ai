# n8n — FlowDesk-AI

n8n orquesta los flujos de atención al cliente: recibe notificaciones de FastAPI, genera respuestas con IA y envía mensajes vía WhatsApp.

## Levantar n8n

```bash
docker compose -f infra/docker-compose.yml up n8n -d
```

También se levanta automáticamente con todos los servicios:

```bash
docker compose -f infra/docker-compose.yml up -d
```

## Acceder

http://localhost:5678

La primera vez crea una cuenta de administrador local (solo para desarrollo).

## Variables de entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `N8N_PORT` | Puerto del host | `5678` |
| `N8N_WEBHOOK_URL` | URL pública para webhooks | `http://localhost:5678` |
| `N8N_ENCRYPTION_KEY` | Clave de cifrado de credenciales | Requerida |
| `N8N_ENABLED` | Habilita notificación a n8n desde FastAPI | `false` |
| `N8N_MODE` | `disabled` / `mirror` / `primary` | `disabled` |
| `INTERNAL_API_KEY` | Clave para comunicación n8n ↔ FastAPI | Requerida |

## Persistencia de datos

- **SQLite** (por defecto): los datos se guardan en el volumen `n8n_data` (Docker).
- Los datos persisten entre reinicios del contenedor.

### Migración futura a PostgreSQL

El servicio está preparado para migrar de SQLite a PostgreSQL. Solo se necesita:

1. Configurar las variables `DB_POSTGRESDB_*` en el archivo `.env`.
2. Establecer `N8N_DB_TYPE=postgresdb`.
3. Reiniciar el contenedor.

Variables disponibles:

| Variable | Descripción |
|----------|-------------|
| `N8N_DB_TYPE` | `sqlite` o `postgresdb` |
| `N8N_DB_HOST` | Host de PostgreSQL |
| `N8N_DB_PORT` | Puerto (default: 5432) |
| `N8N_DB_DATABASE` | Nombre de la base de datos |
| `N8N_DB_USER` | Usuario |
| `N8N_DB_PASSWORD` | Contraseña |

Actualmente n8n usa SQLite. PostgreSQL no está activado.

## Importar workflows

1. Coloca los archivos `.json` de workflow en `infra/n8n/workflows/` (en el host).
2. En la UI de n8n, haz clic en **Import from File**.
3. Selecciona el archivo desde el sistema de archivos del host (la ruta es `infra/n8n/workflows/` relativa al repositorio).

Los workflows importados se pueden exportar desde la UI y guardar en `infra/n8n/workflows/` para versionarlos en git.

## Red Docker

Todos los servicios (backend, frontend, n8n) comparten la misma red Docker.
n8n se comunica con FastAPI usando el nombre del servicio: `http://backend:8000`.
