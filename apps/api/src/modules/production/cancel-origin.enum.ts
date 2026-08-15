/**
 * De quién fue la decisión de cancelar.
 *
 * Es el mismo eje que ya distingue `Correction.origin` entre una corrección del cliente y un
 * error del diseñador, y por la misma razón: sin él, el mes solo muestra trabajo perdido y no
 * dice si hubo que rehacerlo porque el cliente cambió de opinión o porque la agencia se equivocó.
 *
 * Quien cancela lo declara y no se deduce. Deducirlo del cargo de quien aprieta el botón sería
 * falso: una community manager cancela por pedido del cliente casi siempre, y a veces porque
 * producción entregó algo que no correspondía.
 */
export enum CancelOrigin {
  /** El cliente pidió bajar el trabajo o cambió lo que había pedido. */
  CLIENT = 'client',
  /** Un error de la agencia: se produjo algo equivocado, duplicado o fuera de lo pedido. */
  PRODUCTION = 'production',
  /** Decisión comercial o de planificación: cambió la campaña, se reasignó el presupuesto. */
  COMMERCIAL = 'commercial',
}

/** Nombre en español, para el formulario donde se elige. */
export const CANCEL_ORIGIN_LABELS: Record<CancelOrigin, string> = {
  [CancelOrigin.CLIENT]: 'Lo pidió el cliente',
  [CancelOrigin.PRODUCTION]: 'Error de la agencia',
  [CancelOrigin.COMMERCIAL]: 'Decisión comercial o de planificación',
};
