# Deploy en iHosting para Refugio Espartanos

Fecha de referencia: `2026-08-10`

## Arquitectura objetivo

- Repo privado clonado por `Git Version Control` de cPanel
- Rama desplegada por cPanel: `deploy`
- Backend NestJS por Passenger en `https://refugio.espartanos.cl`
- Frontend React/Vite estatico en `https://cuartel.espartanos.cl`
- Base de datos MySQL/MariaDB local del hosting

## Requisitos

- Node.js `22` LTS en cPanel (el repositorio esta probado con `22.22.3`)
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
UPLOAD_DIR=/home/espartanoscl/espartanos_uploads
```

## Configuracion de Passenger

En `Setup Node.js App`:

- Application root: raiz del repositorio clonado
- Application URL: `refugio.espartanos.cl`
- Startup file: `app.js`
- Node version: `22` LTS (el repositorio esta probado con `22.22.3`)

El `Application root` debe quedar fuera de `public_html`. La ruta recomendada es
`/home/espartanoscl/repositories/spartanoshub`.

### Los dos anadidos a mano de `public_html/refugio.espartanos.cl/.htaccess`

Ese archivo lo genera CloudLinux al crear la aplicacion Node y **se regenera si alguien vuelve a
crear el subdominio**. Los bloques `DO NOT REMOVE` son suyos y no se tocan. Al final hay dos
anadidos que no vienen de CloudLinux:

> **No hay que reponerlos a mano.** `scripts/deploy/asegurar-htaccess-refugio.sh` corre en cada
> despliegue desde `.cpanel.yml`: si los dos bloques estan, no escribe nada; si falta alguno, lo
> repone tras dejar un respaldo, comprueba que la API siga respondiendo y **restaura el respaldo
> por su cuenta** si dejara de hacerlo. Lo que sigue es para entender que hace ese script y para
> poder repararlo a mano si alguna vez hiciera falta.

```apache
# Este subdominio sirve la API por Passenger, no WordPress.
# Sin esta linea hereda las reglas de reescritura de public_html/.htaccess
# y toda peticion sin archivo real termina reescrita a /index.php.
<IfModule mod_rewrite.c>
RewriteEngine Off
</IfModule>

# Passenger anuncia su version en cada respuesta. No abre ninguna puerta, pero tampoco
# hay motivo para publicar que version corre.
<IfModule mod_headers.c>
Header always unset X-Powered-By
</IfModule>
```

El primero corrige el fallo mas dificil de diagnosticar que ha tenido este servidor: WordPress
vive en `public_html/` y su `.htaccess` se hereda hacia los subdominios, asi que la API devolvia
un 500 **sin una sola linea en `passenger-error.log`**, porque el error era de Apache y no de la
aplicacion. Si vuelve a pasar, se mira el `.htaccess` padre antes que los registros de Node.

El segundo quita la cabecera `X-Powered-By: Phusion Passenger(R) 6.1.8`. Los dos van envueltos en
`<IfModule>` a proposito: si el modulo no estuviera cargado, una directiva suelta hace que Apache
rechace el archivo entero y devuelva 500.

Antes de tocarlo, respaldar y comprobar que la API sigue viva despues:

```bash
cp -p ~/public_html/refugio.espartanos.cl/.htaccess ~/public_html/refugio.espartanos.cl/.htaccess.bak-$(date +%Y%m%d-%H%M)
curl -sSI https://refugio.espartanos.cl/api/health | grep -iE "HTTP/|powered"
```

Se espera `200` y ninguna linea `powered`. Apache relee el archivo en cada peticion, asi que
restaurar el respaldo surte efecto de inmediato y no hay que reiniciar nada.

## GitHub y cPanel

1. Subir cambios a `main`
2. Esperar que GitHub Actions publique `deploy`
3. En cPanel usar `Update from Remote`
4. En cPanel usar `Deploy HEAD Commit`

## Migraciones

Por SSH o terminal del hosting:

```bash
npm run migration:run:prod
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
