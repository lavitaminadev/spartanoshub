export enum LeadFitStatus {
  QUALIFIED = 'qualified',
  /**
   * Compró.
   *
   * Es un valor aparte de `QUALIFIED` y no un sinónimo: quien vende necesita distinguir de un
   * vistazo al que compró del que solo prometía. Colapsarlos hacía que un tablero con seis
   * calificados no dijera cuántos de esos seis eran clientes.
   *
   * Hacia Meta sí implica calificado —vender es la afirmación más fuerte de que el lead
   * encajaba—, y por eso una venta arrastra las dos etapas.
   */
  SOLD = 'sold',
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
