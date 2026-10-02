/**
 * De qué sitio vino una dirección dejada en la página de novedades.
 *
 * Sin esto, toda alta de captación quedaba escrita igual —`captación · <local>`— y la pregunta que
 * el local hace de verdad no tenía respuesta: si trae gente el QR de la carta o el cartel del
 * mesón. Con un enlace por sitio, la respuesta queda guardada en el dato y no hay que deducirla.
 *
 * Vive aparte del servicio porque es una función pura y es la que se puede equivocar: lo que llega
 * por la dirección lo escribe cualquiera en la barra del navegador, y acaba mostrándose en una
 * tabla y descargándose en una planilla.
 */

/** Deja sólo lo que puede ir en una procedencia: minúsculas, letras, números, guion y punto. */
function limpiar(valor?: string): string {
  return (valor ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * La procedencia que se guarda, con el sitio y la campaña si vinieron.
 *
 * Lo ilegible se ignora en vez de rechazarse: una UTM rota no es razón para perder un
 * consentimiento válido, y la dirección vale lo mismo sin saber de qué cartel salió.
 */
export function origenDeCaptacion(local: string, canal?: string, campana?: string): string {
  const partes = [`captación · ${local}`];
  const sitio = limpiar(canal);
  if (sitio) partes.push(sitio);
  const cual = limpiar(campana);
  if (cual) partes.push(`campaña ${cual}`);
  return partes.join(' · ').slice(0, 255);
}
