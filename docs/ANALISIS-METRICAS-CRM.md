# Por qué el CRM no da las métricas que debería

Análisis, no cambios. Al 2 de octubre de 2026.

**Conclusión corta:** no falta ningún campo. Los datos que hacen falta ya se guardan todos. Lo que
los inutiliza es **una línea que sobrescribe la calificación al descartar**, y eso además se le está
mandando a Meta al revés.

---

## 1 · El lead descartado que desaparece del tablero

### Qué pasa exactamente

`apps/api/src/modules/crm/leads/use-cases/list-leads.use-case.ts`, líneas 168-178:

```
inicioDeMes = hoy, día 1, 00:00
si no se pidió incluirDescartados y no se filtró por etapa:
    (estado ≠ 'lost')  ó  (estado = 'lost' Y updatedAt ≥ inicioDeMes)
```

Es deliberado y está documentado. **No es un dato perdido:** sigue en la base, y hay dos formas de
verlo, las dos ya construidas:

| Cómo | Dónde |
|---|---|
| Casilla **«Ver descartados de meses anteriores»** | `LeadsBoardPage.tsx:768`. Se ve en tablero **y** en tabla |
| Filtrar por la etapa **«Descartado»** | Salta el corte por completo (`filters.status` lo desactiva) |

### Dónde sí está el problema

**El corte es por mes de calendario, no por ventana.** Un lead descartado el 31 de octubre
desaparece el 1 de noviembre: **un día después**. Otro descartado el 2 de octubre sobrevive treinta
días. Dos leads tratados igual, con vidas en pantalla que se diferencian en treinta veces, por una
fecha que no significa nada para quien vende.

Nadie piensa «este mes». Se piensa «lo de las últimas semanas».

**Y la casilla no dice lo que uno busca.** Dice «de meses anteriores», que describe la
implementación. Quien perdió un lead de vista no está pensando «esto es de un mes anterior», está
pensando «¿dónde quedó Juan?».

### Qué cambiaría

| Opción | Costo | Qué mejora | Qué empeora |
|---|---|---|---|
| **Ventana móvil de 30 días** en vez de mes calendario | 3 líneas, 1 test | Desaparece el salto arbitrario del día 1 | Nada. El índice `(organización, estado, updatedAt)` sirve igual |
| 90 días en vez de 30 | lo mismo | Más memoria del trimestre | El tablero carga más tarjetas cerradas |
| Dejarlo como está y **renombrar la casilla** | 1 línea | Se encuentra | El salto del día 1 sigue ahí |

**Recomendación:** ventana móvil de 30 días **y** renombrar la casilla a «Ver también los
descartados». Es el cambio más barato del documento y el único que no tiene contrapartida.

---

## 2 · El verdadero problema: descartar borra la calificación

Esto es lo que impide medir, y es donde tu intuición está bien.

### El sistema ya tiene dos ejes, y son correctos

| Eje | Campo | Qué pregunta responde |
|---|---|---|
| **Etapa** | `status` | ¿Dónde va? (nuevo → contactado → … → ganado / descartado) |
| **Calificación** | `fitStatus` | ¿Cuánto vale? (`review`, `in_review`, `qualified`, `sold`, `unqualified`) |

Están separados a propósito y el código lo explica bien: un lead puede estar en «Contactado» y ya
valer la pena. Hasta aquí, perfecto.

### Pero el descarte pisa el segundo eje

`apps/api/src/modules/crm/leads/use-cases/update-lead.use-case.ts`, líneas 31-34:

```ts
const DESENLACES = {
  [LeadStatus.WON]:  LeadFitStatus.SOLD,
  [LeadStatus.LOST]: LeadFitStatus.UNQUALIFIED,   // ← aquí
};
```

Línea 145: se aplica **siempre que no se mande `fitStatus` a mano**. El modal de descarte sólo
manda `status` y `discardReason` (`LeadsBoardPage.tsx:1192-1196`). **Nunca manda la calificación.**

Resultado: **todo lead descartado queda marcado «no calificado», sea cual sea el motivo.**

