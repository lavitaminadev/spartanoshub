/**
 * A dónde lleva cada acción cuando termina.
 *
 * Hasta ahora el destino después de una acción estaba escrito dentro del botón que la disparaba,
 * repartido en diecisiete lugares. Eso tenía dos costos: cambiar a dónde lleva convertir una
 * solicitud obligaba a buscar el componente que la convierte, y nada impedía que dos acciones
 * parecidas terminaran en pantallas distintas sin que nadie lo hubiera decidido.
 *
 * Acá el destino es dato. Cambiar uno es editar una línea de este archivo.
 *
 * La regla que ordena la tabla, y que conviene mantener al agregar filas:
 *
 * - **Lo que crea algo lleva a lo creado.** Convertir una solicitud en piezas deja al usuario en
 *   el tablero, viendo las piezas que acaba de generar. Dejarlo en la bandeja de origen lo obliga
 *   a buscar a dónde fue a parar su trabajo.
 * - **Lo que cierra algo devuelve a la lista**, con lo cerrado destacado un momento para
 *   confirmar que pasó. Quedarse en el detalle de algo ya resuelto es una pantalla muerta.
 * - **Lo que no cambia de contexto no navega.** Comentar una pieza o editar un valor ocurre donde
 *   está el usuario; sacarlo de ahí le hace perder lo que estaba mirando.
 */

/** Identificador de lo que acaba de ocurrir. */
export type AppAction =
  | 'request.converted'
  | 'request.rejected'
  | 'piece.created'
  | 'piece.assigned'
  | 'piece.delivered'
  | 'piece.cancelled'
  | 'pieceType.proposed'
  | 'pieceType.approved'
  | 'pieceType.retired'
  | 'comment.added'
  | 'settings.saved';

/** Datos que la acción deja disponibles para armar el destino. */
export interface ActionResult {
  /** Identificadores de lo que se creó, para destacarlo al llegar. */
  createdIds?: string[];
  /** Identificador de lo que se resolvió o cerró. */
  subjectId?: string;
  /** Área del trabajo, cuando el destino depende de ella. */
  area?: 'design' | 'audiovisual' | 'community';
}

/**
 * Destino de una acción.
 *
 * `null` significa quedarse donde se está, que es una decisión tan explícita como navegar: hoy
 * se logra por omisión y por eso nadie sabe si fue elegido o si se olvidó.
 */
export type ActionDestination = (result: ActionResult) => string | null;

/** Resalta lo recién creado en la lista de destino, para no llegar a buscarlo. */
function destacando(path: string, ids?: string[]): string {
  if (!ids?.length) return path;
  const separador = path.includes('?') ? '&' : '?';
  return `${path}${separador}highlight=${ids.join(',')}`;
}

export const ACTION_DESTINATIONS: Record<AppAction, ActionDestination> = {
  // --- Crea: lleva a lo creado ---
  'request.converted': ({ createdIds, area }) =>
    destacando(area === 'audiovisual' ? '/audiovisual' : '/production', createdIds),
  'piece.created': ({ createdIds }) => destacando('/production', createdIds),
  'pieceType.proposed': ({ subjectId }) => destacando('/settings/piece-types', subjectId ? [subjectId] : undefined),

  // --- Cierra: devuelve a la lista ---
  'request.rejected': () => '/intake',
  'piece.delivered': ({ subjectId }) => destacando('/production', subjectId ? [subjectId] : undefined),
  'piece.cancelled': ({ subjectId }) => destacando('/production', subjectId ? [subjectId] : undefined),
  'pieceType.retired': () => '/settings/piece-types',

  // --- Aprobar deja ver el resultado sin sacar del catálogo ---
  'pieceType.approved': ({ subjectId }) => destacando('/settings/piece-types', subjectId ? [subjectId] : undefined),

  // --- No cambia de contexto: se queda donde está ---
  // Asignar ocurre desde el tablero y el usuario suele asignar varias seguidas; navegar le
  // costaría volver por cada una.
  'piece.assigned': () => null,
  'comment.added': () => null,
  'settings.saved': () => null,
};

/**
 * Ruta a la que ir después de una acción, o `null` para quedarse.
 *
 * Una acción sin destino declarado se queda donde está en vez de fallar: agregar una acción
 * nueva no debería poder romper la navegación por haber olvidado una línea acá.
 */
export function destinationFor(action: AppAction, result: ActionResult = {}): string | null {
  const destino = ACTION_DESTINATIONS[action];
  return destino ? destino(result) : null;
}
