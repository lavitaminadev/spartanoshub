/**
 * @fileoverview Editar una encuesta que ya tiene respuestas sin perder nada.
 *
 * Reglas, iguales en el editor y en el servidor:
 *
 * - Cambiar la redacción, agregar, reordenar, cambiar reglas u opciones: permitido. La pregunta
 *   conserva su identificador, así que sus respuestas anteriores siguen contando en ella.
 * - Quitar una pregunta que ya pudo tener respuestas la **archiva**: deja de mostrarse a quien
 *   responde, pero sus respuestas siguen visibles en resultados, marcadas como archivadas.
 * - Cambiar el **tipo**, o declarar que la pregunta ahora pregunta otra cosa, abre una **versión
 *   nueva**: la anterior se cierra con su fecha y la nueva nace con identificador propio, así que
 *   sus respuestas nunca se suman. El criterio es uno solo: mismo identificador, misma cosa medida.
 *
 * Cada edición devuelve la lista de cambios en palabras, que se guarda como historial visible.
 * Esa lista es el registro de auditoría: nombra la pregunta, su versión y el motivo, de modo que
 * meses después se pueda reconstruir por qué un resultado quedó partido en dos bloques.
 */
import type { SurveyQuestion } from './types/survey';
export interface ResultadoDeEdicion {
    preguntas: SurveyQuestion[];
    cambios: string[];
    error?: string;
}
/** La familia a la que pertenece una pregunta: el id de su primera versión. */
export declare function raizDePregunta(pregunta: SurveyQuestion): string;
/** Todas las versiones de una misma pregunta, de la más nueva a la más antigua. */
export declare function versionesDePregunta(preguntas: SurveyQuestion[], pregunta: SurveyQuestion): SurveyQuestion[];
/**
 * Compara las preguntas guardadas con las editadas y aplica las reglas.
 *
 * @param conRespuestas Si la encuesta ya recibió respuestas: sólo entonces se archiva en vez de
 *   quitar y un cambio de tipo abre versión nueva.
 * @param ahora Fecha de la edición, para marcar las preguntas cuya redacción cambió.
 * @param versionar Ids que quien edita declaró que «ahora preguntan otra cosa»: su cambio de
 *   redacción abre versión nueva en vez de conservar el identificador. Un cambio de tipo abre
 *   versión esté o no en esta lista, porque dos tipos distintos no se pueden agregar juntos.
 */
export declare function aplicarEdicionDePreguntas(anteriores: SurveyQuestion[], editadas: SurveyQuestion[], conRespuestas: boolean, ahora: string, versionar?: Iterable<string>): ResultadoDeEdicion;
/** Una edición guardada en el historial de la encuesta. */
export interface CambioDeEncuesta {
    fecha: string;
    autor: string | null;
    cambios: string[];
}
/** Máximo de ediciones que se guardan: suficiente para auditar sin que el registro crezca sin fin. */
export declare const MAXIMO_HISTORIAL = 100;
//# sourceMappingURL=survey-edits.d.ts.map