# Primer despliegue de Refugio Espartanos en cPanel

Escrito el `10 de agosto de 2026`.

## 1. Estructura elegida

- `cuartel.espartanos.cl`: frontend publico e interno de la aplicacion
- `refugio.espartanos.cl`: backend/API con Passenger
- `espartanos.cl`: se mantiene fuera de esta primera salida

## 2. Lo que ya resolvimos en este repo limpio

- `frontend` y `backend` viven en un solo monorepo
- `.cpanel.yml` publica el frontend en `public_html/cuartel.espartanos.cl`
- `app.js` queda como entrada de Passenger para el backend
- GitHub Actions publica una rama `deploy` con artefactos compilados

## 3. Lo que falta en el servidor

1. Crear o confirmar base de datos MySQL
2. Configurar `Setup Node.js App` para `refugio.espartanos.cl`
3. Clonar este repo limpio con `Git Version Control`
4. Apuntar cPanel a la rama `deploy`
5. Cargar `.env` productivo
6. Ejecutar migraciones
7. Crear la primera cuenta de administracion

## 4. Variables minimas

```dotenv
NODE_ENV=production
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=...
DB_PASSWORD=...
DB_DATABASE=...

JWT_SECRET=...
INTEGRATION_ENCRYPTION_KEY=...
OAUTH_STATE_SECRET=...
CRON_SECRET=...

APP_PUBLIC_URL=https://cuartel.espartanos.cl
API_PUBLIC_URL=https://refugio.espartanos.cl/api
VITE_API_URL=https://refugio.espartanos.cl/api
VITE_APP_PUBLIC_URL=https://cuartel.espartanos.cl
CORS_ORIGIN=https://cuartel.espartanos.cl
UPLOAD_DIR=/home/espartanoscl/espartanos_uploads

ALLOW_PUBLIC_REGISTRATION=false
ENABLE_SWAGGER=false
```

## 5. Configuracion en cPanel

### Node app

- Application root: carpeta privada del repo
- Application URL: `refugio.espartanos.cl`
- Startup file: `app.js`
- Node version: `22` LTS (el repositorio esta probado con `22.22.3`)

### Git Version Control

- Branch: `deploy`
- Luego usar `Update from Remote`
- Luego usar `Deploy HEAD Commit`

## 6. Primer objetivo funcional

La primera validacion sera el modulo de reservas. Para considerarlo listo:

1. `https://refugio.espartanos.cl/api/health` responde
2. `https://cuartel.espartanos.cl` carga
3. se puede crear un formulario de reserva
4. se puede abrir `/book/{slug}`
5. una reserva entra a base de datos

## 7. Lo que puede esperar

Estas piezas no bloquean la primera prueba de reservas:

- Meta OAuth
- Google OAuth
- cron de produccion
- correo transaccional
- sitio publico en `espartanos.cl`
