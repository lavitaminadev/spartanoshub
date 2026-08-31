# Auditoría — Meta Conversions API for CRM / Conversion Leads

Estado del repositorio auditado: `c2e85ae7` · 31 de agosto de 2026
Documentación de Meta consultada ese mismo día.

**No se modificó código, base de datos ni se envió ningún evento a Meta.** Ningún secreto aparece en
este documento: cuando hace falta nombrar una credencial se nombra solo la variable.

---

## 1. Resumen ejecutivo

La integración **funciona técnicamente** —encola, firma, envía y reintenta— pero **hay un camino de
envío que Meta nunca va a reconocer** como Conversion Leads, y falla por tres motivos a la vez.

Hallazgo principal, `P0`:

`lead-converted.handler.ts:15` declara

```js
const LEADGEN_ID = /^d{15,17}$/;
```

Falta la contrabarra. `d{15,17}` busca la **letra `d` repetida** quince a diecisiete veces, no
dígitos. Comprobado ejecutándolo: contra el `lead_id` real `1779446166725792` devuelve `false`.

Consecuencia: **ese manejador nunca adjunta `lead_id`**. Y en el mismo archivo faltan además
`lead_event_source` y `event_source` en `custom_data`, y usa el nombre estándar `QualifiedLead`.
Tres incumplimientos simultáneos de la especificación. Sus eventos llegan a Events Manager, Meta
responde `events_received: 1`, y **no entrenan nada**.

Es exactamente el caso contra el que advertías: `events_received: 1` no prueba nada.

El otro camino —`lead-stage-changed.handler.ts`, el del embudo comercial— **sí está correcto** tras
los cambios de hoy.

| | |
|---|---|
| Hallazgos P0 | 1 |
| Hallazgos P1 | 4 |
| Hallazgos P2 | 5 |
| Hallazgos P3 | 3 |

---

## 2. Arquitectura encontrada

Dos caminos independientes hacia Meta, con **Pixels distintos y propósitos distintos**:

**Camino A — embudo comercial de la empresa cliente**
`lead-stage-changed.handler.ts` → Pixel de la empresa (`resolveForScope`)
Señal: el prospecto de GRDS avanza. Es el que alimenta Conversion Leads de GRDS.

**Camino B — embudo comercial de la agencia**
`lead-converted.handler.ts` → Pixel propio de Espartanos (`resolveAgencia`)
Señal: Espartanos cerró un cliente nuevo. Es el embudo de la agencia vendiéndose a sí misma.

Que sean dos es **correcto de diseño**: son dos anunciantes distintos con dos conjuntos de datos
distintos. El problema no es que existan, es que el B está roto.

Un tercer emisor, `reservations.service.ts`, manda eventos de reserva por la misma cola.

---

## 3. Flujo real actual

```
Meta Lead Ads
      │
      │  Make (escenario «Leads Facebook a Sheets y API», cada 15 min)
      ▼
POST /api/crm/leads/ingest          lead-ingest.controller.ts
      │                              token de origen, no sesión
      ▼
LeadIntakeService.capture()          lead-intake.service.ts:193
      │  · identificadorExterno() guarda el leadgen_id SIN prefijo
      │  · dedupe por externalLeadId
      │  · retentionReviewAt = +730 días
      ▼
      ├─► emit('lead.received')      ─┐   solo dominio commercial
      └─► emit('lead.created')        │   solo si created === true
                                      │
El equipo mueve la etapa en la ficha  │
      ▼                               │
UpdateLeadUseCase.execute()           │   update-lead.use-case.ts
      ├─► emit('lead.qualified')      │   al pasar a fitStatus qualified
      ├─► emit('lead.won')            │   al entrar en status won
      └─► emit('lead.discarded')      │   al entrar en lost, solo commercial
                                      │
                                      ▼
                     LeadStageChangedHandler          ◄── CAMINO A
                     · excluye lead.excludedFromMeta
                     · exige capacidad metaConversions
                     · respeta campaign.metaCapiEnabled
                     · resuelve Pixel + token por empresa
                     ▼
              MetaConversionOutboxService.enqueue()
                     · Control 1: lista blanca (politica-meta-capi.ts)
                     · hashea em/ph/fn/ln/country/externalId
                     · UNIQUE(organization_id, event_id) → idempotente
                     ▼
              tabla meta_conversion_outbox  (status pending)
                     ▼
              cron cada 5 min · claimBatch() con FOR UPDATE
                     · Control 2: ¿sigue existiendo el lead?
                     · Control 3: ¿dentro de la ventana de 7 días?
                     ▼
              POST graph.facebook.com/v23.0/{pixelId}/events
                     ▼
              ¿events_received >= 1?  ──no──► error, reintento exponencial
                     │ sí                      máx. 8 intentos → failed
                     ▼
              status processed
```

**Lo que no existe en el flujo:** nada crítico falta. La cadena está completa.

---

## 4. Archivos involucrados

