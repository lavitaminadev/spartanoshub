# Leads de Meta: los dos caminos

Hay **dos formas** de que un lead de Meta Lead Ads llegue al CRM. Las dos funcionan a la vez y
no se pisan. Este documento explica cuál usar, por qué existen ambas y cómo pasar de una a otra
sin duplicar nada.

---

## Camino A — Directo (el definitivo)

```
Meta ──webhook firmado──▶  POST /api/webhooks/meta
```

Meta llama a nuestro servidor cada vez que alguien completa un formulario.

**Lo que lo hace mejor:**

- **Firma criptográfica.** Se verifica `X-Hub-Signature-256` con el secreto de la aplicación y
  comparación de tiempo constante. Eso *demuestra* que el lead viene de Meta. Una llave
  compartida solo demuestra que quien llama la conoce.
- **Trae todo.** Descarga el detalle completo del lead y guarda en `metadata.fieldData` **cada
  respuesta del formulario** — comuna, presupuesto, la pregunta que hayas inventado. También
  `adId`, `adName`, `adsetId`, `formId`, `platform` y el consentimiento con su fecha.
- **Un salto menos.** Nada intermedio que pueda caerse ni que cobre por operación.
- **Deduplicación propia**, en `meta_lead_webhook_events` por `pageId + leadgenId`: un reenvío
  de Meta no crea un lead nuevo.

**Lo que cuesta:** requiere `leads_retrieval` con acceso avanzado, y eso exige App Review de
Meta **precedido de la verificación del negocio**, que es el trámite lento.

**Qué necesita configurado:**

| Variable | Para qué |
| --- | --- |
| `META_APP_ID`, `META_APP_SECRET` | Identidad de la aplicación y verificación de la firma |
| `META_WEBHOOK_VERIFY_TOKEN` | Responder el desafío de suscripción de Meta |
| `META_GRAPH_API_VERSION` | Versión del Graph API (por defecto `v23.0`) |

Además, en la pantalla de integraciones hay que **seleccionar la página**: el webhook busca una
cuenta de tipo `PAGE` con `metadata.selected = true`. Sin eso el lead se registra como
`ignored` con el motivo escrito, que es distinto de perderse.

### Lo que a este camino todavía le falta

Dos huecos conocidos, del mismo tipo que ya se corrigió en la importación por archivo:

1. **No asigna cuenta.** `processWebhook` captura con `organizationId` pero sin `clientId`. La
   página de Meta se mapea a *organización*, no a *cuenta*, porque ni `Integration` ni
   `IntegrationAccount` tienen `client_id`. Un lead sin cuenta no aparece en ningún listado: el
   alcance por cuenta lo deja fuera de todos.
2. **Cae en el embudo equivocado.** No pasa `domain`, y el valor por defecto es `commercial`
   (`lead-intake.service.ts`, `splitDomain`). Los contactos de campaña de un cliente entrarían
   al embudo de ventas de la agencia.

**Arreglarlo pide:** una migración que agregue `client_id` a `integration_accounts`, un selector
en la pantalla de integraciones para decir qué cuenta corresponde a cada página, y pasar
`clientId` y `domain: 'audience'` en la captura.

> **Mientras esos dos huecos existan, el camino directo no debe encenderse en producción.**
> El camino B sí asigna cuenta y embudo correctamente.

---

## Camino B — Puente por automatización (el transitorio)

```
Meta ──▶ Make ──HTTP POST──▶  POST /api/public/ingest/leads
```

Un escenario de Make escucha a Meta y reenvía a nuestra API con una llave.

**Para qué sirve:** empezar a operar **hoy**, sin esperar la verificación del negocio.

**Lo que se pierde frente al camino A:**

- La garantía es una llave compartida, no una firma.
- **Solo llegan los campos mapeados.** Las respuestas extra del formulario se descartan: no hay
  dónde guardarlas por esta vía.
