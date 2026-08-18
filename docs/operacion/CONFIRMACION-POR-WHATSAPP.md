# Confirmación por WhatsApp: qué se puede hacer hoy y qué exige integración

## Lo que ya funciona, sin integrar nada

**Botón «Guardar en WhatsApp» en la confirmación.** Ya está.

Abre WhatsApp con el mensaje escrito —local, fecha, personas y código— y la persona decide si lo
envía y a quién. Sin API, sin token, sin número de empresa verificado, sin costo por mensaje y
sin aprobación de plantillas.

Cubre lo que motivaba la idea: que el código no se quede en una pantalla que se cierra, sino que
llegue a donde la persona lo va a buscar.

**Lo que no cubre:** exige un toque. Quien cierra la pestaña sin tocarlo se queda sin nada.

## Las tres opciones para enviar de verdad

Si además quieres que el mensaje salga solo —al confirmar, o el día anterior— hay tres caminos.

### 1. Correo en vez de WhatsApp — **costo cero, ya construido**

El envío de correo ya existe y funciona (`core/notifications/email.service.ts`), y ya se usa
para avisar al equipo de una reserva nueva. Falta enviarle también a quien reserva.

- **Trabajo:** bajo. Una plantilla y una llamada donde ya se avisa al equipo.
- **Costo:** ninguno.
- **Contra:** menos gente abre el correo que WhatsApp, y en teléfono se pierde entre promociones.

### 2. API de WhatsApp Business (Meta) — **lo correcto a mediano plazo**

Es la vía oficial y la que permite mensaje automático y recordatorio.

- **Requiere:** cuenta de WhatsApp Business, número dedicado —no puede ser el que ya usa el
  equipo desde su teléfono—, verificación del negocio en Meta, y plantillas aprobadas por Meta
  para poder escribir primero.
- **Costo:** se paga por conversación iniciada por el negocio. Varía por país; hay que
  cotizarlo antes de comprometerlo.
- **Trabajo:** medio-alto. La parte difícil no es el código —sería otra bandeja de salida como
  las tres que ya existen— sino la verificación y la aprobación de plantillas, que toma días y
  no depende de nosotros.
- **A favor:** ya tienes integración con Meta funcionando, así que el terreno es conocido.

### 3. Un intermediario (Twilio, 360dialog y similares) — **más rápido, más caro**

Resuelven la verificación y las plantillas por ti.

- **Trabajo:** bajo-medio. Una llamada a su API desde una bandeja de salida.
- **Costo:** el de Meta más su margen.
- **Contra:** un tercero más en el camino, con su propia caída y su propio contrato.

## Recomendación

**Correo primero, WhatsApp después.** El correo está construido, no cuesta nada y cubre a quien
cerró la pestaña. Con eso funcionando se ve cuánta gente realmente lo abre, y esa cifra dice si
vale la pena pagar por WhatsApp.

Si el recordatorio del día anterior demuestra que baja la inasistencia por correo, con WhatsApp
bajará más y ahí el gasto se justifica solo.

## Cómo medir el no-show

Ya se mide. No hace falta construirlo.

`no_show` es un estado real de la reserva, con transiciones controladas: solo se llega desde
`confirmed` o `rescheduled`, y es terminal. Al marcarlo, el contacto se actualiza también en el
CRM.

**Dónde verlo:**

| Dónde | Qué muestra |
|---|---|
| Reservas → *Resultados de reservas* | Total, asistidas, no-show, canceladas, por día y por origen |
| Inicio (dirección de operaciones) | Las de hoy: total, asistidas, pendientes y no-show |

La consulta que lo calcula agrupa por estado (`SUM(status = 'no_show')`), así que el número sale
de los mismos datos que la operación, no de un contador aparte que se pueda desincronizar.

**Lo que falta para que la cifra sirva de verdad:** que alguien marque la asistencia. Un no-show
solo se registra si el equipo lo marca al cerrar el día; si nadie lo hace, la reserva queda en
`confirmed` para siempre y el indicador dice cero.

Antes de perseguir el número, conviene fijar quién marca y cuándo. Es una decisión de operación,
no de software.

## Para comparar antes y después

La medida de si esto sirve es simple: **inasistencia antes y después de agregar el recordatorio**.
Reservas → *Resultados de reservas* ya entrega ambas cifras por período, así que se puede
comparar el mes previo con el siguiente sin construir nada.