| Archivo | Función |
|---|---|
| `modules/crm/leads/lead-intake.service.ts` | Entrada del lead, guarda `externalLeadId`, emite `lead.received` |
| `modules/crm/leads/identificador-externo.ts` | Decide si el id lleva prefijo. `meta_lead_ads` va sin él |
| `modules/crm/leads/use-cases/update-lead.use-case.ts` | Emite `qualified` / `won` / `discarded` |
| `modules/crm/leads/use-cases/convert-lead.use-case.ts` | Emite `converted` y `won` |
| `modules/integrations/meta/handlers/lead-stage-changed.handler.ts` | **Camino A** — payload del embudo |
| `modules/integrations/meta/handlers/lead-converted.handler.ts` | **Camino B** — el que está roto |
| `modules/integrations/meta/meta-conversion-outbox.service.ts` | Cola, lista blanca, hasheo, controles |
| `modules/integrations/meta/meta-conversions.service.ts` | Construye el JSON y hace el POST |
| `modules/integrations/meta/identificadores-meta.ts` | Normalización y SHA-256 |
| `modules/integrations/meta/politica-meta-capi.ts` | Lista blanca deny-by-default |
| `modules/integrations/meta/meta-client-pixel.service.ts` | Resuelve Pixel y token por empresa |
| `modules/integrations/meta/region-del-lead.ts` | Extrae la región del formulario |
| `modules/integrations/meta/atribucion-del-lead.ts` | `fbc` / `fbp` / IP / navegador |
| `modules/integrations/meta/origen-del-evento.ts` | Saca el UUID del lead desde el `event_id` |
| `core/outbox/outbox-processor.base.ts` | Toma de lote, bloqueo, reintentos |
| `core/jobs/job-scheduler.service.ts` | Programa el vaciado cada 5 minutos |

**Variables de entorno**, con su uso:

| Variable | Uso | Correcto |
|---|---|---|
| `META_GRAPH_API_VERSION` | versión de Graph, por defecto `v23.0` | ✅ |
| `META_CONVERSIONS_ACCESS_TOKEN` | token de respaldo del entorno | ⚠️ ver §21 |
| `META_TEST_EVENT_CODE` | código de prueba | 🔴 ver §20 |
| `INTEGRATION_ENCRYPTION_KEY` | cifra los tokens en la base | ✅ |

---

## 5. Tablas y estructura

**`meta_conversion_outbox`** — `meta-conversion-outbox.entity.ts`

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `organization_id` | uuid | |
| `event_id` | varchar(255) | **UNIQUE junto a organization_id** |
| `pixel_id` | varchar(255) | destino, resuelto al encolar |
| `event_data` | json | payload ya hasheado |
| `status` | varchar(20) | `pending` `retry` `processing` `processed` `failed` `expired` |
| `attempts` | int | |
| `next_attempt_at` | timestamp | espera exponencial |
| `last_error` | text | saneado de credenciales |
| `processed_at` | timestamp | |

`@Index('UQ_meta_conversion_event', ['organizationId','eventId'], { unique: true })` — **es la
garantía de idempotencia**, y está a nivel de base de datos, no de aplicación.

**`leads.external_lead_id`** — `varchar(255) NULL`. Ver §7.

---

## 6. Auditoría del payload

Construcción en `meta-conversions.service.ts:58-92`. La forma general es correcta: `data` array,
`access_token` en el cuerpo, campos en `snake_case`, `user_data` y `custom_data` anidados.

Un detalle correcto que merece nombrarse: el JSON se arma **campo por campo**, nunca con
propagación de objeto. Eso es lo que impide que un campo nuevo del CRM llegue a Meta por accidente.

---

## 7. Auditoría del `lead_id`

### Recorrido

1. **Origen** — Make lo entrega desde el campo `id` del módulo Facebook Lead Ads. Es el
   `leadgen_id` del webhook.
2. **Entrada** — llega como `idExterno` en el DTO. `ingest-lead.dto.ts:46`, `@IsString()`.
3. **Normalización** — `identificadorExterno(source, idExterno)`. Para `meta_lead_ads` está en
   `IDENTIFICADORES_GLOBALES`, así que **se guarda tal cual, sin prefijo**. Correcto: el prefijo lo
   invalidaría.
4. **Almacenamiento** — `external_lead_id varchar(255)`. **Cadena, nunca número.**
5. **Envío** — `lead_id: leadId` sin hashear.

### Precisión numérica

**Sin riesgo.** Un `leadgen_id` de 16-17 dígitos supera `Number.MAX_SAFE_INTEGER`
(9.007.199.254.740.991, 16 dígitos). Convertirlo a `Number` **perdería precisión silenciosamente**.

Busqué `Number(` y `parseInt(` sobre cualquier variante de lead id en todo el backend: **ninguna
coincidencia**. El único `Number()` cercano es sobre `estimatedAmount`, que es un importe.

La columna es `varchar` y el tipo TypeScript es `string` de punta a punta.

### Confusión entre identificadores

Comprobado que no se mezclan. Cada uno tiene su columna:

| Concepto | Columna | Va a Meta |
|---|---|---|
| Facebook Lead ID | `external_lead_id` | ✅ como `lead_id` |
| ID interno del CRM | `id` (uuid) | ✅ como `external_id`, hasheado |
| Form ID | `external_form_id` | ❌ |
| Page ID | `page_id` | ❌ |
| Campaign ID | `external_campaign_id` | ❌ |
| Ad ID / Ad Set ID | `metadata` | ❌ |

### Validación de forma

Camino A, `lead-stage-changed.handler.ts:85` — `/^\d{15,17}$/` **correcto**.

Camino B, `lead-converted.handler.ts:15` — `/^d{15,17}$/` **ROTO**.

