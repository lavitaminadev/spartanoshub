# Protección de datos y correo comercial

Al 30 de septiembre de 2026. La **Ley 21.719** entra en vigencia el **1 de diciembre de 2026**.

---

## 1. Plazo de conservación de los registros de baja — **decidido, falta firmarlo**

### La recomendación

| Qué | Cuánto se conserva | Qué es exactamente |
|---|---|---|
| **Huella de exclusión** (`email_suppression`) | **Indefinida mientras exista la lista de correo** | SHA-256 de `organización:correo`. No contiene la dirección. |
| Ficha del suscriptor dada de baja (nombre, correo, texto aceptado) | **5 años** desde la baja, luego se anonimiza | Es la prueba de que hubo consentimiento y de cuándo se retiró. |
| Constancia de respuesta a una solicitud de derechos | **5 años** desde la respuesta | La ley obliga a guardar el respaldo de la remisión, su fecha y el contenido íntegro. |

### Por qué la huella es indefinida

**No es una decisión de conveniencia, es la única compatible con las dos leyes a la vez.**

El artículo 28 B de la Ley 19.496 dice que, pedida la suspensión, los envíos *«quedarán desde
entonces prohibidos»*. No fija plazo, no admite caducidad y no contempla que la prohibición se
extinga. **Borrar la huella significa volver a escribirle**, y eso es el incumplimiento que la
norma prohíbe. Un plazo de conservación aquí no sería prudencia: sería programar la infracción.

Al mismo tiempo, la Ley 21.719 da derecho a supresión. Las dos se concilian porque **lo que se
conserva no es un dato personal utilizable**: es un hash irreversible que sólo sirve para
responder «¿a esta dirección le prohibí escribir?» cuando ya se tiene la dirección por otra vía.
No se puede listar, no se puede revertir, y no permite reconstruir a quién pertenece. Es el
mínimo necesario para cumplir un deber legal, que es precisamente la excepción que hace que la
supresión no lo alcance.

### Por qué cinco años para lo demás

Tres plazos se superponen y manda el más largo:

1. **Prescripción infraccional** — Ley 19.496 art. 26: las acciones contravencionales prescriben
   en **seis meses** desde la infracción, y el plazo **se suspende** mientras dure un procedimiento
   ante el SERNAC. Seis meses es el piso, no el techo: un procedimiento suspendido puede estirarlo
   mucho más.
2. **Reclamo ante la Agencia** — tras responder una solicitud de derechos, el titular tiene **30
   días hábiles** para reclamar ante la Agencia de Protección de Datos Personales. Durante ese
   plazo y durante lo que dure el reclamo, el respaldo de la respuesta es la defensa.
3. **Prescripción civil ordinaria** — 5 años (Código Civil art. 2515) para acciones de daños.

Cinco años cubre los tres sin quedarse corto y sin convertirse en «para siempre», que es lo que
el principio de proporcionalidad no admite para un dato que sí identifica.

### Qué hay que hacer con esto

1. Que un abogado lo revise y lo firme.
2. Escribirlo en la política de privacidad: el plazo publicado y el real tienen que coincidir.
3. Si se decide un plazo distinto para la huella, hay que implementar el borrado **y asumir que a
   partir de ese momento esas direcciones pueden volver a recibir correo**. Conviene decirlo así
   de claro al decidir.

---

## 2. Los dos ajustes que no corría nadie — **resueltos**

**Retención de comentarios de trabajo.** La función de despersonalización existía desde hacía
meses y no la llamaba nadie: el ajuste se podía cambiar en pantalla y no tenía ningún efecto. Lo
que faltaba era decidir *qué trabajos cuentan*, y sólo cuentan los cerrados —entregado, aprobado o
cancelado en producción; sesión realizada o cancelada; solicitud convertida o rechazada—. Un
trabajo abierto puede llevar meses y su hilo es la conversación viva sobre algo que todavía se
está haciendo; vaciarlo por antigüedad borraría el porqué de lo que el equipo mira hoy. Corre
dentro del trabajo de retención diario. Sin plazo fijado no hace nada, que es lo correcto: «sin
plazo» no significa «bórralo ya».

