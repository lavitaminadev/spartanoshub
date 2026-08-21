/**
 * @fileoverview Cómo se contacta y cómo se reconoce a alguien, en una sola copia.
 *
 * Lo usan la tarjeta del tablero y la ficha. Con una copia en cada una, el enlace de WhatsApp
 * se armaba distinto según por dónde se pulsara, y el color de una persona cambiaba al pasar
 * de una pantalla a la otra: dejaba de servir para reconocerla de un vistazo, que es lo único
 * para lo que existe.
 */

/** Enlace de WhatsApp: `wa.me` solo acepta dígitos, sin `+` ni espacios. */
export function whatsapp(telefono?: string | null): string | undefined {
  const digitos = telefono?.replace(/\D/g, '');
  return digitos ? `https://wa.me/${digitos}` : undefined;
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
