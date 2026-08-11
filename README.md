# Refugio Espartanos Platform

Monorepo limpio para desplegar Refugio Espartanos en cPanel.

## Estructura

- `apps/web`: frontend React/Vite publicado en `https://cuartel.espartanos.cl`
- `apps/api`: backend NestJS ejecutado con Passenger en `https://refugio.espartanos.cl/api`
- `packages/shared`: tipos y contratos compartidos
- `scripts/deploy`: bootstrap productivo y cron

`frontend` y `backend` no son dos repos distintos en esta version. Viven en el mismo repositorio y se despliegan juntos.

## Versiones objetivo

- Node.js: `22.22.3` LTS
- Backend: NestJS `11`
- Frontend: React `19` + Vite `8`
- Base de datos: MySQL `8+` o MariaDB `10.6+`

## Flujo de despliegue

1. Trabajar sobre `main`.
2. GitHub Actions compila y publica la rama `deploy`.
3. cPanel `Git Version Control` apunta a `deploy`.
4. Setup Node.js App sirve `apps/api/dist/main.js` usando `app.js`.
5. `.cpanel.yml` copia `apps/web/dist` a `/home/espartanoscl/public_html/cuartel.espartanos.cl`.

## Variables productivas clave

```dotenv
APP_PUBLIC_URL=https://cuartel.espartanos.cl
API_PUBLIC_URL=https://refugio.espartanos.cl/api
VITE_API_URL=https://refugio.espartanos.cl/api
VITE_APP_PUBLIC_URL=https://cuartel.espartanos.cl
CORS_ORIGIN=https://cuartel.espartanos.cl
UPLOAD_DIR=/home/espartanoscl/vitahub_uploads
```

## Documentacion util

- [Despliegue iHosting](docs/deployment/ihosting.md)
- [Primer despliegue](docs/deployment/PLAN-PRIMER-DESPLIEGUE.md)
- [Checklist](docs/deployment/DEPLOY-CHECKLIST-IHOSTING.md)
