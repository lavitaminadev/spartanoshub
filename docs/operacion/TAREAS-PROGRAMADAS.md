# Tareas programadas (cron)

Hay trabajos que el sistema no hace solo: alguien tiene que llamarlos cada cierto tiempo. Los
dispara el **cron de cPanel**.

**Mientras una tarea no esté creada, lo que hace no ocurre nunca.** No aparece ningún error: los
recordatorios simplemente no salen y las conversiones se quedan en la cola.

## La alternativa interna, y por qué no basta

La aplicación trae un planificador propio que corre casi las mismas tareas por intervalos. Está
**apagado de fábrica** y se enciende con `ENABLE_INTERNAL_SCHEDULER=true`.

No reemplaza al cron de cPanel por tres razones: mide intervalos desde que arrancó el proceso, así
que nada puede ocurrir «a las 8 de la mañana»; en Passenger el proceso se duerme sin visitas y se
reinicia en cada despliegue, con lo que la cuenta vuelve a empezar; y si algún día hay más de un
proceso, cada uno ejecutaría lo mismo por su cuenta.

Sirve como red de seguridad —que algo salga una vez al día aunque el cron falle—, no como el
mecanismo principal. `data-retention`, `resumen-diario` y `cumpleanos`, que dependen de la hora,
necesitan el cron sí o sí.

## Cómo se instalan

`scripts/deploy/setup-crontab.sh` instala todas las tareas del controlador (25 de sus 26 rutas; `google-ads/diagnostics` es sólo de consulta), y `.cpanel.yml` lo llama en cada
despliegue. Reinstalar reemplaza únicamente las líneas de las tareas que el script gestiona (las
que apuntan exactamente a `/api/cron/<nombre>`); una línea manual hacia otra ruta se conserva. Si
se agrega una ruta al controlador, hay que sumarla al heredoc del script **y** a su lista
`TAREAS_GESTIONADAS`, o no correrá en producción.

## Cómo se llaman

Todas aceptan `POST`, y las que escriben deberían llamarse así. Varias aceptan además `GET`, para
los programadores que sólo saben hacer eso (columna «Verbos»). Siempre con la clave en una cabecera:

```bash
curl -s -X POST -H "x-cron-secret: $CRON_SECRET" https://refugio.espartanos.cl/api/cron/<tarea>
```

`CRON_SECRET` se define en cPanel → Setup Node.js App → Environment variables. Sin ella, todas
responden 403. Para rotarla sin corte existe `CRON_SECRET_PREVIOUS`: se mueve la vigente ahí, se
pone la nueva en `CRON_SECRET`, se actualizan los cron y después se borra la anterior.

## Las rutas

La frecuencia es la del planificador interno (`job-scheduler.service.ts`) cuando la tarea está
allí; las que no tiene, ver la nota. Los minutos están repartidos para no arrancar todas juntas.

| Tarea | Verbos | Frecuencia instalada | Qué hace |
|---|---|---|---|
| `meta-capi` | POST (`limit`), GET | cada 5 min | Vacía la cola de conversiones hacia Meta. |
| `meta-capi/diagnostics` | GET | cada hora, minuto 0 | Estado de la cola de Meta, sin efectos. |
| `meta-capi/cleanup` | POST (`olderThanDays`) | domingo 03:45 | Descarta eventos enviados y antiguos. |
| `google-ads` | POST (`limit`), GET | cada 5 min | Vacía la cola de conversiones de Google. |
| `google-ads/diagnostics` | GET | no se instala | Estado de la cola de Google, sin efectos. |
| `campanas` | POST (`limit`) | cada 5 min | Despacha las campañas encoladas. |
| `recordatorio-reservas` | POST, GET | cada 30 min | Recordatorio de la víspera. |
| `encuesta-post-visita` | POST, GET | cada 30 min | Encuesta tras la visita. |
| `cupon-post-visita` | POST, GET | cada hora | Cupón automático tras la visita. |
| `cierre-asistencia` | POST, GET | cada 15 min | Cierra reservas pasadas e informa la asistencia. |
| `reservation-integrations` | POST, GET | cada hora | Reintenta calendario y CRM de reservas. |
| `cumpleanos` | POST, GET | diaria 08:15 | Saludo de cumpleaños. |
| `meta-lead-recovery` | POST, GET | cada 15 min | Recupera leads de Meta que no llegaron por webhook. |
| `recordatorio-tareas` | POST, GET | cada 30 min | CRM: avisos antes del vencimiento. |
| `resumen-diario` | POST, GET | diaria 08:05 | CRM: un correo por responsable. |
| `leads-parados` | POST, GET | cada hora | CRM: leads sin movimiento. |
| `operational-alerts` | POST, GET | cada hora | Alertas de operación. |
| `stale-pieces` | POST, GET | cada hora | Piezas de audiovisual detenidas. |
| `xp-periods` | POST, GET | cada 6 horas | Cierre de períodos de experiencia. |
| `monthly-cycles` | POST, GET | diaria 03:10 | Cierre de ciclos mensuales. |
| `collection-emails` | POST, GET | diaria 03:20 | Avisos de pago vencido. |
| `data-retention` | POST, GET | diaria 03:30 | Anonimiza lo vencido (ley 21.719). |
| `automation-runs` | POST | cada minuto | Reanuda ejecuciones de Automatizaciones con espera. |
| `automation-schedule` | POST | cada hora | Disparadores de tiempo de Automatizaciones. |
| `automation-webhooks` | POST | cada minuto | Entrega los webhooks en cola. |
| `automation-cleanup` | POST | diaria 03:40 | Limpia ejecuciones y entregas resueltas. |

