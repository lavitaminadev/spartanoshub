export enum LeadFitStatus {
  QUALIFIED = 'qualified',
  /** Nace así: nadie lo ha mirado todavía. */
  REVIEW = 'review',
  /**
   * Alguien ya habló con esta persona y todavía no decide.
   *
   * Distinto de `REVIEW` a propósito: un lead que nadie tocó y uno en conversación piden cosas
   * distintas, y con un solo estado intermedio no se distinguen.
   */
  IN_REVIEW = 'in_review',
  UNQUALIFIED = 'unqualified',
}
