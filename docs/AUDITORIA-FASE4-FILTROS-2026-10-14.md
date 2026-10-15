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
| F-02 | CRM | Anuncio y plataforma | **A — medido, sin riesgo** | `EXPLAIN` a 250.000 filas: la página usa `idx_org_domain_created` (§13) | 4–55 ms; un índice no aporta nada | — | Cerrado |
| F-07 | CRM | Estado en la cola CAPI | **C — ausente, construible** | `origen-del-evento.ts:20` + `:281` | Pérdida silenciosa invisible | P2 | Nada |
| F-03 | Encuestas | Fecha en resultados | **B — defectuoso** | `surveys.controller.ts:289` | Crece sin techo | P2 | Nada |
| F-08 | Encuestas | Tasa de finalización | **C — construible** | `survey_visits.session_id` | Abandono invisible | P2 | Nada |
| F-09 | Reservas | Sincronización Calendar | **D — requiere capturar** | No se guarda el id del evento | No se lista lo desincronizado | P2 | Migración |
| F-05 | CRM | Búsqueda libre | **A — medido, sin riesgo** | `EXPLAIN` a 250.000 filas: 5,5 ms cuando acierta (§13) | Ningún índice aplicable, y no hace falta | — | Cerrado |
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

- **F-02 y F-05 — medidos el 14 de octubre (§13).** Ninguno justifica un índice. La medición
  sacó a la luz un hallazgo distinto —el abanico de `OR` del conteo— que tampoco urge al volumen
  actual.
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

## 13. Medición de F-02 y F-05 con `EXPLAIN`

Ejecutada el 14 de octubre de 2026 sobre una **réplica local**: MariaDB 12.3.2 en instancia
aislada, tabla `leads` con las columnas de `lead.entity.ts` y los nueve índices que crean las
migraciones 0050, 0080 y 0100. Sembradas **250.000 filas** con una sola organización, `metadata`
con `adName`, `platform` y seis respuestas de formulario (655 bytes por fila). Volúmenes
comparados: 2.000, 25.000 y 250.000; producción está en los **cientos**, así que 2.000 ya es
unas diez veces lo de hoy. El SQL no se escribió a mano: se instanció el `ListLeadsUseCase` real
y se capturó lo que emite TypeORM. Cada cifra es la mediana de cinco ejecuciones en caliente, y
las filas recorridas salen de los contadores `Handler_read_*`.

### `findAndCount` son dos consultas y se comportan al revés

**La página (20 filas) va bien en todo volumen.** Camina `idx_org_domain_created` en orden
`created_at DESC` y se detiene al juntar 20 filas. Acceso `range`, nunca `ALL`.

| Caso de la página | 2.000 | 25.000 | 250.000 |
|---|---|---|---|
| Sin filtros | 19 filas / 3,7 ms | 19 / 3,2 ms | 19 / **4,4 ms** |
| F-02 anuncio | 826 / 26,1 ms | 898 / 28,6 ms | 898 / **18,8 ms** |
| F-02 plataforma | 32 / 5,4 ms | 32 / 12,1 ms | 32 / **4,1 ms** |
| F-02 anuncio + plataforma | 826 / 26,2 ms | 961 / 32,2 ms | 961 / **54,6 ms** |
| F-05 búsqueda que acierta | 131 / 13,3 ms | 131 / 12,3 ms | 131 / **5,5 ms** |
| F-05 búsqueda que no acierta | 826 / 31,7 ms | 11.124 / 339,9 ms | 112.495 / **1.216,6 ms** |
| F-05 + F-02 | 826 / 123,8 ms | 2.535 / 337 ms | 2.535 / **122,5 ms** |

El «posible recorrido completo» que este documento atribuía a F-02 **no ocurre en la página**.

**El conteo recorre la tabla entera, y no por F-02 ni por F-05.** Todos los casos dan
`type=ALL`, `key=(ninguno)` — incluido el que **no lleva filtro alguno**:

| Caso del conteo | 2.000 | 25.000 | 250.000 |
|---|---|---|---|
| **Sin ningún filtro** | 2.001 / 4,6 ms | 25.001 / 55,8 ms | 250.001 / **496,6 ms** |
| F-02 anuncio | 2.001 / 20,8 ms | 25.001 / 261,6 ms | 250.001 / **1.062,6 ms** |
| F-02 plataforma | 2.001 / 25,6 ms | 25.001 / 242,8 ms | 250.001 / **967,6 ms** |
| F-05 búsqueda | 2.001 / 29,8 ms | 25.001 / 292,4 ms | 250.001 / **1.039,4 ms** |
| F-05 + acotado a una persona | 2.001 / 41 ms | 25.001 / 461,1 ms | 250.001 / **2.763,5 ms** |
| F-05 + F-02 | 2.001 / 112,4 ms | 25.001 / 1.462,2 ms | 250.001 / **17.627,1 ms** |

### La causa es el abanico de `OR`, no la falta de índice