- Consume operaciones de Make. En plan gratuito son 1.000 créditos al mes y 2 escenarios
  activos.

**Lo que sí conserva:** la llave lleva la cuenta y la campaña, así que el lead entra a la empresa
correcta y con su campaña — sin depender de que el escenario escriba bien ningún nombre.

### Configuración en Make

| Campo | Valor |
| --- | --- |
| Módulo | HTTP → *Make a request* |
| URL | `https://refugio.espartanos.cl/api/public/ingest/leads` |
| Método | `POST`, cuerpo JSON |
| Cabecera | `Authorization: Bearer <llave>` |

Cuerpo mínimo:

```json
{
  "nombre":      "{{full_name}}",
  "telefono":    "{{phone_number}}",
  "email":       "{{email}}",
  "idExterno":   "{{leadgen_id}}",
  "fechaOrigen": "{{created_time}}"
}
```

- Acepta también `name`, `phone`, `correo`, `external_id`, `created_at` y varios más. Ver
  `normalizar-cuerpo-entrada.ts` para la lista completa.
- Los campos que no reconoce **se descartan sin fallar**: Meta manda `form_id`, `ad_id` y una
  entrada por pregunta, y esas preguntas las cambia quien crea el anuncio.
- **`idExterno` no es opcional en la práctica**: es lo que impide que un reintento de Make
  convierta un lead en tres.
- **`fechaOrigen` tampoco**: sin ella todo entra con la fecha de hoy y el gráfico por día muestra
  un pico que nunca existió.
- **No mandes `campana` ni `clientId`**: los pone la llave. Si vienen, se ignoran.

Requisito: teléfono **o** correo. Sin ninguno de los dos se rechaza con el motivo, que Make
muestra en su historial.

---

## Cómo conviven sin contaminarse

El riesgo real es que el mismo lead entre por los dos caminos y quede duplicado. Lo evita el
identificador con que se reconoce un lead ya recibido:

| Camino | `source` | `externalLeadId` |
| --- | --- | --- |
| A — directo | `meta_lead_ads` | `123456789012345` |
| B — puente **bien configurado** | `meta_lead_ads` | `123456789012345` |
| B — puente con otro nombre de origen | `Meta Ads` | `Meta Ads:123456789012345` |

La regla está en `identificador-externo.ts`: a los orígenes de la lista
`IDENTIFICADORES_GLOBALES` no se les antepone nada, porque su identificador ya es único en el
mundo. Hoy esa lista contiene `meta_lead_ads`.

> **Para que los dos caminos se reconozcan, el origen del puente debe llamarse exactamente
> `meta_lead_ads`.** Se elige al crear la llave, en *CRM → Administración → Conexión de
> campañas*. Con cualquier otro nombre, el mismo lead entra dos veces.

Con esa condición cumplida, encender el camino A **no obliga a apagar el B primero**: si los dos
entregan el mismo lead, el segundo reconoce al primero y lo actualiza en vez de duplicarlo.

---

## Cuándo cambiar de camino

1. Completar la verificación del negocio en el Business Manager dueño de la app.
2. Recortar los permisos que se piden en `meta-oauth.service.ts` a los que el código realmente
   usa. Hoy se piden diez, y `instagram_manage_messages` y `pages_messaging` **no se usan en
   ninguna parte** — pedir permisos sin flujo que enseñar es motivo de rechazo, y el rechazo
   arrastra a `leads_retrieval`, que sí hace falta.
3. Enviar App Review con justificación y video por permiso.
4. Cerrar los dos huecos de la sección anterior.
5. Seleccionar la página en la pantalla de integraciones.
6. Apagar el escenario de Make cuando el directo lleve un par de días entregando.

Para una **demostración** no hace falta nada de esto: en modo desarrollo la aplicación funciona
con las cuentas de administradores y probadores, así que se pueden recibir leads reales de
campañas propias sin acceso avanzado. App Review hace falta para conectar Business Manager de
terceros.
