# Qué se le envía a Meta

Todo lo que sale de la plataforma hacia Meta, campo por campo: qué evento, cuándo, con qué nombre
exacto, qué datos lleva y cuáles van cifrados.

Está escrito para poder auditarlo. Si alguien pregunta «¿qué le mandan ustedes a Facebook?», la
respuesta completa está acá y no hay nada fuera de esta lista.

---

## 1 · Los nueve eventos, completos

Son dos grupos, y usan **nombres distintos a propósito**.

### Del CRM — nombres propios

| Nombre exacto | Cuándo sale | `event_id` |
|---|---|---|
| `Lead recibido` | Entra un prospecto comercial | `lead-recibido:<id del lead>` |
| `Calificado` | La calificación pasa a «calificado», **y también al vender** | `lead-calificacion:<id del lead>` |
| `Vendido` | La etapa pasa a «ganado» | `lead-venta:<id del lead>` |
| `Descartado` | Se cierra afirmando que **no servía** | `lead-descarte:<id del lead>` |
| `QualifiedLead` | Se convierte un prospecto de Meta en cliente | `lead-converted:<id del lead>:<id de la empresa>` |

`action_source`: **`system_generated`** en los cinco. No los dispara un navegador: los dispara el
equipo al mover una ficha.

> **`Descartado` sólo sale cuando alguien afirmó que la persona no servía.** Si se contestó «no
> alcancé a saber» —el caso de nueve de cada diez cierres— no se envía nada. Ver
> [manual 05](05-campanas.md) para el flujo de descarte.

### De Reservas y Encuestas — nombres estándar de Meta

| Nombre exacto | Cuándo sale | `event_id` | `action_source` |
|---|---|---|---|
| `InitiateCheckout` | Alguien empieza a llenar el formulario | `initiatecheckout:<id>` | `website` |
| `Schedule` | Reserva creada | `schedule:<id>` | `website` |
| `Lead` | Respuesta a encuesta pública, y solicitud de grupo | `lead:<id>` | `website` |
| `Reserva_Asistida` | El equipo confirma que la persona llegó | `reserva_asistida:<id>` | **`physical_store`** |

El último usa `physical_store` porque ocurre en el local, no en la web, y decirle a Meta lo
contrario falsearía dónde pasó la conversión.

Hay un décimo que **no sale solo**: el botón de **evento de prueba** del panel de Pixel manda un
`Lead` cuando alguien lo aprieta a mano.

---

## 2 · Qué datos lleva cada evento

El formato es el oficial de la Conversions API de Meta. Esto es **exactamente** lo que viaja:

```
POST https://graph.facebook.com/<versión>/<pixel>/events

data: [{
  event_name        el nombre de la tabla de arriba
  event_time        momento en segundos
  event_source_url  la página, cuando la hubo
  action_source     system_generated | website | physical_store
  event_id          el de la tabla de arriba
  user_data: { … }  ver abajo
  custom_data: { … }
}]
access_token
```

### `user_data` — quién es la persona

**Cifrado con SHA-256**, siempre. Nunca sale en claro:

| Campo | Qué es | Cómo se normaliza antes de cifrar |
|---|---|---|
| `em` | Correo | Minúsculas, sin espacios |
| `ph` | Teléfono | Sólo dígitos |
| `fn` | Nombre | Minúsculas, sin tildes |
| `ln` | Apellido | Minúsculas, sin tildes |
| `ct` | Ciudad | Minúsculas, sin tildes ni espacios |
| `st` | Región | Igual que la ciudad |
| `country` | País | `cl` |
| `db` | Fecha de nacimiento | `AAAAMMDD` |
| `external_id` | Nuestro identificador **de la persona** | Tal cual, luego cifrado |

**Sin cifrar**, porque Meta lo prohíbe o porque son suyos:

| Campo | Qué es | Por qué va en claro |
|---|---|---|
| `lead_id` | El identificador que Meta generó en su formulario | Es un número de Meta, no un dato personal. Cifrarlo lo vuelve irreconocible |
| `fbc` | Clic del anuncio | Señal técnica. Meta prohíbe cifrarla |
| `fbp` | Cookie del navegador | Igual |
| `client_ip_address` | Dirección desde la que entró | Igual |
| `client_user_agent` | Navegador | Igual |

