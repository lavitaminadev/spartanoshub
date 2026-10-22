import { PLAZO_AVISO_VULNERACION_HORAS } from '@espartanos/shared';

const HORA_MS = 3_600_000;

/** Cuántas horas antes del vencimiento empieza a avisar la alerta diaria. */
export const ANTICIPO_ALERTA_HORAS = 24;

export type EstadoDelAviso = 'avisado' | 'a tiempo' | 'por vencer' | 'vencido';

export interface PlazoDeAviso {
  /** Cuándo vence el aviso al local: la detección más el plazo que promete el contrato. */
  vence: Date;
  /** Horas que quedan; negativo si ya venció. */
  horasRestantes: number;
  estado: EstadoDelAviso;
}

/**
 * El plazo para avisar al local de una vulneración, calculado desde la detección.
 *
 * Se calcula en cada lectura y no se guarda: depende de la hora de hoy, y un valor guardado
 * quedaría viejo. Un aviso hecho fuera de plazo sigue figurando como `avisado`; que se hizo
 * tarde se ve comparando las dos fechas, que es la constancia.
 */
export function plazoDeAviso(detectadoEl: Date, avisoLocalEl: Date | null | undefined, ahora: Date = new Date()): PlazoDeAviso {
  const vence = new Date(new Date(detectadoEl).getTime() + PLAZO_AVISO_VULNERACION_HORAS * HORA_MS);
  const horasRestantes = (vence.getTime() - ahora.getTime()) / HORA_MS;
  if (avisoLocalEl) return { vence, horasRestantes, estado: 'avisado' };
  if (horasRestantes <= 0) return { vence, horasRestantes, estado: 'vencido' };
  return { vence, horasRestantes, estado: horasRestantes <= ANTICIPO_ALERTA_HORAS ? 'por vencer' : 'a tiempo' };
}
