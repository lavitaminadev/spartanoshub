/**
 * Identidad de marca, en un solo lugar.
 *
 * Estaba repartida como texto literal en más de ciento sesenta puntos entre las dos
 * aplicaciones, así que un cambio de nombre era una búsqueda y reemplazo con riesgo de dejar
 * mitades sin tocar. Ahora es una edición.
 *
 * No confundir con los identificadores técnicos —`@vitahub/shared`, `DB_DATABASE`,
 * `vitahub_uploads`—: esos no los ve nadie y renombrarlos obliga a migrar datos y rutas del
 * servidor sin que nadie note la diferencia.
 */
export const BRAND = {
  /** Nombre de la agencia. */
  name: 'Espartanos',
  /** Nombre completo, para títulos y documentos. */
  legalName: 'Cuartel Espartano',
  /** Nombre del producto interno. */
  product: 'Espartanos',
  /** Título de la pestaña del navegador. */
  documentTitle: 'Espartanos',
  mark: '/brand/espartanos-helmet.png',
  lockup: '/brand/espartanos-helmet.png',
} as const;
