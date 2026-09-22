import { tryLocalToUtc, zonedParts } from './timezone';

/** Un tramo del horario semanal: día de la semana (0 = domingo) y horas locales `HH:mm`. */
export type TramoDeHorario = { day: number; start: string; end: string };

/** Cuánto se alarga una estadía cada vez que el equipo indica que la mesa sigue ocupada. */
export const MINUTOS_POR_EXTENSION = 30;

const aMinutos = (hora: string) => {
  const partes = /^(\d{1,2}):(\d{2})$/.exec(hora);
  return partes ? Number(partes[1]) * 60 + Number(partes[2]) : -1;
};

/**
 * La hora en que cierra el local el día de una reserva.
 *
 * Es el fin del tramo del horario semanal en que empieza la reserva. Si la reserva no cae en
 * ningún tramo —se anotó a mano fuera de horario, o el horario cambió después— devuelve `null`,
 * y quien llama decide qué usar en su lugar. Un fin de `24:00` es la medianoche siguiente.
 */
export function horaDeCierre(inicio: Date, zonaHoraria: string, tramos: TramoDeHorario[]): Date | null {
  const local = zonedParts(inicio, zonaHoraria);
  const minuto = local.hour * 60 + local.minute;
  const tramo = tramos
    .filter((item) => item.day === local.weekday && aMinutos(item.start) <= minuto && minuto < aMinutos(item.end))
    .sort((a, b) => aMinutos(b.end) - aMinutos(a.end))[0];
  if (!tramo) return null;
  const fin = aMinutos(tramo.end);
  const fecha = `${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
  const medianoche = tryLocalToUtc(fecha, '00:00', zonaHoraria);
  if (!medianoche) return null;
  if (fin >= 24 * 60) return new Date(medianoche.getTime() + 24 * 3600_000);
  return tryLocalToUtc(fecha, `${String(Math.floor(fin / 60)).padStart(2, '0')}:${String(fin % 60).padStart(2, '0')}`, zonaHoraria);
}

/**
 * Hasta cuándo queda una reserva que sigue en la mesa: media hora más desde su fin previsto o
 * desde ahora, lo que sea más tarde. Así, pedirla cuando ya pasó el fin no regala tiempo pasado.
 */
export function finExtendido(finActual: Date, ahora: Date): Date {
  return new Date(Math.max(finActual.getTime(), ahora.getTime()) + MINUTOS_POR_EXTENSION * 60_000);
}