Dos construcciones del use-case se multiplican al armar el `WHERE`: la disyunción de cerrados
(`:225-232`) repite el `WHERE` entero dos veces, y la búsqueda libre (`:237`) lo repite una vez
por cada uno de los siete campos. Una búsqueda normal son **14 bloques `OR`** (77 parámetros);
acotada a una persona, **28 bloques** (168 parámetros). Con esa forma el optimizador no usa
ningún índice y reevalúa `JSON_EXTRACT` una vez por bloque y por fila.

Aislando cada ingrediente del conteo a 250.000 filas:

| Variante | Acceso | Índice | Filas | ms |
|---|---|---|---|---|
| Como está hoy, sin filtros | `ALL` | — | 250.001 | 559,5 |
| Sin la disyunción (al pedir los descartados) | `ref` | `idx_org_domain_status` | 112.495 | **196,3** |
| Disyunción reescrita como un solo bloque | `ALL` | — | 250.001 | 415,2 |
| Reescrita + búsqueda sin abanico | `ALL` | — | 250.001 | 819,1 |
| Reescrita + búsqueda + anuncio (**el peor caso de hoy**) | `ALL` | — | 250.001 | **1.191,3** |

La última fila compara con los 17.627,1 ms del caso equivalente de hoy: **15 veces más rápido
sin crear un solo índice**, sólo cambiando la forma del `WHERE`.

### F-02: no se justifica un índice

Un índice normal no alcanza a `JSON_EXTRACT`; la única vía en MariaDB es columna generada
virtual más índice sobre ella. Medido a 250.000 filas:

| Qué se midió | Acceso | Filas | ms |
|---|---|---|---|
| Antes, como está hoy | `ALL` | 250.001 | 1.574,2 |
| Con el índice, mismo SQL (sin tocar el código) | `ALL` | 250.001 | 1.525,0 |
| Con el índice, preguntando por la columna generada | `ALL` | 250.001 | 1.721,9 |

Cero beneficio, por dos razones: MariaDB **no** sustituye la expresión por la columna indexada
—a diferencia de MySQL 8—, así que sin cambiar el código el índice es invisible; y aun
cambiándolo, mientras esté la disyunción de cerrados el plan sigue siendo `ALL`.

Lo que costaría crearlo, medido sobre las 250.000 filas: `ADD COLUMN` virtual 117 ms (no
reescribe filas), `ADD INDEX` 3.664 ms, espacio de índices 286,9 → **314,6 MB** (+27,7 MB), e
insertar 2.000 leads pasa de 101 a **132 ms (+31 %)**. A escala de producción el `ALTER` es
instantáneo y el espacio despreciable, pero el recargo en escritura no lo es: la captura de
leads escribe en caliente.

Sólo paga encadenado detrás de la reescritura y de un cambio en el use-case:

| Con índice, a 250.000 filas | Acceso | Índice | Filas | ms |
|---|---|---|---|---|
| Con disyunción, columna generada | `ALL` | — | 250.001 | 1.610,2 |
| **Sin disyunción, columna generada** | `ref` | `idx_org_plataforma` | **55.009** | **67,7** |

**Conclusión: no se crea migración por F-02.** Hoy el filtro cuesta 4–55 ms en la página y
21–26 ms en el conteo a un volumen diez veces mayor que el real.

### F-05: ni índice ni `FULLTEXT`

El comodín inicial es real pero no es lo que cuesta: a 250.000 filas una búsqueda que acierta
son **5,5 ms** en la página, porque el índice de orden entrega las filas y los `LIKE` sólo
descartan las 131 que llega a mirar. Lo caro es la búsqueda que **no** acierta (1.216,6 ms,
porque camina el índice completo buscando veinte filas que no existen) y el conteo con su
abanico de catorce bloques.

`FULLTEXT` no resuelve ninguno de los dos. Busca por palabra o prefijo de palabra, y esta
búsqueda es por infijo: `%gomez%` tiene que encontrar «Gomez» dentro del campo, y también medio
número de teléfono. Cambiarlo alteraría **qué encuentra el filtro**, que es una decisión de
producto y no de rendimiento; y el conteo, que es el caso caro, seguiría siendo `ALL` por la
forma del `WHERE`.

**Conclusión: F-05 se cierra sin cambios.** A 2.000 filas el peor caso son 123,8 ms de página y
112,4 ms de conteo.

### Hallazgo nuevo que deja esta medición

El abanico de `OR` del conteo no estaba en la matriz. No urge al volumen actual —4,6 ms sin
filtros y 112,4 ms en el peor caso a 2.000 filas—, pero es lo único de los tres con retorno
medido: reescribir el `WHERE` da 15× en el peor caso, sin migración y sin espacio en disco.

---

## Límites

- Sin acceso a producción. Los planes de ejecución de §13 se tomaron sobre una **réplica local
  sembrada**: el esquema y los nueve índices son los reales, el volumen y la distribución son una
  aproximación. Toda otra afirmación de rendimiento de este documento sigue siendo inferencia a
  partir de índices declarados y forma de las consultas.
- No se ejecutó la suite en esta sesión; las 288 suites se verificaron en verde el 7 de octubre.
- Las ausencias confirman que no hay código, no que la funcionalidad no exista por otra vía.
- La verificación de aislamiento multiempresa **no cubre todos los módulos** (§9).
