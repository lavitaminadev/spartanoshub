# Auditoría forense Fase 3 — EspartanosHub como plataforma

**Fecha:** 14 de octubre de 2026
**Código:** `spartanoshub-deploy-update`, commit `f3ed9d4ee`, rama `main` (7 de octubre de 2026)
**Alcance:** lectura. Sin modificaciones, sin llamadas a APIs externas, sin acceso a la base de producción.

Complementa a [`AUDITORIA-META-2026-10-14.md`](./AUDITORIA-META-2026-10-14.md) y **corrige un hallazgo suyo** (ver §7).

---

## 1. Qué es EspartanosHub

No es una integración con Meta con módulos alrededor. Es un sistema operativo de agencia:
**34 módulos**, 94 entidades, 164 migraciones, 67 controladores, 16 tareas programadas y 288
archivos de prueba.

La relación entre los tres sistemas que pediste investigar es menos profunda de lo que el encargo
supone, y eso es una decisión deliberada documentada en el código, no una omisión.

### Inventario por módulo

| Módulo | Función | Datos que genera | Estado |
|---|---|---|---|
| `reservations` | Reservas y páginas públicas | Reservas, visitas, cupones, canjes, grupos | Implementado y probado |
| `surveys` | Encuestas propias | Respuestas, visitas, valoraciones | Implementado y probado |
| `crm` | Leads, etapas, reglas, campañas | Leads, interacciones, historial de etapas | Implementado y probado |
| `integrations` | Meta, Google | Colas de conversión, métricas, tokens | Implementado y probado |
| `marketing` | Suscriptores, campañas de correo | Suscriptores, envíos, exclusiones | Implementado y probado |
| `clients` | Empresas y sus capacidades | Capacidades contratadas, datos legales | Implementado y probado |
| `users` / `authorization` | Cuentas, roles, permisos | Permisos por empresa, acciones finas | Implementado y probado |
| `notifications` | Correo saliente | Registro de correos | Implementado y probado |
| `production`, `content`, `briefs`, `approvals`, `audiovisual` | Producción de piezas | Piezas, aprobaciones, historial | Implementado |
| `design-budget` | Presupuesto en UD | Movimientos y saldo | Implementado, sin vista de cliente |
| `billing`, `contracts`, `account-cycles` | Facturación y ciclos | Facturas, notas de cobro | Implementado |
| `intake`, `service-requests` | Solicitudes internas | Peticiones y prórrogas | Implementado |
| `gamification`, `objectives`, `knowledge`, `meetings`, `pods`, `onboarding` | Equipo | XP, objetivos, actas | Implementado |
| `documents` | Drive del cliente | Carpetas en Google Drive | Parcial — ver §4.F |
| `saved-views`, `reports`, `uploads`, `catalog`, `operations`, `automations`, `collaboration`, `process-templates`, `organizations`, `client-portal` | Transversales | — | Implementado |

**Ningún módulo quedó clasificado como «no encontrado».**

---

## 2. Reservas

### Qué es una reserva

**No es sólo una cita horaria.** `reservation_forms.mode` distingue variantes, y el comentario de
`reservation-form.entity.ts:34` lo dice literal: *«reservas y encuestas, que son esta misma entidad
con distinto `mode`»*. Una encuesta pública se publica con la misma maquinaria que una reserva.

La entidad `reservations` tiene **más de 40 columnas**. Las que revelan su naturaleza real:

- `starts_at` / `ends_at` / `party_size` → es una **ocupación de capacidad en el tiempo**
- `table_label`, `resource_id` → asignación de recurso físico
- `left_at`, `departure_source` → **la mesa sigue ocupada hasta que alguien diga que se fue**
- `guest_document`, `birth_date` → identidad del comensal
- `consent_version`, `reservation_consent_at`, `marketing_consent_at` → consentimientos versionados
- `idempotency_key` → defensa contra el doble envío

### Estados reales

```
pending · confirmed · attended · no_show · cancelled_business · waitlist
```

Seis estados, no los cuatro que suele suponerse. `attended` y `no_show` son los que importan para
marketing: distinguen **reserva hecha** de **persona que efectivamente vino**.

### Concurrencia — resuelto con cuidado

