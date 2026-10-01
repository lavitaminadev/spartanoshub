# Casillas del equipo

Quién del equipo recibe cada aviso, sin necesidad de que tenga cuenta en el sistema.
Reservas → el local → paso **Correos del local**.

Un garzón, una cajera o la barra no tienen por qué tener usuario: reciben un correo y hacen su
trabajo. Esta tabla es donde se anotan, y donde se decide **qué le toca a cada uno**.

| Casilla | Reserva nueva | Grupos | Espera | Cambios | Encuestas | Operación |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| gerente@casacostanera.cl · Encargada de turno | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| mesones@casacostanera.cl · Garzones | ✓ | | | ✓ | | ✓ |
| caja@casacostanera.cl · Cajera | | | | | | ✓ |

![La tabla de casillas del equipo](img/02-casillas-del-equipo.jpg)
*Cada fila es una casilla del equipo; cada columna, un tipo de aviso. Debajo, el formulario para agregar a alguien nuevo.*

---

## Los seis avisos

| Tipo | Cuándo sale | Qué lleva dentro |
|---|---|---|
| **Reserva nueva** | Alguien reserva | Nombre, cuántos vienen, día y hora, código |
| **Solicitud de grupo o evento** | Alguien pide un evento o viene con 9+ | Todo lo anterior **más el teléfono, el correo y lo que contó** |
| **Lista de espera** | Alguien se anota para un horario lleno | Nombre, cuántos, para cuándo |
| **El cliente canceló o cambió la hora** | Quien reservó lo cambia desde su enlace | Qué reserva, la hora nueva y la anterior |
| **Mensaje en una encuesta** | Alguien escribe algo en una encuesta | La nota, el mensaje y su correo si lo dejó |
| **Reservas pausadas o día cerrado** | Alguien pausa las reservas o cierra un día | Qué pasó, en qué local y quién lo hizo |

Mira la segunda fila. El aviso de un evento lleva **el teléfono y las notas de quien lo pidió**: es
lo que hace falta para llamarlo y acordar la fecha. Un garzón no necesita el teléfono del cliente
para saber que a las nueve entran seis personas — y antes lo recibía igual, porque la lista era una
sola y recibía todo.

---

## Cómo se agrega a alguien

1. Reservas → abre el local → paso **Correos del local**.
2. Baja hasta **«Quién del equipo recibe cada aviso»**.
3. Escribe el correo. El nombre y el cargo son opcionales pero **ponlos**: dentro de seis meses,
   `mesones@` sin cargo no le dice a nadie si se puede borrar.
4. Marca los avisos que le tocan.
5. **Agregar al equipo**.

Para cambiarle los avisos a alguien que ya está, marca o desmarca su casilla en la tabla. Se guarda
al momento.

**Quitar todas las marcas es válido** y no borra la fila. Es lo que se hace con quien está de
vacaciones: deja de recibir y vuelve a activarse sin pedirle otra vez la dirección.

---

## El campo de arriba, el antiguo

En el mismo paso, más arriba, sigue el campo **«3. A quién se avisa de cada reserva nueva»** con
los correos separados por coma.

**Esas direcciones reciben los seis avisos.** No se tocaron a propósito: apagarle avisos en
silencio a alguien que los venía recibiendo es peor que no cambiar nada.

Para repartir, pasa esas direcciones a la tabla de abajo y bórralas de arriba. Mientras estén en
las dos, reciben desde arriba (todo) y la tabla no les quita nada.

---

## Por qué está hecho así

Antes, las direcciones vivían en ese campo de texto del formulario. Tres problemas:

**Eran del formulario, no del local.** Un local con dos formularios —uno para el salón y otro para
la terraza— tenía que mantener la misma lista dos veces. Olvidar una dejaba a alguien sin avisos y
nadie se enteraba hasta que faltó una reserva.

**Era un solo balde.** Los seis avisos a las mismas direcciones, incluido el teléfono del cliente a
todo el turno.

**No quedaba constancia.** El correo de un trabajador es un dato personal suyo. Tenerlo en una lista
sin saber quién lo agregó ni cuándo no se puede explicar, y la Ley 21.719 pregunta justamente eso.

La tabla nueva es **del local** (vale para todos sus formularios), reparte por tipo, y guarda quién
agregó cada dirección y cuándo.

---

## Dos avisos que antes no llegaban

**Reservas pausadas o día cerrado.** Esto existía sólo como campana dentro de la aplicación. Quien
no tiene cuenta —el turno que atiende— no se enteraba de que esa noche no entraba nadie hasta que
la noche había pasado. Es el aviso que más cuesta no recibir y era el único que no salía del
sistema.

**Mensaje en una encuesta, cuando viene de un QR.** Antes el aviso exigía que la respuesta viniera
de una reserva. Una encuesta abierta por el QR de la carta no le avisaba a nadie: el mensaje
quedaba en Resultados esperando que alguien abriera la pantalla. Ver [el manual 07](07-encuestas-y-avisos.md).

---

## Quién puede mantener esta tabla

| Cargo | Qué puede |
|---|---|
| Administración, Dirección Comercial, Dev | El equipo de cualquier local que tengan asignado |
| La cuenta de la empresa | **El equipo de su propio local, y ninguno más** |

Que la empresa pueda mantener el suyo es deliberado: es **su** equipo, y pedirle a la agencia que
agregue a cada garzón nuevo es lo que hace que la lista quede vieja.

El servidor comprueba tres cosas antes de dejar tocar nada: el cargo, que la cuenta alcance esa
empresa, y que esa empresa **tenga Reservas contratado**. Esconder la pantalla no es cerrarla.

---

## A qué ley responde

**Ley 21.719, minimización.** Los datos tratados deben ser *adecuados, pertinentes y limitados a lo
necesario* para la finalidad. Mandar el teléfono de un cliente a seis personas cuando una sola lo
va a llamar no es limitado a lo necesario. Repartir por tipo es cómo se cumple esto en la práctica.

**Ley 21.719, responsabilidad proactiva.** Hay que poder demostrar que se cumple. Saber quién
agregó cada dirección del equipo y cuándo es parte de eso.

**Los correos de los trabajadores también son datos personales.** Se tratan sobre la base de la
relación laboral y para una finalidad concreta —avisarles de su trabajo—, y por eso la tabla
guarda el cargo: permite entender a quién se le está quitando algo antes de quitarlo.

---

## Preguntas que van a salir

**¿La misma persona puede estar en dos locales?**
Sí, con avisos distintos en cada uno. El encargado de turno de un local no tiene por qué enterarse
de lo que pasa en el otro.

**Si quito a alguien, ¿pierdo el historial?**
No. Los correos que ya salieron quedan registrados en el log de envíos.

**¿Hay que poner a los usuarios con cuenta aquí también?**
No hace falta. Quien tiene cuenta en la empresa ya recibe la campana dentro de la aplicación. La
tabla es para correo, y sirve igual para los dos: si quieres que además le llegue por correo,
agrégalo.

**¿Por qué no puedo inventar un tipo de aviso nuevo?**
Porque cada tipo corresponde a un correo que existe. Un tipo que no corresponde a nada sería una
casilla que no hace nada, que es justo lo que se vino a corregir.
