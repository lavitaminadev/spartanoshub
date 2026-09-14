/**
 * @fileoverview De dónde llegó una visita cuando el enlace no trae UTM.
 *
 * Una UTM escrita (o un enlace corto por canal) siempre manda: esto es sólo el respaldo para quien
 * llega por la bio de Instagram, un anuncio o una búsqueda sin enlace marcado. Lo detectado se
 * guarda con `utm_content = deteccion-automatica`, para que en los resultados se distinga de lo
 * que alguien marcó a propósito sin romper cómo Google Analytics agrupa fuente y medio.
 *
 * WhatsApp, QR, correo y SMS no dejan rastro: sin enlace por canal quedan como directo.
 */

export const CONTENIDO_DETECTADO = 'deteccion-automatica';

export interface OrigenDetectado {
  source: string;
  medium: string;
  content: string;
}

/** Aplicaciones que abren enlaces en su propio navegador y se identifican en él. */
const NAVEGADORES_INTERNOS: Array<[RegExp, string]> = [
  [/Instagram/i, 'instagram'],
  [/FBAN|FBAV|FB_IAB|FBIOS/i, 'facebook'],
  [/musical_ly|Bytedance|TikTok/i, 'tiktok'],
  [/LinkedInApp/i, 'linkedin'],
];

/** Sitios de origen conocidos por su dominio. */
const SITIOS: Array<[RegExp, string, string]> = [
  [/(^|\.)maps\.google\.|google\.[a-z.]+\/maps/i, 'google', 'maps'],
  [/(^|\.)google\.[a-z.]+$/i, 'google', 'organic'],
  [/(^|\.)instagram\.com$/i, 'instagram', 'social'],
  [/(^|\.)(facebook|fb)\.com$|(^|\.)fb\.me$/i, 'facebook', 'social'],
  [/(^|\.)tiktok\.com$/i, 'tiktok', 'social'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/i, 'x', 'social'],
  [/(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/i, 'linkedin', 'social'],
  [/(^|\.)bing\.com$/i, 'bing', 'organic'],
  [/(^|\.)duckduckgo\.com$/i, 'duckduckgo', 'organic'],
  [/(^|\.)yahoo\.com$/i, 'yahoo', 'organic'],
  [/(^|\.)tripadvisor\.[a-z.]+$/i, 'tripadvisor', 'referral'],
];

/**
 * Detecta el origen de una visita sin UTM.
 *
 * @returns `null` si la dirección ya trae `utm_source` o si no hay ninguna señal (visita directa).
 */
export function detectarOrigen(search: string, referrer: string, userAgent: string, hostPropio: string): OrigenDetectado | null {
  const params = new URLSearchParams(search);
  if (params.get('utm_source')) return null;
  const detectado = (source: string, medium: string): OrigenDetectado => ({ source, medium, content: CONTENIDO_DETECTADO });

  // Identificadores que agregan solos los anuncios: los más confiables.
  if (params.get('gclid') || params.get('gbraid') || params.get('wbraid')) return detectado('google', 'cpc');
  const interno = NAVEGADORES_INTERNOS.find(([patron]) => patron.test(userAgent))?.[1];
  if (params.get('fbclid')) return detectado(interno === 'instagram' ? 'instagram' : 'facebook', 'social');
  if (params.get('ttclid')) return detectado('tiktok', 'cpc');
  if (interno) return detectado(interno, 'social');

  if (!referrer) return null;
  let host = '';
  let ruta = '';
  try { const url = new URL(referrer); host = url.hostname.toLowerCase(); ruta = url.pathname; } catch { return null; }
  // Navegar dentro del mismo sitio no es un origen.
  const limpio = (valor: string) => valor.replace(/^www\./, '');
  if (!host || limpio(host) === limpio(hostPropio.toLowerCase())) return null;
  if (/google\./.test(host) && ruta.startsWith('/maps')) return detectado('google', 'maps');
  const sitio = SITIOS.find(([patron]) => patron.test(host));
  if (sitio) return detectado(sitio[1], sitio[2]);
  return detectado(limpio(host).slice(0, 60), 'referral');
}

/** Origen de la visita actual: UTM si la hay, si no lo detectado, si no nada. */
export function origenDeEstaVisita(): OrigenDetectado | null {
  if (typeof window === 'undefined') return null;
  return detectarOrigen(window.location.search, document.referrer, navigator.userAgent, window.location.hostname);
}
