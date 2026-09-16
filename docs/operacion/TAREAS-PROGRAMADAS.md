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

## Cómo se llaman

Todas se piden igual, con `GET` y la clave en una cabecera:

```bash
curl -s -H "x-cron-secret: $CRON_SECRET" https://refugio.espartanos.cl/api/cron/<tarea>
```

`CRON_SECRET` se define en cPanel → Setup Node.js App → Environment variables. Sin ella, todas
responden 403. Para rotarla sin corte existe `CRON_SECRET_PREVIOUS`: se mueve la vigente ahí, se
pone la nueva en `CRON_SECRET`, se actualizan los cron y después se borra la anterior.

En cPanel → Cron Jobs, cada línea se escribe así (ejemplo, cada hora en el minuto 5):

```
5 * * * * curl -s -H "x-cron-secret: LA_CLAVE" https://refugio.espartanos.cl/api/cron/recordatorio-reservas >/dev/null 2>&1
```

Conviene separar los minutos entre tareas que coinciden en frecuencia, para no arrancarlas todas
en el mismo segundo.

## Imprescindibles

Sin estas cinco, Reservas queda a medias.

| Tarea | Frecuencia | Qué pasa si falta |
|---|---|---|
| `meta-capi` | cada 10 min | Las conversiones se acumulan en la cola y **nunca llegan a Meta**. Las campañas optimizan a ciegas. |
| `recordatorio-reservas` | cada hora | No se envía el recordatorio de la víspera, que es la medida que más reduce las ausencias. |
| `encuesta-post-visita` | cada hora | No se envía la encuesta tras la visita: no entra ninguna opinión. |
| `cierre-asistencia` | cada hora | Las reservas pasadas quedan abiertas para siempre y la asistencia nunca se informa. |
| `data-retention` | diaria, de madrugada | No se anonimiza lo vencido. Es una obligación de la ley 21.719, no una comodidad. |

## Recomendadas

| Tarea | Frecuencia | Para qué |
|---|---|---|
| `reservation-integrations` | cada hora | Reintenta las reservas cuyo envío a Meta, Google o el calendario falló. |
| `cumpleanos` | diaria, mañana | Saludo a quien dio su fecha y está suscrito. |
| `meta-capi/cleanup` | semanal | Descarta de la cola los eventos ya enviados y antiguos. |
| `meta-lead-recovery` | diaria | Recupera leads de Meta que no llegaron por webhook. |

## Sólo si se usa el módulo

| Tarea | Frecuencia | Módulo |
|---|---|---|
| `resumen-diario` | diaria, mañana | CRM: un correo por responsable, si tiene algo que leer. |
| `recordatorio-tareas` | cada hora | CRM: avisos doce y tres horas antes. |
| `leads-parados` | diaria | CRM: leads sin movimiento. |
| `google-ads` | cada 10 min | Cola de conversiones de Google Ads. |
| `collection-emails` | diaria | Avisos de pago vencido. |
| `monthly-cycles` | diaria | Cierre de ciclos mensuales. |
| `operational-alerts` | cada hora | Alertas de operación. |
| `stale-pieces` | diaria | Piezas de audiovisual detenidas. |
| `xp-periods` | diaria | Cierre de períodos de experiencia. |
| `automation-runs`, `automation-schedule`, `automation-webhooks`, `automation-cleanup` | según Automatizaciones | Ver `docs/AUTOMATIZACIONES.md`. |

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
