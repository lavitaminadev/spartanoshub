# Campañas

Escribir un correo y mandárselo a una lista. Marketing → **Campañas**.

Es la única comunicación del sistema que nadie pidió individualmente: el resto —confirmación de
reserva, clave temporal, saludo de cumpleaños— responde a algo que esa persona hizo. Por eso es la
que más rejas lleva.

---

## La pantalla

| Asunto | A quién | Cupón | Estado | Llegó a | Cuándo |
|---|---|---|---|---|---|
| Vuelve este fin de semana, {{nombre}} | **Casa Costanera** · Lista de marketing | `VUELVE20` | Borrador | — | — |
| Cambios en tu plan | **Espartanos (agencia)** · Quienes administran | — | Borrador | — | — |
| Novedades de Espartanos | **Espartanos (agencia)** · Lista de marketing | — | Enviada | 197 de 200 | 10-09-2026 |
| Menú de primavera | **Casa Costanera** · Lista de marketing | — | Enviando | 142 de 184 · 2 sin entregar | — |

![La lista de campañas](img/05-campanas-lista.jpg)
*Las columnas nuevas: a quién va —empresa y grupo— y el cupón.*

La columna **A quién** va en dos líneas a propósito: la empresa sola no dice si el correo fue a sus
clientes o a quienes la administran, que son dos correos muy distintos.

---

## Escribir una campaña, paso a paso

### 1 · A qué lista

Se elige al crear y **no se puede cambiar después**. Mover una campaña de empresa mandaría a una
lista un texto escrito para otra, y el permiso de cada lista se dio por separado.

### 2 · A quiénes de esa empresa

| Destino | Quiénes son | Lleva enlace de baja |
|---|---|---|
| **Su lista de marketing** | Quienes aceptaron recibir promociones de esa empresa | Sí |
| **Quienes administran la empresa** | Las cuentas activas de esa empresa en el sistema | **No** |

El segundo es un aviso de servicio a quien contrató —un cambio en su plan, una funcionalidad
nueva—, no publicidad. Por eso no exige permiso de marketing y no lleva enlace de baja: nadie se da
de baja de que le cuenten cómo va el servicio que paga.

**Si lo que vas a mandar es publicidad, éste no es el destino.** La pantalla te lo dice al elegirlo
y otra vez al confirmar el envío.

Sólo cuentas **activas**: escribirle a quien ya no trabaja ahí es filtrarle a un tercero lo que pasa
en esa empresa.

![El editor, destino y destinatarios](img/05-editor-destino.jpg)
*La cifra y los nombres se actualizan al cambiar la lista o el destino, antes de escribir nada.*

### 3 · Asunto y texto

Escribe `{{nombre}}` donde quieras el nombre de quien lo recibe. A quien no lo tenga guardado se le
manda igual y sin el hueco: «Hola ,» delata que no sabías a quién le escribías.

El enlace de baja lo pone el sistema en el pie. No hace falta escribirlo y **no se puede quitar**.

### 4 · Cupón (opcional)

Escribe el código de un cupón que **ya exista** en Cupones. Al guardar se comprueba que:

- exista
- sea **de esta misma empresa**
- esté **activo**
- **no haya vencido**

Si falla cualquiera de las cuatro, el error te dice cuál. Se comprueba al guardar y no al enviar
para que te enteres mientras todavía puedes corregirlo: **un código que la caja rechaza delante del
cliente es peor que no ofrecer ninguno**.

En el correo sale en su propia fila, con la fecha hasta la que vale al lado. Escrito dentro del
texto se pierde entre las frases y quien lo lee en el teléfono tiene que buscarlo para copiarlo; en
su fila se ve de una. Si además quieres nombrarlo dentro de una frase, usa `{{cupon}}`.

![El campo del cupón](img/05-editor-cupon.jpg)
*Las cuatro condiciones que tiene que cumplir el código, explicadas donde se escribe.*

### 5 · Ver cómo queda

Lo compone el servidor con la misma función que el envío, así que **lo que ves es lo que sale**,
con el pie de baja incluido. El nombre va con un dato de ejemplo y el enlace del pie es de muestra.

---

## Antes de apretar el botón

Mientras escribes, la pantalla te dice en vivo:

> Ahora mismo llegaría a **184 personas** · La lista de esta empresa
> Por ejemplo: Ana Moya, Diego Ruiz, Fernanda Riquelme, luis@correo.cl, Carmen Soto…

Y al enviar, otra vez, con la cifra, la frase de qué lista es, unos nombres y el cupón si lo lleva.
**Hay que escribir el número a mano para confirmar.**

![La confirmación del envío](img/05-confirmar-envio.jpg)
*El cupón con su fecha, la cifra, unos nombres y «y 179 más». Abajo, la cifra escrita a mano.*

