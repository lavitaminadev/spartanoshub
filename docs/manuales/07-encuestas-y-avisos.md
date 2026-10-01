# Avisos de las encuestas

Qué pasa cuando alguien escribe un mensaje en una encuesta, y a quién le llega.
Encuestas, más Reservas → el local → **Correos del local**.

---

## El caso que esto resuelve

Una persona cena mal, responde la encuesta, pone 2 de 5 y escribe *«la mesa estaba fría y tardaron
40 minutos»*. Lo escribe esa noche, antes de ir a dejarlo en Google.

Si nadie del local lo lee hasta el lunes, la oportunidad de arreglarlo se perdió.

---

## Cómo funciona ahora

```
Alguien responde una encuesta y escribe un mensaje
            │
            ▼
   ¿Quién es el local? ──── por la reserva, si vino de una invitación
                      └──── por la empresa de la encuesta, si vino de un QR
            │
            ▼
   Casillas del equipo marcadas con «Mensaje en una encuesta»
            │
     ¿ninguna? → la casilla de soporte del local, como último recurso
     ¿tampoco? → no sale nada. El mensaje queda en Resultados
            │
            ▼
   Correo con la nota, el mensaje y el correo de la persona
   Responder va directo a ella
```

**El aviso sale una sola vez**, la primera que la persona escribe. Corregir el texto después lo
guarda sin volver a avisar: antes, cada corrección mandaba otro correo al local.

---

## Lo que cambió: el QR ahora también avisa

Antes, el aviso **exigía que la respuesta viniera de una reserva**. La primera línea del código
decía: si no hay reserva, no hagas nada.

Consecuencia: **una encuesta abierta por el QR de la carta no le avisaba a nadie.** El mensaje
quedaba guardado en Resultados esperando a que alguien abriera esa pantalla. Y la encuesta del QR
es justo la que más se responde en caliente, en la mesa, mientras todavía se puede arreglar.

Las casillas del equipo son **del local**, no del formulario de reservas. Con la empresa de la
encuesta ya se sabe a quién escribirle, haya reserva o no.

---

## A quién le llega, y cómo se configura

Se configura en **Reservas → el local → Correos del local**, en la tabla de casillas del equipo:
marca **«Mensaje en una encuesta»** a quien corresponda ([manual 02](02-casillas-del-equipo.md)).

![Dónde se marca](img/02-casillas-del-equipo.jpg)
*La columna «Mensaje en una encuesta», en la tabla de casillas del equipo del local.*

Normalmente eso es el encargado de turno o la gerencia, no todo el equipo: el mensaje puede traer
el nombre y el correo de quien lo escribió.

### El último recurso

Si no hay **nadie** marcado para encuestas, el aviso va a la casilla de soporte del local —la de
«A dónde llegan las respuestas del cliente»—.

Es un último recurso para que un mensaje con nota baja no se quede sin leer, **no el destino
normal**: en cuanto el local anota a alguien del equipo, deja de usarse.

Si tampoco hay casilla de soporte, no sale nada y el mensaje queda en Resultados. No se cae hacia
ningún destinatario inventado: escribirle a quien no corresponde es peor que no escribir.

---

## El correo que llega

- **Asunto y cuerpo** salen de su plantilla, editable en Correos (`Aviso al equipo: mensaje en una
  encuesta`). Si lo apagas ahí, el mensaje se sigue guardando en Resultados; sólo deja de salir el
  correo.
- Lleva en filas aparte: la **encuesta**, la **nota** y el **correo** de quien respondió, si lo dejó.
- **Responder va directo a esa persona.** El local le contesta desde su propio correo sin tener que
  copiar la dirección.

---

## Las encuestas al equipo no llevan enlace de baja

Hay dos tipos de encuesta: a clientes y **al equipo** (internas). Las dos usan la misma plantilla de
correo, y esa plantilla **no lleva enlace de darse de baja**.

Parecía un olvido y no lo es. El artículo 28 B habla de comunicaciones *promocionales o
publicitarias*. Una encuesta no es publicidad: es una pregunta sobre un servicio ya prestado. Y en
una encuesta al equipo, un enlace de baja permitiría que un trabajador se quitara a sí mismo de las
comunicaciones de su trabajo, que no es lo que esa casilla significa.

Lo mismo con el aviso de mensaje en una encuesta: va al equipo del local, es un alerta operativo, y
un enlace de baja ahí dejaría que alguien se apagara los avisos de nota baja de su propio local.

---

## Mandar una encuesta por correo a gente que no está en el sistema

Ya se podía y se sigue pudiendo: al crear o editar una encuesta, en el paso de **distribución**,
marca «Correo» y escribe las direcciones separadas por coma. No hace falta que tengan cuenta.

Después, desde la encuesta, **Enviar por correo**.

Sirve igual para una encuesta al equipo: escribes los correos de los garzones y la reciben, sin
crearles usuario.

---

## A qué ley responde

**Ley 19.496, art. 28 B — y por qué no aplica aquí.** El artículo exige el enlace de suspensión en
comunicaciones *promocionales o publicitarias*. Una invitación a responder una encuesta sobre una
visita ya ocurrida no lo es, y un aviso al equipo sobre su propio turno tampoco. Poner el enlace
donde no corresponde no es «ir sobre seguro»: crea la expectativa de poder darse de baja de algo
que es parte del trabajo.

**Ley 21.719, finalidad y minimización.** El mensaje de una encuesta puede traer el nombre y el
correo de quien lo escribió. Por eso se reparte con las casillas por tipo y no a todo el equipo:
quien no va a contestarle no necesita su correo.

**Ley 21.719, respuestas anónimas en encuestas al equipo.** Una encuesta interna puede configurarse
como anónima. En una relación laboral, una respuesta identificada no es una respuesta libre.

---

## Preguntas que van a salir

**No me llegó el aviso de un mensaje.**
Tres cosas, en orden: que haya alguien marcado con «Mensaje en una encuesta»; que el aviso esté
encendido en Correos; y que la respuesta tenga de verdad un mensaje escrito —una nota baja sin
texto no dispara nada—.

**¿Puedo cambiar el texto del aviso?**
Sí, en Correos → `Aviso al equipo: mensaje en una encuesta`. Variables disponibles: `{{nombre}}`,
`{{local}}`, `{{nota}}`, `{{mensaje}}`, `{{encuesta}}`.

**¿Llega también si la nota es buena?**
Sí. El aviso lo dispara el mensaje escrito, no la nota. Un «estuvo todo excelente, la chica de la
barra fue un amor» también vale la pena que lo lea el turno.

**¿Y si la encuesta no es de ninguna empresa?**
Entonces no hay local al que avisar. Es el caso de una encuesta interna de la agencia, donde el
destinatario natural es quien la creó, no un local.