**`external_id` identifica a la persona, no al hecho.** En Reservas no viaja el identificador de la
reserva sino uno estable de quien reserva: con el de la reserva, cada visita parecía alguien
distinto y se perdía la conexión entre quien miró, quien reservó y quien asistió — que es justo lo
que mide una campaña.

**La normalización importa tanto como el cifrado.** Un espacio de más produce un resumen distinto,
y el evento se acepta **sin emparejarse con nadie**: cuenta como enviado y no sirve de nada.

### `custom_data` — el contexto del evento

Son seis campos y **no hay campos libres**:

| Campo | Cuándo viaja |
|---|---|
| `value` | **En el CRM, sólo en la venta y sólo si alguien anotó el monto.** En Reservas, si el local puso un valor por persona: se multiplica por cuántos vienen |
| `currency` | Junto al monto. `CLP`, o la moneda que el local haya puesto |
| `content_ids` | Reservas y Encuestas: el identificador del local |
| `content_type` | `reservation`, `group_request` o `survey` |
| `lead_event_source` | `Espartanos`. Sólo en los eventos del CRM |
| `event_source` | `crm`. Sólo en los eventos del CRM |

**El valor de una reserva es una estimación declarada, no un cobro.** Sale del valor por persona que
el local escribe en el diseño de su página, multiplicado por el tamaño del grupo. Si no lo puso, no
viaja nada: un cero diría que la reserva no vale, que es distinto de no saber cuánto vale.

> **Por qué no hay campos libres.** `custom_data` es donde acabaría cualquier dato comercial que a
> alguien le pareciera útil para segmentar —ingresos, deuda, salud—, y eso es justo lo que las
> condiciones de Meta prohíben. La lista es cerrada: lo que no está, no sale.

---

## 3 · Las dos rejas que impiden que salga algo que no debe

**Una lista cerrada de campos.** Todo lo que no esté en las tres listas de arriba se descarta antes
de enviar, aunque alguien lo haya puesto en el código.

**Un detector de categorías prohibidas**, que busca palabras delatoras tanto en los nombres de los
campos como en el nombre del evento. Atrapa el caso realista: alguien agrega un dato que le parece
útil para segmentar y resulta ser de una categoría que Meta no admite.

**Las dos se comprueban dos veces**: al encolar el evento y otra vez justo antes del envío. Un
evento peligroso que entre por un camino nuevo no llega a Meta aunque haya conseguido entrar a la
cola.

Y hay una tercera, propia: **antes de enviar se verifica que ningún campo que deba ir cifrado vaya
en claro**. Si algún camino futuro deja de cifrar, el evento no sale. Es la última reja, y existe
para que un error de programación no se convierta en una fuga.

---

## 4 · Cuándo **no** se envía nada

Vale la pena conocerlo: la mayoría de las veces que «falta» un evento, es una de éstas.

### En el CRM

| Condición | Qué pasa |
|---|---|
| El lead está marcado como **excluido de Meta** | No se reporta en ninguna etapa |
| El lead **no tiene empresa** | Es un prospecto de la agencia, no pertenece a ninguna cuenta publicitaria |
| La empresa **no tiene contratado** el servicio de conversiones | No se reporta |
| La campaña tiene la medición **apagada** | Excepción para campañas de prueba |
| **No hay Pixel configurado** | Queda una advertencia en el registro y nada más |
| **El lead entró con más de 7 días de antigüedad** | Ver abajo |

**La regla de los 7 días.** Meta descarta los eventos con más de una semana, y falsear la fecha
para colarlos puede costar el lote entero. Un prospecto importado con su fecha de origen real —una
campaña de hace meses— **no se anuncia**, porque sería mentir sobre cuándo llegó.

Es la causa más común de que un lote importado no aparezca en Meta, y es correcta.

### En Reservas

Además de lo anterior: **sin consentimiento de medición no se envía nada.** La persona tiene que
haber aceptado la casilla de medición en la página de reserva. Sin eso, la reserva se guarda, el
local la ve, y Meta no se entera.

---

## 5 · Nombres estándar y nombres propios: la decisión

Meta **no exige** nombres oficiales. Los eventos personalizados se admiten; las únicas
restricciones son que sean texto y no pasen de 50 caracteres.

| | Evento estándar | Evento propio |
|---|---|---|
| ¿Lo acepta la API? | Sí | **Sí** |
| ¿Meta sabe qué significa? | Sí, lo tiene pre-entrenado | No. Es una etiqueta |
| ¿Se puede optimizar por él? | Directo | **Hay que darlo de alta** en Events Manager |
| ¿Exige parámetros? | A veces | No |