`reservations.service.ts:1138-1154` toma las filas que solapan con `pessimistic_write` **antes** de
contar la ocupación, dentro de una transacción envuelta en `retryOnDeadlock` (`:426`). El cupo se
cuenta sobre filas bloqueadas, no sobre una lectura que puede quedar vieja entre la comprobación y
la escritura.

`:1496` deduplica el envío público por `idempotencyKey` contra `reservation_form_events`.

`:712` bloquea el formulario por `public_slug` cuando hace falta.

**Veredicto:** no encontré una vía de sobrecupo. Es de las partes mejor construidas del sistema.

### Zona horaria

Cada formulario guarda la suya (`timezone`, por omisión `America/Santiago`). Los cálculos usan
`Intl.DateTimeFormat` con `timeZone` explícito (`:4187`), no la del servidor — que corre en UTC.
El cambio de horario de verano chileno queda resuelto por la base de datos de zonas de ICU.

### Trazabilidad

`reservation_events` guarda el historial. `process_stage_changes` registra cambios de etapa con
`changed_by` y `duration_hours`.

---

## 3. Encuestas

### Es un constructor propio

**No hay Google Forms.** Ninguna referencia a `forms.googleapis.com` en todo el repositorio.

Las preguntas viven en `survey.questions` como JSON, con esta justificación en el código: *«solo se
leen y escriben junto»* a la encuesta.

### El riesgo de integridad que preguntabas: confirmado

`survey.entity.ts:29` → `questions: SurveyQuestion[]` en JSON
`survey-response.entity.ts:22` → `answers: Record<string, string | number>`

Las respuestas se indexan por `pregunta.id`. **No hay versión de encuesta ni versión de pregunta.**

Existe `change_log` (`:67`) con fecha, autor y lista de cambios — es un registro de auditoría, no un
versionado. Si alguien cambia el texto de una pregunta después de recibir respuestas, **las
históricas quedan apuntando al nuevo enunciado**. El `id` sobrevive, el significado no.

**Severidad: P2.** No corrompe datos, pero invalida la comparación temporal sin avisar.

### Anonimato

`public-survey-flow.service.ts:148-150` construye el identificador así:

```ts
respondentId: persona
  ? `reserva:${persona.reservationId}`
  : `public:${origen}:${randomUUID()}`
```

Una respuesta por enlace abierto recibe un **UUID aleatorio**: no reconstruye la identidad ni por
IP ni por huella. El anonimato se respeta donde se promete.

Cuando viene de una reserva, sí queda vinculada — y es legítimo, porque la invitación se firma con
HMAC (`invitacion-a-encuesta.ts:42`) desde esa reserva concreta.

### Métricas disponibles

`survey_visits` (migración `0141`) guarda una fila por visita con su canal, y desde la migración
`0169` también la campaña. Con eso **sí** se pueden calcular aperturas, inicios, completadas y tasa
de finalización. Las respuestas parciales existen: hay reanudación por `edit_token_hash`.

---

## 4. Ecosistema Google — qué existe y qué no

| Servicio | Estado | Evidencia |
|---|---|---|
| **Google Ads** | **Implementado** | `googleads.googleapis.com`, cola propia, `gclid`/`gbraid`/`wbraid` |
| **GA4 (navegador)** | **Implementado** | `Ga4Tag.tsx`, `gtag.js`, con consentimiento previo |
| **GA4 Data API** | **Implementado** | `analyticsdata.googleapis.com/v1beta` |
| **GA4 Measurement Protocol** | **No implementado** | Sin `api_secret`, sin `/mp/collect` |
| **Google Tag Manager** | **No implementado** | Ningún `GTM-` en el repositorio |
| **Google Calendar** | **Implementado, unidireccional** | `calendar/v3`, sólo `createEvent` |
| **Gmail API** | **No implementado** | El correo sale por **SMTP** con `nodemailer` |
| **Google Drive** | **Implementado, limitado** | Crea carpetas por cliente, `drive.file` |
| **Google Forms** | **No implementado** | — |
| **Google Sheets** | **No implementado** | — |
| **Maps / Business Profile / Search Console / Merchant / Firebase** | **No implementados** | — |

### A. Google Ads

