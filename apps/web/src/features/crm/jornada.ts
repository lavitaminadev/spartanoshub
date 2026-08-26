/**
 * La jornada de la vista diaria: en qué hora cae cada actividad.
 *
 * Vive aparte del panel para poder probarla. Repartir por horas parece trivial hasta que algo
 * cae fuera del horario habitual: si esa actividad no encuentra fila, no se dibuja en ninguna
 * parte y la agenda miente por omisión, que es peor que mostrarla a deshora.
 */

/** Actividad tal como la devuelve el CRM. Solo lo que necesita el reparto. */
export interface ActividadDeJornada { date: string }

/**
 * Franja que abre y cierra el día cuando no hay nada fuera de ella.
 *
 * No se dibujan las veinticuatro horas: las que nunca se usan solo alejan las que sí, y obligan
 * a desplazarse para llegar a la mañana.
 */
export const JORNADA = { desde: 8, hasta: 20 };

/**
 * Reparte las actividades de un día en una fila por hora.
 *
 * La franja se estira para incluir lo que caiga fuera del horario habitual, hacia atrás o hacia
 * adelante, de modo que ninguna actividad quede sin fila.
 *
 * @param eventos Actividades de ese día, en cualquier orden.
 * @returns Una entrada por hora, de la primera a la última, con lo que cae en ella ya ordenado.
 */
export function franjasDelDia<T extends ActividadDeJornada>(eventos: T[]): Array<{ hora: number; eventos: T[] }> {
  const horas = eventos.map((evento) => new Date(evento.date).getHours());
  const desde = Math.min(JORNADA.desde, ...horas);
  const hasta = Math.max(JORNADA.hasta, ...horas);

  return Array.from({ length: hasta - desde + 1 }, (_, indice) => {
    const hora = desde + indice;
    return {
      hora,
      eventos: eventos
        .filter((evento) => new Date(evento.date).getHours() === hora)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    };
  });
}
