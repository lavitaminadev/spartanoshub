/**
 * Vocabulario compartido del módulo de producción: el flujo de estados de una pieza y los
 * tipos de pieza.
 *
 * Vive fuera de las pantallas porque el tablero y la ficha de la pieza tienen que nombrar
 * las mismas etapas en el mismo orden. Si cada pantalla declara su propia lista, una pieza
 * termina apareciendo en una columna del tablero y en otra etapa distinta en su ficha.
 */

/**
 * Estados de una pieza, en el orden en que avanza.
 *
 * Espeja `PieceStatus` del backend: es el universo completo de estados que puede tener una
 * pieza y ninguna pantalla debe agregar etapas propias a esta secuencia.
 */
export const PRODUCTION_WORKFLOW = [
  'backlog',
  'assigned',
  'in_progress',
  'internal_review',
  'client_validation',
  'correction',
  'approved',
  'delivered',
] as const;

/** Estado de una pieza dentro del flujo de producción. */
export type ProductionStatus = (typeof PRODUCTION_WORKFLOW)[number];

/**
 * Posición de un estado dentro del flujo.
 *
 * Devuelve `-1` cuando el estado no pertenece al flujo (por ejemplo una pieza cancelada),
 * de modo que quien lo use pueda distinguir «al principio» de «fuera del flujo».
 */
export function productionStageIndex(status?: string | null): number {
  if (!status) return -1;
  return (PRODUCTION_WORKFLOW as readonly string[]).indexOf(status);
}

/**
 * Nombre visible de cada tipo de pieza.
 *
 * Los valores son los que acepta el backend al crear una pieza; las etiquetas son lo único
 * que ve el equipo, para que no aparezca `post_simple` en pantalla.
 */
export const PIECE_TYPE_LABELS: Record<string, string> = {
  post_simple: 'Post simple',
  post_author: 'Post de autor',
  carousel: 'Carrusel',
  story_original: 'Historia original',
  story_adapted: 'Historia adaptada',
  story_template: 'Historia con plantilla',
  reel_cover: 'Portada de reel',
  flyer_digital: 'Flyer digital',
  flyer_print: 'Flyer para impresión',
};

/** Tipos de pieza en orden de presentación, para armar selectores. */
export const PIECE_TYPE_OPTIONS = Object.entries(PIECE_TYPE_LABELS);

/** Etiqueta del tipo de pieza, o el valor crudo si no está en el mapa. */
export function pieceTypeLabel(type?: string | null): string {
  if (!type) return '';
  return PIECE_TYPE_LABELS[type] ?? type;
}