### Evidencia en producción

```
origen                    source          leads  con_lead_id_valido  con_prefijo
FRANQUICIAS-MAY2026-GRDS  meta_lead_ads      29                  29            0
```

29 de 29 válidos, cero con prefijo.

### Conclusión

> **FACEBOOK LEAD ID: CORRECTO en el camino A · INCORRECTO en el camino B**

El almacenamiento y el transporte son impecables. El fallo está en una sola validación mal escrita
que descarta todos los identificadores buenos.

---

## 8. Auditoría de parámetros

### Petición principal

| Parámetro | Requerido | Implementado | Valor | Estado | Problema |
|---|---|---|---|---|---|
| `data` | Sí | ✅ | array de 1 | 🟢 | |
| `access_token` | Sí | ✅ | por Pixel, cifrado | 🟢 | |
| `test_event_code` | No | ✅ | env global | 🔴 | Ver §20 |

### Evento de servidor

| Parámetro | Requerido | Implementado | Valor actual | Estado |
|---|---|---|---|---|
| `event_name` | **Sí** | ✅ | A: `Lead recibido`/`Calificado`/`Vendido`/`Descartado` · B: `QualifiedLead` | A 🟢 · B 🔴 |
| `event_time` | **Sí** | ✅ | `Date.now()` | 🟠 §10 |
| `action_source` | **Sí** | ✅ | `system_generated` | 🟢 §5 |
| `user_data` | **Sí** | ✅ | ver abajo | 🟢 |
| `event_id` | Recomendado | ✅ | estable por lead+etapa | 🟢 §11 |
| `event_source_url` | Solo web | ⚪ | ausente | 🟢 correcto omitirlo |

### `user_data`

| Parámetro | Prioridad Meta | Implementado | Hash | Estado |
|---|---|---|---|---|
| `lead_id` | **Más alta** | A ✅ · B 🔴 | **sin hash** ✅ | A 🟢 · B 🔴 |
| `fbc` | Más alta | ✅ cuando existe | sin hash ✅ | 🟢 |
| `em` | Más alta | ✅ | SHA-256 ✅ | 🟢 |
| `ph` | Alta | ✅ | SHA-256 ✅ | 🟢 |
| `fn` / `ln` | Media | ✅ | SHA-256 ✅ | 🟢 |
| `country` | Media | ✅ `cl` | SHA-256 ✅ | 🟢 |
| `st` | Media | ✅ región del formulario | SHA-256 ✅ | 🟢 |
| `ct` | Media | ⚪ | — | 🟡 el CRM no la guarda |
| `zp` `db` `ge` | Media | ⚪ | — | 🟢 no se piden |
| `external_id` | — | ✅ uuid interno | SHA-256 ✅ | 🟢 |
| `fbp` | Apoyo | ✅ | sin hash ✅ | 🟢 |
| `client_ip_address` | Apoyo | ✅ | sin hash ✅ | 🟢 |
| `client_user_agent` | Apoyo | ✅ | sin hash ✅ | 🟢 |

### `custom_data`

| Parámetro | Requerido | Camino A | Camino B | Estado |
|---|---|---|---|---|
| `event_source` | **Sí, valor `crm`** | ✅ | 🔴 **ausente** | B incumple |
| `lead_event_source` | **Sí** | ✅ `Espartanos` | 🔴 **ausente** | B incumple |
| `value` | Condicional | solo en venta | retainer del cliente | 🟠 §8 |
| `currency` | Con `value` | ✅ CLP | ✅ CLP | 🟢 |
| `content_ids` `content_type` | No | reservas | — | 🟢 |

> *"Abre cada evento en Events Manager y revisa que tengan los parámetros personalizados
> `lead_event_source` y `event_source`. **Si el evento no tiene estos parámetros, no se registrará
> como evento de clientes potenciales de conversión.**"*

---

## 9. `action_source`

**Valor actual: `system_generated` en los dos caminos.**

La especificación de Conversion Leads lo fija sin margen:

> `action_source` · **Valor: `system_generated`** · Obligatorio.
> "Establezca este parámetro en el valor `system_generated` para **todos** los eventos de
> conversión de clientes potenciales."

No distingue entre cambio manual y automático. **Aplica a los seis casos que planteas** —cambio
manual del vendedor, cambio automático, calificación, visita agendada, venta y evento interno—
porque lo que describe es de dónde sale la **conversión**, no quién movió la ficha. La conversión
la genera el sistema al detectar la transición.

> **Conclusión: CORRECTO. 🟢** Y no por que Meta lo aceptara, sino porque la spec lo exige literal.

---

## 10. `event_time`

**Todos los emisores usan `Math.floor(Date.now() / 1000)`.**

Es el momento en que se **encola**, no el momento en que ocurrió la transición.

> `event_time` · "Una marca de tiempo de UNIX en segundos que indica **cuándo tu CRM actualizó** el
> evento de actualización de la etapa."

**En la práctica el desfase es de milisegundos**, porque el evento se emite dentro del mismo
`execute()` que escribe el cambio. No hay cola intermedia entre la transición y el `enqueue`.

Riesgo real, y es acotado:

