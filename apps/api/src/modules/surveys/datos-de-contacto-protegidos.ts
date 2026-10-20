import { MARCA_PROTEGIDA } from '@espartanos/shared';

type Respuestas = Record<string, unknown>;
type PreguntaConDato = { id: string; dato?: string | null };

/**
 * Qué preguntas de una encuesta piden datos de contacto (nombre, RUT, correo, teléfono, nacimiento).
 *
 * Esas respuestas viven dentro de `answers`, no en columnas: recortar sólo `respondentName` y
 * `respondentEmail` dejaría el teléfono y el RUT viajando en cada respuesta.
 */
export function preguntasDeContacto(preguntas: readonly PreguntaConDato[] | null | undefined): Array<{ id: string; dato: string }> {
  return (preguntas ?? []).filter((pregunta): pregunta is { id: string; dato: string } => Boolean(pregunta.dato));
}

/** Lo que la persona contestó en la pregunta de un dato de contacto, o `null` si no la hubo o la dejó vacía. */
export function contestadoEn(
  respuestas: Respuestas | null | undefined,
  preguntas: readonly PreguntaConDato[] | null | undefined,
  dato: string,
): string | null {
  const pregunta = preguntasDeContacto(preguntas).find((candidata) => candidata.dato === dato);
  const valor = pregunta ? respuestas?.[pregunta.id] : undefined;
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null;
}

/** Las mismas respuestas con los datos de contacto reemplazados por la marca. No muta lo recibido. */
export function sinDatosDeContacto(
  respuestas: Respuestas | null | undefined,
  preguntas: readonly PreguntaConDato[] | null | undefined,
): Respuestas {
  const copia: Respuestas = { ...(respuestas ?? {}) };
  for (const { id } of preguntasDeContacto(preguntas)) {
    if (copia[id] !== undefined && copia[id] !== null && copia[id] !== '') copia[id] = MARCA_PROTEGIDA;
  }
  return copia;
}

/** Sólo las respuestas a las preguntas de datos de contacto. */
export function soloDatosDeContacto(
  respuestas: Respuestas | null | undefined,
  preguntas: readonly PreguntaConDato[] | null | undefined,
): Respuestas {
  const salida: Respuestas = {};
  for (const { id } of preguntasDeContacto(preguntas)) if (respuestas?.[id] !== undefined) salida[id] = respuestas[id];
  return salida;
}
