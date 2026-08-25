/**
 * @fileoverview Cómo se contacta y cómo se reconoce a alguien, en una sola copia.
 *
 * Lo usan la tarjeta del tablero y la ficha. Con una copia en cada una, el enlace de WhatsApp
 * se armaba distinto según por dónde se pulsara, y el color de una persona cambiaba al pasar
 * de una pantalla a la otra: dejaba de servir para reconocerla de un vistazo, que es lo único
 * para lo que existe.
 */

/**
 * Enlace de WhatsApp: `wa.me` solo acepta dígitos, sin `+` ni espacios.
 *
 * @param telefono - Teléfono del lead, tal como está guardado.
 * @param mensaje - Texto con el que abre la conversación. Si no se pasa, se abre el chat vacío.
 */
export function whatsapp(telefono?: string | null, mensaje?: string): string | undefined {
  const digitos = telefono?.replace(/\D/g, '');
  if (!digitos) return undefined;
  return mensaje
    ? `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`
    : `https://wa.me/${digitos}`;
}

/**
 * Primer mensaje a un lead, ya redactado.
 *
 * Quien atiende escribe lo mismo veinte veces al día y cada vez distinto; con el texto puesto,
 * la persona al otro lado recibe siempre quién la contacta y por qué, que es lo que evita que
 * el mensaje se lea como spam.
 *
 * Cada dato que falta se omite en vez de dejar un hueco: sin el interés, el mensaje sigue
 * teniendo sentido; con un «por tu interés en undefined», no.
 *
 * @param nombre - Nombre del lead. Solo se usa el primero, como se saluda de verdad.
 * @param empresa - Quién contacta, tal como debe leerlo el destinatario.
 * @param interes - Campaña o producto por el que consultó, si se sabe.
 */
export function mensajeDePrimerContacto(
  { nombre, empresa, interes }: { nombre?: string | null; empresa?: string | null; interes?: string | null },
): string {
  const saludo = nombre?.trim().split(/\s+/)[0];
  return [
    saludo ? `Hola ${saludo},` : 'Hola,',
    empresa?.trim() ? ` te contactamos de ${empresa.trim()}` : ' te contactamos',
    interes?.trim() ? ` por tu interés en ${interes.trim()}` : '',
    '. ¿Cuándo podemos conversar?',
  ].join('');
}

/**
 * Color estable de una persona, derivado de su identificador.
 *
 * No se guarda en ningún sitio: se calcula, así que un miembro nuevo del equipo tiene color sin
 * que nadie se lo asigne. La paleta sale de los tonos de marca y no de colores al azar, para que
 * el tablero no termine con avatares que discuten con el resto de la pantalla.
 */
export function colorDePersona(id?: string | null): string {
  const paleta = ['#0fb9b1', '#ec0b61', '#7040a0', '#c67912', '#1f6fb2', '#087e79'];
  if (!id) return paleta[0];
  let suma = 0;
  for (const caracter of id) suma += caracter.charCodeAt(0);
  return paleta[suma % paleta.length];
}
