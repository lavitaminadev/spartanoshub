import type { SurveyQuestion } from '@espartanos/shared';

/**
 * El flujo simple de una encuesta de satisfacción: primero la nota, después lo demás.
 *
 * Contestar una encuesta larga de entrada hace que la mayoría la abandone sin dejar nada. Pedir
 * sólo las estrellas primero asegura esa respuesta, y el resto se ofrece según cómo le fue:
 *
 * - **Nota baja**: se ofrece antes que nada escribirle al equipo en privado. Quien tuvo un mal
 *   rato suele querer que alguien lo lea, y es la única oportunidad del local de arreglarlo.
 * - **Nota alta**: se pregunta si quiere contestar unas preguntas más. Puede decir que no.
 *
 * **En los dos casos la reseña pública queda disponible.** La política de Google Maps prohíbe
 * «selectively solicit positive reviews from customers» (sección *Rating Manipulation*): mostrar
 * el botón de reseña sólo a quien puso buena nota es exactamente eso, y expone al local a que le
 * retiren reseñas. A quien puso nota baja se le ofrece primero el canal privado, pero puede
 * seguir hasta la reseña si así lo decide.
 */

/** Por debajo de este umbral la nota se considera baja. Coincide con el valor de fábrica de la reseña. */
export const UMBRAL_POR_DEFECTO = 4;

export type SiguientePaso = 'mensaje-al-equipo' | 'ofrecer-encuesta';

/**
 * La pregunta de estrellas que abre el flujo.
 *
 * Es la primera de tipo `rating`. Sin ella la encuesta no tiene nota con la que decidir el camino
 * y se responde completa de una vez, como hasta ahora.
 */
export function preguntaDeNota(preguntas: SurveyQuestion[]): SurveyQuestion | undefined {
  return preguntas.find((pregunta) => pregunta.type === 'rating');
}

/** Si la nota es válida para una pregunta de estrellas. */
export function notaValida(nota: unknown): nota is number {
  return typeof nota === 'number' && Number.isInteger(nota) && nota >= 1 && nota <= 5;
}

/**
 * Qué se le ofrece después de la nota.
 *
 * @param umbral La nota mínima considerada buena. Viene de la configuración de reseña de la
 *   encuesta; si no es un número razonable se usa el de fábrica.
 */
export function siguientePaso(nota: number, umbral: unknown): SiguientePaso {
  const limite = typeof umbral === 'number' && umbral >= 1 && umbral <= 5 ? umbral : UMBRAL_POR_DEFECTO;
  return nota < limite ? 'mensaje-al-equipo' : 'ofrecer-encuesta';
}

/**
 * Une las respuestas nuevas con las ya guardadas.
 *
 * Se completa por pasos, así que cada envío trae sólo una parte: reemplazar el objeto borraría la
 * nota que se guardó primero. Las preguntas que la encuesta no tiene se rechazan, igual que en el
 * envío de una sola vez.
 *
 * @throws Error con los identificadores desconocidos.
 */
export function unirRespuestas(
  preguntas: SurveyQuestion[],
  guardadas: Record<string, string | number>,
  nuevas: Record<string, string | number> | undefined,
): Record<string, string | number> {
  if (!nuevas) return { ...guardadas };
  const conocidas = new Set(preguntas.map((pregunta) => pregunta.id));
  const desconocidas = Object.keys(nuevas).filter((clave) => !conocidas.has(clave));
  if (desconocidas.length > 0) throw new Error(`La encuesta no tiene las preguntas: ${desconocidas.join(', ')}`);
  return { ...guardadas, ...nuevas };
}

/**
 * Las preguntas obligatorias que faltan, sin contar la nota.
 *
 * Sólo se exigen cuando la persona **eligió** contestar la encuesta. Si dijo que no, la respuesta
 * termina con la nota y, si quiso, su mensaje: exigirle el resto convertiría el «no, gracias» en
 * un formulario que no puede cerrar.
 */
export function obligatoriasPendientes(preguntas: SurveyQuestion[], respuestas: Record<string, string | number>): string[] {
  const nota = preguntaDeNota(preguntas);
  return preguntas
    .filter((pregunta) => pregunta.required && pregunta.id !== nota?.id)
    .filter((pregunta) => {
      const valor = respuestas[pregunta.id];
      return valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
    })
    .map((pregunta) => pregunta.question);
}

/** Lo máximo que se guarda de un mensaje al equipo. Suficiente para contar qué pasó. */
export const LARGO_MAXIMO_MENSAJE = 2000;