- **Reintentos** — el `event_time` se conserva del encolado original, no se refresca. ✅ correcto.
- **Reencolado manual** (`reintentar()`) — conserva el `event_time` viejo. Si el evento lleva más
  de 7 días parado, el control de caducidad lo marca `expired` antes de enviarlo. ✅
- **Importación histórica** — cubierto: los leads importados no emiten `lead.received`.

**Lo que sí es una oportunidad perdida:** la columna `stage_changed_at` existe y guarda el momento
real de la transición. Usarla sería más fiel, y sería lo correcto el día que haya procesamiento por
lotes. Hoy no cambia nada.

> **🟡 MEJORABLE, no urgente.**

---

## 11. `event_id`

**Estrategia actual, camino A:** `lead-{etapa}:{uuid}` — `lead-calificacion:92c453b7-…`
**Camino B:** `lead-converted:{uuid}:{clientId}`

| Propiedad | Cumple | Por qué |
|---|---|---|
| Unicidad | ✅ | uuid + etapa |
| Estabilidad | ✅ | no lleva fecha ni azar |
| Idempotencia | ✅ | `UNIQUE(organization_id, event_id)` |
| Reintentos | ✅ | el id no cambia, Meta deduplica |
| Volver atrás y reavanzar | ⚠️ | ver abajo |

### La distinción que pides

**No las estamos mezclando, y conviene dejarlo escrito:**

- **Deduplicación Pixel ↔ CAPI** — es de Meta, y aplica cuando el mismo hecho llega por navegador
  y por servidor. **Aquí no aplica**: estos eventos solo existen en el servidor, no hay Pixel de
  navegador emitiendo un `Calificado`.
- **Idempotencia de nuestra outbox** — es nuestra, y la garantiza el índice UNIQUE. Es lo que
  impide que un doble clic encole dos filas.

El `event_id` sirve a las dos, pero **el mecanismo que nos protege hoy es el índice**, no la
deduplicación de Meta.

### El caso que no cubre

Un lead que se califica, se descalifica y se vuelve a calificar produce el **mismo** `event_id`. La
segunda calificación **no se envía**.

¿Es correcto? **Sí, para Conversion Leads.** Meta quiere saber que el lead alcanzó la etapa, no
cuántas veces. Enviar dos calificaciones del mismo lead inflaría el numerador de la tasa de
conversión. Es una decisión, no un descuido — pero **no estaba documentada**.

> **🟢 CORRECTO**, con la salvedad documentada.

---

## 12. Duplicados e idempotencia

| Escenario | ¿Duplica? | Por qué |
|---|---|---|
| Doble clic en Guardar | ❌ | `event_id` estable + UNIQUE |
| Petición repetida | ❌ | ídem |
| Reintento del worker | ❌ | misma fila, mismo id |
| Timeout y reenvío | ❌ | Meta deduplica por `event_id` |
| Dos workers a la vez | ❌ | ver §13 |
| Reinicio del servidor | ❌ | filas `processing` viejas vuelven a `retry` a los 10 min |
| Webhook repetido de Make | ❌ | dedupe por `external_lead_id` en la ingesta |
| Guardar sin cambio de etapa | ❌ | los emisores comparan `etapaPrevia !== status` |

**No puede ocurrir `Calificado` · `Calificado` · `Calificado`** para el mismo cambio. La garantía es
de base de datos.

---

## 13. Outbox y reintentos

### Carrera entre workers

**No puede ocurrir.** `claimBatch()` en `outbox-processor.base.ts:148`:

```js
return this.repository.manager.transaction(async (manager) => {
  const items = await repository.find({ …, lock: { mode: 'pessimistic_write' } });
  await repository.update(items.map(i => i.id), { status: 'processing' });
});
```

`pessimistic_write` es `SELECT … FOR UPDATE`. El worker B se bloquea hasta que A confirma, y
entonces ya ve `processing` y no las toma. La marca y la lectura van **en la misma transacción**.

El comentario del archivo advierte además que el bloqueo exige transacción abierta, porque sobre un
`find` suelto TypeORM lanza `PessimisticLockTransactionRequiredError` y la cola se detiene sin
error visible.

### Política de reintentos actual

| Aspecto | Valor | Evaluación |
|---|---|---|
| Máximo | 8 intentos | 🟢 |
| Espera | exponencial, techo 1 h | 🟢 |
| Lote | 25 por pasada | 🟢 |
| Frecuencia | cada 5 min | 🟢 |
| Claim caducado | 10 min | 🟢 |
| Token revocado | no reintenta | 🟢 |
| Fuera de ventana | `expired` sin gastar intentos | 🟢 |
| Reintento manual | `POST conversions/outbox/reintentar` | 🟢 |

**No hay riesgo de bucle infinito, ni de bloqueo de cola, ni de pérdida silenciosa.**

Un detalle correcto: `events_received < 1` con HTTP 200 se trata como fallo. Meta responde 200 y
descarta el evento en algunos casos, y sin esto quedaría marcado como enviado.

---

## 14. Estados reales del CRM

De `packages/shared/src/types/lead.ts` — fuente única.

**Embudo comercial:** `new` · `contacted` · `meeting_scheduled` · `quote_sent` · `negotiation` ·
`won` · `lost`

**Ciclo de reserva:** `new` · `reserved` · `attended` · `no_show` · `lost`

**Calificación**, eje independiente de la etapa: `review` · `in_review` · `qualified` · `sold` ·
`unqualified`

