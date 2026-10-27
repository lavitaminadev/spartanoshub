import type { SurveyQuestion } from '@espartanos/shared';

type Respuestas = Record<string, string | number | undefined>;

/** Escalas que el servidor acepta; son las mismas en las que se promedian los resultados. */
const RATING = { min: 1, max: 5 } as const;
const NPS = { min: 0, max: 10 } as const;

/** Las preguntas a las que una persona puede responder hoy: las archivadas no se muestran. */
export function preguntasContestables(preguntas: readonly SurveyQuestion[]): SurveyQuestion[] {
  return preguntas.filter((pregunta) => !pregunta.archivada);
}

/**
 * Qué respuestas públicas no caben en su pregunta.
 *
 * El formulario ya lo impide, pero el endpoint no tiene sesión: quien llama sin pasar por la
 * página podía mandar un 99 que desordenaba el promedio o una opción que no existe.
 * Valida el rango de `rating` y `nps` y que la opción de una pregunta de selección sea una de las
 * publicadas. Lo vacío se deja a las reglas de obligatoriedad.
 */
export function respuestasFueraDeRango(preguntas: readonly SurveyQuestion[], respuestas: Respuestas): string[] {
  const problemas: string[] = [];
  for (const pregunta of preguntasContestables(preguntas)) {
    const valor = respuestas[pregunta.id];
    if (valor === undefined || valor === null || valor === '') continue;

    if (pregunta.type === 'rating' || pregunta.type === 'nps') {
      const { min, max } = pregunta.type === 'rating' ? RATING : NPS;
      const numero = typeof valor === 'number' ? valor : Number(valor);
      if (!Number.isInteger(numero) || numero < min || numero > max) {
        problemas.push(`«${pregunta.question}» admite un valor entre ${min} y ${max}`);
      }
    } else if (pregunta.type === 'multiple-choice') {
      if (typeof valor !== 'string' || !(pregunta.options ?? []).includes(valor)) {
        problemas.push(`«${pregunta.question}»: la opción elegida no existe`);
      }
    }
  }
  return problemas;
}
