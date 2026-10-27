import { createHash } from 'node:crypto';

/**
 * Cuántas retenciones de cupo vigentes puede tener un mismo origen en un mismo local.
 *
 * Seis cubren a una familia o una oficina que reserva desde la misma red probando horarios, y
 * dejan sin efecto a quien quiere agotar la agenda sin reservar: con diez minutos de vigencia,
 * cada origen puede apartar a lo sumo seis horarios a la vez en vez de todos.
 */
export const TOPE_RETENCIONES_POR_ORIGEN = 6;

/** Huella estable del origen, sin guardar la dirección. `undefined` si la petición no la trae. */
export function huellaDeOrigen(ip?: string): string | undefined {
  const limpia = (ip ?? '').trim();
  return limpia ? createHash('sha256').update(`retencion:${limpia}`).digest('hex').slice(0, 32) : undefined;
}
