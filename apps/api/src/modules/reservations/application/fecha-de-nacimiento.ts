/**
 * @fileoverview Qué se acepta como fecha de nacimiento.
 *
 * Ni futura ni de hace dos siglos: los dos casos son erratas de tecleo, y una fecha imposible
 * guardada sin queja reaparece más tarde como un saludo de cumpleaños absurdo.
 */

/** Años hacia atrás que se consideran una persona viva. */
const EDAD_MAXIMA = 120;

export function fechaDeNacimientoValida(valor: string): boolean {
  const fecha = new Date(`${valor.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime())) return false;
  const hoy = new Date();
  if (fecha.getTime() > hoy.getTime()) return false;
  const limite = new Date(hoy);
  limite.setUTCFullYear(limite.getUTCFullYear() - EDAD_MAXIMA);
  return fecha.getTime() >= limite.getTime();
}
