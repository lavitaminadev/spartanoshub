/**
 * @fileoverview Enlace de WhatsApp para que quien reserva se guarde la confirmación.
 *
 * Qué resuelve: la confirmación vive en una pantalla que se cierra. WhatsApp es donde la gente
 * guarda lo que no quiere perder, y llevar el código ahí evita la llamada de «¿a qué hora era?».
 *
 * **No requiere ninguna integración.** `wa.me` es un enlace normal: abre WhatsApp con el texto
 * escrito y la persona decide si lo envía y a quién. No hay API, ni token, ni número de empresa,
 * ni costo por mensaje, ni aprobación de plantillas.
 *
 * Lo que **no** resuelve, y conviene tener claro antes de prometerlo: no es un mensaje
 * automático. Si el local quiere enviar la confirmación por su cuenta, o recordar el día
 * anterior sin que la persona haga nada, eso sí exige la API de WhatsApp Business y es otro
 * trabajo. Ver `docs/operacion/CONFIRMACION-POR-WHATSAPP.md`.
 *
 * Dónde se usa: `BookingSuccess.tsx`.
 */

export interface BookingShareData {
  /** Nombre del formulario o del local, como se llama de cara al público. */
  formName: string;
  /** Fecha y hora, ya formateadas en la zona horaria del local. */
  when: string;
  referenceCode: string;
  partySize?: number;
  /**
   * Teléfono del local en formato internacional, solo dígitos.
   *
   * Sin él, el enlace abre WhatsApp para que la persona elija destinatario —normalmente se lo
   * envía a sí misma o a quien la acompaña—. Con él, abre la conversación con el local.
   */
  venuePhone?: string;
}

/** Límite práctico del texto en la URL. Por encima, algunos navegadores lo recortan. */
const MAX_TEXT_LENGTH = 1500;

/**
 * Arma el mensaje que se va a compartir.
 *
 * Se escribe en primera persona de quien reserva, no del local: el destinatario más frecuente es
 * uno mismo o un acompañante, y un texto redactado como si lo mandara el negocio se lee raro.
 */
export function buildBookingMessage(data: BookingShareData): string {
  const lineas = [
    `Reserva en ${data.formName}`,
    data.when,
    data.partySize ? `${data.partySize} ${data.partySize === 1 ? 'persona' : 'personas'}` : null,
    `Código: ${data.referenceCode}`,
  ].filter(Boolean);

  return lineas.join('\n').slice(0, MAX_TEXT_LENGTH);
}

/**
 * Enlace `wa.me` listo para usar.
 *
 * @returns La dirección, o `undefined` si falta lo mínimo para armar un mensaje con sentido.
 */
export function buildWhatsAppShareUrl(data: BookingShareData): string | undefined {
  if (!data.referenceCode || !data.formName) return undefined;

  const texto = encodeURIComponent(buildBookingMessage(data));
  // Solo dígitos: `wa.me` rechaza el `+`, los espacios y los guiones.
  const destino = data.venuePhone?.replace(/\D/g, '') ?? '';

  return destino
    ? `https://wa.me/${destino}?text=${texto}`
    : `https://wa.me/?text=${texto}`;
}