### Por qué eso es falso, con tu propia lista de motivos

`packages/shared/src/types/lead.ts:147-157`. Son nueve, y los clasifico contra lo que la
calificación debería decir:

| Motivo de descarte | ¿Era mal lead? | Qué dice hoy |
|---|---|---|
| Datos de contacto erróneos | **Sí** | no calificado ✓ |
| Solo consultaba (sin intención) | **Sí** | no calificado ✓ |
| No es el perfil buscado | **Sí** | no calificado ✓ |
| **Compró en otro proyecto** | **No. Era un comprador real** | no calificado ✗ |
| Precio fuera de presupuesto | No necesariamente | no calificado ✗ |
| Ubicación no le acomoda | No. Buen lead, producto equivocado | no calificado ✗ |
| Sin financiamiento / no calificó crédito | Discutible | no calificado ✗ |
| Nunca respondió | **No se sabe** | no calificado ✗ |
| Otro | **No se sabe** | no calificado ✗ |

**Tres de nueve son correctos.** En los otros seis el sistema afirma algo que nadie dijo.

El caso que lo resume: **«Compró en otro proyecto»**. Es el lead más calificado que existe —era un
comprador, con plata, decidido— y queda archivado como basura.

### La consecuencia que duele: se le está enseñando esto a Meta

`update-lead.use-case.ts:225-233` y el bloque siguiente:

- Sólo se le anuncia a Meta `lead.qualified` cuando la calificación **llega** a `qualified`.
- El descarte **también se anuncia**, y el comentario del código lo dice: *«le enseña a Meta qué
  perfiles no buscamos»*.

Entonces, hoy, cuando alguien compra en la competencia:

```
se descarta  →  fitStatus pasa a «no calificado»
             →  nunca se emite lead.qualified
             →  se le manda a Meta: «este perfil no lo buscamos»
```

**Le estás pagando a Meta para que deje de traerte compradores.** No es una metáfora: es el
contraste con el que el algoritmo aprende a quién mostrarle el anuncio.

### Lo que no se puede responder hoy

Ninguna de estas preguntas tiene respuesta con el dato actual, y las tres son las que importan:

1. ¿Qué porcentaje de los leads de esta campaña **eran buenos**? — Hoy «bueno» equivale a «cerró»,
   así que la métrica mide al vendedor, no al anuncio.
2. De los que eran buenos y se perdieron, **¿por qué** se perdieron? — Se perdió el dato de que eran
   buenos.
3. ¿Qué anuncio trae gente con plata que compra **en otro lado**? — Esa es la señal de que el
   anuncio funciona y el producto o el precio no. Hoy se ve igual que un anuncio que trae basura.

---

## 3 · Lo que pides no necesita campos nuevos

Lo verifiqué campo por campo. **Ya está todo guardado:**

| Lo que quieres medir | Con qué dato | ¿Existe? |
|---|---|---|
| Si el lead era bueno | `fitStatus` | **Sí.** Se está pisando |
| Por qué se perdió | `discardReason` | **Sí.** Se guarda bien |
| De qué anuncio vino | `source`, `sourceDetail`, `campaignName`, `metadata` | **Sí** |
| En qué etapa murió | `status` + historial de proceso | **Sí** |
| Cuánto tardó | `ProcessHistoryService` registra cada cambio con su duración | **Sí** |
| **Volver a contactar más adelante** | Tarea con vencimiento (`approval_requests.due_at`) | **Sí** |

### Sobre «volver a contactar en un tiempo más»

**No lo hagas un campo.** Ya existe el mecanismo: una tarea con fecha de vencimiento sobre el lead,
que es lo que alimenta `openTasks`, la agenda y los avisos de inactividad.

Un campo `recontactarEl` sería una segunda fuente de verdad para la misma pregunta: habría una fecha
en la ficha que nadie mira y una tarea en la agenda que sí se mira, y en cuanto se contradigan,
ninguna de las dos sirve. Lo que falta no es el campo, es **ofrecer crear esa tarea en el momento de
descartar**, que es cuando la persona sabe si vale la pena volver.