> Nota: **no existen** los estados «Pendiente», «Asignado», «No responde», «Seguimiento» ni «Visita
> realizada» que planteabas. Lo más parecido a «Visita agendada» es `meeting_scheduled`, y
> «realizada» sería `negotiation`.

---

## 15. Eventos CAPI reales

| Estado o transición | `event_name` | Código |
|---|---|---|
| Lead entra al CRM | `Lead recibido` | `lead-stage-changed.handler.ts:69` |
| `fitStatus` → `qualified` | `Calificado` | `:70` |
| `status` → `won` | `Vendido` (+ arrastra `Calificado`) | `:71` |
| `status` → `lost`, commercial | `Descartado` | `:72` |
| Lead convertido en cliente | `QualifiedLead` | `lead-converted.handler.ts:111` 🔴 |
| Reservas | `Schedule` · `Purchase` · otros | `reservations.service.ts` |

### Nomenclatura

**Camino A: consistente.** Los cuatro salen de una constante única, `ETAPAS`, con el comentario de
que cambiarlos parte el histórico.

**Riesgo real de coexistencia:** `QualifiedLead` del camino B y `Calificado` del camino A son
conceptualmente lo mismo y viajan a **Pixels distintos**, así que hoy no colisionan. Pero si alguna
vez apuntaran al mismo, Meta los vería como dos etapas separadas.

Sobre tildes y espacios: `Lead recibido` lleva espacio, `Calificado` no lleva tilde. **La spec dice
"campo sin formato"** y no impone restricciones. No es un problema, pero conviene que **nadie los
edite nunca** — están documentados como tales.

---

## 16. Configure Sales Funnel — qué espera Meta

De la [guía oficial del paso 5](https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration/crm-integration/5-configure-your-sales-funnel):

1. Los eventos del CRM aparecen como etapas en Events Manager
2. Se eliminan los que no correspondan y se ordenan según el embudo real
3. Se clasifican en **dos grupos**:
   - **Etapas positivas** — "eventos que representan clientes potenciales de calidad"
   - **Otras etapas** — "eventos que no representan un cliente potencial de calidad"
4. Se ordenan reflejando el orden real
5. **Objetivo de optimización:** "selecciona la **etapa principal más temprana** para la que
   optimizar. No necesita ser la última etapa del embudo. El sistema se optimiza para todas."

> "Si compartes una cantidad adecuada de etapas de eventos, es posible que Meta use IA para generar
> un embudo de ventas para ti."

---

## 17. Positive Stages recomendadas

| Orden | Estado Spartanoshub | Evento Meta | Grupo | ¿Optimizar? | Motivo |
|---|---|---|---|---|---|
| 1 | entrada al CRM | `Lead recibido` | primera etapa | No | Es el **denominador**. Sin él la tasa de conversión no se puede calcular |
| 2 | `fitStatus = qualified` | `Calificado` | **Positiva** | ✅ **Sí** | Juicio humano que no se deduce de ningún comportamiento |
| 3 | `status = won` | `Vendido` | **Positiva** | No | Tarda meses y hay muy pocos |
| — | `status = lost` | `Descartado` | Otras | No | Contraste |

---

## 18. Other Stages recomendadas

**Solo `Descartado`.**

Y explícitamente **no enviar**: `contacted`, `meeting_scheduled`, `quote_sent`, `negotiation`,
`reserved`, `attended`, `no_show`.

El motivo no es solo ruido. Es que **la etapa que optimizas debe convertir entre 1% y 40%**. Si
`Contactado` cubriera el 90% de los leads y se marcara positiva, quedaría fuera del rango y Meta la
ignoraría.

Sobre tu pregunta de eventos negativos —`No calificado`, `No responde`, `Perdido`, `Cancelado`—:
el único que existe como estado es `lost`, y va en «otras etapas». Los demás no existen y **no hay
que inventarlos**.

---

## 19. Evento recomendado para optimización

### **`Calificado`.**

**Justificación documental:** Meta pide "la etapa principal más temprana", y exige que la etapa
optimizada ocurra dentro de 28 días con una tasa entre 1% y 40%.

**Justificación con tus datos reales** (agosto 2026, único mes con historia):

| Métrica | Valor | Requisito | |
|---|---|---|---|
| Leads en el mes | 30 | 200 | ❌ |
| De Lead Ads | 27 | — | |
| Con `lead_id` válido | 29 de 29 | recomendado | ✅ |
| `fitStatus = qualified` | 6 | — | |
| **Tasa de calificación** | **20%** | 1%–40% | ✅ |
| `status = won` | 1 → 3,3% | 1%–40% | ✅ pero pocos |
| `status = lost` | 1 → 3,3% | — | |

**Distribución de etapas:** `new` 93,3% · `won` 3,3% · `lost` 3,3%.

> **Advertencia sobre estos números:** son de **un solo mes** y en su mayoría datos de prueba
> (`demo3`, `Demo2`, `aaaa`). El 20% es real como cálculo pero **no es una tasa consolidada**. No
> extrapoles.

`Vendido` queda descartado como objetivo: 3,3% y un ciclo que puede superar los 28 días.

---

## 20. Errores y riesgos

### 🔴 P0-1 — Regex roto anula el `lead_id` del camino B

`lead-converted.handler.ts:15`. Ver §7. **Ningún evento de ese camino lleva `lead_id`.**

