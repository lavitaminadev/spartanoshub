export enum UDMovementType {
  BUDGET_ASSIGNED = 'budget_assigned',
  RESERVATION = 'reservation',
  CONSUMPTION = 'consumption',
  ADJUSTMENT = 'adjustment',
  EXTRA = 'extra',
  /** Devolución al presupuesto de unidades reservadas para un trabajo que no se va a hacer. */
  RELEASE = 'release',
  ROLLOVER = 'rollover',
}