Sube conversiones de clic con `gclid` y, cuando no lo hay, con identificadores mejorados.
Contempla `gbraid` y `wbraid` para campañas de iOS y de aplicación, donde Google no entrega `gclid`.
**No usa Data Manager API.**

### C. GTM — ausencia deliberada

Sin GTM, los eventos del navegador salen directo desde la página pública. **Eso evita el problema
que el encargo teme**: no hay dos sistemas enviando lo mismo. La duplicación Pixel/CAPI se resuelve
por `event_id` compartido (`META_DEDUPLICATED_EVENTS`).

### D. Calendar — el hallazgo

```
createEvent  ✓     updateEvent  ✗     deleteEvent  ✗
```

`reservations.service.ts:2706` crea el evento. **Nada lo actualiza ni lo borra.**

**Consecuencia demostrable:** una reserva reagendada o cancelada deja en el calendario del equipo un
evento en el horario viejo. No hay identificador externo guardado en `reservations` para encontrarlo
después. **Severidad: P2** — produce información falsa en una herramienta que el equipo consulta a
diario.

### E. Correo

SMTP con `nodemailer`, no Gmail API. Hay registro de envíos (`RegistroDeCorreo`).

Conviene no confundir tres cosas que el sistema sí distingue: **generado** (se compuso),
**aceptado** (el servidor SMTP lo tomó) y **entregado** (llegó al buzón). El registro llega hasta
*aceptado*; nada en el sistema demuestra la entrega.

### F. Drive

`google-drive.service.ts:18` crea la estructura de carpetas de un cliente con permiso `drive.file`
—el más acotado, sólo lo que la propia app crea—. No lee ni sincroniza documentos existentes.

---

## 5. Los flujos que pediste

| Flujo | ¿Existe? | Evidencia |
|---|---|---|
| **A. Reserva directa** | **Sí, completo** | Página pública → validación → cupo con cerrojo → correo → asistencia |
| **B. Reserva + Calendar** | **Parcial** | Se crea el evento; no se actualiza ni se cancela |
| **C. Encuesta tras reserva** | **Sí, completo** | `encuesta-post-visita.job.ts` → invitación firmada → respuesta ligada a la reserva |
| **D. Captación publicitaria** | **Sí, completo** | Meta Lead Ads → webhook → lead → CRM |
| **E. Conversión comercial** | **Sí** | Lead → calificado → venta → cola CAPI |
| **F. Análisis transversal** | **Parcial** | Los datos existen; no hay una vista que los cruce |

### El corte deliberado entre CRM y Reservas

`reservations.service.ts:567` fuerza `form.crmEnabled = false` **siempre**, con este comentario:

> *Reservas y CRM son capacidades independientes. No se crea ni sincroniza un lead desde una
> reserva; se conserva la columna histórica solo para no borrar datos.*

**Una reserva nunca se convierte en lead.** El flujo D y el flujo A no se tocan. Es una decisión
tomada, no un hueco — y conviene saberlo antes de proponer unificar nada.

---

## 6. Qué eventos comerciales salen, y cuáles no

| Hecho del negocio | Meta | Google Ads | Estado |
|---|---|---|---|
| Empezó a llenar el formulario | `InitiateCheckout` | — | Sí |
| Reserva creada | `Schedule` | Sí | Sí |
| **Reserva confirmada** | — | — | **No se distingue de la creada** |
| **Persona asistió** | `Reserva_Asistida` | — | Sí, sólo Meta |
| **No se presentó** (`no_show`) | — | — | **No se informa** |
| Respondió una encuesta | `Lead` | — | Sí |
| Lead recibido / calificado / vendido / descartado | nombres propios | — | Sí |

**El dato más valioso que no se está usando:** `no_show`. El sistema sabe quién reservó y no vino
—`left_at`, `departure_source`, el cierre automático de asistencia— y eso no viaja a ninguna
plataforma. Una campaña que trae reservas que no se presentan hoy se ve idéntica a una que trae
clientes reales.

---

## 7. Corrección al informe de Meta

El hallazgo **M-06** decía que el sistema usa nombres de evento propios en vez de estándar. **Es
cierto sólo para el CRM.**

