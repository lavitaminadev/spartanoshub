import type { ParameterResolver } from '../parameters/parameter-resolver.service';

/**
 * Qué correos son comerciales y por tanto nacen con el enlace de baja encendido.
 *
 * Una confirmación de reserva o una clave temporal no son publicidad: son parte de lo que la
 * persona pidió, y ofrecerle darse de baja de ellas la dejaría sin el servicio que contrató. Los
 * de esta lista sí lo son, aunque sean amables: una felicitación de cumpleaños de la que no se
 * puede uno bajar es exactamente lo que la normativa persigue.
 */
const COMERCIALES = new Set([
  'email.birthday',
  'email.coupon',
  'email.survey_invite',
  'email.team_survey_message',
]);

/** Si esa plantilla nace con el enlace encendido. Lo usa el catálogo y la pantalla de Correos. */
export function esCorreoComercial(prefijo: string): boolean {
  return COMERCIALES.has(prefijo);
}

/**
 * La dirección de baja de una persona, si ese correo la lleva.
 *
 * Devuelve `undefined` cuando el correo no es comercial, cuando quien administra apagó el
 * interruptor de esa plantilla, o cuando no hay token —una dirección que no está en la lista de
 * suscriptores no tiene de qué darse de baja—.
 *
 * El `origen` viaja en la dirección para dejar constancia de desde qué correo se pidió la baja:
 * del alta se guardaba todo y de la baja sólo la fecha.
 *
 * @param prefijo - La plantilla, como `email.birthday`.
 * @param token - Token del suscriptor. Sin él no hay enlace.
 */
export async function enlaceDeBaja(
  parametros: ParameterResolver | undefined,
  prefijo: string,
  token: string | null | undefined,
  alcance: { clientId?: string | null; organizationId?: string | null },
): Promise<string | undefined> {
  const base = process.env.APP_PUBLIC_URL?.replace(/\/$/, '');
  if (!base || !token || !esCorreoComercial(prefijo)) return undefined;

  /*
   * El interruptor puede apagarlo, pero la pantalla advierte antes lo que eso significa.
   *
   * Se deja apagar porque quien administra puede tener un caso que hoy no podemos prever; lo que
   * no se hace es apagarlo en silencio. Ante un fallo al leerlo, el enlace va: equivocarse hacia
   * el lado de ofrecer la baja no rompe nada, y al revés sí.
   */
  if (parametros) {
    const encendido = await parametros
      .get(`${prefijo}_unsubscribe`, alcance.clientId ?? null, null, alcance.organizationId ?? null)
      .catch(() => true);
    if (encendido === false) return undefined;
  }
  return `${base}/api/marketing/suscriptores/baja/${encodeURIComponent(token)}?origen=${encodeURIComponent(prefijo)}`;
}
