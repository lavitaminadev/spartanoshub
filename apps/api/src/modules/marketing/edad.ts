/**
 * Qué se puede decidir a partir de una fecha de nacimiento declarada.
 *
 * Las dos preguntas que resuelve —«¿cumple hoy?» y «¿es mayor de edad?»— parecen triviales y
 * tienen la misma trampa: se comparan fechas, y una zona horaria mal aplicada mueve el cumpleaños
 * un día. Por eso se trabaja con el mes y el día sueltos, y nunca con la diferencia en
 * milisegundos.
 */

/** Edad a partir de la cual se puede recibir comunicación comercial. */
export const MAYORIA_DE_EDAD = 18;

/**
 * Si dos fechas caen el mismo día del año.
 *
 * El año se ignora a propósito: es un cumpleaños, no un aniversario exacto.
 *
 * **El 29 de febrero se felicita el 28** en los años que no son bisiestos. La alternativa —no
 * felicitar— deja a esa persona sin saludo tres de cada cuatro años, que es peor que un día de
 * diferencia y además parece que el sistema se olvidó de ella.
 */
export function cumpleHoy(nacimiento: Date, hoy: Date = new Date()): boolean {
  const mes = nacimiento.getMonth();
  const dia = nacimiento.getDate();

  if (mes === hoy.getMonth() && dia === hoy.getDate()) return true;

  const bisiesto = new Date(hoy.getFullYear(), 1, 29).getMonth() === 1;
  const naceEn29DeFebrero = mes === 1 && dia === 29;
  const hoyEs28DeFebrero = hoy.getMonth() === 1 && hoy.getDate() === 28;

  return naceEn29DeFebrero && hoyEs28DeFebrero && !bisiesto;
}

/**
 * Años cumplidos a la fecha.
 *
 * Se cuenta restando años y ajustando si todavía no llegó el día, y no dividiendo milisegundos:
 * los años bisiestos hacen que la división dé 17,999 para alguien que cumplió 18 esta mañana.
 *
 * @returns `null` si no hay fecha. Quien no la declaró no es menor ni mayor: es desconocido, y
 *   quien decide qué hacer con eso es quien llame a esta función.
 */
export function edadEn(nacimiento?: Date | null, hoy: Date = new Date()): number | null {
  if (!nacimiento) return null;
  const fecha = nacimiento instanceof Date ? nacimiento : new Date(nacimiento);
  if (Number.isNaN(fecha.getTime())) return null;

  let anos = hoy.getFullYear() - fecha.getFullYear();
  const yaCumplio = hoy.getMonth() > fecha.getMonth()
    || (hoy.getMonth() === fecha.getMonth() && hoy.getDate() >= fecha.getDate());
  if (!yaCumplio) anos -= 1;
  return anos;
}

/**
 * Si se le puede mandar comunicación comercial por su edad declarada.
 *
 * **Quien no declaró fecha puede recibir.** Es la decisión deliberada: exigirla dejaría fuera a
 * toda la lista actual, que se recogió sin preguntarla, y no hay indicio alguno de que sean
 * menores. Lo que esta función impide es lo que sí consta: escribirle a alguien que **declaró**
 * ser menor de edad.
 *
 * Una fecha declarada no acredita nada —cualquiera escribe otro año—, pero deja constancia de que
 * se preguntó, que es lo que se puede mostrar si alguien lo reclama.
 */
export function puedeRecibirPorEdad(nacimiento?: Date | null, hoy: Date = new Date()): boolean {
  const edad = edadEn(nacimiento, hoy);
  if (edad === null) return true;
  return edad >= MAYORIA_DE_EDAD;
}
