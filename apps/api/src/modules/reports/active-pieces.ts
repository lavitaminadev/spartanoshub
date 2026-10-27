/**
 * Definición única de pieza «activa»: cualquiera que no esté entregada ni cancelada.
 * El inicio, los reportes y el pulso de la agencia cuentan con esta misma condición.
 */
export const ACTIVE_PIECE_STATUS_SQL = "status NOT IN ('delivered','cancelled')";

export const isActivePieceStatus = (status: string): boolean => status !== 'delivered' && status !== 'cancelled';
