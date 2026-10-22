import { UDMovementType } from './ud-movement-type.enum';

/**
 * Cuánto cambió el disponible por un movimiento, con signo: negativo descuenta, positivo suma.
 *
 * El signo sale del tipo y no de cómo cada escritor guardó el monto. `reservation` y
 * `consumption` descuentan; `release`, `extra`, `budget_assigned` y `rollover` suman;
 * `adjustment` lleva su propio signo porque es la diferencia con signo entre el contrato
 * anterior y el nuevo. Un tipo desconocido no mueve el número: es más seguro que inventar un signo.
 */
export function efectoEnElDisponible(tipo: string, monto: number): number {
  const magnitud = Math.abs(Number(monto));
  switch (tipo) {
    case UDMovementType.RESERVATION:
    case UDMovementType.CONSUMPTION:
      return -magnitud;
    case UDMovementType.RELEASE:
    case UDMovementType.EXTRA:
    case UDMovementType.BUDGET_ASSIGNED:
    case UDMovementType.ROLLOVER:
      return magnitud;
    case UDMovementType.ADJUSTMENT:
      return Number(monto);
    default:
      return 0;
  }
}