### 🟠 P1-1 — El camino B no lleva `lead_event_source` ni `event_source`

`lead-converted.handler.ts:127-130`. Sin esos dos campos, la spec dice que el evento **no se
registra como Conversion Leads**. Sumado al P0, ese camino está triplemente invisible.

### 🟠 P1-2 — El camino B usa un nombre de evento estándar

`QualifiedLead`. Es la misma causa raíz del `code=100 subcode=2804010` que ya corregimos en el
camino A. Aquí no ha estallado porque no lleva `value` obligatorio, pero es la misma trampa.

### 🟠 P1-3 — `test_event_code` es global

`meta-conversions.service.ts:91` lo añade **a todos los eventos** si la variable existe. No hay
distinción entre entorno de prueba y producción, ni entre Pixel de prueba y real.

Meta advierte: *"El campo `test_event_code` solo debe usarse para realizar pruebas. Es necesario que
lo elimines cuando envías tu carga útil de producción."* Y añade que esos eventos **sí entran** en
el sistema y se usan para segmentación.

**Verificado que hoy no está puesta en el `.env.example`**, así que no está activa. Pero un
despliegue con esa variable contaminaría toda la producción.

### 🟠 P1-4 — El camino B manda el importe del retainer

`lead-converted.handler.ts:129` → `value: client.retainerAmount`. Es **cuánto le cobra Espartanos a
ese cliente**. Ver §8 de minimización.

### 🟡 P2 — Cinco puntos menores

- `event_time` usa `Date.now()` en vez de `stage_changed_at` (§10)
- `ct` (ciudad) no se envía aunque el formulario podría pedirla
- El camino B no respeta `lead.excludedFromMeta` — solo lo comprueba el camino A
- El camino B no valida la ventana de 7 días con `sourceCreatedAt`
- Nombres de evento con espacio y sin tilde, sin norma escrita

### ⚪ P3

- El `event_id` que no reenvía una recalificación no estaba documentado
- No hay métrica de EMQ observable desde la aplicación
- El camino B duplica lógica que el A ya resolvió mejor

---

## 21. Seguridad

| Comprobación | Resultado |
|---|---|
| Token en el frontend | ✅ **No**. Ninguna referencia en `apps/web` |
| Token en la base | ✅ Cifrado, prefijo `enc:v1:` |
| Token en logs | ✅ Saneado desde hoy (`sin-credenciales.ts`) |
| Token enviado desde el navegador | ✅ No |
| Endpoints con permisos | ✅ `@Roles` + `@ModuleScope('integrations')` |
| ¿Un usuario puede fabricar eventos? | ⚠️ Ver abajo |
| Endpoints públicos | ✅ Solo la ingesta, con token de origen |
| Validación del cambio de etapa | ✅ `isStatusInDomain` |

**El punto que merece atención:** `meta-pixel.controller.ts:252` expone un endpoint de evento de
prueba. Está protegido por rol y **exige `META_TEST_EVENT_CODE`**, lo que impide usarlo contra
producción sin esa variable. Es una defensa correcta, pero depende de que la variable no exista en
producción — la misma condición que el P1-3.

**Multicliente**, tu pregunta 22: el riesgo *"lead de A → Pixel de B"* **está cerrado**.
`resolveForScope()` resuelve por `clientId`, y el comentario del archivo documenta que antes se
recorrían las credenciales de todas las empresas y se tomaba la primera coincidencia, con lo que
"cuál se usaba dependía del orden de las claves en un JSON". Eso ya se corrigió.

**Lo que sí sigue abierto y no es de código:** GRDS y la empresa de prueba **comparten el Pixel
`911449224635876`**. Los datos de prueba entran al conjunto de datos de un cliente real.

---

## 22. Consultas SQL de comprobación

Todas de solo lectura.

```sql
-- Últimos eventos encolados
SELECT event_id, pixel_id, status, attempts,
       JSON_UNQUOTE(JSON_EXTRACT(event_data,'$.eventName')) AS evento,
       FROM_UNIXTIME(JSON_EXTRACT(event_data,'$.eventTime')) AS ocurrio,
       created_at, processed_at, LEFT(COALESCE(last_error,''),120) AS error
FROM meta_conversion_outbox
ORDER BY created_at DESC LIMIT 40;
```

```sql
-- Reparto por evento y estado
SELECT JSON_UNQUOTE(JSON_EXTRACT(event_data,'$.eventName')) AS evento,
       status, COUNT(*) AS n
FROM meta_conversion_outbox
GROUP BY evento, status ORDER BY evento, status;
```

```sql
-- Eventos SIN lead_id: los que Meta no reconoce para Conversion Leads
SELECT JSON_UNQUOTE(JSON_EXTRACT(event_data,'$.eventName')) AS evento,
       COUNT(*) AS total,
       SUM(JSON_EXTRACT(event_data,'$.userData.lead_id') IS NULL) AS sin_lead_id
FROM meta_conversion_outbox
GROUP BY evento;
```

```sql
-- ¿Falta lead_event_source o event_source en algún evento?
SELECT JSON_UNQUOTE(JSON_EXTRACT(event_data,'$.eventName')) AS evento, COUNT(*) AS incompletos
FROM meta_conversion_outbox
WHERE JSON_EXTRACT(event_data,'$.customData.leadEventSource') IS NULL
   OR JSON_EXTRACT(event_data,'$.customData.eventSource') IS NULL
GROUP BY evento;
```

