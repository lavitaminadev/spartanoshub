# Suscribirse sin reservar

El enlace y el QR para que alguien entre a tu lista sin tener que reservar.
Reservas → el local → paso **Publicar**.

Sirve para el QR de la carta, el cartel del mesón, el pie de la boleta o el perfil de Instagram:
sitios donde la persona **ya está dentro** y pedirle que reserve no viene a cuento.

---

## Dónde está el enlace

En el paso **Publicar**, debajo del enlace de reservas, aparece un segundo bloque:

> **ENLACE PARA SUSCRIBIRSE SIN RESERVAR**
> `https://cuartel.espartanos.cl/novedades/casa-costanera`
> [Copiar] [Abrir]

![El enlace en el paso de publicar](img/03-enlace-suscribirse.jpg)
*Debajo del enlace de reservas, con sus propios botones de copiar y abrir.*

Está aparte a propósito: son dos puertas distintas. La de arriba lleva a tomar una mesa; ésta sólo
recoge el correo de quien quiere enterarse.

**Aparece cuando el local está publicado.** Antes de publicar no existe, porque la página pública
tampoco.

## Para hacer el QR

Copia el enlace y pásalo por cualquier generador de QR. No hay uno dentro del sistema a propósito:
un QR es una imagen que se imprime una vez y vive dos años en una carta, así que conviene hacerlo
con la herramienta de diseño que uses para la carta, al tamaño y con el logo que corresponda.

Lo único importante: **el enlace no cambia nunca** mientras no cambies el nombre corto del local.
Si lo cambias, el QR impreso deja de funcionar.

---

## Qué ve la persona

```
Novedades de Casa Costanera - Providencia
Déjanos tu correo y te contamos lo que vale la pena.

Correo *                [                    ]
Nombre (opcional)       [                    ]
Tu cumpleaños (opcional)[                    ]

□ Quiero recibir las novedades y beneficios de Casa Costanera *
  ▸ Ver qué estoy aceptando
□ Declaro ser mayor de 18 años (opcional)

                        [ Quiero recibirlas ]
```

![La página de captación](img/03-captacion.jpg)
*Con el texto desplegado. Es el mismo que se guarda como prueba del consentimiento.*

**El botón no se habilita** hasta que haya un correo con forma de correo y la casilla marcada.

**«Ver qué estoy aceptando»** despliega el texto legal completo. No es un enlace a otra página: es
el texto, ahí mismo, porque lo que hay que poder demostrar después es lo que la persona tenía
delante cuando aceptó.

**El cumpleaños se pide y no se exige.** Sólo sirve si el local manda el beneficio de cumpleaños;
exigirlo para suscribirse sería pedir un dato que no hace falta para la finalidad.

---

## Qué pasa al enviar

| Si… | La página dice | Qué guarda |
|---|---|---|
| Es alguien nuevo | «Listo. Vas a recibir las novedades de…» | Ficha nueva, suscrita |
| Ya estaba suscrito | «Listo» igual | Completa lo que faltaba (nombre, cumpleaños) |
| **Pidió no recibir antes** | «Ya nos habías pedido que no te escribiéramos» | **Nada** |

El tercer caso es el importante. Si esa dirección pidió no recibir más, **no se la vuelve a
suscribir**, y la página se lo dice en vez de fingir que la sumó. Si de verdad cambió de opinión,
la página le pide que escriba, porque es preferible preguntárselo a darlo por hecho.

De cada alta se guarda:

- El **texto exacto** que se mostró
- La **fecha y hora**
- La **dirección IP** desde la que aceptó
- Si **declaró ser mayor de edad**
- La **procedencia**: `Se suscribió · captación · Casa Costanera`

---

## Por qué el texto lo pone el servidor

El texto que la persona acepta **no lo escribe la página**. Lo genera el servidor con la identidad
legal del local —razón social, RUT, correo de privacidad— y la página sólo lo muestra.

La razón es simple: cualquiera puede abrir las herramientas del navegador y cambiar lo que una
página muestra. Si el texto viajara desde el navegador al guardarse, la «prueba» del consentimiento
sería un texto que el propio interesado pudo haber modificado. **El texto es la prueba**, así que
tiene que venir de donde no se puede tocar.

Es el mismo texto que usa la casilla de la página de reserva. Una sola fuente: si cambia la razón
social del local, cambia en los dos sitios a la vez.

---

## Las defensas que tiene

**Campo trampa.** Hay un campo invisible para una persona —está fuera de la pantalla y oculto a los
lectores de pantalla— que un robot rellena por costumbre. Si llega lleno, la página responde que
todo salió bien y **no guarda nada**. Decirle que fue rechazado le enseña a reintentar de otra
forma.

**Tres envíos por minuto.** Es el límite más estricto de todo el sistema público, y es a propósito:
es el único sitio donde se crea un dato personal a partir de una sola dirección de correo. Sin
freno, serviría para averiguar si una persona está en el sistema probando direcciones, o para
llenar la lista con correos ajenos.

**Consulta de exclusión antes de crear nada.** Explicado arriba.

---

## A qué ley responde

**Ley 19.496, art. 28 B.** Todo lo que salga de esta lista llevará identificación del remitente y
enlace de suspensión. La página ya lo anuncia al pie: *«Cada correo lleva abajo un enlace para
dejar de recibirlos, y funciona sin tener cuenta»*. Decirlo antes de pedir el dato es parte de
informar.

**Ley 21.719, consentimiento informado.** El texto está a la vista, en la misma pantalla, antes de
aceptar. Una casilla premarcada o un texto escondido detrás de tres clics no cumplen con
«informado».

**Ley 21.719, licitud del origen.** La procedencia queda escrita en cada ficha. Es lo que permite
responder a «¿de dónde sacaron mi correo?» con una frase concreta.

**Ley 21.719, minimización.** Se piden tres datos y dos son opcionales. El único obligatorio es el
correo, que es el que hace falta para la finalidad.

**El art. 28 B manda sobre una casilla marcada después.** Por eso la exclusión se consulta antes de
crear la ficha: pedida la suspensión, los envíos *«quedarán desde entonces prohibidos»*, y una
casilla marcada en otra página no es la misma persona diciendo expresamente que cambió de opinión.

---

## Preguntas que van a salir

**¿Puedo tener un enlace por cada sitio, para saber cuál funciona?**
Hoy no. Todos los que se suscriban por este enlace quedan con la misma procedencia. Si te hace
falta distinguir la carta del mesón, dilo y se puede agregar.

**¿Sirve para la lista de la agencia?**
No: el enlace es de un local y la ficha entra a la lista de ese local. Para la de la agencia está
la casilla de la red en la página de reserva ([manual 01](01-beneficios-de-la-red.md)).

**¿Qué pasa si alguien pone el correo de otra persona?**
Esa persona recibirá el primer correo con su enlace de baja y podrá salirse en un clic, sin
cuenta. Es el motivo por el que el enlace de baja no exige identificarse.

**¿Puedo cambiar el texto de la página?**
El texto legal no. El nombre del local sale del formulario de reservas, así que cambiándolo ahí
cambia aquí.
