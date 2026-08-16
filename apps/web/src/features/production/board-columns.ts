import { PRODUCTION_WORKFLOW, type ProductionStatus } from './production-labels';

/**
 * Columnas del tablero, por área.
 *
 * Las ocho etapas de `PRODUCTION_WORKFLOW` son el detalle real de una pieza, pero ocho columnas
 * en pantalla no se leen: obligan a desplazarse en horizontal y ninguna llega a tener suficientes
 * tarjetas para decir algo. El tablero agrupa varias etapas por columna sin inventar estados
 * nuevos — una pieza sigue teniendo su estado exacto, solo se muestra junto a sus vecinas.
 *
 * Es una tabla a propósito: cambiar cómo se agrupan, renombrar una columna o agregar una es
 * editar este archivo, sin tocar el tablero ni el backend.
 */

export type BoardArea = 'design' | 'audiovisual';

export interface BoardColumn {
  /** Identificador estable de la columna; no cambia aunque cambie el título. */
  key: string;
  title: string;
  /** Etapas reales que caen en esta columna. */
  statuses: readonly ProductionStatus[];
  /** Qué mirar en esta columna, para que la cabecera diga algo y no solo cuente. */
  hint: string;
}

/**
 * Arte: cinco columnas.
 *
 * `correction` va junto a `client_validation` porque una pieza en corrección sigue siendo una
 * pieza que está con el cliente esperando cerrarse: separarlas hace parecer que la corrección
 * es una etapa aparte cuando es parte de la misma conversación.
 */
export const DESIGN_COLUMNS: readonly BoardColumn[] = [
  { key: 'to_assign', title: 'Por asignar', statuses: ['backlog'], hint: 'Trabajo aceptado que todavía no tiene responsable' },
  { key: 'working', title: 'En trabajo', statuses: ['assigned', 'in_progress'], hint: 'Asignado o ya en manos de alguien' },
  { key: 'internal', title: 'Revisión interna', statuses: ['internal_review'], hint: 'Terminado, esperando el visto bueno del área' },
  { key: 'with_client', title: 'Con el cliente', statuses: ['client_validation', 'correction'], hint: 'En revisión del cliente o corrigiendo lo que pidió' },
  { key: 'done', title: 'Cerrado', statuses: ['approved', 'delivered'], hint: 'Aprobado o ya entregado' },
];

/**
 * Audiovisual: mismas columnas que Arte, por ahora.
 *
 * Su flujo real es distinto —grabación, selección, montaje, musicalización— pero esas etapas no
 * existen todavía en el modelo: una sesión solo tiene `status`. Poner columnas que el dato no
 * puede llenar dejaría un tablero con cuatro columnas siempre vacías, que se lee como si el área
 * no trabajara.
 *
 * Cuando se defina la fase de edición, esta constante es lo único que hay que cambiar.
 */
export const AUDIOVISUAL_COLUMNS: readonly BoardColumn[] = DESIGN_COLUMNS;

export const BOARD_COLUMNS: Record<BoardArea, readonly BoardColumn[]> = {
  design: DESIGN_COLUMNS,
  audiovisual: AUDIOVISUAL_COLUMNS,
};

/**
 * Trabajo que el tablero puede colocar.
 *
 * Declara los campos que mira, en vez de aceptar cualquier cosa con un índice abierto. Con el
 * índice, una pieza que llegara sin `status` compilaba igual y desaparecía del tablero en
 * ejecución; y todo lo que se leía salía como `unknown`, obligando a convertir en cada uso.
 *
 * Los campos van opcionales porque el tablero sirve a piezas y a sesiones, que no comparten
 * todos. Lo obligatorio es lo único sin lo cual no se puede colocar una tarjeta: qué es y en
 * qué etapa está.
 */
export interface BoardItem {
  id: string;
  status: string;
  title?: string;
  clientId?: string;
  clientName?: string;
  type?: string;
  typeLabel?: string;
  assignedTo?: string;
  udAmount?: number;
  /** Última modificación, que es como se detecta el trabajo detenido. */
  updatedAt?: string;
}

/**
 * Reparte el trabajo en columnas.
 *
 * Lo que no cae en ninguna columna se descarta en vez de acumularse en la primera: una pieza
 * cancelada no es una pieza «por asignar», y mostrarla ahí haría que alguien la tomara.
 */
export function groupByColumn<T extends BoardItem>(
  items: readonly T[],
  columns: readonly BoardColumn[],
): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};
  for (const column of columns) grouped[column.key] = [];

  for (const item of items) {
    const column = columns.find((candidate) => (candidate.statuses as readonly string[]).includes(item.status));
    if (column) grouped[column.key].push(item);
  }
  return grouped;
}

/**
 * Trabajo detenido: sin movimiento por más horas de las tolerables.
 *
 * El umbral llega desde `production.stale_hours`, que ya es configurable. Lo cerrado nunca está
 * detenido: una pieza entregada hace un mes no se movió porque no tiene a dónde ir.
 */
export function isStalled(item: BoardItem, staleHours: number, now = Date.now()): boolean {
  if (!item.updatedAt || staleHours <= 0) return false;
  if (item.status === 'delivered' || item.status === 'approved' || item.status === 'cancelled') return false;
  return now - new Date(item.updatedAt).getTime() > staleHours * 3_600_000;
}

/** Etapas que el tablero muestra, para pedirle al backend solo lo que va a colocar. */
export function statusesFor(area: BoardArea): ProductionStatus[] {
  return BOARD_COLUMNS[area].flatMap((column) => [...column.statuses]);
}

/**
 * Comprueba que las columnas cubran el flujo completo.
 *
 * Una etapa que no esté en ninguna columna hace desaparecer trabajo del tablero sin que nadie lo
 * note. Se expone como función para que una prueba lo verifique cada vez que alguien cambie la
 * tabla de columnas, en vez de descubrirlo cuando falte una pieza.
 */
export function uncoveredStatuses(area: BoardArea): string[] {
  const cubiertas = new Set<string>(statusesFor(area));
  return PRODUCTION_WORKFLOW.filter((status) => !cubiertas.has(status));
}
