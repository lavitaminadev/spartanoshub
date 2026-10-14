# Auditoría forense Fase 4 — Filtros, consultas y datos desaprovechados

**Fecha:** 14 de octubre de 2026
**Código:** `spartanoshub-deploy-update`, commit `f3ed9d4ee`, rama `main` (7 de octubre de 2026)
**Alcance:** lectura. Sin modificaciones, sin migraciones, sin consultas a producción.
**Revisión 2** — incorpora las correcciones del anexo final. Lo corregido se señala en §12.

Antecedentes: [`AUDITORIA-META-2026-10-14.md`](./AUDITORIA-META-2026-10-14.md) y
[`AUDITORIA-FASE3-PLATAFORMA-2026-10-14.md`](./AUDITORIA-FASE3-PLATAFORMA-2026-10-14.md).
No se tomaron como prueba: todo se verificó de nuevo en el código.

---

## 1. Resumen ejecutivo

El sistema **guarda más de lo que deja filtrar**, y ésa sigue siendo la conclusión central.

Una reserva guarda `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `gclid`, `fbclid`,
`fbc` y `fbp` **como columnas reales**, y el filtro de reservas no expone ninguna. El dato de qué
campaña trajo cada reserva está en la fila y no se puede preguntar desde la aplicación.

Ese filtro **no depende de ninguna otra corrección**: filtrar reservas por su propia columna no
toca leads ni encuestas. Es el cambio de menor costo y mayor beneficio de esta auditoría.

El CRM filtra por anuncio y plataforma con `JSON_EXTRACT` sobre una columna sin índice. **Eso es un
riesgo de rendimiento no demostrado**, no un defecto probado: no se midió nada.

No se encontró fuga entre organizaciones en los módulos verificados. El alcance de esa verificación
se precisa en §9: no es el sistema entero.

La pregunta de negocio que el sistema no puede responder: *qué campaña trae reservas que realmente
se usan*. Los dos extremos existen y nada los cruza.

---

## 2. Tres problemas distintos, no uno

Esta separación cambia las prioridades y faltaba en la revisión anterior.

| Tipo | Qué resuelve | Quién lo usa | Precisión exigible |
|---|---|---|---|
| **Filtro operativo** | Encontrar una reserva, un lead, una respuesta | El equipo, a diario | Exacta sobre la fila |
| **Analítica comercial** | Cuántas reservas por campaña, qué etapa se atasca | Dirección, periódico | Agregada y comparable |
| **Atribución publicitaria** | Qué campaña **causó** una venta | Decisión de inversión | Regla causal verificable |

**Nada de lo que propone este informe es atribución.** Agrupar por `utm_campaign` es coincidencia
de etiqueta: sirve para decidir dónde mirar, no para medir retorno. Confundirlos lleva a decisiones
de presupuesto sobre una correlación.

---

## 3. Inventario de filtros por módulo

### CRM — leads (`list-leads.dto.ts`)

| Filtro | Campo | Dónde vive | Índice |
|---|---|---|---|
| `status`, `fitStatus`, `source`, `campaignName`, `assignedTo` | columnas | Columna | No |
| `clientId` | `leads.client_id` | Columna | **Sí** (`IDX_leads_org_client_created`) |
| `domain` | `leads.domain` | Columna | **Sí** (`IDX_leads_org_domain`) |
| `desde` / `hasta` | `leads.created_at` | Columna | **Sí** (compuesto) |
| `search` | nombre, correo, teléfono, empresa | Columnas | No |
| `anuncio` | `metadata.$.adName` | **JSON** | No |
| `plataforma` | `metadata.$.platform` | **JSON** | No |
| `campoPropio` | `custom_fields.$."clave"` | **JSON** | No |

Índices en `leads`: `org_client_created`, `org_domain`, `org_form_name`, `org_stage_changed`,
`regla_aplicada`.

### Reservas (`ListReservationsDto`)

Acepta `page`, `pageSize`, `formId`, `status`, `from`, `to`, `search`, `clientId`, `couponCode`,
`resourceId`, `asistenciaSupuesta`.

Índices: `org_client`, `org_client_starts`, `form_start`, `contact`, `post_visit` y tres de cupón.
**Ninguno cubre columnas UTM** — comprobado en todas las migraciones, no asumido.

### Encuestas

`GET /surveys/:id/results` **no acepta filtros**: trae todas las respuestas y agrega en memoria.
Aparte existe una consulta de visitas agrupadas por campaña (`surveys.controller.ts:329`).

### Cola de conversiones Meta

`GET integrations/meta/conversions/outbox` expone el estado. Índices `outbox_pending`,
`outbox_client_pixel` y la clave única `UQ_meta_conversion_event`.

---

## 4. Matriz forense

| ID | Mód. | Filtro | Estado | Evidencia | Impacto | Prior. | Depende de |
|---|---|---|---|---|---|---|---|
| F-01 | Reservas | Origen y campaña | **C — ausente, construible** | `reservation.entity.ts`: `utm_*`, `gclid`, `fbclid` son columnas | Operativo: no se filtra por origen | **P1** | **Nada** |
| F-06 | Reservas | Origen × asistencia | **C — ausente, construible** | `status` + `utm_*` en la misma fila | Analítica: la pregunta central | **P1** | F-01 |
| F-04 | Transversal | Identificador de campaña | **B — asimétrico** | CRM tiene `external_campaign_id`; Reservas sólo `utm_campaign` (texto) | Impide cruzar CRM con Reservas | P2 | Captura |
| F-02 | CRM | Anuncio y plataforma | **Riesgo no demostrado** | `list-leads.use-case.ts:148-153` sin índice; **sin medición** | Posible recorrido completo | P2 | Medir |
| F-07 | CRM | Estado en la cola CAPI | **C — ausente, construible** | `origen-del-evento.ts:20` + `:281` | Pérdida silenciosa invisible | P2 | Nada |
| F-03 | Encuestas | Fecha en resultados | **B — defectuoso** | `surveys.controller.ts:289` | Crece sin techo | P2 | Nada |
| F-08 | Encuestas | Tasa de finalización | **C — construible** | `survey_visits.session_id` | Abandono invisible | P2 | Nada |
| F-09 | Reservas | Sincronización Calendar | **D — requiere capturar** | No se guarda el id del evento | No se lista lo desincronizado | P2 | Migración |
| F-05 | CRM | Búsqueda libre | **Riesgo no demostrado** | `:237` `Like('%t%')` | Ningún índice aplicable | P3 | Medir |
| F-10 | Reservas | Permanencia | **C — construible** | `left_at`, `starts_at` | Rotación sin medir | P3 | Nada |

---

## 5. F-04 redefinido: no son tres cadenas sueltas

La revisión anterior decía que «campaña» existe tres veces como texto libre. **Es inexacto.**

| Módulo | Campo | Tipo | ¿Identificador estable? |
|---|---|---|---|
| CRM | `leads.external_campaign_id` | Columna | **Sí** — el id de Meta |
| CRM | `leads.campaign_name` | Columna | No — etiqueta legible |
| Captación | `lead_ingest_sources.campaign_id` | Columna | **Sí** |
| Reservas | `reservations.utm_campaign` | Columna | **No** — etiqueta UTM |
| Encuestas | `survey_visits.campana` | Columna | No — etiqueta |

El CRM **ya tiene** el identificador real. El hueco está en Reservas y Encuestas, que sólo guardan
la etiqueta que viene en la URL.

Eso cambia el trabajo: no es construir un catálogo desde cero, es **propagar un identificador que
ya existe** hacia los dos módulos que no lo reciben. Y es trabajo de captación —qué manda el enlace
del anuncio— antes que de base de datos.

---

## 6. F-07 desglosado en cuatro cosas distintas

El hallazgo se mantiene, pero mezclaba cuatro preguntas que se verifican por separado.

| Etapa | Qué garantiza | Evidencia | Estado |
|---|---|---|---|
| **Integridad del identificador** | El `event_id` lleva el UUID del lead de forma legible y estricta | `origen-del-evento.ts:20` exige `^lead-[a-z]+:<uuid>$`; rechaza cualquier otra forma | **CONFIRMADO** |
| **Generación del evento** | Se emite con esa forma exacta | `lead-stage-changed.handler.ts:281` → `` `lead-${etapa}:${lead.id}` `` | **CONFIRMADO** |
| **Entrega a Meta** | El evento salió y Meta lo recibió | `meta-conversion-outbox.service.ts:251` exige `events_received >= 1` | **CONFIRMADO** |
| **Conciliación** | Saber qué leads **no** tienen evento entregado | **No existe consulta** que cruce `leads` con la cola | **AUSENTE** |

Los tres primeros están cerrados por ambos extremos y `UQ_meta_conversion_event` impide duplicados.
Lo que falta es sólo el cuarto: la consulta de conciliación.

**Una precisión que el informe anterior no hacía:** que un evento se entregue no significa que Meta
lo haya **atribuido** ni usado para optimizar. La cola puede demostrar entrega; nada en el sistema
puede demostrar atribución.

---

## 7. Lo que está bien y no hay que tocar

**Inyección SQL.** La búsqueda usa `Like()` de TypeORM, parametrizado. La única interpolación
—la clave de campo propio— se valida con `/^[a-z][a-z0-9_]{0,39}$/` antes (`:161`).

**Zona horaria.** Los rangos de reserva usan la zona del formulario, no la del servidor. Las fechas
del CRM se validan con `@Matches(/^\d{4}-\d{2}-\d{2}$/)`.

**Exportación de reservas.** `reservations.controller.ts:497` reutiliza el mismo `requestedScope`
que la lista y audita explícitamente el volcado por mover datos personales en bloque.

**Vistas guardadas en Reservas — ya existen.** `ReservationsPage.tsx:660` monta `VistasGuardadas`
con `ambito="reservas.lista"`, persistidas en `saved_views` con clave única por dueño y ámbito.
**No es una propuesta pendiente.** Lo único a revisar al añadir filtros nuevos es incluirlos en el
cálculo de `hayFiltros` de la línea 663, o el botón de guardar no se habilitará con ellos.

---

## 8. Datos que ya existen y nadie consulta

| Dato | Dónde está | Qué permitiría |
|---|---|---|
| `utm_campaign`, `utm_source`, `utm_medium` | Columnas de `reservations` | Reservas por campaña |
| `gclid`, `fbclid`, `fbc`, `fbp` | Columnas de `reservations` | Trazar el clic |
| `origin_detected` | Columna | Separar lo medido de lo supuesto |
| `left_at`, `departure_source` | Columnas | Permanencia y rotación |
| `survey_visits.session_id` | Tabla | Abandono y finalización |
| `process_stage_changes.duration_hours` | Tabla | Velocidad por etapa |
| `reservation_coupon_redemptions.canal` | Tabla | Canje en local vs. con reserva |
| `meta_conversion_outbox.status` | Tabla | Conversiones que no salieron |

Ninguno aparece en un filtro de pantalla.

---

## 9. Seguridad multiempresa — alcance exacto de lo verificado

La revisión anterior concluyó sobre el sistema habiendo revisado un módulo. Esto es lo que sí se
comprobó, y lo que no.

| Módulo | Verificación | Evidencia |
|---|---|---|
| CRM | **Verificado** | `list-leads.use-case.ts:122` abre con `{ organizationId }`; el alcance por empresa se aplica en `:169`; `clientId` nunca llega crudo de la URL |
| Encuestas | **Verificado** | `surveys.controller.ts:97` acota por `organizationId`, y para rol cliente exige además coincidencia de `clientId` y capacidad contratada |
| Marketing | **Verificado por muestreo** | 15 consultas acotadas por `organizationId` en 3 servicios |
| Documentos, Reportes | **Verificado por muestreo** | Acotación presente |
| Facturación | **No verificado** | El servicio recibe `organizationId` por parámetro; no se auditó cada consulta |
| Resto de módulos | **No verificado** | Fuera del alcance de esta fase |

**Pruebas que respaldan el aislamiento, y son más fuertes que mi lectura:**
`aislamiento-cuentas.e2e.spec.ts` cubre que pedir una cuenta ajena por parámetro no devuelve sus
leads, que un lead ajeno no se alcanza por identificador ni se modifica, y que un prospecto de la
agencia no aparece en el CRM de ninguna empresa. Existen además `reservas-por-empresa`,
`crm-por-empresa`, `fuga-inicio-crm` y `matriz-de-acceso`.

**Conclusión acotada:** no se encontró fuga en los módulos verificados, y hay pruebas automáticas
que la vigilan en CRM y Reservas. **No es una afirmación sobre el sistema entero.**

---

## 10. Preguntas que hoy no se pueden responder

| Pregunta | Tipo | Datos | Limitación |
|---|---|---|---|
| ¿Qué campaña trae reservas que se usan? | Analítica | Existen | Falta el filtro |
| ¿Qué campaña trae más `no_show`? | Analítica | Existen | Falta el filtro |
| ¿Qué leads no llegaron a Meta? | Operativa | Existen | Falta la conciliación |
| ¿Qué encuestas se abandonan? | Analítica | Existen | Falta la consulta |
| ¿Qué clientes vuelven? | Analítica | Existen | Falta el filtro |
| ¿Qué reservas no se sincronizaron con Calendar? | Operativa | **No existen** | No se guarda el id |
| ¿Cayó la satisfacción este mes? | Analítica | Existen | Resultados sin filtro de fecha |

---

## 11. Lista consolidada de mejoras

Ordenadas por prioridad, con su dependencia real, beneficio y complejidad. Sin repetir nada ya
implementado.

| # | Mejora | Tipo | Depende de | Beneficio | Migración | Índice | Complejidad |
|---|---|---|---|---|---|---|---|
| 1 | **Filtro por origen y campaña en reservas** (F-01) | Operativo | **Nada** | Alto — responde «de dónde vino» por fila | No | Conviene en `utm_campaign`, **hoy no existe** | **Baja** |
| 2 | **Conciliación leads ↔ cola CAPI** (F-07) | Operativo | Nada | Alto — detecta pérdida silenciosa | No | No | Baja |
| 3 | **Fecha en resultados de encuesta** (F-03) | Operativo | Nada | Medio — acota una consulta que crece sin techo | No | No | Baja |
| 4 | **Cruce origen × asistencia** (F-06) | Analítica | F-01 | Alto — la pregunta comercial central | No | El de F-01 | Media |
| 5 | **Tasa de finalización de encuestas** (F-08) | Analítica | Nada | Medio | No | No | Media |
| 6 | **Propagar el id de campaña a Reservas** (F-04) | Analítica | Captación | Alto — habilita cruzar CRM con Reservas | Sí | Sí | Media |
| 7 | **Id del evento de Calendar** (F-09) | Operativo | Nada | Medio | Sí | No | Media |
| 8 | **Permanencia en mesa** (F-10) | Analítica | Nada | Bajo | No | No | Baja |

### Investigar antes de decidir

- **F-02** — medir con `EXPLAIN` sobre volumen real antes de pagar una migración con relleno de
  histórico. Hoy es una hipótesis.
- **F-05** — lo mismo para la búsqueda con comodín inicial.
- **Aislamiento en Facturación y módulos no verificados** (§9).

### Descartar

- **Filtros por `event_id` o dataset en la cola.** Son identificadores de diagnóstico y el panel de
  la cola ya existe.
- **Filtro por versión de encuesta.** No hay versionado (Fase 3, P3-02): ofrecerlo promete algo que
  el dato no sostiene.
- **Filtros finos sobre respuestas anónimas.** Reidentifican al participante.
- **Filtros por dimensiones que sólo viven en Meta o GA4.** Obligarían a consultar la plataforma en
  cada carga de pantalla.

---

## 12. Anexo de correcciones a la revisión 1

| Qué cambió | Por qué | Evidencia |
|---|---|---|
| **F-01 ya no depende de F-04** | Se inventó una dependencia inexistente. Filtrar reservas por su propia columna no toca otros módulos | `reservations.utm_campaign` es columna de esa tabla |
| **F-04 redefinido** | Se afirmó «tres cadenas sueltas». Falso: el CRM ya tiene identificador real | `leads.external_campaign_id`, `lead_ingest_sources.campaign_id` |
| **F-02 reclasificado a riesgo no demostrado** | Se afirmó que no escala sin medir nada | No se ejecutó `EXPLAIN` ni se midió volumen |
| **F-07 desglosado en cuatro etapas** | Mezclaba integridad, generación, entrega y conciliación. Las tres primeras están confirmadas; sólo falta la cuarta | `origen-del-evento.ts:20`, `handler:281`, `outbox:251`, `UQ_meta_conversion_event` |
| **Vistas guardadas: de propuesta a hecho** | Se propuso «reutilizar saved-views» cuando ya está montado en Reservas | `ReservationsPage.tsx:660`, `ambito="reservas.lista"` |
| **Alcance de seguridad acotado** | Se concluyó sobre el sistema habiendo revisado el CRM | §9 detalla módulo por módulo qué se verificó |
| **Separados filtro operativo, analítica y atribución** | Ponerlos en una sola matriz sugería que lo propuesto medía retorno | §2 |
| **Corregido: no hay índice en `utm_campaign`** | La revisión 1 decía «índices existentes» para F-01. Es falso | Ninguna migración crea índice sobre columnas UTM |
| **Retirada la propuesta «catálogo de campaña compartido»** | Se apoyaba en el diagnóstico equivocado de F-04 | Reemplazada por la mejora 6 |

---

## Límites

- Sin acceso a producción: **no se analizaron planes de ejecución SQL**. Toda afirmación de
  rendimiento es inferencia a partir de índices declarados y forma de las consultas.
- No se ejecutó la suite en esta sesión; las 288 suites se verificaron en verde el 7 de octubre.
- Las ausencias confirman que no hay código, no que la funcionalidad no exista por otra vía.
- La verificación de aislamiento multiempresa **no cubre todos los módulos** (§9).
