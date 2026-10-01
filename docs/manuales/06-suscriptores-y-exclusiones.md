# Suscriptores y exclusiones

La lista, la prueba de cada dirección, y quién pidió no recibir más. Marketing → **Suscriptores**.

Esta pantalla contesta dos preguntas distintas. Arriba, «¿quién está en la lista?». Abajo,
«¿a quién tengo prohibido escribirle?». La segunda no es una lista que se pueda mirar, y eso tiene
una razón.

---

## Arriba: quiénes están

Cada empresa tiene su propia lista y su propio permiso. **La misma persona puede estar suscrita en
un local y de baja en otro**, y eso no es un error: son permisos distintos dados a responsables
distintos.

Las tarjetas de arriba resumen cada empresa y filtran al tocarlas.

![La lista de suscriptores](img/06-suscriptores-lista.jpg)
*La misma persona, suscrita en un local y de baja en otro. Y las procedencias nuevas: «red» y «Se suscribió».*

### Los tres estados

| Estado | Qué significa | ¿Se le puede escribir? |
|---|---|---|
| **Suscrito** | Dijo que sí, y consta cuándo y ante qué texto | Sí |
| **Pendiente** | Está en la lista pero nadie le ha preguntado | **No** |
| **De baja** | Se dio de baja o dijo que no | **No, nunca más** |

Tres y no dos porque «todavía no ha dicho que sí» y «dijo que no» son cosas distintas: a la primera
se le puede preguntar una vez, a la segunda no se le puede escribir nunca más.

«Pendiente» es, casi siempre, una fila importada sin declarar qué aceptó.

### De dónde salió cada una

| Procedencia | Qué fue |
|---|---|
| **Reservó** | Marcó la casilla de beneficios al reservar |
| **Reservó · red** | Marcó la casilla de los demás locales. Entra a la lista de la agencia |
| **Se suscribió** | Entró por el QR o el enlace del local, sin reservar |
| **Importado** | Vino de un archivo, con su origen declarado |

---

## Ver ficha: la prueba de una dirección

El botón **Ver ficha** abre todo lo que respalda esa dirección:

| Dato | Para qué sirve |
|---|---|
| Empresa, nombre, estado | Lo evidente |
| De dónde salió | La respuesta a «¿de dónde sacaron mi correo?» |
| **Dijo que sí** | Fecha y hora exactas |
| **Desde qué dirección** | La IP. Es lo que convierte «dijo que sí» en comprobable |
| Declaró ser mayor de edad | Fecha, o «no consta» |
| Fecha de nacimiento declarada | Para el beneficio de cumpleaños |
| Último correo enviado | Para no repetir campañas sobre la misma gente |
| **Se dio de baja** | Fecha, alcance, y desde qué correo la pidió |
| **El texto que aceptó** | Entero, tal como lo leyó |

![La ficha de un suscriptor](img/06-ficha-del-suscriptor.jpg)
*Todo lo que respalda esa dirección, incluido el texto que leyó al aceptar.*

El texto va entero y sin resumir. Se guardaba desde siempre y **no se mostraba en ninguna parte**:
guardar la prueba sin poder leerla no sirve para el día en que alguien reclame.

Si dice *«No consta ningún texto»*, esa dirección vino de una importación sin declarar qué aceptó.
No se puede defender, y por eso queda en «pendiente» y no recibe campañas.

---

## Abajo: quiénes pidieron no recibir más

> Hay **37** peticiones anotadas · **12** de todos los locales.
> No se pueden listar: se guarda una huella y no el correo, para poder cumplir la petición sin
> quedarse con la dirección de quien pidió que la borráramos. Sí se puede preguntar por una
> dirección concreta.

![Las exclusiones](img/06-exclusiones.jpg)
*El número sí se puede mostrar. Las direcciones no: lo que se guarda es una huella.*

### Por qué no se pueden listar

Porque lo que se guarda no es el correo sino una **huella** suya: un código irreversible del que no
se puede volver a la dirección.

Esto resuelve una contradicción real entre dos obligaciones:

| Obligación | Qué exige |
|---|---|
| Art. 28 B, Ley 19.496 | **Recordar** que pidió no recibir. Si lo olvidas, le vuelves a escribir |
| Derecho de supresión, Ley 21.719 | **Borrar** sus datos si te lo pide |

Guardando una huella se cumplen las dos: alcanza para no volver a escribirle y no conserva el dato
de quien pidió que lo borraran.

El precio es que **sólo se puede preguntar, no mirar**. Y preguntar es justo lo que hace falta
cuando alguien llama diciendo «sigo recibiendo correos».

### Consultar una dirección

Escribe el correo y pulsa **Consultar**. Tres respuestas posibles:

