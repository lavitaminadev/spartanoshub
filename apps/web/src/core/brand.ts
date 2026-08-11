/**
 * Identidad de marca, en un solo lugar.
 *
 * Estaba repartida como texto literal en más de ciento sesenta puntos entre las dos
 * aplicaciones, así que un cambio de nombre era una búsqueda y reemplazo con riesgo de dejar
 * mitades sin tocar. Ahora es una edición.
 *
 * Cubre solo lo que se lee en pantalla. Los identificadores técnicos —el ámbito de los paquetes,
 * el nombre de la base, las rutas del servidor— no pasan por acá: viven en su propia
 * configuración porque cambiarlos implica migrar datos y no solo texto.
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
