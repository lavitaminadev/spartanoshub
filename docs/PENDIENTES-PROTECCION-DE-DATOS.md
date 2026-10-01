# Protección de datos y correo comercial: lo que queda pendiente

Al 30 de septiembre de 2026.

La **Ley 21.719** entra en vigencia el **1 de diciembre de 2026**. De lo que queda aquí, sólo el
punto 1 tiene esa fecha encima; el resto es mejora o confirmación externa.

Lo ya resuelto no se repite acá: está en los mensajes de los commits, que explican qué pasaba antes
y por qué el cambio es el que es.

---

## 1. Fijar el plazo de conservación de los registros de baja — **tiene fecha**

**Qué falta.** Decidir cuánto tiempo se conservan las constancias de que alguien pidió no recibir
más, y dejarlo escrito con su justificación.

**Por qué no lo decide el código.** La Ley 21.719 no fija un plazo: exige que el responsable fije
uno, lo pueda justificar y lo cumpla. Un valor elegido desde el código sería un número inventado
sin nadie detrás.

**La tensión que hay que resolver.** El artículo 28 B de la Ley 19.496 obliga a *recordar* la
petición —si se borra, se le vuelve a escribir y se incumple—. El derecho de supresión de la
21.719 permite pedir que se borren los datos. Hoy eso se concilia guardando una huella SHA-256 de
`organización:correo` en `email_suppression`, sin la dirección: alcanza para no volver a escribir y
no conserva el dato de quien pidió que lo borraran.

**Lo que falta decidir:** cuánto vive esa huella. Recomendación a discutir con abogado:
indefinida mientras exista la lista, porque es lo único que sostiene la prohibición, y borrarla
reactivaría el envío. Si se fija un plazo, hay que implementar el borrado y decirlo en la política
de privacidad.

**Dónde toca.** `apps/api/src/modules/marketing/exclusion.entity.ts`, el texto de la política en
`packages/shared/src/documentos-legales.ts`.

---

## 2. Dos ajustes que existen y no los corre nadie

Están en el catálogo, se pueden cambiar en pantalla, y no tienen efecto. Un ajuste que miente es
peor que uno que falta: quien lo configura cree que quedó cubierto.

| Ajuste | Qué pasa hoy |
|---|---|
| Retención de comentarios de trabajo | La función de borrado existe; ningún trabajo programado la llama. |
| Plazo de respuesta a solicitudes de derechos | Nada calcula el vencimiento ni avisa cuando se acerca. El plazo legal es de 30 días corridos, prorrogable una vez (`PLAZO_RESPUESTA_DERECHOS_DIAS`). |

El segundo tiene peso legal: una solicitud que vence sin respuesta es un incumplimiento, y hoy
nadie se entera de que venció.

**Decisión pendiente:** conectarlos o esconderlos. Esconder es legítimo y es mejor que dejarlos
aparentando funcionar; conectar el segundo es poco trabajo y evita un incumplimiento por olvido.

---

## 3. Etapa 3: formularios públicos de captación y QR

Hoy una dirección entra a la lista por dos caminos: la casilla al reservar, o una importación que
obliga a declarar la procedencia. Falta el tercero, que es el que pidió el cliente: una página o un
QR donde alguien se suscriba sin reservar.

Lo que no puede faltar cuando se haga: el texto aceptado guardado entero, la IP, la fecha, y la
consulta a la lista de exclusión antes de crear la ficha — lo mismo que ya hace
`AltaDeSuscriptorDesdeReserva`. Si se construye sin eso, la lista deja de poder defenderse.

---

## 4. Registro «No Molestar» del SERNAC

No se ha revisado si aplica. Es un registro público de personas que pidieron no recibir publicidad;
si alcanza al correo comercial de locales gastronómicos, habría que consultarlo antes de enviar,
igual que se consulta la lista de exclusión propia.

**Falta:** averiguar el alcance real y, si aplica, cómo se consulta.

---

## 5. Confirmación de abogado

Tres decisiones que se tomaron con criterio y lectura de la ley, no con asesoría. Conviene que
alguien las firme antes del 1 de diciembre:

1. **¿Basta la baja por local?** Cada empresa es responsable distinto de sus datos y por eso la
   baja es por empresa, con un botón bien visible para salir de todas. La alternativa —que una baja
   saque de todas automáticamente— tiene el problema contrario: nadie pidió dejar de recibir de un
   local donde sí quiere seguir.
2. **¿Un consentimiento nuevo levanta una baja anterior?** Hoy sí, pero sólo desde una casilla
   marcada a propósito y después de advertirle que había pedido no recibir. Reservar de nuevo no
   basta: el artículo 28 B dice que tras la solicitud los envíos «quedarán desde entonces
   prohibidos», sin excepción por una compra posterior.
3. **Los plazos de respuesta a solicitudes de derechos** y si la prórroga necesita avisarse.

---

## Cómo está hoy el camino de salida, para quien revise esto

```
Correo comercial → pie «Dar de baja» (y el botón nativo de Gmail/Yahoo)
  → GET  /api/marketing/suscriptores/baja/:token   pregunta, no ejecuta
  → POST /api/marketing/suscriptores/baja/:token   ejecuta
     · alcance=local → sólo esa empresa
     · alcance=todas → todas sus fichas + huella en email_suppression
  → pie de la página → /solicitudes (acceso, rectificación, supresión)
```

Que el GET no ejecute no es un trámite de más: los antivirus de correo y la previsualización de
Outlook abren los enlaces de un mensaje para revisarlos, y con la baja colgada del GET se daba de
baja a gente que nunca hizo clic. Como no se puede deshacer sola, no se arreglaba después.
