# Historial de preparacion y despliegue

Proyecto: **Refugio Espartanos / Spartanoshub**  
Fecha de inicio: **10 de agosto de 2026**  
Repositorio: `https://github.com/lavitaminadev/spartanoshub`

Este documento registra decisiones, cambios y verificaciones. No contiene contrasenas,
tokens, claves privadas ni valores secretos.

## Arquitectura obligatoria

| Componente | Dominio | Ruta en cPanel |
| --- | --- | --- |
| Frontend | `https://cuartel.espartanos.cl` | `/home/espartanoscl/public_html/cuartel.espartanos.cl` |
| Backend/API | `https://refugio.espartanos.cl` | Aplicacion Node fuera de `public_html` |
| Dominio principal | `https://espartanos.cl` | Fuera del alcance; no se publica la aplicacion aqui |

El repositorio es un monorepo: frontend y backend se versionan juntos, pero se publican en
destinos distintos. El backend debe permanecer en
`/home/espartanoscl/repositories/spartanoshub`; solamente los archivos estaticos compilados
del frontend llegan a `public_html/cuartel.espartanos.cl`.

## Estado inicial encontrado

- El repositorio limpio se preparo en `C:\Users\leno\Desktop\final\spartanoshub-audit`.
- GitHub contiene `main` para desarrollo y `deploy` para los artefactos compilados.
- El repositorio se confirmo como publico para que cPanel pueda descargarlo sin guardar una
  clave privada de GitHub.
- cPanel no tenia repositorios registrados en Git Version Control.
- Las carpetas de ambos subdominios solo contenian archivos iniciales de cPanel y respondian
  `403`; `/api/health` respondia `404`.
- La cuenta tiene Setup Node.js App de CloudLinux habilitado y shell SSH deshabilitado. SFTP
  y las operaciones administradas por cPanel si estan disponibles.
- Ya existian una base de datos y un usuario MySQL, sin datos de la aplicacion.

## Auditoria y correcciones previas

- Se migro el codigo necesario a un repositorio limpio sin borrar el repositorio anterior.
- Se mantuvo el modulo de reservas y se revisaron sus rutas publicas y administrativas.
- Se fijaron los unicos origenes productivos permitidos: Cuartel para el frontend y Refugio
  para la API.
- Se impidio que el backend pueda desplegarse dentro de `public_html`.
- Se preparo una rama `deploy` generada por GitHub Actions para no compilar en los 768 MB del
  servidor.
- Se revisaron y fijaron scripts de instalacion npm; la auditoria de dependencias quedo sin
  vulnerabilidades conocidas.
- Resultado de la validacion anterior: 472 pruebas de API, 30 pruebas de frontend, lint y
  compilacion para cPanel correctos.

## Cambios de esta salida 1.0.0

### Version visible

Antes, el frontend declaraba `0.0.0` y el health check dependia de una variable que Passenger
no entrega:

```text
apps/web/package.json: 0.0.0
health: process.env.npm_package_version || '1.0.0'
```

Ahora frontend, backend y monorepo comparten `1.0.0`, y el health check lee directamente la
version empaquetada de la API:

```text
apps/web/package.json: 1.0.0
health: version leida desde apps/api/package.json
```

### Node y migraciones

Antes, `.cpanel.yml` ejecutaba `npm` sin activar el entorno de CloudLinux y no aplicaba las
migraciones. Ahora valida el entorno Node 22 creado por cPanel, lo agrega al `PATH`, instala
solo dependencias productivas, valida `.env` y aplica las migraciones pendientes antes de
publicar el frontend o reiniciar Passenger.

Las lineas reemplazadas no se conservan como codigo muerto. El equivalente anterior y el
objetivo de cada cambio quedan documentados aqui y junto a la configuracion activa.

### Correccion del artefacto Apache