| Respuesta | Qué hacer |
|---|---|
| **Pidió no recibir de ningún local** | Nada. Si dice que sigue recibiendo, es un correo de servicio, no publicidad |
| **Pidió no recibir de una empresa** | Ver de cuál y desde cuándo. Si le llegó algo de ésa después de esa fecha, hay un problema |
| **No consta ninguna petición** | Búscala arriba en la lista: puede estar suscrita y no haber pedido la baja nunca |

---

## Anotar una petición recibida por fuera

Botón **«Anotar una petición recibida por fuera»**.

No toda petición de baja llega por el enlace del correo. Llega por tres caminos más, y los tres
obligan igual:

**El SERNAC.** Su sistema «No Molestar» **no es un registro que uno consulte**. Funciona al revés:
el consumidor entra al Portal del Consumidor, escribe su correo y **elige las empresas** que quiere
bloquear; el SERNAC **te reenvía la solicitud**; y tienes **siete días** para cumplirla. Si sigues
escribiéndole, puede presentar un *aviso de incumplimiento*, que es la antesala del procedimiento
sancionatorio.

**Una llamada o un correo a soporte** diciendo «sáquenme de la lista».

**Un reclamo**, donde la prueba de cuándo se aplicó es justo lo que te van a pedir.

![Anotar una petición recibida por fuera](img/06-anotar-peticion.jpg)
*El origen es obligatorio: es lo único que explica por qué esa dirección quedó excluida sin que nadie hiciera clic en nada.*

### Cómo se anota

1. Escribe el **correo**.
2. Escribe **de dónde vino**. Es obligatorio: *«Aviso SERNAC 12-03-2026»*, *«Llamó por teléfono el
   3 de marzo»*. Es lo único que explica por qué esa dirección quedó excluida sin que nadie hiciera
   clic en ningún enlace. Un campo vacío no es una respuesta ante un reclamo.
3. **Anotar la petición**.

Se aplica **a todos los locales**, que es lo que pide quien lo pide por estas vías.

**Funciona aunque la persona no esté en ninguna lista**, y es a propósito: la petición vale igual, y
la exclusión impide que entre después por una reserva. Quien pide no recibir antes de estar no
tiene por qué volver a pedirlo.

---

## Importar y descargar

**Importar** sube un archivo y **exige declarar de dónde salió** y, si lo hubo, el texto que esas
personas aceptaron. Sin eso las filas entran como «pendiente» y no reciben nada.

**Descargar los suscritos** da el archivo de una empresa, **sólo de quienes están suscritos ahora
mismo**. Incluir a quien se dio de baja pondría esa dirección en un archivo que sale del sistema,
donde el enlace de baja ya no funciona y la baja no se puede hacer cumplir.

Queda anotado quién descargó y cuántas filas: desde ese momento, esa copia es responsabilidad de
quien la tiene.

---

## Quién ve qué

| Cargo | La lista | Ficha | Consultar exclusiones | Anotar peticiones |
|---|:--:|:--:|:--:|:--:|
| Administración, Dir. Comercial, Dev | Todas | ✓ | ✓ | ✓ |
| **La cuenta de la empresa** | **Sólo la suya** | ✓ | ✗ | ✗ |

Las exclusiones son **sólo de la agencia**. Una cuenta de empresa preguntando por una dirección
cualquiera sabría si esa persona está en el sistema, que es información de otros locales.

---

## A qué ley responde

**Ley 19.496, art. 28 B.** La lista de exclusión es el mecanismo que hace cumplible el *«quedarán
desde entonces prohibidos»*. Sin ella, la prohibición dependería de que la ficha no se borrara
nunca.

**Ley 21.719, licitud y responsabilidad proactiva.** Hay que poder demostrar el origen de cada
dato y que el tratamiento es lícito. La ficha completa —origen, texto, fecha, IP— es esa
demostración, y por eso ahora se puede leer.

**Ley 21.719, supresión.** Se concilia con lo anterior guardando una huella y no la dirección.

**Ley 21.719, minimización, aplicada a quien mira.** Que una cuenta de empresa no pueda consultar
exclusiones no es jerarquía: es que ese dato no le hace falta para su trabajo y revelaría
información de otras empresas.

---

## Preguntas que van a salir

**Aparece dos veces la misma persona.**
Es correcto si está en dos empresas: son dos permisos distintos. Dentro de una misma empresa no
puede repetirse.

**¿Puedo borrar una fila?**
Desde aquí no. El borrado de datos se pide en /solicitudes y tiene su procedimiento
([manual 08](08-solicitudes-de-derechos.md)). Borrar a mano se saltaría la constancia de la baja.

**Alguien se dio de baja y quiere volver.**
Tiene que pedirlo expresamente, sabiendo que había pedido no recibir. El sistema lo permite por ese
camino y no por otro: reservar de nuevo no basta.

**¿Qué pasa si importo a alguien que está excluido?**
No entra, y la importación te dice cuántas filas se descartaron por eso.
