# Manuales

Uno por cada cosa. Cada manual dice **qué hace**, **cómo se usa paso a paso**, **por qué está
hecho así** y **a qué ley responde** cuando responde a alguna.

Están escritos para quien va a usar la pantalla, no para quien la programó: si un manual necesita
que sepas lo que es un token o una migración, el manual está mal escrito.

| Manual | De qué va | Dónde se usa |
|---|---|---|
| [01 · Beneficios de la red](01-beneficios-de-la-red.md) | La segunda casilla de la página de reserva: recibir promociones de los **demás** locales | Reservas → Constructor → Legales |
| [02 · Casillas del equipo](02-casillas-del-equipo.md) | Quién del equipo recibe cada aviso, sin necesidad de tener cuenta | Reservas → Constructor → Correos del local |
| [03 · Suscribirse sin reservar](03-captacion-y-qr.md) | El enlace y el QR para que alguien entre a la lista sin reservar | Reservas → Publicar |
| [04 · El camino de salida](04-darse-de-baja.md) | Cómo se da de baja alguien, qué pasa después y qué guarda el sistema | Correo del cliente |
| [05 · Campañas](05-campanas.md) | Escribir y enviar un correo a una lista, con cupón y a quién llega | Marketing → Campañas |
| [06 · Suscriptores y exclusiones](06-suscriptores-y-exclusiones.md) | La lista, la prueba de cada dirección, y quién pidió no recibir | Marketing → Suscriptores |
| [07 · Avisos de las encuestas](07-encuestas-y-avisos.md) | Qué pasa cuando alguien escribe un mensaje en una encuesta | Encuestas |
| [08 · Solicitudes de derechos](08-solicitudes-de-derechos.md) | Los plazos legales, la prórroga y los avisos | Administración → Solicitudes |

## Qué trae cada manual

Todos siguen la misma estructura, y ninguna parte sobra:

1. **Qué hace**, en una frase.
2. **Paso a paso**, con una captura por paso.
3. **Qué correo llega**, cuando llega alguno. Compuesto con la misma función que los manda, no
   dibujado: un manual que enseña un correo inventado envejece el día que alguien toca la plantilla.
4. **Las ramas que fallan**, con el mensaje exacto que verás.
5. **Quién puede qué**, por cargo.
6. **Dónde queda cada cosa**: la tabla, la columna, el endpoint, el cron y el interruptor de Correos.
7. **A qué ley responde**, con el artículo.
8. **Preguntas que van a salir.**

Las capturas salen de la instancia de pruebas que se levanta con `npm run dev:visual`. Los correos
se componen con `node scripts/quality/generar-correos-de-ejemplo.cjs`.

## Lo que todos tienen en común

Tres ideas atraviesan todo lo que sigue. Si las entiendes, el resto se explica solo.

**1. Un permiso sirve para una cosa.** Quien te deja el correo para que le confirmes una mesa no te
dio permiso para mandarle promociones. Quien aceptó promociones de un local no se las dio a otro.
Cada permiso se pide por separado, se guarda por separado y se retira por separado.

**2. Lo que no se puede probar, no se puede defender.** De cada dirección se guarda el texto exacto
que la persona leyó, cuándo lo aceptó y desde dónde. No es burocracia: la primera pregunta de
cualquier reclamo es «¿de dónde sacaron mi correo?», y «estaba en un Excel» no es una respuesta.

**3. Salir tiene que ser más fácil que entrar.** Un enlace en cada correo, sin contraseña, sin
formulario, con un botón para salir de todo. Quien no encuentra cómo salirse marca el correo como
spam, y eso le hace daño a todos los locales a la vez.

## Las leyes a las que esto responde

| Ley | Qué exige, en una línea |
|---|---|
| **Ley 19.496, art. 28 B** (consumidor) | Todo correo publicitario debe decir quién lo manda y ofrecer una forma de pedir que paren. Pedida la suspensión, los envíos siguientes **quedan prohibidos**. |
| **Ley 21.719** (datos personales, vigente **1-12-2026**) | Consentimiento libre, específico e informado; retirarlo tiene que ser tan fácil como darlo; derechos de acceso, rectificación, supresión, oposición y portabilidad, con plazos. |
| **Ley 19.628** | La que la 21.719 modifica. Sigue siendo el nombre de la norma. |
| **Reglas de Gmail y Yahoo** (no son ley, pero deciden si tu correo llega) | Autenticación del dominio, menos de 0,3% de quejas, y baja de un clic desde el propio cliente de correo. |