```sql
-- Duplicados: no debería devolver ninguna fila
SELECT organization_id, event_id, COUNT(*) AS veces
FROM meta_conversion_outbox
GROUP BY organization_id, event_id HAVING COUNT(*) > 1;
```

```sql
-- Eventos por lead
SELECT SUBSTRING_INDEX(event_id, ':', -1) AS lead_uuid,
       GROUP_CONCAT(JSON_UNQUOTE(JSON_EXTRACT(event_data,'$.eventName')) ORDER BY created_at) AS recorrido
FROM meta_conversion_outbox
WHERE event_id LIKE 'lead-%'
GROUP BY lead_uuid ORDER BY COUNT(*) DESC LIMIT 25;
```

```sql
-- Embudo real, últimos 90 días
SELECT COUNT(*) AS leads,
       SUM(status <> 'new') AS movidos,
       SUM(fit_status = 'qualified') AS calificados,
       SUM(status = 'meeting_scheduled') AS con_reunion,
       SUM(status = 'won') AS vendidos,
       SUM(status = 'lost') AS perdidos,
       ROUND(100*SUM(fit_status='qualified')/COUNT(*),1) AS pct_calificados
FROM leads
WHERE domain = 'commercial' AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY);
```

```sql
-- Tiempo de lead a calificación y a venta
SELECT AVG(DATEDIFF(stage_changed_at, created_at)) AS dias_promedio,
       MAX(DATEDIFF(stage_changed_at, created_at)) AS peor_caso,
       SUM(DATEDIFF(stage_changed_at, created_at) > 28) AS fuera_de_ventana
FROM leads
WHERE domain='commercial' AND stage_changed_at IS NOT NULL
  AND fit_status IN ('qualified','sold');
```

```sql
-- Pixels en uso: detecta empresas compartiendo destino
SELECT pixel_id, COUNT(*) AS eventos, COUNT(DISTINCT organization_id) AS organizaciones
FROM meta_conversion_outbox GROUP BY pixel_id;
```

---

## 23. Payload final recomendado

### `Calificado`

```json
{
  "event_name": "Calificado",
  "event_time": 1756654200,
  "action_source": "system_generated",
  "event_id": "lead-calificacion:92c453b7-f04c-4529-afd4-e6c8d976777e",
  "user_data": {
    "lead_id": "1779446166725792",
    "em": ["<sha256>"],
    "ph": ["<sha256>"],
    "fn": ["<sha256>"],
    "ln": ["<sha256>"],
    "st": ["<sha256>"],
    "country": ["<sha256>"],
    "external_id": ["<sha256>"],
    "fbc": "fb.1.1756500000000.IwAR...",
    "fbp": "fb.1.1756500000000.1098115397",
    "client_ip_address": "…",
    "client_user_agent": "…"
  },
  "custom_data": {
    "lead_event_source": "Espartanos",
    "event_source": "crm"
  }
}
```

| Parámetro | Clasificación |
|---|---|
| `event_name` `event_time` `action_source` `user_data` | **OBLIGATORIO** |
| `lead_event_source` `event_source` | **OBLIGATORIO** para Conversion Leads |
| `lead_id` | **RECOMENDADO** — prioridad más alta de Meta |
| `event_id` | RECOMENDADO — idempotencia |
| `em` `ph` `fbc` | RECOMENDADO — emparejamiento |
| `fn` `ln` `st` `country` `external_id` `fbp` IP UA | OPCIONAL — suman EMQ, ya se tienen |
| `value` `currency` | **NO NECESARIO** en calificación |
| `event_source_url` | **NO CORRESPONDE** — es de web |

### `Visita agendada`

**No procede.** El estado `meeting_scheduled` existe en el CRM pero **no se envía a Meta, y no debe
enviarse** — ver §18. El payload que probaste con ese nombre corresponde a una etapa que la
recomendación descarta.

---

## 24. Tabla actual vs Meta

| Tema | Actualmente | Meta recomienda | Estado | Acción |
|---|---|---|---|---|
| `lead_id` camino A | validado y enviado | recomendado | 🟢 | — |
| `lead_id` camino B | **regex roto, nunca viaja** | recomendado | 🔴 | Añadir la contrabarra |
| `event_name` A | nombres de etapa libres | campo sin formato | 🟢 | — |
| `event_name` B | `QualifiedLead` estándar | libre | 🔴 | Renombrar |
| `event_time` | `Date.now()` | cuando el CRM actualizó | 🟡 | Usar `stage_changed_at` |
| `event_id` | estable por lead+etapa | recomendado | 🟢 | Documentar la recalificación |
| `action_source` | `system_generated` | `system_generated` | 🟢 | — |
| `event_source` A | `crm` | `crm` | 🟢 | — |
| `event_source` B | **ausente** | obligatorio | 🔴 | Añadir |
| `lead_event_source` A | `Espartanos` | nombre del CRM | 🟢 | — |
| `lead_event_source` B | **ausente** | obligatorio | 🔴 | Añadir |
| Hasheo | correcto por campo | según tabla oficial | 🟢 | — |
| `custom_data` | lista blanca | mínimo necesario | 🟢 | Revisar `value` del B |
| Etapas del embudo | 4 en A | todas las que uses | 🟢 | Configurar en Events Manager |
| Etapas positivas | sin configurar | positivas vs otras | ⚪ | Tarea tuya |
| Etapa de optimización | sin configurar | la más temprana de calidad | ⚪ | `Calificado` |
| Reintentos | 8, exponencial | recomendado | 🟢 | — |
| Idempotencia | UNIQUE en DB | — | 🟢 | — |
| Outbox | bloqueo pesimista | — | 🟢 | — |
| `test_event_code` | global por entorno | solo pruebas | 🟠 | Acotar a Pixel de prueba |
| Dataset por empresa | `resolveForScope` | uno por anunciante | 🟢 | Separar el de prueba |
| Versión Graph | `v23.0` | actual | 🟢 | Vigilar caducidad |