La primera ejecucion remota de la rama `deploy` paso pruebas y compilacion, pero se detuvo al
verificar `apps/web/dist/.htaccess`. Vite copiaba ese archivo oculto en Windows, pero no en el
runner Linux de GitHub Actions. El build ahora realiza una copia explicita y multiplataforma
desde `apps/web/public/.htaccess` y comprueba que el destino exista. Esta proteccion conserva
el enrutamiento de React y evita publicar Cuartel sin sus cabeceras de seguridad.

La segunda ejecucion remota confirmo `.htaccess`, pero detecto que un build limpio ubicaba la
entrada de API en `dist/src/main.js`. La causa era la importacion TypeScript de un JSON fuera
de `src`; un artefacto antiguo en Windows habia ocultado el cambio de ruta. La version ahora
se lee en tiempo de ejecucion, `rootDir` queda fijado en `src` y el build limpia `dist` antes
de compilar. Asi `apps/api/dist/main.js` se genera igual en una maquina nueva y en desarrollo.

La auditoria posterior de `deploy` encontro 38.339 archivos, de los cuales 35.741 pertenecian
a `node_modules`. La causa era `git add -Af`, que forzaba todos los archivos ignorados. Ademas,
recrear una rama huerfana en cada salida impedia que cPanel avanzara por fast-forward. El flujo
ahora fuerza solo los tres directorios `dist`, rechaza cualquier `node_modules` y crea cada
estado como hijo del despliegue anterior. La rama se reinicializa una sola vez despues de esta
correccion y el repositorio de cPanel se vuelve a clonar porque aun no contiene datos propios.

### Correccion de la migracion de contactos

El primer despliegue administrado instalo dependencias y valido el entorno, pero MySQL detuvo
`ContactsRequireLead1726200000000`: no permite cambiar `lead_id` mientras una clave foranea
`SET NULL` usa esa columna. La migracion ahora elimina temporalmente solo esa relacion,
convierte la columna a obligatoria y la recrea como `RESTRICT`. Si algo falla, restaura la
nulabilidad y la relacion anterior para no dejar la tabla a medias.

## Acceso y seguridad

- El acceso de automatizacion usa una clave dedicada para cPanel; ninguna clave privada se
  versiona ni se copia al proyecto.
- El repositorio publico elimina la necesidad de instalar una clave privada de GitHub en el
  servidor.
- Las variables productivas se guardaran solo en `.env` dentro de la carpeta privada de la
  aplicacion, con permisos restringidos.
- Al finalizar se deben revocar los tokens y reemplazar las claves que se compartieron en el
  chat, aunque fueran temporales.

## Bitacora de ejecucion

| Paso | Estado | Evidencia |
| --- | --- | --- |
| Repositorio limpio y publico | Completado | `lavitaminadev/spartanoshub` |
| Auditoria funcional y de seguridad | Completado | Pruebas, lint, build y audit correctos |
| Version 1.0.0 y health coherente | Completado | 476 pruebas API y 30 pruebas web correctas |
| Publicacion de cambios en `main` | Completado | PR `#3`, CI correcta |
| Actualizacion automatica de `deploy` | En correccion | Se eliminan dependencias y force-push recurrente |
| Git Version Control en cPanel | Completado | Repo privado del servidor sobre rama `deploy` |
| Aplicacion Node 22 para Refugio | Completado | Node 22.23.0, Production, inicio `app.js` |
| Variables y base de datos | Completado | `.env` modo `600`, credencial MySQL renovada |
| Migraciones | En correccion | cPanel detecto una clave foranea incompatible con `NOT NULL` |
| Frontend Cuartel | Pendiente | Prueba HTTPS y carga de recursos |
| Backend Refugio | Pendiente | Prueba `GET /api/health` |
| Flujo de reservas | Pendiente | Formulario, enlace publico y registro en DB |

## Criterio de cierre

El despliegue queda cerrado cuando Cuartel carga por HTTPS, Refugio responde su health en
version `1.0.0`, las migraciones terminan sin errores y el primer flujo de reservas puede
guardar y recuperar una reserva. Integraciones externas, SMTP y procesos programados pueden
permanecer desactivados durante esta primera prueba.
