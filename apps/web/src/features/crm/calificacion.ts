/**
 * Cómo se lee la calificación de un lead, en un solo sitio.
 *
 * El mismo campo se llamaba «Calidad» en la ficha, «Calificación» en el editor y su valor
 * `review` se leía «En revisión» en un lado y «Por revisar» en otro. Tres nombres para una cosa
 * hacen dudar de si son la misma, y quien filtra por una no encuentra lo que ve en la otra.
 *
 * No se reutiliza el catálogo general de estados porque `review` allí lo comparten documentos,
 * solicitudes e incorporación: renombrarlo para el CRM renombraría cosas que no tienen que ver.
 */

/** Nombre del campo. Va aparte para que no vuelva a divergir entre pantallas. */
export const CALIFICACION_TITULO = 'Calificación';

/**
 * Cómo se lee cada valor.
 *
 * «Vendido» va aparte de «Calificado» y no es un sinónimo: quien vende necesita distinguir de
 * un vistazo al que compró del que solo prometía. Con un solo valor, un tablero con seis
 * calificados no dice cuántos de esos seis son clientes.
 *
 * «Pendiente» es el estado en que nace, cuando nadie lo ha mirado. «En revisión» es el paso
 * siguiente: alguien ya habló con la persona y todavía no decide. Son dos situaciones distintas
 * y con una sola palabra no se sabe cuál de las dos tienes delante.
 */
export const CALIFICACION_ROTULOS: Record<string, string> = {
  sold: 'Vendido',
  qualified: 'Calificado',
  in_review: 'En revisión',
  review: 'Pendiente',
  unqualified: 'No calificado',
};

/** Las opciones en el orden en que se ofrecen, de mejor a peor. */
export const CALIFICACIONES: Array<{ value: string; label: string }> = [
  { value: 'sold', label: CALIFICACION_ROTULOS.sold },
  { value: 'qualified', label: CALIFICACION_ROTULOS.qualified },
  { value: 'in_review', label: CALIFICACION_ROTULOS.in_review },
  { value: 'review', label: CALIFICACION_ROTULOS.review },
  { value: 'unqualified', label: CALIFICACION_ROTULOS.unqualified },
];

/** El rótulo de un valor, o el valor mismo si llegara uno que no está en la lista. */
export function rotuloDeCalificacion(valor?: string | null): string {
  if (!valor) return '—';
  return CALIFICACION_ROTULOS[valor] ?? valor;
}
