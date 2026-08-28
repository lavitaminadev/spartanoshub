/**
 * Las señales de cómo llegó una persona, listas para acompañar su conversión.
 *
 * Meta empareja bastante mejor un evento que trae `fbc` y `fbp` que uno con solo correo y
 * teléfono, y en una conversión que ocurre semanas después de la visita esas señales solo pueden
 * venir de lo que se guardó entonces. Se leen de `metadata.attribution`, que las conserva desde
 * la captura.
 *
 * Lo que no exista se omite. Inventar un `fbc` o mandar la IP del servidor en vez de la de la
 * persona no mejora la coincidencia: le enseña a Meta el dispositivo equivocado.
 */

/** Lo que se le puede entregar a Meta sobre el origen de una persona. */
export interface AtribucionDeMeta {
  fbp?: string;
  fbc?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
}

/**
 * Formato del identificador de clic: `fb.<subdominio>.<milisegundos>.<fbclid>`.
 *
 * El índice de subdominio vale 1 cuando se construye en el servidor sin cookie, que es
 * exactamente nuestro caso; lo dice la documentación de Meta.
 */
const INDICE_DE_SUBDOMINIO = 1;

/**
 * Construye el `fbc` a partir del `fbclid` de la URL.
 *
 * Sirve cuando la persona llegó desde un anuncio pero la página no tenía el Pixel puesto: no hay
 * cookie `_fbc`, pero el `fbclid` viaja en la URL y se guardó al capturar. Con él y el instante
 * en que se vio, el valor se arma entero.
 *
 * **El `fbclid` distingue mayúsculas de minúsculas.** No se normaliza ni se recorta: Meta lo
 * compara tal cual y cualquier retoque lo vuelve inservible.
 *
 * @param fbclid - Tal como venía en la URL.
 * @param visto - Cuándo se vio por primera vez. Sin fecha no se construye: una marca de tiempo
 *   inventada produce un valor que Meta acepta y no empareja con nada.
 */
export function construirFbc(fbclid?: string, visto?: string | Date): string | undefined {
  const valor = fbclid?.trim();
  if (!valor || !visto) return undefined;

  const instante = visto instanceof Date ? visto : new Date(visto);
  if (Number.isNaN(instante.getTime())) return undefined;

  return `fb.${INDICE_DE_SUBDOMINIO}.${instante.getTime()}.${valor}`;
}

/**
 * Señales de atribución de un lead, con el `fbc` reconstruido si hiciera falta.
 *
 * @param lead - Cualquier registro con `metadata.attribution`.
 * @returns Solo lo que exista de verdad.
 */
export function atribucionDelLead(lead: { metadata?: Record<string, unknown> | null }): AtribucionDeMeta {
  const guardado = (lead.metadata?.attribution ?? {}) as {
    fbp?: string;
    fbc?: string;
    fbclid?: string;
    capturedAt?: string;
    clientIpAddress?: string;
    clientUserAgent?: string;
  };

  return {
    fbp: guardado.fbp || undefined,
    // El `fbc` guardado manda: viene de la cookie real y es el que vio el navegador. El
    // construido es el recambio para cuando la página no tenía el Pixel.
    fbc: guardado.fbc || construirFbc(guardado.fbclid, guardado.capturedAt),
    clientIpAddress: guardado.clientIpAddress || undefined,
    clientUserAgent: guardado.clientUserAgent || undefined,
  };
}
