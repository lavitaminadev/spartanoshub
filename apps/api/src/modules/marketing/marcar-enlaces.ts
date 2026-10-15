/**
 * @fileoverview Marca los enlaces propios de un correo de campaña para poder atribuirle lo que trajo.
 *
 * Sin esto, una reserva que llega desde una campaña es indistinguible de cualquier otra: el
 * correo salía sin ninguna marca y no había llave con la que unirlos. Lo que falta no es una
 * consulta, es el dato.
 */

/**
 * Nombre de campaña legible para la columna `utm_campaign` de la reserva.
 *
 * Se usa el asunto y no el identificador: ese nombre aparece tal cual en el filtro de Reservas,
 * y un uuid ahí no le dice nada a quien lo lee. Se queda fijo al enviar, así que editar el
 * asunto después no desordena lo ya atribuido.
 */
export function nombreDeCampana(asunto: string): string {
  const limpio = asunto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  // 180 es el largo de `reservations.utm_campaign`: cortar acá evita que la base lo trunque a medias.
  return (limpio || 'campana').slice(0, 180);
}

/**
 * Agrega las marcas a los enlaces que apuntan al sitio propio, y sólo a ésos.
 *
 * **Nunca toca enlaces de terceros.** Añadirle parámetros al enlace de un proveedor o de una red
 * social es, en el mejor caso, ruido en la analítica de otro, y en el peor rompe una URL firmada.
 * Se compara el origen completo contra el del sitio, así que un dominio que apenas se le parezca
 * queda fuera.
 *
 * Lo ya marcado se respeta: si quien escribió la campaña puso su propio `utm_campaign`, manda el
 * suyo. Marcar encima convertiría una decisión deliberada en un accidente.
 *
 * @param html - El correo ya compuesto.
 * @param base - `APP_PUBLIC_URL`. Sin ella no se marca nada: es preferible no atribuir a
 *   atribuirle a un dominio equivocado.
 * @param campana - El nombre que viajará en `utm_campaign`.
 */
export function marcarEnlacesPropios(html: string, base: string | undefined, campana: string): string {
  if (!base || !campana) return html;
  let origen: string;
  try {
    origen = new URL(base).origin;
  } catch {
    return html;
  }

  return html.replace(/href="([^"]+)"/g, (completo, url: string) => {
    let destino: URL;
    try {
      destino = new URL(url);
    } catch {
      // Un `href` relativo, un `mailto:` o un ancla: nada que atribuir.
      return completo;
    }
    if (destino.origin !== origen) return completo;
    /*
     * El enlace de baja se deja intacto.
     *
     * Marcarlo contaría como visita de campaña a quien entró justamente a dejar de recibirlas, y
     * ensuciaría el embudo con el movimiento que lo cierra.
     */
    if (destino.pathname.includes('/baja')) return completo;

    if (!destino.searchParams.has('utm_campaign')) {
      destino.searchParams.set('utm_source', 'campana');
      destino.searchParams.set('utm_medium', 'email');
      destino.searchParams.set('utm_campaign', campana);
    }
    return `href="${destino.toString().replace(/&/g, '&amp;')}"`;
  });
}
