import { isStalled, type BoardItem } from './board-columns';

/**
 * Filtros del tablero.
 *
 * Son funciones puras y no consultas al servidor porque el tablero ya trae el trabajo del área
 * completo: filtrar en el navegador responde al instante y no multiplica peticiones cada vez que
 * alguien prueba un filtro distinto, que es como se usa un tablero.
 *
 * Cada filtro responde a una pregunta que alguien hace en voz alta frente al tablero, y ese es el
 * criterio para agregar uno nuevo: si no corresponde a una pregunta real, sobra.
 */

export interface BoardFilters {
  /** Cuenta a la que pertenece el trabajo. */
  clientId?: string;
  /** Clave del tipo de pieza, que ahora viene del catálogo configurable. */
  type?: string;
  /** Responsable; `'mine'` lo resuelve quien llama con su propio identificador. */
  assignedTo?: string;
  /** Vista rápida por situación. */
  view?: BoardView;
  /** Texto libre sobre el título. */
  search?: string;
}

/**
 * Vistas rápidas.
 *
 * `stalled` es la que no se puede responder mirando: el resto se ve en las columnas, pero el
 * trabajo detenido está repartido entre todas y por eso hace falta preguntarlo.
 */
export type BoardView =
  | 'all'
  | 'pending'
  | 'to_review'
  | 'to_finish'
  | 'finished'
  | 'stalled';

export const BOARD_VIEW_LABELS: Record<BoardView, string> = {
  all: 'Todo',
  pending: 'Pendientes',
  to_review: 'Por revisar',
  to_finish: 'Por terminar',
  finished: 'Finalizados',
  stalled: 'Estancados',
};

/** Etapas que responden a cada vista; `undefined` es «no filtra por etapa». */
const VIEW_STATUSES: Partial<Record<BoardView, readonly string[]>> = {
  pending: ['backlog', 'assigned', 'in_progress'],
  to_review: ['internal_review'],
  to_finish: ['client_validation', 'correction', 'approved'],
  finished: ['delivered'],
};

export interface FilterContext {
  /** Umbral de `production.stale_hours`, para la vista de detenidos. */
  staleHours: number;
  now?: number;
}

/**
 * Aplica los filtros en orden de descarte: primero lo que elimina más.
 *
 * El texto va al final porque es el más caro y el que menos suele usarse.
 */
export function applyBoardFilters<T extends BoardItem>(
  items: readonly T[],
  filters: BoardFilters,
  context: FilterContext,
): T[] {
  const now = context.now ?? Date.now();

  return items.filter((item) => {
    if (filters.clientId && item.clientId !== filters.clientId) return false;
    if (filters.type && item.type !== filters.type) return false;
    if (filters.assignedTo && item.assignedTo !== filters.assignedTo) return false;

    if (filters.view && filters.view !== 'all') {
      if (filters.view === 'stalled') {
        if (!isStalled(item, context.staleHours, now)) return false;
      } else {
        const etapas = VIEW_STATUSES[filters.view];
        if (etapas && !etapas.includes(item.status)) return false;
      }
    }

    if (filters.search) {
      const texto = (item.title ?? '').toLowerCase();
      if (!texto.includes(filters.search.trim().toLowerCase())) return false;
    }
    return true;
  });
}

/** Si hay algún filtro puesto, para poder ofrecer limpiarlos sin adivinar. */
export function hasActiveFilters(filters: BoardFilters): boolean {
  return Boolean(
    filters.clientId || filters.type || filters.assignedTo || filters.search
    || (filters.view && filters.view !== 'all'),
  );
}