Notas: `meta-capi/cleanup` no existe en el planificador interno (semanal por decisión del script).
`resumen-diario` y `cumpleanos` van en horas de la mañana porque dependen del reloj de pared. La
hora es la del servidor. Las tareas por intervalo de Automatizaciones son las más frecuentes; ver
`docs/AUTOMATIZACIONES.md`.

Qué pasa si una falta: no hay error visible, simplemente lo que hace no ocurre. Las que más duelen:
`meta-capi` (las conversiones nunca llegan a Meta), `recordatorio-reservas` y `encuesta-post-visita`
(no salen avisos), `cierre-asistencia` (las reservas pasadas quedan abiertas), `data-retention`
(obligación legal) y `campanas` (ver abajo).

## Campañas: por qué necesita su propio cron

Cuando alguien aprieta «Enviar» en Marketing → Campañas **no sale ningún correo todavía**. Lo que
hace el botón es encolar un destinatario por fila y dejar la campaña en «Enviando». Los correos los
manda esta tarea, por tandas.

No es un rodeo: doscientos correos no caben en una petición. El `curl` del crontab corta al minuto
y Passenger antes, así que enviando en el propio botón la lista se cortaba a la mitad y la campaña
quedaba marcada como «Enviando» sin forma de reanudarla.

Con la tarea puesta, una campaña de doscientos sale en dos o tres pasadas —unos diez minutos— y la
pantalla muestra el avance mientras tanto. **Sin la tarea puesta, no sale ni uno.**

El lote por pasada se controla con `limit` (100 por omisión). Si el servidor de correo del hosting
tiene un tope por hora, bajarlo es la forma de respetarlo sin tocar código.

Dos detalles que conviene saber:

- **Una baja a mitad de envío se respeta.** Quien se da de baja después de encolarse y antes de que
  salga su correo no lo recibe: la comprobación va pegada al envío, no al botón.
- **La constancia no se borra.** A diferencia de las otras colas, ésta no tiene tarea de limpieza a
  propósito: es la respuesta a «¿a mí me escribieron, y cuándo?».

## Comprobar que funcionan

Dos tareas responden su propio diagnóstico, sin efectos:

```bash
curl -s -H "x-cron-secret: $CRON_SECRET" https://refugio.espartanos.cl/api/cron/meta-capi/diagnostics
curl -s -H "x-cron-secret: $CRON_SECRET" https://refugio.espartanos.cl/api/cron/google-ads/diagnostics
```

Y en la aplicación: Reservas → sucursal → Medición muestra cuántas conversiones salieron, cuántas
esperan y cuántas fallaron en los últimos 30 días. Si el número de «en espera» sólo crece, el cron
de `meta-capi` no se está ejecutando.

## Nota sobre el correo

Ninguna de estas tareas envía nada si la casilla de salida no está configurada
(`SMTP_ENABLED`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`). Se ve en la aplicación,
en Correos → paso 1, entrando como desarrollo.
