/**
 * @fileoverview El horario de atención de un local, en una línea legible.
 *
 * La página mostraba los horarios libres y nada más: quien entraba un lunes cerrado veía una
 * grilla vacía sin saber si el local no abre ese día, si está lleno o si algo falló. Decir el
 * horario ahí mismo evita esa duda, y evita también la llamada que la sigue.
 */

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

interface Ventana { day: number; start: string; end: string }

/** Los días con el mismo horario se juntan, y los seguidos se escriben como rango. */
function rango(dias: number[]): string {
  if (dias.length === 1) return DIAS[dias[0]];
  const seguidos = dias.every((dia, indice) => indice === 0 || dia === dias[indice - 1] + 1);
  if (seguidos && dias.length > 2) return `${DIAS[dias[0]]} a ${DIAS[dias[dias.length - 1]]}`;
  return dias.length === 2 ? `${DIAS[dias[0]]} y ${DIAS[dias[1]]}` : dias.map((dia) => DIAS[dia]).join(', ');
}

/**
 * @param ventanas Tramos de atención, con el día en la numeración del navegador (0 = domingo).
 * @returns Algo como «Mar a Jue 18:00–01:30 · Vie y Sáb 18:00–02:30 · Dom y Lun cerrado», o vacío
 *   si el local no declaró ninguno.
 */
export function resumenDeHorarios(ventanas: Ventana[] | undefined): string {
  if (!ventanas?.length) return '';

  // Un día puede tener dos tramos (almuerzo y cena): se muestran los dos.
  const porDia = new Map<number, string>();
  for (const ventana of ventanas) {
    if (typeof ventana?.day !== 'number' || !ventana.start || !ventana.end) continue;
    const tramo = `${ventana.start}–${ventana.end}`;
    porDia.set(ventana.day, porDia.has(ventana.day) ? `${porDia.get(ventana.day)} y ${tramo}` : tramo);
  }
  if (porDia.size === 0) return '';

  const porHorario = new Map<string, number[]>();
  for (const [dia, horario] of [...porDia.entries()].sort((a, b) => a[0] - b[0])) {
    porHorario.set(horario, [...(porHorario.get(horario) ?? []), dia]);
  }

  const partes = [...porHorario.entries()].map(([horario, dias]) => `${rango(dias)} ${horario}`);
  const cerrados = [0, 1, 2, 3, 4, 5, 6].filter((dia) => !porDia.has(dia));
  if (cerrados.length && cerrados.length < 7) partes.push(`${rango(cerrados)} cerrado`);
  return partes.join(' · ');
}
