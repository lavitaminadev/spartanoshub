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
 * «Pendiente» y no «En revisión»: nadie está revisando nada: es el estado en que nace el lead
 * mientras quien vende decide. La palabra describe lo que pasa, que es que todavía no se decidió.
 */
export const CALIFICACION_ROTULOS: Record<string, string> = {
  qualified: 'Calificado',
  review: 'Pendiente',
  unqualified: 'No calificado',
};

/** Las opciones en el orden en que se ofrecen, de mejor a peor. */
export const CALIFICACIONES: Array<{ value: string; label: string }> = [
  { value: 'qualified', label: CALIFICACION_ROTULOS.qualified },
  { value: 'review', label: CALIFICACION_ROTULOS.review },
  { value: 'unqualified', label: CALIFICACION_ROTULOS.unqualified },
];

/** El rótulo de un valor, o el valor mismo si llegara uno que no está en la lista. */
export function rotuloDeCalificacion(valor?: string | null): string {
  if (!valor) return '—';
  return CALIFICACION_ROTULOS[valor] ?? valor;
}