### Por qué el CRM usa nombres propios

**Primero: `Purchase` exige `value` y `currency`.** Es un evento estándar de Meta y sin el monto lo
rechaza con un error 400. Pasó: dos ventas de agosto de 2026 se perdieron por eso, y el arreglo fue
cambiar el nombre a `Vendido`. Volver a `Purchase` sin que el equipo anote el monto reproduce el
mismo fallo.

**Segundo: `Lead` ya está ocupado.** Reservas y Encuestas lo usan para respuestas de encuesta y
solicitudes de grupo. Si el CRM llamara `Lead` a su primera etapa, **los comensales y los
prospectos caerían en la misma conversión** y dejarían de poder distinguirse. Eso es peor que no
tener optimización pre-entrenada.

### Lo que hay que hacer en Events Manager

Dar de alta los cuatro nombres propios como **conversiones personalizadas**. Mientras no se haga,
los eventos llegan y quedan registrados, pero **ningún conjunto de anuncios puede apuntarles**.

Es lo único de este manual que no depende del código.

---

## 6 · Lo que Meta aprende, y lo que no

Conviene decirlo porque se asume al revés con frecuencia:

**Meta no aprende a evitar perfiles porque le mandes un evento negativo.** Optimiza hacia el evento
que se configura como objetivo del conjunto de anuncios, y nada más. Los demás se registran y
sirven para informes, pero no entrenan la entrega.

Por eso `Descartado` **no le enseña a Meta a quién evitar**. Lo que enseña es qué evento positivo se
manda y por cuál se optimiza.

**Y hace falta volumen.** Meta necesita del orden de **50 conversiones por semana y por conjunto de
anuncios** para salir de la fase de aprendizaje. Con pocos calificados al mes, optimizar por
`Calificado` no sale nunca de aprendizaje y entrega peor que no hacer nada.

Mientras ese volumen no exista, la calidad sirve para **tus decisiones** —qué campaña bajar, qué
creativo matar— y no para las de Meta. Se ve en **CRM → Resultados**.

---

## 7 · Dónde mirar si algo no cuadra

| Qué | Dónde |
|---|---|
| La cola de envíos | Tabla `meta_conversion_outbox` |
| Si llegó | `status`: `processed` es llegado; `failed` y `expired` son perdidos |
| Por qué falló | `last_error`, con el código y el `fbtrace_id` que pide el soporte de Meta |
| Qué se mandó | `event_data`, el evento completo |
| Reintentar lo fallido | Hay una acción que los devuelve a la cola sin duplicarlos |

El `event_id` es lo que impide contar dos veces: si un evento llegó pese a un error, Meta lo
deduplica por ese identificador.

---

## 8 · A qué ley responde

**Ley 21.719, licitud.** Mandar datos de una persona a un tercero es un tratamiento y necesita
fundamento. En Reservas ese fundamento es el consentimiento de medición, que se pide aparte del de
marketing y se guarda con su texto y su fecha.

**Ley 21.719, minimización.** Que `custom_data` sea una lista cerrada de seis campos es esta
obligación hecha código: no se manda lo que no hace falta para la finalidad.

**Ley 21.719, seguridad.** El cifrado de los identificadores y la comprobación previa al envío son
medidas técnicas apropiadas. Nada que identifique a una persona sale en claro.

**Condiciones de Meta.** Prohíben enviar categorías sensibles —salud, situación financiera,
creencias—. El detector de palabras delatoras existe para eso.

---

## 9 · Preguntas que van a salir

**¿Le mandan mi correo a Facebook?**
Se manda un **resumen cifrado** del correo, no el correo. De ese resumen no se puede volver atrás:
le sirve a Meta para comparar con lo que ya tiene, no para leerlo.

**¿Por qué un lead importado no aparece en Meta?**
Casi siempre por la regla de los 7 días. Meta rechaza lo más viejo, y falsear la fecha arriesga el
lote completo.

**Mandé una venta y no llegó.**
Mira `last_error` en la cola. Si dice `code=100`, suele ser un parámetro que falta.

**¿Puedo dejar de mandarle un lead a Meta?**
Sí: márcalo como excluido en su ficha. Deja de reportarse en todas las etapas, sin perder el lead
ni nada de lo que cuelga de él.

**¿Esto cuenta las reservas dos veces?**
No. El navegador y el servidor mandan el mismo `event_id`, y Meta los une.
