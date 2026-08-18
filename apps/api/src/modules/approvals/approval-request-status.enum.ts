/**
 * Estados de un pendiente, sea una aprobación o una tarea.
 *
 * Los tres primeros los comparten ambos. Los dos de decisión —`approved` y `rejected`— solo
 * tienen sentido en una aprobación, y `done` solo en una tarea: nadie «aprueba» llamar a un
 * prospecto, y un cliente no «completa» una pieza, la aprueba o la rechaza.
 *
 * Conviven en un mismo enum porque conviven en una misma tabla, y separarlos obligaría a
 * mirar dos columnas para saber si algo sigue abierto.
 */
export enum ApprovalRequestStatus {
  PENDING = 'pending',
  VIEWED = 'viewed',
  EXPIRED = 'expired',
  /** Solo aprobaciones. */
  APPROVED = 'approved',
  /** Solo aprobaciones. */
  REJECTED = 'rejected',
  /** Solo tareas. */
  DONE = 'done',
  /** Solo tareas: se decidió que ya no hace falta. */
  CANCELLED = 'cancelled',
}

/**
 * Qué clase de pendiente es.
 *
 * Una aprobación la resuelve el cliente decidiendo; una tarea la resuelve quien la tiene
 * asignada haciéndola. Comparten tabla porque comparten forma —dueño, vencimiento, estado,
 * registro al que pertenecen— y porque «qué tengo pendiente» debería responderse con una
 * consulta y no con dos.
 */
export enum PendingKind {
  APPROVAL = 'approval',
  TASK = 'task',
}

/** Estados en los que el pendiente sigue abierto. */
export const OPEN_STATUSES = [
  ApprovalRequestStatus.PENDING,
  ApprovalRequestStatus.VIEWED,
] as const;