**Plazo de respuesta a solicitudes de derechos.** El plazo estaba escrito en las políticas que el
comensal lee y en ninguna parte del sistema: nadie lo calculaba y nadie avisaba, así que una
solicitud podía vencer sin que se enterara nadie. Ahora:

- Se calcula al leer la lista y se ordena por vencimiento, no por fecha de entrada: primero lo que
  está por vencer, no lo último que llegó.
- Aviso a la dirección desde **una semana antes**, y otro distinto cuando vence. Una semana porque
  responder bien toma días y avisar la víspera no sirve.
- La **prórroga** se puede anotar: una sola vez, con motivo, y sólo antes del vencimiento. Las
  tres condiciones se comprueban en el servidor porque son de la ley. Prorrogar vencido no es una
  prórroga, es un incumplimiento con mejor cara, y dejarlo pasar daría un papel que dice que se
  cumplió cuando no se cumplió.

**Plazo verificado contra el texto oficial:** 30 días **corridos** desde el ingreso, prorrogable
**una sola vez** por hasta 30 días corridos más, avisando antes y fundadamente. Varias guías
comerciales publican «15 días hábiles» o «3 días hábiles»; **no coinciden con la ley** y no se
siguieron.

---

## 3. Captación pública y QR — **hecho**

Faltaba el tercer camino. Una dirección sólo entraba marcando la casilla al reservar o importando
un archivo con su procedencia declarada; quien quería recibir las promociones sin reservar —el QR
de la carta, el cartel del mesón— no tenía por dónde.

`/novedades/<slug>`, pública y sin sesión. El enlace aparece en el paso de publicar del
constructor, junto al de reservas pero aparte: son dos puertas distintas.

Todo lo que la hace defendible lo pone el servidor:

- El texto que se acepta sale de la identidad legal del local, no del navegador. Un texto que
  viaja desde el cliente no prueba nada porque se puede cambiar, y el texto **es** la prueba.
- Se guarda ese texto, la fecha, la IP y la declaración de mayoría de edad.
- Se consulta la lista de exclusión **antes** de crear nada: a quien pidió no recibir no se le
  vuelve a suscribir en silencio, y la página se lo dice en vez de fingir que lo sumó.
- Campo trampa y límite de 3 por minuto. Es el único endpoint público que crea un dato personal a
  partir de una dirección de correo: sin freno sirve para averiguar si alguien está en el sistema.

---

## 4. Registro «No Molestar» del SERNAC — **investigado y resuelto en lo que nos toca**

**Lo que yo había supuesto estaba mal.** No es un registro que las empresas consulten antes de
enviar. Funciona al revés:

1. El consumidor entra al Portal del Consumidor, escribe su correo o teléfono y **elige las
   empresas** que quiere bloquear. No es un bloqueo general.
2. El SERNAC **reenvía la solicitud** a esas empresas.
3. La empresa tiene **siete días** para cumplir, y el consumidor recibe aviso del estado.
4. Si siguen escribiéndole, puede presentar un **aviso de incumplimiento** desde la misma
   plataforma. Ese aviso es la antesala del procedimiento sancionatorio.

**Consecuencia práctica:** no hay nada que consultar, hay algo que **aplicar en siete días**. Y
eso no se podía hacer: la única forma de entrar a la lista de exclusión era que la persona hiciera
clic en el enlace de un correo. Un aviso del SERNAC —o una llamada, o un correo a soporte— obligaba
a editar la base de datos a mano, o a no cumplir.

**Resuelto:** en Suscriptores hay ahora «Anotar una petición recibida por fuera». Exige decir de
dónde vino —«Aviso SERNAC 12-03-2026»— porque eso es lo único que explica por qué una dirección
quedó excluida sin que nadie hiciera clic en nada. Funciona aunque la persona no esté en ninguna
lista, y así tampoco entra después por una reserva.

**Pendiente operativo, no de código:** decidir **qué casilla recibe los avisos del SERNAC** y que
alguien la mire. Siete días corridos se pasan en una semana de vacaciones.

---

## 5. Las tres decisiones para el abogado

Tomadas con criterio y lectura de la ley, no con asesoría. Esto es en qué se fundan.

### 5.1 La baja es por empresa, con un botón para salir de todas

