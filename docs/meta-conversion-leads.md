# Meta Conversion Leads — cómo está implementado y qué hay que configurar

Qué le enviamos a Meta desde el CRM, por qué esas cuatro etapas y no otras, y qué queda por
configurar en Events Manager. Escrito para volver a leerlo dentro de seis meses sin tener que
reconstruir el razonamiento.

Última revisión de la documentación oficial: **31 de agosto de 2026**.

---

## 1. Qué es esto y para qué sirve

Conversion Leads es una optimización de Meta para campañas de formularios instantáneos. En vez de
optimizar hacia «quien rellena el formulario», optimiza hacia «quien rellena el formulario **y
además termina siendo un buen lead**». Para saber cuál es cuál, Meta necesita que el CRM le
devuelva qué pasó después con cada persona.

Eso es lo que hace nuestra integración: devolverle a Meta el recorrido de cada lead por el embudo.

- [Conversions API for CRM integration](https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration) — la página raíz
- [Configurar tu CRM para clientes potenciales calificados](https://www.facebook.com/business/help/279369167153556) — la versión para negocio

---

## 2. Requisitos de elegibilidad

De la [página oficial de la integración](https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration):

| Requisito | Valor exigido | Dónde estamos (agosto 2026) |
|---|---|---|
| Leads al mes | **200** | 30 — falta 6,7× |
| Tasa de conversión de la etapa optimizada | **1% – 40%** | 20% (6 calificados de 30) ✅ |
| La etapa ocurre dentro de | **28 días** de generado el lead | por vigilar |
| Origen | Solo Lead Ads (formularios instantáneos) | 27 de 30 ✅ |
| Lead ID de 15–17 dígitos guardado | recomendado | 27 de 27 = **100%** ✅ |

**La calidad de nuestros datos ya cumple. Lo que falta es volumen**, y eso es una decisión de
pauta, no de código.

El umbral de 200 es **por Pixel**, no por agencia. Ver la sección 6.

---

## 3. Las cuatro etapas que enviamos

| Etapa | `event_name` | Cuándo | Grupo en Events Manager |
|---|---|---|---|
| Lead recibido | `Lead recibido` | entra al CRM | primera etapa |
| Calificado | `Calificado` | alguien lo marca | **positiva** |
| Vendido | `Vendido` | se cierra la venta | **positiva** |
| Descartado | `Descartado` | se da por perdido | otras |

### Por qué el lead recibido es imprescindible

Es el **denominador**. La [guía de implementación](https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration/crm-integration/3-implementing-the-crm-integration)
lo dice con números:

> Si tus campañas generan 100 clientes potenciales, entonces Meta espera 100 eventos de «Raw Lead»
> subidos para representar la primera etapa principal. […] se generan 100 clientes potenciales,
> pero Meta espera que se suban **215 eventos**.

Sin esa etapa, el requisito del 1–40% no se puede evaluar: no hay sobre qué dividir.

### Por qué NO enviamos contactado, reunión agendada, cotización

Son pasos de proceso, no de valor. Se contacta a todos y se agenda para averiguar, así que no
distinguen un buen lead de uno malo. Y hay un riesgo concreto: si una etapa cubre casi todos los
leads y se marca como positiva, saca a la etapa optimizada del rango 1–40% exigido.

### Por qué el descartado sí

La [guía de configuración del embudo](https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration/crm-integration/5-configure-your-sales-funnel)
tiene un grupo exacto para esto:

> - **Etapas positivas**: los eventos que representan clientes potenciales de calidad.
> - **Otras etapas**: los eventos que no representan un cliente potencial de calidad.

El contraste es la mitad de lo que Meta necesita para distinguir un buen perfil.

### Cada etapa exige las anteriores

De la [especificación de la carga útil](https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration/payload-specification):

> Si un cliente potencial llega a la etapa «Convertido», **es necesario que ya se hayan enviado
> todas las etapas anteriores**.

Por eso una venta arrastra la calificación. El `event_id` es estable por lead y etapa
(`lead-calificacion:<uuid>`), así que si ya salió, la cola la reconoce y no la duplica.

---

## 4. Nombres libres, nunca eventos estándar

**Esta es la corrección más importante que se hizo.**

La especificación define `event_name` como *«campo sin formato para capturar las etapas de cliente
potencial que usas en el CRM»*. Nosotros usábamos `QualifiedLead` y `Purchase`, que son eventos
**estándar de web**.

Consecuencia real en producción: al llamarlo `Purchase`, Meta aplicaba la validación del evento
estándar, que exige `value` y `currency`. Las ventas sin importe se rechazaban con
`code=100 subcode=2804010` y la conversión se perdía en la cola de fallidos.

Con nombres libres esa validación no existe. Una venta sin monto se reporta igual.

> ⚠️ **No cambiar estos nombres.** Son la clave con la que se configura el embudo en Events
> Manager. Cambiarlos parte el histórico en dos series que no se suman y obliga a rehacer la
> clasificación de etapas.

---

## 5. La carga útil

Campos obligatorios según la [especificación](https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration/payload-specification),
y qué mandamos:

| Campo | Valor exigido | Nosotros |
|---|---|---|
| `event_name` | etapa del CRM, formato libre | ✅ |
| `event_time` | UNIX, posterior a la generación del lead | ✅ |
| `action_source` | `system_generated` | ✅ |
| `user_data` | al menos un identificador | ✅ |
| `lead_event_source` (en `custom_data`) | nombre del CRM | `Espartanos` |
| `event_source` (en `custom_data`) | `crm` | ✅ |

> Si el evento no tiene `lead_event_source` y `event_source`, **no se registrará como evento de
> clientes potenciales de conversión**.

### Identificadores y calidad de emparejamiento (EMQ)

Meta puntúa de 0 a 10 cuántos identificadores manda cada evento, su calidad, y qué porcentaje
empareja con una cuenta real. Prioridades según la
[tabla oficial](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters):

| Parámetro | Prioridad Meta | Enviamos |
|---|---|---|
| `lead_id` | **más alta** | ✅ sin hashear, validado 15–17 dígitos |
| `fbc` (click id) | más alta | ✅ cuando existe |
| `em` correo | más alta | ✅ SHA-256 |
| `ph` teléfono | alta | ✅ SHA-256, con código de país, sin `+` |
| `fn` / `ln` nombre y apellido | media | ✅ SHA-256 |
| `country` | media | ✅ `cl` |
| `external_id` | — | ✅ nuestro UUID |
| `fbp`, IP, navegador | apoyo | ✅ sin hashear |

`ct`, `st`, `zp`, `db`, `ge` no se envían: el CRM no los guarda.

> **Si envías `lead_id`, usa uno válido o el sistema rechazará el evento.** Por eso se valida el
> formato antes de mandarlo: en la base conviven identificadores de prueba escritos a mano.

- [Referencia de hasheo y normalización](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters)
- [Dataset Quality API — cómo se calcula el EMQ](https://developers.facebook.com/docs/marketing-api/conversions-api/dataset-quality-api/)

---

## 6. Multiempresa: por qué cada empresa tiene su propio Pixel

De los [pasos de seguimiento](https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration/crm-integration/6-follow-up-steps):

> **No cambies píxeles después de este paso. Cambiar píxeles reinicia el proceso de entrenamiento.**

Esa frase convierte la separación de Pixels en una decisión irreversible, no en una buena práctica.
Cuatro consecuencias:

1. **El umbral de 200 leads/mes es por Pixel.** Sumar diez clientes en un Pixel llegaría a 200 y
   sería inútil: el embudo de un restaurante y el de una inmobiliaria no son el mismo embudo.
2. **Mezclar empresas contamina de forma no reversible.** El modelo aprende de leads que no son
   de ese anunciante, y deshacerlo exige cambiar de Pixel — que reinicia el entrenamiento.
3. **Cada Pixel tiene su propio embudo, su propio análisis y su propia fase de aprendizaje** de
   2 a 4 semanas.
4. **Para apagar una campaña de prueba, usar `metaCapiEnabled` de la campaña**, nunca cambiar el
   Pixel. Apagar una campaña no reinicia nada.

En el código: tabla `meta_pixels`, resolución por empresa en `MetaClientPixelService`, y token
propio por Pixel. La capacidad `metaConversions` nace apagada: sin contratarla no sale ningún dato
personal hacia Meta.

---

## 7. Plazos: los dos que hay que no confundir

### 7 días — plazo para *avisar*

Cuenta desde que **ocurre** el hecho. Un lead que entró hace un mes y se califica hoy tiene 7 días
desde hoy para que el evento llegue a Meta.

Nunca nos limita: la cola se vacía cada 5 minutos. Y está protegido — si un evento se quedara
trabado más de 7 días, la cola lo marca `expired` en vez de mandarlo para que Meta lo rechace.

### 28 días — ventana de atribución

La etapa que optimizas tiene que **ocurrir** dentro de 28 días de que el lead se generó. Un lead
que se califica al día 35 ya no entrena el modelo.

**Este sí condiciona la operación**: hay que trabajar los leads dentro del primer mes, idealmente
en la primera semana. Las alertas de leads parados (3/5/7 días) existen justamente para eso.

### Relleno histórico — 7 días, y no más

> **No intentes llenar más de 7 días de datos modificando los valores `event_time`.** El modelo se
> basa en una marca de tiempo precisa. Hacerlo puede provocar que **todos** tus datos rellenados se
> desechen.

No descarta los viejos: descarta el lote. Por eso los leads importados **no** disparan el evento de
lead recibido — se comprueba `sourceCreatedAt` y lo que supere 7 días no se envía.

---

## 8. Qué configurar en Events Manager

Esta parte no es código. Se hace en la interfaz de Meta.

**0. Antes de nada: un Pixel por empresa, sin compartir.** Si dos empresas comparten Pixel,
sepáralas ahora. Después del paso 4 ya no se puede sin reiniciar el entrenamiento.

**1. Generar el token.** [Events Manager](https://www.facebook.com/events_manager2) → tu Pixel →
Configuración → API de conversiones → *Generar token de acceso*. Tiene que salir de ahí.

**2. Esperar un día y verificar la marca verde.**

> Después de 1 día, aparecerá una marca verde junto al paso «Enviar un evento de CRM» si se detecta
> un evento válido.

**3. Comprobar que los eventos traen las dos etiquetas.** Abre un evento y confirma
`lead_event_source` y `event_source`. Sin ellas no cuenta como Conversion Leads.

**4. Configurar el embudo.** Ordenar las etapas en el orden real y clasificarlas:

- **Positivas:** `Calificado`, `Vendido`
- **Otras:** `Descartado`

> Si compartes una cantidad adecuada de etapas de eventos, es posible que Meta use IA para generar
> un embudo de ventas para ti.

**5. Objetivo de optimización: `Calificado`.**

> Selecciona la etapa principal **más temprana** para la que optimizar. No necesita ser la última
> etapa del embudo. El sistema se optimiza para todas las etapas.

`Vendido` está al 3,3% y tarda meses; `Calificado` al 20% y llega en días.

**6. Compartir el Pixel con la cuenta publicitaria.** Configuración → *Compartir con una cuenta
publicitaria* → Activos conectados → Añadir activos. Sin esto la campaña no puede usarlo.

**7. Revisar la pestaña Diagnóstico** la primera semana. Es donde Meta dice qué está rechazando.

**8. Fase de aprendizaje: 2 a 4 semanas.** Se puede activar la optimización durante ese período,
pero *«es posible que no veas todas las mejoras de rendimiento hasta después»*.

---

## 9. Dónde vive esto en el código

| Qué | Archivo |
|---|---|
| Las cuatro etapas y la carga útil | `apps/api/src/modules/integrations/meta/handlers/lead-stage-changed.handler.ts` |
| Lead recibido, con el corte de 7 días | `apps/api/src/modules/crm/leads/lead-intake.service.ts` |
| Calificado / vendido / descartado | `apps/api/src/modules/crm/leads/use-cases/update-lead.use-case.ts` |
| Venta al convertir en cliente | `apps/api/src/modules/crm/leads/use-cases/convert-lead.use-case.ts` |
| Cola, reintentos y ventana de atribución | `apps/api/src/modules/integrations/meta/meta-conversion-outbox.service.ts` |
| Hasheo y normalización | `apps/api/src/modules/integrations/meta/identificadores-meta.ts` |
| Lista blanca de campos | `apps/api/src/modules/integrations/meta/politica-meta-capi.ts` |
| Pixel y token por empresa | `apps/api/src/modules/integrations/meta/meta-client-pixel.service.ts` |
| `fbc` desde el `fbclid` guardado | `apps/api/src/modules/integrations/meta/atribucion-del-lead.ts` |

### Dos controles que conviene conocer

**Nada sensible sale.** `politica-meta-capi.ts` aplica una lista blanca: lo que no está declarado no
viaja, se registra el bloqueo sin valores y el evento no entra a la cola.
[Información prohibida según Meta](https://www.facebook.com/business/help/1917565658619579).

**Nada de lo que ya no existe sale.** Antes de cada envío se comprueba que el lead siga en el CRM.
Si se borró, el evento queda `expired` sin llamar a Meta. La búsqueda es por UUID, nunca por nombre
ni campaña: la misma persona por dos campañas son dos leads distintos.

También hay un interruptor **«No reportar a Meta»** en la ficha del lead, para pruebas y duplicados
que se quieren conservar sin enseñárselos a la plataforma.

---

## 10. Índice de enlaces oficiales

**La integración**
- [Raíz de Conversion Leads](https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration)
- [1: Conectar tu CRM](https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration/crm-integration/1-connecting-your-crm-with-lead-ads)
- [2: Primeros pasos](https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration/crm-integration/2-getting-started-with-integration)
- [3: Implementación por desarrolladores](https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration/crm-integration/3-implementing-the-crm-integration)
- [5: Configurar el embudo de ventas](https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration/crm-integration/5-configure-your-sales-funnel)
- [6: Pasos de seguimiento](https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration/crm-integration/6-follow-up-steps)
- [Especificación de la carga útil](https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration/payload-specification)

**Conversions API en general**
- [Referencia](https://developers.facebook.com/documentation/ads-commerce/conversions-api)
- [Parámetros de eventos del servidor](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/server-event)
- [Parámetros de información del cliente (hasheo)](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters)
- [Asistente de carga útil](https://developers.facebook.com/documentation/ads-commerce/conversions-api/payload-helper) — para probar antes de mandar
- [Deduplicación de eventos](https://developers.facebook.com/documentation/ads-commerce/conversions-api/deduplicate-pixel-and-server-events)
- [Solución de problemas y códigos de error](https://developers.facebook.com/documentation/ads-commerce/conversions-api/support)
- [Prácticas recomendadas](https://developers.facebook.com/documentation/ads-commerce/conversions-api/best-practices)

**Herramientas**
- [Events Manager](https://www.facebook.com/events_manager2)
- [Administrador de anuncios](https://www.facebook.com/adsmanager/manage/campaigns)
- [Business Suite](https://business.facebook.com/)
- [Estado de la plataforma Meta](https://metastatus.com/)

**Políticas**
- [Información prohibida](https://www.facebook.com/business/help/1917565658619579)
- [Condiciones de la plataforma](https://developers.facebook.com/terms/dfc_platform_terms/)

---

## 11. Pendiente

- **Volumen**: 30 → 200 leads/mes. Decisión de pauta.
- **Separar el Pixel de la empresa de prueba** antes de que empiece el entrenamiento.
- **Encender las alertas de leads parados** (3/5/7 días): son lo que mantiene los leads dentro de
  la ventana de 28 días.
- **Clasificar el embudo en Events Manager** una vez que lleguen los primeros eventos reales.