**Reservas usa eventos estándar de Meta**: `InitiateCheckout`, `Schedule` y `Lead`
(`packages/shared/src/constants/meta-events.ts:21-28`), con `event_id` compartido para deduplicar
contra el Pixel del navegador.

El único nombre propio del lado de reservas es `Reserva_Asistida`, y está justificado: no existe un
evento estándar para «vino de verdad», y el comentario del código explica que no se deduplica porque
ningún navegador puede emitirlo.

Mi informe anterior generalizó desde el CRM. **M-06 queda acotado al CRM.**

---

## 8. Hallazgos nuevos de esta fase

| ID | Sev | Componente | Evidencia | Impacto |
|---|---|---|---|---|
| P3-01 | **P2** | Calendar | Sólo `createEvent`; sin `update` ni `delete`, sin id externo | Eventos falsos en el calendario del equipo tras reagendar o cancelar |
| P3-02 | **P2** | Encuestas | `questions` en JSON sin versión | Cambiar una pregunta reinterpreta respuestas históricas en silencio |
| P3-03 | P2 | Conversiones | `no_show` no se informa a ninguna plataforma | No se puede distinguir tráfico que viene de tráfico que reserva y no aparece |
| P3-04 | P3 | Reservas → Google | Sólo se sube la conversión de creación | Google no recibe la asistencia, que Meta sí recibe |
| P3-05 | P3 | Correo | El registro llega hasta «aceptado por SMTP» | No hay evidencia de entrega |
| P3-06 | P3 | Análisis | Los datos de inversión, leads, reservas y encuestas no se cruzan en ninguna vista | El flujo F existe en la base y no en pantalla |

---

## 9. Cómo aprovechar mejor lo que ya se genera

Sin módulos nuevos. Todo lo de abajo usa datos que el sistema ya guarda.

**1. Informar la asistencia a Google Ads.** Meta ya recibe `Reserva_Asistida`; Google sólo recibe la
creación. La cola de Google ya existe y el `gclid` ya se captura.

**2. Informar el `no_show`.** No como conversión positiva: como señal de exclusión o como valor
negativo donde la plataforma lo admita. Es el dato que distingue una campaña buena de una que llena
la agenda de gente que no llega.

**3. Cerrar el ciclo del calendario.** Guardar el id del evento en la reserva y actualizarlo o
borrarlo al reagendar y cancelar. Es la corrección de mayor relación valor/esfuerzo de esta fase.

**4. Versionar las preguntas de encuesta.** Antes de que haya suficiente histórico como para que el
problema sea caro.

**5. Una vista que cruce inversión, leads, reservas, asistencia y respuestas.** Las cinco fuentes ya
están en la base: `integration_metrics`, `leads`, `reservations`, `survey_responses`. Falta la
consulta, no el dato.

Lo que **no** recomiendo: enviar respuestas de encuesta a Meta o Google. Son datos de satisfacción
con texto libre, la política interna (`politica-meta-capi.ts:53`) ya bloquea esos campos, y no hay
finalidad publicitaria que lo justifique.

---

## 10. Dictamen

**Conservar sin cambios:** el control de cupo con cerrojo, el manejo de zonas horarias, la
deduplicación Pixel/CAPI por `event_id`, el anonimato de las encuestas públicas y la separación
deliberada entre CRM y Reservas.

**Corregir:** el ciclo de vida del evento de calendario (P3-01) y el versionado de preguntas
(P3-02).

**Probar antes de decidir:** informar `no_show`. Técnicamente es directo; qué significa para cada
plataforma y si conviene enviarlo como exclusión o como valor negativo es una decisión de negocio
que necesita datos de al menos un trimestre.

**No tocar:** la ausencia de GTM, de Google Forms y de Measurement Protocol. Las tres son decisiones
coherentes con una arquitectura que mide desde el servidor y evita la duplicación.

---

## Límites de esta auditoría

- Sin llamadas reales a APIs externas ni acceso a la base de producción.
- No ejecuté la suite completa en esta sesión; las 288 suites se verificaron en verde el 7 de octubre.
- Las afirmaciones sobre ausencia de integraciones se basan en búsqueda exhaustiva del repositorio:
  **confirman que no hay código**, no que nunca se haya usado por otra vía.
