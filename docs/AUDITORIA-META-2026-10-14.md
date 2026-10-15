# Auditoría forense — Integración con Meta

**Fecha:** 14 de octubre de 2026
**Código auditado:** `spartanoshub-deploy-update`, commit `f3ed9d4ee` (rama `main`, 7 de octubre de 2026)
**Alcance:** lectura. No se modificó código, no se ejecutaron envíos reales ni se consultó la base de producción.

---

## 0. Dos correcciones al encargo

Antes del informe, dos premisas del encargo que no se sostienen.

**El directorio `spartanoshub-audit` está 593 commits atrás**, en la rama `feat/vistas`, con fecha
del 12 de agosto de 2026. Auditarlo habría descrito código que ya no existe: por ejemplo, ahí sólo
está `lead-converted.handler.ts`, cuando en producción también corre `lead-stage-changed.handler.ts`,
que es el emisor de los cuatro eventos comerciales. Esta auditoría se hizo sobre `main`.

**La versión por omisión no es `v23.0`, es `v25.0`.** Está en un solo sitio
(`version-de-graph.ts:16`) y no hay ninguna otra versión escrita a mano en todo `apps/api/src`.

---

## 1. Resumen ejecutivo

La integración con Meta está **mejor construida de lo que un sistema de este tamaño suele estar**.
La cola de envíos tiene reserva de filas con cerrojo, recuperación de filas abandonadas, ventana de
atribución por origen, pausa automática ante credencial revocada y verificación de `events_received`.
El hasheo de identificadores se comprueba contra los vectores oficiales que publica Meta. La firma
de los webhooks se valida con `timingSafeEqual` sobre el cuerpo crudo. Existe una capa de política
que bloquea el envío de datos sensibles antes de que salgan.

Lo que **no** existe: integración con WhatsApp Cloud API —ni envío de mensajes ni recepción de
`ctwa_clid`—, y persistencia de Insights más allá de métricas agregadas por día.

El riesgo más inmediato no está en el código sino en el calendario: **Meta retira comportamientos
heredados del protocolo de todas las versiones el 27 de octubre de 2026**, dentro de trece días.

El límite real del sistema tampoco es técnico: con unos diez leads por semana, ningún evento
alcanza el volumen que Meta pide para salir de la fase de aprendizaje.

---

## 2. Inventario comprobado

| Componente | Archivo | Líneas | Estado |
|---|---|---|---|
| Pixel por empresa | `meta/meta-client-pixel.service.ts` | 858 | Funcional |
| Lead Ads | `meta/meta-lead-ads.service.ts` | 410 | Funcional |
| Descubrimiento de activos | `meta/meta-asset-discovery.service.ts` | 346 | Funcional |
| Cola de conversiones | `meta/meta-conversion-outbox.service.ts` | 345 | Funcional |
| OAuth | `meta/meta-oauth.service.ts` | 343 | Funcional |
| Emisor por etapa | `meta/handlers/lead-stage-changed.handler.ts` | 305 | Funcional |
| Política de datos | `meta/politica-meta-capi.ts` | 206 | Funcional |
| Envío CAPI | `meta/meta-conversions.service.ts` | 171 | Funcional |
| Webhook / mensajería | `meta/meta.service.ts` | 148 | Parcial — ver §7 |
| Emisor por conversión | `meta/handlers/lead-converted.handler.ts` | 138 | Funcional |
| Identificadores | `meta/identificadores-meta.ts` | 134 | Funcional |
| Insights | `meta/meta-insights.service.ts` | 69 | Funcional, limitado |
| Borrado de datos | `meta/meta-data-deletion.ts` | 60 | Funcional |

**Total del módulo:** 4.458 líneas. **Pruebas:** 31 archivos en `test/unit/integrations/`, 3 suites
e2e que tocan Meta.

