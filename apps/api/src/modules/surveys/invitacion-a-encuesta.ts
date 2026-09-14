import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * El enlace de la encuesta que llega por correo después de una visita.
 *
 * Permite saber quién respondió sin pedirle que se identifique: la invitación dice de qué reserva
 * viene, y está firmada para que nadie pueda fabricar una que atribuya respuestas a otra persona
 * cambiando un número en la dirección.
 *
 * **No lleva datos personales.** Sólo la encuesta, la reserva y el vencimiento. Un enlace se
 * reenvía, queda en el historial del navegador y en los registros de cualquier servidor por el
 * que pase; el nombre y el correo se buscan en la reserva al responder, del lado del servidor.
 *
 * La clave se deriva del secreto de la aplicación con un propósito propio. Firmar invitaciones con
 * la misma clave que las sesiones haría que una firma válida en un contexto pudiera presentarse
 * en el otro.
 */

/** Cuánto vale una invitación. Un mes cubre a quien abre el correo tarde, sin dejarla eterna. */
export const VIGENCIA_INVITACION_SEGUNDOS = 30 * 24 * 3600;

export interface Invitacion {
  surveyId: string;
  reservationId: string;
  /** Segundos desde epoch. */
  expira: number;
}

function clave(secreto: string): Buffer {
  return createHmac('sha256', secreto).update('espartanos:invitacion-a-encuesta:v1').digest();
}

function firmar(cuerpo: string, secreto: string): string {
  return createHmac('sha256', clave(secreto)).update(cuerpo).digest('base64url');
}

/**
 * Arma la invitación para una reserva.
 *
 * @param ahora Inyectable para las pruebas; en producción es el reloj.
 */
export function crearInvitacion(surveyId: string, reservationId: string, secreto: string, ahora: number = Date.now()): string {
  if (!secreto) throw new Error('Falta el secreto para firmar la invitación');
  const cuerpo = Buffer.from(JSON.stringify({
    s: surveyId,
    r: reservationId,
    x: Math.floor(ahora / 1000) + VIGENCIA_INVITACION_SEGUNDOS,
  })).toString('base64url');
  return `${cuerpo}.${firmar(cuerpo, secreto)}`;
}

/**
 * Lee una invitación, o `null` si no sirve.
 *
 * Devuelve `null` —y no lanza— para cualquier forma de invitación inválida: firma que no
 * coincide, vencida, de otra encuesta o mal formada. La encuesta se sigue pudiendo responder de
 * forma anónima; lo único que se pierde es la atribución, que es justo lo que no se puede dar por
 * buena sin firma.
 *
 * @param surveyId La encuesta que se está respondiendo. Una invitación de otra no vale acá.
 */
export function leerInvitacion(token: string | undefined, surveyId: string, secreto: string, ahora: number = Date.now()): Invitacion | null {
  if (!token || !secreto || token.length > 600) return null;
  const partes = token.split('.');
  if (partes.length !== 2) return null;
  const [cuerpo, firma] = partes;

  const esperada = Buffer.from(firmar(cuerpo, secreto));
  const recibida = Buffer.from(firma);
  // La comparación en tiempo constante evita adivinar la firma midiendo cuánto tarda en fallar.
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;

  let datos: { s?: unknown; r?: unknown; x?: unknown };
  try {
    datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof datos.s !== 'string' || typeof datos.r !== 'string' || typeof datos.x !== 'number') return null;
  if (datos.s !== surveyId) return null;
  if (datos.x * 1000 < ahora) return null;
  return { surveyId: datos.s, reservationId: datos.r, expira: datos.x };
}