---

## 25. Prioridades

**P0 — antes de activar nada**
1. `lead-converted.handler.ts:15` — la contrabarra del regex

**P1 — antes de que entren leads reales**
2. Añadir `lead_event_source` y `event_source` al camino B
3. Cambiar `QualifiedLead` por un nombre de etapa libre
4. Acotar `test_event_code` al Pixel de pruebas
5. Decidir si el retainer debe viajar como `value`

**P2 — cuando haya volumen**
6. `event_time` desde `stage_changed_at`
7. Que el camino B respete `excludedFromMeta` y la ventana de 7 días
8. Mapear `ct` si el formulario pide comuna

**P3 — deuda**
9. Documentar la decisión de no reenviar recalificaciones
10. Unificar los dos manejadores
11. Exponer el EMQ en la pantalla de diagnóstico

---

## 26. Veredicto

| | Pregunta | Respuesta |
|---|---|---|
| **A** | ¿CAPI funciona técnicamente? | **PARCIALMENTE** — camino A sí, camino B envía pero no cuenta |
| **B** | ¿El payload cumple la documentación? | **PARCIALMENTE** — A sí, B incumple tres requisitos |
| **C** | ¿`lead_id` correcto? | **PARCIALMENTE** — correcto en A, roto en B |
| **D** | ¿`action_source` correcto? | **SÍ** — la spec lo fija literal para todos los casos |
| **E** | ¿`event_source` y `lead_event_source` bien usados? | **PARCIALMENTE** — ausentes en B |
| **F** | ¿PII bien tratada? | **SÍ** — hasheo por campo correcto, `lead_id` sin hash |
| **G** | ¿Riesgo de mandar información innecesaria? | **SÍ** — el retainer del cliente en B |
| **H** | ¿La outbox evita duplicados? | **SÍ** — UNIQUE + bloqueo pesimista |
| **I** | ¿Eventos bien mapeados? | **PARCIALMENTE** — A sí, B duplica conceptos |
| **J** | ¿Se puede configurar el Sales Funnel hoy? | **SÍ**, con las cuatro etapas del camino A |
| **K** | Primera Positive Stage | **`Calificado`** — `fitStatus = 'qualified'` |
| **L** | Evento de optimización | **`Calificado`** — 20% de tasa, dentro del rango 1-40%, ocurre en días. Pero **no calificas todavía**: 30 leads/mes contra 200 exigidos |
| **M** | Qué NO enviar | `retainerAmount` · respuestas del formulario · `discardReason` · notas · `qualityScore` · etapas intermedias · `test_event_code` en producción |
| **N** | Qué corregir antes de producción | P0-1 · P1-1 · P1-2 · P1-3 · P1-4, en ese orden |

---

## 27. Plan de corrección

**Bloque 1 — una línea, alto impacto**
`lead-converted.handler.ts:15`: `/^d{15,17}$/` → `/^\d{15,17}$/`. Con una prueba que use un
identificador real de 16 dígitos, porque este fallo existe **precisamente porque no había ninguna**.

**Bloque 2 — cumplir la spec en el camino B**
Añadir los dos campos de `custom_data`, cambiar el nombre del evento, y decidir sobre el `value`.

**Bloque 3 — cerrar el `test_event_code`**
Que solo se añada cuando el Pixel destino sea el declarado como de pruebas.

**Bloque 4 — fidelidad temporal**
`event_time` desde `stage_changed_at`.

**Bloque 5 — tuyo, en Events Manager**
Separar el Pixel de la empresa de prueba · generar el token desde la guía de CRM · clasificar el
embudo · optimizar a `Calificado` · compartir el Pixel con la cuenta publicitaria.

---

## Anexo — Fuentes oficiales

- [Conversions API for CRM integration](https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration)
- [3: Implementación por desarrolladores](https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration/crm-integration/3-implementing-the-crm-integration)
- [5: Configurar el embudo de ventas](https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration/crm-integration/5-configure-your-sales-funnel)
- [6: Pasos de seguimiento](https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration/crm-integration/6-follow-up-steps)
- [Especificación de la carga útil](https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration/payload-specification)
- [Parámetros de eventos del servidor](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/server-event)
- [Parámetros de información del cliente](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters)
- [Deduplicación](https://developers.facebook.com/documentation/ads-commerce/conversions-api/deduplicate-pixel-and-server-events)
- [Uso de la API](https://developers.facebook.com/documentation/ads-commerce/conversions-api/using-the-api)