**Se funda en que cada local es responsable distinto de sus datos.** Quien aceptó recibir
promociones de Casa Costanera se las dio a Casa Costanera; ese consentimiento no alcanza a Bar
Ruperto y la baja de uno no es la revocación del otro. Si una baja sacara automáticamente de
todas, el sistema estaría decidiendo por la persona que ya no quiere saber de locales donde sí
quiere seguir.

**El riesgo que se asume, y cómo se mitiga:** que alguien crea que se dio de baja «de todo» y siga
recibiendo de otro local. Por eso el botón de «darme de baja de todos» está a la vista desde el
primer momento, no escondido detrás del primer paso, y la página lo dice con palabras. La
alternativa —no ofrecerlo— empuja a la gente a «marcar como spam», que hunde la reputación del
servidor y perjudica a todos los locales.

**Qué confirmar:** si el artículo 28 B se satisface con una suspensión por responsable, o si la
Agencia va a exigir que una petición alcance a todo el grupo económico.

### 5.2 Un consentimiento nuevo levanta una baja anterior, pero sólo expreso y advertido

**Se funda en que el artículo 28 B prohíbe los envíos «desde entonces», no para siempre y contra
la voluntad de la persona.** Un consentimiento posterior, libre e informado, es un hecho nuevo.
Pero no cualquier cosa cuenta como tal: **reservar de nuevo no basta**, porque quien reserva está
pidiendo una mesa, no publicidad, y tratarlo como permiso sería exactamente lo que la norma
impide.

Por eso el sistema exige dos cosas juntas: una casilla marcada a propósito **y** que antes se le
haya advertido que había pedido no recibir. Sin la advertencia no se levanta nada.

**Qué confirmar:** si esa advertencia basta, o si hace falta constancia aparte del momento en que
se le advirtió.

### 5.3 Los plazos y la prórroga

Verificados contra el texto oficial: 30 días corridos, prorrogables una vez por hasta 30 más, con
aviso previo y fundado. La duda no es el número sino la forma: **qué tiene que decir el aviso de
prórroga y cómo se acredita** que se mandó antes del vencimiento. El sistema guarda la fecha y el
motivo; si hace falta guardar el texto enviado al titular, es un cambio pequeño y conviene saberlo
antes del 1 de diciembre.

---

## Cómo está hoy el camino de salida

```
Correo comercial → pie «Dar de baja» (y el botón nativo de Gmail/Yahoo)
  → GET  /api/marketing/suscriptores/baja/:token   pregunta, no ejecuta
  → POST /api/marketing/suscriptores/baja/:token   ejecuta
     · alcance=local → sólo esa empresa
     · alcance=todas → todas sus fichas + huella en email_suppression
  → pie de la página → /solicitudes (acceso, rectificación, supresión)

Aviso del SERNAC / llamada / correo a soporte
  → Suscriptores → «Anotar una petición recibida por fuera»  (7 días para cumplir)
```

Que el GET no ejecute no es un trámite de más: los antivirus de correo y la previsualización de
Outlook abren los enlaces de un mensaje para revisarlos, y con la baja colgada del GET se daba de
baja a gente que nunca hizo clic. Como no se puede deshacer sola, no se arreglaba después.

---

## Fuentes consultadas

- [Ley 21.719, texto oficial — BCN](https://www.bcn.cl/leychile/navegar?idNorma=1209272)
- [Ley 19.628 con las modificaciones vigentes desde el 1-12-2026 — BCN](https://www.bcn.cl/leychile/navegar?idNorma=141599&idVersion=2026-12-01)
- [Ley 19.496, art. 26 (prescripción) — BCN](https://www.bcn.cl/leychile/navegar?idNorma=61438&idParte=8542458)
- [SERNAC — Solicitar no recibir publicidad no deseada (No Molestar)](https://www.sernac.cl/portal/617/w3-article-9184.html)
- [SERNAC — Aviso de incumplimiento](https://www.sernac.cl/portal/617/w3-article-58437.html)
- [ChileAtiende — Aviso de incumplimiento No Molestar](https://www.chileatiende.gob.cl/fichas/78787-aviso-de-incumplimiento-para-dejar-de-recibir-publicidad-no-deseada-o-spam-no-molestar)