Es deliberadamente incómodo. Un envío no se deshace, y escribir la cifra obliga a mirarla en vez de
confirmar por reflejo. Si el número cambió entre que abriste la pantalla y el envío, lo que
escribes ya no cuadra y tienes que volver a mirar.

«312 personas» no dice si son las que crees. La muestra de nombres va corta a propósito: sirve para
**reconocer** la lista, no para leerla —eso está en Suscriptores, con sus filtros—.

---

## Qué pasa después de enviar

El botón **encola; no manda**. Los correos salen por tandas en las siguientes pasadas del cron, y
la pantalla muestra el avance.

Mandar todo en el momento era el error: doscientos correos no caben en una petición —el cron corta
al minuto y el servidor antes—, así que la lista se enviaba a medias y la campaña quedaba en
«enviando» para siempre, sin forma de reanudarla ni de repetirla.

Encolar gana tres cosas: un rebote reintenta a **esa persona** y no a la campaña, una ejecución que
muere a medias la recoge la siguiente pasada, y queda constancia de a quién le llegó.

**Una baja entre el encolado y el envío se respeta.** Entre que aprietas el botón y sale el último
correo pasan minutos, y en ese rato alguien puede darse de baja desde un correo anterior. La
comprobación va pegada al envío, no a la intención.

Lo que no se pudo entregar se reintenta tres veces y sólo si el fallo suena a problema del momento.
Un rebote permanente —dirección que no existe— da el mismo resultado las tres veces.

---

## Dos cosas que esta pantalla no tiene, a propósito

**No hay caja para escribir direcciones a mano.** Una dirección sin procedencia no se puede
defender ante «¿de dónde sacaron mi correo?», que es la primera pregunta de cualquier reclamo. Para
eso está **Importar**, que exige declarar de dónde salió y deja constancia; una vez importadas, la
campaña las alcanza como a cualquier otra.

**No hay «todas las listas».** Quien aceptó promociones de Casa Costanera se las dio **a Casa
Costanera**, no a Espartanos ni a Bar Ruperto. Mandarle a todas de una vez usaría un permiso dado
para una cosa en otra.

Para hablarle a quien sí quiere saber de toda la red está la **lista de la agencia**, que tiene el
permiso correcto y se llena sola con la casilla de la red ([manual 01](01-beneficios-de-la-red.md)).
Se elige como cualquier otra empresa.

---

## Quién puede qué

| Cargo | Escribir | Enviar |
|---|:--:|:--:|
| Administración, Dirección Comercial, Dev | ✓ | ✓ (con permiso `manage`) |
| **La cuenta de la empresa** | ✗ | ✗ |

Enviar exige un permiso mayor que escribir: mandar un correo a una lista entera no se deshace, y no
es lo mismo que redactar el borrador.

Una cuenta de empresa mira su lista y **se la descarga** para escribir por su cuenta; enviar desde
aquí no. No es desconfianza: quien aprieta el botón responde de que cada dirección de esa lista
tenga respaldo, y ese respaldo lo lleva la agencia.

---

## A qué ley responde

**Ley 19.496, art. 28 B.** Cada correo lleva identificación del remitente y enlace de suspensión, y
el enlace no se puede desactivar. La comprobación pegada al envío es lo que cumple el *«quedarán
desde entonces prohibidos»* incluso para una baja ocurrida dos minutos antes.

**Ley 21.719, finalidad.** Los datos sólo pueden tratarse para fines *determinados, explícitos y
legítimos*. De ahí sale que no se pueda cambiar la lista de una campaña ya escrita, y que no exista
«todas las listas».

**Ley 21.719, exactitud y responsabilidad proactiva.** La campaña enviada no se borra ni se edita:
ante un reclamo hay que poder decir qué texto salió, a qué lista, quién lo mandó y cuándo.

**Por qué el destino «administradores» no lleva baja.** Porque no es comunicación promocional sino
información del servicio contratado, prestada en el marco de una relación contractual. El art. 28 B
habla de comunicaciones *promocionales o publicitarias*. Si alguna vez se usa para venderles algo,
deja de ser esto y necesita su propio respaldo.

---

## Preguntas que van a salir

**¿Puedo repetir una campaña ya enviada?**
No se reenvía la misma. Duplica el texto en una nueva: así queda constancia de que fueron dos
envíos distintos, que es lo que realmente ocurrió.

**¿Por qué no puedo borrar una campaña enviada?**
Porque su texto es la constancia de lo que salió. Los borradores sí se descartan.

**Puse un cupón y me dice que es de otra empresa.**
Los cupones son por empresa. Crea uno para esta en Cupones, o elige el de esta empresa.

**«No hay nadie suscrito en esta lista ahora mismo».**
Los que están en «pendiente» —importados sin declarar qué aceptaron— y los que se dieron de baja no
cuentan. Mira la lista en Suscriptores filtrando por estado.
