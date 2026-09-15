/**
 * @fileoverview Editar una encuesta que ya tiene respuestas sin perder nada.
 *
 * Reglas, iguales en el editor y en el servidor:
 *
 * - Cambiar la redacción, agregar, reordenar, cambiar reglas u opciones: permitido. La pregunta
 *   conserva su identificador, así que sus respuestas anteriores siguen contando en ella.
 * - Quitar una pregunta que ya pudo tener respuestas la **archiva**: deja de mostrarse a quien
 *   responde, pero sus respuestas siguen visibles en resultados, marcadas como archivadas.
 * - Cambiar el **tipo** de una pregunta con respuestas no se permite: sumar estrellas con texto
 *   libre no tiene sentido. Se crea una pregunta nueva y la anterior se archiva.
 *
 * Cada edición devuelve la lista de cambios en palabras, que se guarda como historial visible.
 */
import type { SurveyQuestion } from './types/survey';
export interface ResultadoDeEdicion {
    preguntas: SurveyQuestion[];
    cambios: string[];
    error?: string;
}
/**
 * Compara las preguntas guardadas con las editadas y aplica las reglas.
 *
 * @param conRespuestas Si la encuesta ya recibió respuestas: sólo entonces se archiva en vez de
 *   quitar y se bloquea el cambio de tipo.
 * @param ahora Fecha de la edición, para marcar las preguntas cuya redacción cambió.
 */
export declare function aplicarEdicionDePreguntas(anteriores: SurveyQuestion[], editadas: SurveyQuestion[], conRespuestas: boolean, ahora: string): ResultadoDeEdicion;
/** Una edición guardada en el historial de la encuesta. */
export interface CambioDeEncuesta {
    fecha: string;
    autor: string | null;
    cambios: string[];
}
/** Máximo de ediciones que se guardan: suficiente para auditar sin que el registro crezca sin fin. */
export declare const MAXIMO_HISTORIAL = 100;
//# sourceMappingURL=survey-edits.d.ts.map