**Variables de entorno:** `META_GRAPH_API_VERSION`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`,
`META_TEST_EVENT_CODE`, `DEFAULT_TENANT_ID`, `META_TENANT_<pageId>`.

---

## 3. Hallazgos

| ID | Sev | Componente | Evidencia | Impacto | Estado |
|---|---|---|---|---|---|
| M-01 | **P1** | Versión Graph | `version-de-graph.ts:16` → `v25.0`; Meta retira protocolo heredado de todas las versiones el 27-oct-2026 | Fallos silenciosos tras esa fecha si se usa algún comportamiento retirado | DOCUMENTADO |
| M-02 | P2 | Transporte | `fetch` en 4 servicios (9 llamadas), `HttpService` en 3 | Dos políticas de error y de timeout distintas; un 429 se clasifica distinto según el camino | CONFIRMADO |
| M-03 | P2 | Lead Ads | `meta-lead-ads.service.ts:256-262` guarda `adId`, `adsetId`, `adName` dentro de `metadata` JSON | No hay columna ni índice: no se puede agrupar por anuncio en SQL sin recorrer el JSON | CONFIRMADO |
| M-04 | P2 | WhatsApp | Ningún `POST /messages`, ningún `ctwa_clid`, ningún Phone Number ID en `apps/api/src` | El flujo B del encargo no existe | CONFIRMADO |
| M-05 | P2 | Insights | `meta-insights.service.ts:33` fija `date_preset=last_30d` | Pasados 30 días sin sincronizar hay un hueco irrecuperable | CONFIRMADO |
| M-06 | P3 | Eventos | Nombres propios (`Lead recibido`, `Calificado`, `Vendido`, `Descartado`) en vez de estándar | Sin eventos estándar no hay optimización por `Purchase` con valor | CONFIRMADO |
| M-07 | P3 | Volumen | 4 `Calificado` en cinco semanas (medido en producción el 7-oct) | Meta pide ~50 conversiones semanales por conjunto; no se alcanza | CONFIRMADO |
| M-08 | P3 | Pruebas | Dobles incompletos: `dataProtection.*`, `dataSource.query`, `destinatariosDeAvisos.para` | Una rotura real produciría el mismo mensaje que hoy; no se distinguiría | CONFIRMADO |

---

## 4. Lo que está demostrado que funciona

### Hasheo contra vectores oficiales

`test/unit/integrations/vectores-oficiales-meta.spec.ts` compara la normalización con el CSV que
publica Meta. Es la única forma de saber que el digest empareja: uno distinto se acepta igual y
simplemente no coincide con nadie, así que el error no se vería por ningún otro medio.

`identificadores-meta.ts:78-80` evita el error clásico de doble hasheo —si el valor ya es un
SHA-256, no lo vuelve a hashear— y `:131` se niega a enviar un parámetro que llegue sin hashear.

### La cola de envíos

`outbox-processor.base.ts:148-176` reserva el lote dentro de una transacción con
`pessimistic_write`, y antes devuelve a `retry` las filas que quedaron en `processing` más tiempo
del permitido. Dos procesos simultáneos no pueden tomar la misma fila, y una caída a mitad de envío
no deja eventos atascados para siempre.

`meta-conversion-outbox.service.ts:251-254` trata como fallo una respuesta `200` con
`events_received: 0`. Sin eso, un evento descartado por Meta quedaba marcado como enviado — una
conversión perdida que nadie iría a buscar.

`:161-171` corta por la ventana de atribución según el origen del evento, en vez de gastar los ocho
reintentos contra una ventana ya cerrada.

`:206-215` pausa el encolado cuando Meta rechazó la credencial en las últimas 24 horas, y se reanuda
sola con el primer envío exitoso.

`:274-277` distingue el código `190` de un `OAuthException` genérico. Marcar todo `OAuthException`
como credencial dejaba sin reintento eventos cuyo token estaba perfectamente bien.

### Webhooks

`meta.controller.ts:62-66` valida `hub.verify_token` con `timingSafeEqual` y longitud previa.
`meta.service.ts:61-65` valida la firma `x-hub-signature-256` sobre `req.rawBody`, no sobre el
cuerpo ya parseado — que es el único modo correcto.

### Política de datos

`politica-meta-capi.ts:53-61` bloquea el envío de campos cuyo nombre sugiera dato sensible:
patrimonio, salud, documentos de identidad, notas libres. Registra la infracción **sin el valor**.
Es una defensa que la mayoría de las integraciones no tiene.

### Saneado de credenciales

`meta-conversions.service.ts:112-118` reemplaza el error de Axios por uno propio antes de
propagarlo, porque el original arrastra `config.data` con el `access_token` en claro. Hoy nadie lo
serializa; basta con que alguien registre el objeto entero.

---

## 5. Los flujos, reconstruidos

**A. Lead Ads → base de datos.** Existe y es completo.
`meta.controller.ts:69` → firma → `meta-lead-ads.service.ts:processWebhook` → Graph API por
`leadgen_id` → `leads` + `metadata`. Conserva `leadgen_id`, `form_id`, `campaign_id`, `page_id`,
`ad_id`, `adset_id`, `platform` y las respuestas del formulario.

**B. WhatsApp.** **No existe.** Sin envío, sin recepción, sin `ctwa_clid`.

**C. Lead → calificación → venta → CAPI.** Existe.
`update-lead.use-case.ts` emite `lead.qualified` / `lead.won` / `lead.discarded` →
`lead-stage-changed.handler.ts` → cola → Graph API. El monto sólo viaja con la venta y sólo si
alguien lo anotó.

**D. Evento → cola → worker → Graph API.** Existe, descrito en §4.

**E. OAuth.** Existe. `meta-oauth.service.ts:94-110` canjea el token corto por uno largo y guarda
`expiresAt`. Los secretos se guardan cifrados con prefijo `enc:v1:`.

**F. Insights.** Existe, limitado. Trae `spend`, `impressions`, `reach`, `clicks` y `actions` de los
últimos 30 días a `integration_metrics`.

---

## 6. Qué datos se pierden

| Dato | Dónde se pierde | Consecuencia |
|---|---|---|
| `ad_id`, `ad_name`, `adset_*` desde Make | El escenario del cliente es anterior a sep-2026 y no los manda | No se sabe qué anuncio trae cada lead |
| Leads con origen de más de 7 días | `lead-intake.service.ts`, filtro de antigüedad | No se reportan; medido: 13 de 47 |
| Insights de más de 30 días | `date_preset=last_30d` | Hueco irrecuperable si no se sincroniza |
| `ctwa_clid` | No hay receptor | Sin atribución de WhatsApp |

---

## 7. Lo que no pude verificar

- **Comportamiento real contra Graph API.** No se hicieron llamadas: el encargo lo prohíbe y es lo
  correcto.
- **Estado de la cola en producción.** No se consultó la base.
- **Si alguna conversión personalizada en Events Manager optimiza hacia `Descartado`.** Eso vive en
  la interfaz de Meta, fuera del código. Es la comprobación pendiente más barata y más urgente:
  `Descartado` fue el evento más enviado (62 de 100 en cinco semanas).

---

## 8. Correcciones mínimas, por impacto

1. **Revisar el aviso del 27 de octubre** (M-01). Contrastar la lista de comportamientos retirados
   contra las nueve llamadas del módulo. Trece días.
2. **Actualizar el escenario de Make** para que mande los cuatro campos de anuncio. El blueprint
   descargable ya los incluye desde el 23 de septiembre; el escenario en uso es anterior.
3. **Unificar el transporte** (M-02) detrás de un único cliente con la misma política de timeout,
   reintento y clasificación de errores. No por estética: hoy un 429 se trata distinto según el
   camino.
4. **Completar los dobles de prueba** (M-08).
5. **Promover `ad_id` a columna** (M-03) si se quiere analizar por anuncio.

---

## 9. Dictamen

**Conservaría sin cambios:** la cola de envíos, el hasheo de identificadores, la verificación de
firmas, la política de datos sensibles y el saneado de credenciales. Son las partes donde un error
sería caro y están resueltas con cuidado y con pruebas que lo demuestran.

**Corregiría ya:** el escenario de Make —es pérdida de datos en curso, no un riesgo— y la revisión
del cambio de Meta del 27 de octubre.

**Probaría antes de decidir:** unificar el transporte. La duplicidad es real y molesta, pero los
dos caminos funcionan hoy y tocarlos sin una prueba que fije el comportamiento actual cambia riesgo
conocido por riesgo nuevo.

**No tocaría:** la elección de nombres de evento propios. Con diez leads por semana, ningún esquema
de eventos saca al pixel de la fase de aprendizaje, y cambiarlos invalidaría el histórico sin
mejorar nada medible.

---

## Fuentes consultadas

- [Graph API — tabla de versiones](https://developers.facebook.com/docs/graph-api/changelog/versions) — 14 oct 2026
- [Graph API v25.0](https://developers.facebook.com/docs/graph-api/changelog/version25.0) — 14 oct 2026
- [Graph API v26.0](https://developers.facebook.com/docs/graph-api/changelog/version26.0) — 14 oct 2026
- [Introducing Graph API v25 and Marketing API v25](https://developers.facebook.com/blog/post/2026/02/18/introducing-graph-api-v25-and-marketing-api-v25) — 14 oct 2026

Las fechas de expiración de Graph API figuran como **TBD** para v23.0, v24.0 y v25.0 en la tabla
oficial, mientras que el changelog de Marketing API sí da fechas firmes. Esa discrepancia **no se
pudo resolver** y queda como NO VERIFICADA.
