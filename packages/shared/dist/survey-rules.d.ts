/**
 * @fileoverview Reglas de una encuesta que deben dar lo mismo en la página pública y en el servidor.
 *
 * Qué preguntas se muestran según lo contestado, cuáles son obligatorias en ese momento y si un
 * dato de contacto está bien escrito. Vive aquí para que la página nunca exija algo que el
 * servidor no pide, ni el servidor rechace algo que la página dejó enviar.
 */
import type { SurveyContactField, SurveyQuestion } from './types/survey';
type Respuestas = Record<string, string | number | undefined | null>;
/** Nombre visible y tipo de campo de cada dato de contacto. */
export declare const DATOS_DE_CONTACTO: Record<SurveyContactField, {
    etiqueta: string;
    pregunta: string;
    placeholder: string;
    autocompletar: string;
    tipo: 'text' | 'email' | 'tel' | 'date';
}>;
/** Orden en que se piden los datos: el mismo en el editor, la página y los resultados. */
export declare const ORDEN_DE_DATOS: SurveyContactField[];
/**
 * Preguntas en el orden en que se muestran: primero los datos de quien responde, en su orden fijo,
 * y después las preguntas en el orden que les dio el equipo. Así los datos no quedan perdidos al
 * final de una encuesta larga.
 */
export declare function ordenarParaMostrar<T extends SurveyQuestion>(preguntas: T[]): T[];
/**
 * Si una pregunta se muestra con las respuestas actuales.
 *
 * Una pregunta con `mostrarSi` sólo aparece cuando la pregunta de la que depende tiene uno de los
 * valores elegidos. Si esa pregunta a su vez está oculta, ésta también: una cadena de reglas no
 * puede mostrar algo cuyo origen nadie vio.
 */
export declare function preguntaVisible(pregunta: SurveyQuestion, preguntas: SurveyQuestion[], respuestas: Respuestas, visitadas?: Set<string>): boolean;
/** Las preguntas que ve la persona con lo que lleva contestado, en orden. */
export declare function preguntasVisibles(preguntas: SurveyQuestion[], respuestas: Respuestas): SurveyQuestion[];
/** Valida el dígito verificador de un RUT chileno. Acepta puntos, guion y K minúscula. */
export declare function rutValido(valor: string): boolean;
/** Da formato 12.345.678-9 a un RUT escrito de cualquier forma. */
export declare function formatearRut(valor: string): string;
/** Mensaje de error de un dato de contacto, o `null` si está bien o vacío. */
export declare function errorDeDato(dato: SurveyContactField | undefined, valor: unknown): string | null;
/**
 * Qué falta o está mal en lo contestado, considerando sólo las preguntas visibles.
 *
 * @param omitir Preguntas que no se exigen en este envío (por ejemplo, la nota del flujo por pasos).
 * @returns Una lista de textos listos para mostrar; vacía si se puede enviar.
 */
export declare function problemasDeRespuesta(preguntas: SurveyQuestion[], respuestas: Respuestas, omitir?: string[]): string[];
/** Si la encuesta pide algún dato que identifica a la persona: entonces se necesita su aceptación. */
export declare function pideDatosPersonales(preguntas: SurveyQuestion[]): boolean;
/** Si en lo contestado viene algún dato personal escrito. */
export declare function traeDatosPersonales(preguntas: SurveyQuestion[], respuestas: Respuestas): boolean;
export {};
//# sourceMappingURL=survey-rules.d.ts.map