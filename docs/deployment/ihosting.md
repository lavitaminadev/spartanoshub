# Deploy en iHosting para Refugio Espartanos

Fecha de referencia: `2026-08-10`

## Arquitectura objetivo

- Repo privado clonado por `Git Version Control` de cPanel
- Rama desplegada por cPanel: `deploy`
- Backend NestJS por Passenger en `https://refugio.espartanos.cl`
- Frontend React/Vite estatico en `https://cuartel.espartanos.cl`
- Base de datos MySQL/MariaDB local del hosting

## Requisitos

- Node.js `20.20.2` en cPanel
- `app.js` en la raiz del repo
- `.cpanel.yml` en la raiz del repo
- `.env` productivo en la raiz privada del repo
- SSL activo para `cuartel.espartanos.cl` y `refugio.espartanos.cl`

## Que hace `.cpanel.yml`

1. Verifica que existan `apps/api/dist/main.js` y `apps/web/dist/index.html`
2. Ejecuta `npm ci --omit=dev`
3. Valida variables con `npm run check:production-env`
4. Prepara carpetas privadas de almacenamiento
5. Copia `apps/web/dist/` a `/home/espartanoscl/public_html/cuartel.espartanos.cl`
6. Toca `tmp/restart.txt` y `app.js` para reiniciar Passenger

No compila en el servidor. La compilacion ocurre en GitHub Actions y termina publicada en la rama `deploy`.

## Configuracion de dominios

- Frontend: `https://cuartel.espartanos.cl`
- API: `https://refugio.espartanos.cl/api`

Variables esperadas:

```dotenv
APP_PUBLIC_URL=https://cuartel.espartanos.cl
API_PUBLIC_URL=https://refugio.espartanos.cl/api
VITE_API_URL=https://refugio.espartanos.cl/api
VITE_APP_PUBLIC_URL=https://cuartel.espartanos.cl
CORS_ORIGIN=https://cuartel.espartanos.cl
UPLOAD_DIR=/home/espartanoscl/vitahub_uploads
```

## Configuracion de Passenger

En `Setup Node.js App`:

- Application root: raiz del repositorio clonado
- Application URL: `refugio.espartanos.cl`
- Startup file: `app.js`
- Node version: `20.20.2`

## GitHub y cPanel

1. Subir cambios a `main`
2. Esperar que GitHub Actions publique `deploy`
3. En cPanel usar `Update from Remote`
4. En cPanel usar `Deploy HEAD Commit`

## Migraciones

Por SSH o terminal del hosting:

```bash
npm run migration:run
```

Luego inicializar la primera cuenta:

```bash
node scripts/deploy/bootstrap-production.cjs --org "Refugio Espartanos" --code REFUGIO --email tu@dominio.cl --name "Tu Nombre"
```

## Reservas como primera prueba

Para validar primero el modulo de reservas, debe quedar operativo como minimo:

- frontend cargando en `cuartel.espartanos.cl`
- backend respondiendo en `refugio.espartanos.cl/api/health`
- base de datos creada y migrada
- `APP_PUBLIC_URL` y `VITE_APP_PUBLIC_URL` apuntando a `cuartel`
- `API_PUBLIC_URL` y `VITE_API_URL` apuntando a `refugio`

## Verificacion

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://refugio.espartanos.cl/api/health
curl -s -o /dev/null -w "%{http_code}\n" https://cuartel.espartanos.cl
```
