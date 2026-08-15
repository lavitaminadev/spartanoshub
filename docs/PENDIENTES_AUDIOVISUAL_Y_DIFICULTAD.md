# Pendientes: fase de edición audiovisual y escala N1–N5

Estado al 15 de agosto de 2026. Dos huecos que están **identificados y acotados**, y que no se
cerraron porque dependen de decisiones del negocio, no de trabajo técnico pendiente.

Este documento existe para que quien retome —yo mismo la próxima sesión, o cualquier otro— no
tenga que volver a investigar dónde está el límite.

---

## 1. Fase de edición audiovisual

### Qué existe hoy

`session` (tabla `sessions`) tiene ocho columnas:

```
organization_id, client_id, type (varchar libre), date,
location, assigned_team (json), moodboard_id, status
```

Eso alcanza para **agendar** una sesión y saber quién va. No alcanza para nada de lo que ocurre
después de grabar.

### Qué falta, en concreto

| Falta | Consecuencia hoy |
|---|---|
| Estados de post-producción | Una sesión pasa de `scheduled` a terminada sin etapas intermedias: no se puede saber si está en montaje o en musicalización |
| Versiones del entregable | No hay equivalente de `piece_versions`: un editor no puede subir un corte y que quede registrado |
| Correcciones | No hay equivalente de `corrections`: las rondas del cliente sobre un video no se cuentan |
| Unidades de presupuesto | Una sesión no descuenta nada del plan del cliente |

### Por qué no se implementó

**Falta una decisión de negocio, no código**: contra qué unidad se cobra el trabajo audiovisual.

Las opciones que hay que descartar o elegir:

- **Por sesión** — simple, pero una sesión de dos horas y una de un día completo cuestan igual.
- **Por entregable** — un video, un reel, un cortometraje. Es lo más parecido a cómo se cobra
  Arte, y el catálogo de tipos ya lo soporta con `area: 'audiovisual'`.
- **Por minuto de material final** — preciso, pero obliga a medir algo que hoy nadie mide.

**Recomendación**: por entregable. Es la única que funciona hoy sin construir nada nuevo — el
catálogo de tipos ya distingue el área, y ya se verificó creando un tipo «cortometraje» de
audiovisual, aprobándolo en 6 UD y registrando trabajo contra él.

### Lo que ya está listo para cuando se decida

- `PieceTypeArea.AUDIOVISUAL` existe y funciona: audiovisual puede tener su propio catálogo de
  tipos, con sus unidades, su aprobación y su área, sin código nuevo.
- El hilo de comentarios ya cubre `CommentSubject.SESSION`.
- `AUDIOVISUAL_COLUMNS` en `board-columns.ts` ya declara las columnas del tablero.

### Qué hay que corregir cuando se implemente

**`AUDIOVISUAL_COLUMNS` hoy es una copia de las de Arte.** Está así a propósito y documentado en
el código: poner columnas de grabación, selección, montaje y musicalización cuando el dato no
puede llenarlas dejaría cuatro columnas siempre vacías, que se lee como si el área no trabajara.

Cuando existan los estados reales, **cambiar esa constante es lo único que hace falta** para que
el tablero de audiovisual refleje su flujo. El componente no cambia.

---

## 2. Escala de dificultad N1–N5

### Qué existe hoy

`piece.difficultyLevel` es un `tinyint` validado entre 1 y 5 (`@Min(1) @Max(5)`), y **alimenta el
XP**:

```
xp.service.ts:20      const level = piece.difficultyLevel ?? 1;
xp-calculator.ts:25   const base = calculateBase(params.difficultyLevel);
xp-calculator.ts:27   const expected = EXPECTED_HOURS[params.difficultyLevel]
```

### Qué falta

**El criterio.** No existe en ninguna parte qué significa N1, N2, N3, N4 o N5. Alguien escribe un
número del 1 al 5 sin nada que le diga cuál corresponde.

### Por qué esto importa más de lo que parece

Ese número mueve dos cosas:

1. **El XP del diseñador** — su mérito registrado.
2. **Las horas esperadas** — contra las que se mide si el trabajo se demoró.

Sin criterio, ambas quedan a merced de quién llenó el campo. Dos personas valorando el mismo
trabajo con criterios distintos producen métricas que parecen comparables y no lo son.

### Por qué no se implementó

**No se tiene el texto de los cinco niveles del Documento Maestro.** Inventarlos sería repetir el
error del `?? 1.0` que se corrigió en esta misma sesión —un valor decidido por quien programa en
vez de por quien tiene la atribución— pero con peor consecuencia, porque afecta al equipo.

### Discrepancia registrada

La Dirección de Arte **no usa esta escala**. Clasifica en dos: impresión es complejidad alta,
redes sociales normal. Eso está capturado en `PRINT_PIECE_TYPES` y documentado en
`piece-type.enum.ts`.

La decisión del 15 de agosto fue **usar N1–N5, la escala del Documento Maestro**. Falta conciliar
esa decisión con la práctica del área, o traducir una a la otra.

### Qué hace falta para cerrarlo

Los cinco criterios, en una frase cada uno, que permitan a alguien mirar un trabajo y saber qué
número corresponde. Con eso:

1. Se agregan como constante con etiquetas, igual que `PIECE_TYPE_LABELS`.
2. Se muestran en el formulario donde se elige el nivel.
3. Opcionalmente se vuelven configurables, igual que se hizo con las unidades.

Es medio día de trabajo una vez que existan las frases.

---

## Resumen para la reunión

| Pendiente | Bloqueado por | Quién decide |
|---|---|---|
| Fase de edición audiovisual | Contra qué unidad se cobra | Dirección + Nico |
| Columnas del tablero audiovisual | Lo anterior | — |
| Escala N1–N5 | Los cinco criterios | Nico |
| Conciliar N1–N5 con alta/normal | Lo anterior | Nico + Dirección de Arte |

Ninguno está bloqueado por trabajo técnico. Los cuatro se destraban con una decisión.
