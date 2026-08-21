/**
 * @fileoverview Cómo se compone el identificador con el que se reconoce un lead ya recibido.
 */

/**
 * Orígenes cuyo identificador **ya es único en el mundo**, así que no se les antepone nada.
 *
 * Son los sistemas que además tienen un camino propio hacia el CRM. Meta es el caso: sus leads
 * pueden llegar por su webhook firmado —que guarda el identificador tal cual— o de paso por una
 * automatización intermedia. Si el puente antepusiera su nombre, el mismo lead entraría dos
 * veces: una como `123456` y otra como `Meta Ads:123456`.
 *
 * Mantener los dos caminos a la vez es una situación real y transitoria: se opera con el puente
 * mientras el acceso directo espera la verificación del negocio. Que no se contaminen entre sí
 * es lo que permite encender el segundo sin apagar el primero de un día para otro.
 */
const IDENTIFICADORES_GLOBALES = new Set(['meta_lead_ads']);

/**
 * Identificador con el que se deduplica un lead recibido por integración.
 *
 * Sin origen conocido se antepone el nombre del origen: dos portales distintos pueden usar el
 * mismo número interno, y sin prefijo uno pisaría el lead del otro.
 *
 * @param source - Valor `source` del origen que recibió el lead.
 * @param idExterno - Identificador que trae el sistema de origen, si lo trae.
 * @returns El identificador a guardar, o `undefined` cuando no hay ninguno con qué componerlo.
 */
export function identificadorExterno(source: string, idExterno?: string): string | undefined {
  if (!idExterno) return undefined;
  return IDENTIFICADORES_GLOBALES.has(source) ? idExterno : `${source}:${idExterno}`;
}