---

## 4 · Las tres opciones, con su costo real

### Opción A — Preguntar la calificación al descartar *(la que recomiendo)*

El modal de descarte pasa a tener dos preguntas en vez de una:

```
¿Por qué se descarta?        [motivo, obligatorio, ya existe]
¿El lead servía?             [Sí, servía / No servía / No alcancé a saber]
¿Volver a contactarlo?       [No / en 1 mes / en 3 meses / en 6 meses]  ← crea una tarea
```

- **Costo:** el modal, quitar `LOST` de `DESENLACES`, y un valor por omisión para lo ya guardado.
  Estimo 1 archivo de API, 1 de web, 2 o 3 tests.
- **Sin migración ni campos nuevos.** `fitStatus` ya tiene `in_review` para «no alcancé a saber».
- **Gana:** las tres preguntas de la sección 2 pasan a tener respuesta. Meta deja de recibir la
  señal invertida.
- **Cuesta:** un clic más al descartar. Es el precio de la métrica, y el descarte masivo puede
  seguir pidiendo la calificación una sola vez para toda la tanda.

**Lo que hay que decidir, y es tuyo:** qué pasa con los descartes ya guardados. Son todos
«no calificado» y no se puede saber cuáles lo eran de verdad. Hay dos caminos honestos:

1. **Dejarlos como están** y que las métricas nuevas cuenten sólo desde el cambio. Limpio, pero el
   histórico sigue mintiendo.
2. **Pasarlos a `in_review`** («no se sabe») salvo los tres motivos que sí significan mal lead. No
   inventa nada: reconoce que no se preguntó. Es una migración de una sentencia.

Me inclino por la 2 — *no sé* es verdad, *no servía* no lo es — pero cambia datos ya guardados y eso
lo decides tú.

### Opción B — Deducir la calificación del motivo, sin preguntar

Mapear los nueve motivos a calificación automáticamente, sin tocar el modal.

- **Costo:** casi cero. Una tabla de nueve filas.
- **Gana:** arregla el histórico y el futuro de una vez, sin fricción.
- **Cuesta:** **sigue inventando.** «Nunca respondió» no dice si el lead era bueno, y el sistema
  tendría que elegir por él. Mejor que hoy, pero sigue siendo el sistema afirmando lo que no sabe.

### Opción C — No tocar nada y medir sólo con `discardReason`

Armar los informes cruzando campaña × motivo de descarte, ignorando `fitStatus`.

- **Costo:** sólo la pantalla de informes.
- **Gana:** responde bastante de la pregunta 3 sin tocar el flujo.
- **Cuesta:** no arregla la señal a Meta, que es el daño que cuesta plata todos los días.

---

## 5 · Lo que haría yo, en orden

1. **La ventana móvil de 30 días** y renombrar la casilla. Tres líneas, sin contrapartida.
2. **Opción A.** Es la que convierte el CRM en algo que se puede medir.
3. **Cortar la señal invertida a Meta** — sale gratis con A, pero si quieres sólo esto, es dejar de
   anunciar el descarte cuando el motivo no implica mal lead.
4. **Después**, y recién después, los informes: calificación × campaña, motivo × anuncio, y «buenos
   que se perdieron» como su propio número.

El punto 4 no sirve de nada antes del 2, porque mediría el dato roto con más detalle.

---

## 6 · Lo que no revisé

Para que quede dicho:

- **No conté leads reales.** No tengo acceso a la base de producción, así que no puedo decirte
  cuántos descartes mal clasificados hay hoy. Todo lo de arriba sale de leer el código y la lista de
  motivos, no de medir tus datos. Si quieres el número, es una consulta.
- **No miré el dominio `audience`** (el ciclo de reserva: reservado, asistió, no asistió). `DESENLACES`
  sólo se aplica al embudo comercial, así que nada de esto lo toca, pero tampoco lo analicé.
- **No toqué nada.** Esto es análisis, como pediste.
