/**
 * Las respuestas del formulario de Meta, legibles.
 *
 * Llegan tal como las entrega Meta, y eso no es texto para mostrar: las opciones vienen con
 * guiones bajos en vez de espacios —`he_invertido_en_negocios_pequeños`— y las preguntas traen
 * caracteres invisibles delante que ni se ven ni se pueden borrar a mano. Puestas crudas en la
 * ficha se leen como un volcado de base de datos justo en el momento en que alguien va a llamar
 * por teléfono.
 *
 * Se arregla al mostrar y no al guardar: lo guardado es lo que Meta dijo, y si mañana cambia su
 * formato conviene tener el original para entenderlo.
 */

/** Una pregunta con su respuesta, ya lista para leer. */
export interface RespuestaDelFormulario {
  question: string;
  answer: string;
}

/**
 * Caracteres sin ancho que Meta antepone a los enunciados.
 *
 * Junta-palabras, espacio de ancho cero y la marca de orden de bytes. No se ven, ocupan sitio y
 * estropean cualquier comparación de texto: dos preguntas idénticas dejan de serlo porque una
 * empieza por un carácter que nadie escribió.
 */
const INVISIBLES = /[​-‍⁠﻿]/g;

/**
 * Deja un texto de Meta como se escribiría a mano.
 *
 * Los guiones bajos vuelven a ser espacios y la primera letra sube a mayúscula. Lo demás no se
 * toca: `$80.000.000 - $100.000.000` y `+ de 25MM` tienen que salir con sus cifras intactas, y
 * cualquier intento de «arreglarlas» las estropea.
 */
export function legible(valor: string): string {
  const limpio = valor.replace(INVISIBLES, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!limpio) return '';
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

/**
 * Las respuestas de un lead, limpias y sin las que quedaron vacías.
 *
 * Una pregunta sin respuesta ocupa una fila y no dice nada; se descarta para que la sección no
 * crezca con huecos.
 *
 * @param metadata - El `metadata` del lead tal como viene de la API.
 */
export function respuestasDelFormulario(metadata?: Record<string, unknown> | null): RespuestaDelFormulario[] {
  const guardadas = metadata?.answers;
  if (!Array.isArray(guardadas)) return [];

  return guardadas
    .filter((fila): fila is Record<string, unknown> => Boolean(fila) && typeof fila === 'object')
    .map((fila) => ({
      question: legible(String(fila.question ?? '')),
      answer: legible(String(fila.answer ?? '')),
    }))
    .filter((fila) => fila.question.length > 0 && fila.answer.length > 0);
}
