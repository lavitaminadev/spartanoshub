export enum PieceStatus {
  BACKLOG = 'backlog',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  INTERNAL_REVIEW = 'internal_review',
  CLIENT_VALIDATION = 'client_validation',
  CORRECTION = 'correction',
  APPROVED = 'approved',
  DELIVERED = 'delivered',
  /** Trabajo que no se va a hacer. Devuelve las unidades reservadas según la regla configurada. */
  CANCELLED = 'cancelled',
}
