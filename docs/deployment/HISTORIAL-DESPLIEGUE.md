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
health: apiPackage.version
```

### Node y migraciones

Antes, `.cpanel.yml` ejecutaba `npm` sin activar el entorno de CloudLinux y no aplicaba las
migraciones. Ahora valida el entorno Node 22 creado por cPanel, lo agrega al `PATH`, instala
solo dependencias productivas, valida `.env` y aplica las migraciones pendientes antes de
publicar el frontend o reiniciar Passenger.

Las lineas reemplazadas no se conservan como codigo muerto. El equivalente anterior y el
objetivo de cada cambio quedan documentados aqui y junto a la configuracion activa.

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
| Version 1.0.0 y health coherente | Completado | 473 pruebas API y 30 pruebas web correctas |
| Publicacion de cambios en `main` | Pendiente | Se completa despues de CI |
| Actualizacion automatica de `deploy` | Pendiente | Se completa despues de GitHub Actions |
| Git Version Control en cPanel | Pendiente | Rama objetivo: `deploy` |
| Aplicacion Node 22 para Refugio | Pendiente | Inicio: `app.js` |
| Variables y base de datos | Pendiente | Secretos fuera del repositorio |
| Migraciones | Pendiente | Ejecutadas por `.cpanel.yml` |
| Frontend Cuartel | Pendiente | Prueba HTTPS y carga de recursos |
| Backend Refugio | Pendiente | Prueba `GET /api/health` |
| Flujo de reservas | Pendiente | Formulario, enlace publico y registro en DB |

## Criterio de cierre

El despliegue queda cerrado cuando Cuartel carga por HTTPS, Refugio responde su health en
version `1.0.0`, las migraciones terminan sin errores y el primer flujo de reservas puede
guardar y recuperar una reserva. Integraciones externas, SMTP y procesos programados pueden
permanecer desactivados durante esta primera prueba.
