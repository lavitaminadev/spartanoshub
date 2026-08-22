# Las puertas que atienden sin sesión

Ocho rutas del sistema responden a quien no ha iniciado sesión. Cada una existe por un motivo
distinto y ninguna tiene detrás a una persona con cuenta: las abre un comensal, un visitante de
la web, el servidor de tareas o Meta.

Eso las convierte en **la superficie expuesta del producto**. Cualquiera en internet puede
llamarlas, así que lo que importa de ellas no es que funcionen —eso lo cubre cada módulo— sino
que no sirvan para más de lo que deben.

Cubiertas por `test/e2e/puertas-sin-sesion.e2e.spec.ts` (14 pruebas) y
`test/e2e/entrada-make.e2e.spec.ts` (11 pruebas).

---

## El inventario

| Ruta | Quién llama | Cómo se autoriza | Límite |
| --- | --- | --- | --- |
| `POST /auth/login` · `register` | Una persona | Contraseña | 5/min |
| `GET /health` | Monitorización | Nada. No devuelve datos | — |
| `POST /cron/*` | El servidor de tareas | `CRON_SECRET` en cabecera | 6/min |
| `GET·POST /webhooks/meta` | Meta | Firma HMAC del cuerpo | — |
| `POST /public/ingest/leads` | Make, Zapier | Llave por campaña | 120/min |
| `POST /public/agency-crm/leads/submissions` | Visitante de la web | Ninguna + honeypot | 10/min |
| `GET·POST /public/reservations/:slug` | Un comensal | El propio enlace publicado | 10–120/min |
| `GET·POST /public/surveys/:id` | Quien recibió el enlace | El propio enlace | 10–60/min |

---

## Una por una

### `POST /auth/login` — el acceso

Cinco intentos por minuto **por dirección de origen**, ajustable con `AUTH_THROTTLE_LIMIT`. Un
token robado muere al cambiar la contraseña: `JwtStrategy` rechaza cualquier token emitido antes
del último cambio. Cerrar sesión surte efecto de inmediato.

**Lo que hay que saber:** el límite es por IP, no por persona. Una oficina entera lo comparte.

### `GET /health` — la salud del servicio

No devuelve datos del negocio: estado, hora y versión. Es correcto que no exija nada.

### `POST /cron/*` — las tareas programadas

Clave compartida en `x-cron-secret`, comparada en **tiempo constante** (`timingSafeEqual`), que es
lo correcto: una comparación normal filtra la clave carácter a carácter midiendo cuánto tarda en
fallar. Sin `CRON_SECRET` configurado no atiende a nadie, en vez de atender a todos.

### `GET·POST /webhooks/meta` — el webhook

La verificación compara el testigo en tiempo constante. Los envíos exigen **firma HMAC del cuerpo
crudo**: sin ella no se procesa nada. Comprobado: un envío sin firma no crea ni un lead.

**Lo que hay que saber:** desde la corrección de agosto, un lead de Meta solo entra si su campaña
está registrada en el CRM. Sin registrar, queda como evento en error —visible y reprocesable— en
vez de entrar sin empresa.

### `POST /public/ingest/leads` — la entrada de Make

La llave se guarda **solo como huella**, igual que una contraseña. Una llave apagada responde lo
mismo que una inexistente: distinguirlas confirmaría a un tercero que la suya es válida y solo hay
que esperar.

**La llave decide la empresa, no el cuerpo.** Está probado: un envío que pide otra empresa aterriza
igual en la de su llave. El límite es alto (120/min) a propósito: una campaña dispara leads en
ráfaga y frenarlos haría que Zapier reintentara, duplicando.

### `POST /public/agency-crm/leads/submissions` — el formulario de la web

La única sin credencial de ninguna clase, porque la rellena un visitante. Se protege con:

- **Honeypot**: un campo oculto por CSS que un formulario real deja vacío. Si viene lleno se
  responde éxito y se descarta en silencio — decirle a un bot que fue detectado solo le enseña a
  esquivarlo la próxima vez.
- **Consentimiento obligatorio** antes de guardar nada.
- **Clave de idempotencia**: un reenvío no duplica.
- **`create-only`**: un envío anónimo da de alta un prospecto, nunca reescribe uno existente.

El contacto entra siempre en el embudo comercial y **sin empresa**, aunque el cuerpo pida otra
cosa. Probado.

### `GET·POST /public/reservations/:slug` — el formulario de reservas

El enlace publicado es la credencial. Lo que devuelve está recortado a propósito:

- Los campos marcados como internos **no se publican** (`field.internal`).
- Va el `pixelId` pero **nunca el token de acceso**: solo un booleano `metaReady`.
- No viaja el identificador de la organización ni el de la empresa.

La URL del evento que se declara a Meta **la arma el servidor**. La que manda el cliente solo se
acepta si apunta al mismo host: sin eso, cualquiera podía declarar un dominio ajeno y ensuciar el
Events Manager de tu cliente. El `Referer` tampoco vale, porque lo controla igualmente quien llama.

La IP y el navegador se leen de la petición, no del cuerpo: un dato que el navegador escribe no
sirve para atribuir.

### `GET·POST /public/surveys/:id` — las encuestas

Solo se abren las activas. Las respuestas se validan contra las preguntas reales: una respuesta a
una pregunta que no existe se rechaza nombrándola.

**Corregido en esta revisión:** la vista pública devolvía el contrato completo, y ahí viajaban
**quién de la agencia la creó** —el identificador de una persona real—, **cuántas respuestas
lleva** y **a quién se distribuyó**. Nada de eso hace falta para contestar, y el recuento además
le dice a cualquiera cómo le está yendo a esa campaña.

Ahora se arma explícitamente en vez de quitar campos del objeto completo: así, un campo nuevo en
la encuesta no se publica solo por haberse añadido.

---

## Reglas para la próxima puerta pública

1. **Armar la respuesta, no filtrarla.** Quitar campos de un objeto completo publica cada campo
   nuevo que alguien añada. Construirla explícitamente no.
2. **Comparar secretos en tiempo constante.** `timingSafeEqual`, nunca `===`.
3. **No distinguir «no existe» de «está apagado».** Distinguirlos permite enumerar lo que hay
   probando nombres.
4. **Lo que decide de quién es el dato viene de la credencial, no del cuerpo.** La llave dice la
   empresa; el cuerpo no puede cambiarla.
5. **Sin credencial configurada, no se atiende.** Nunca «si no hay clave, pasa cualquiera».
6. **Lo rechazado no deja rastro.** Probado en la base después del intento, no en el código de
   respuesta.

---

## Lo que queda abierto

- **El límite de acceso es por IP.** Una oficina lo comparte. Ajustable, pero el reparto sigue
  siendo por origen.
- **El formulario de la web no tiene captcha.** Hoy lo cubren el honeypot y el límite de 10/min.
  Si empieza a llegar basura, es lo siguiente que hay que poner.
- **Las tareas programadas dependen de una sola clave compartida.** Rotarla exige tocar el
  servidor de tareas y el `.env` a la vez.
