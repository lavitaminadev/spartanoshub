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

const TIPOS: Record<string, string> = { nps: 'recomendación 0-10', rating: 'estrellas', text: 'texto libre', 'multiple-choice': 'opción múltiple' };
const corto = (texto: string) => (texto.length > 70 ? `${texto.slice(0, 67)}…` : texto);

/**
 * Compara las preguntas guardadas con las editadas y aplica las reglas.
 *
 * @param conRespuestas Si la encuesta ya recibió respuestas: sólo entonces se archiva en vez de
 *   quitar y se bloquea el cambio de tipo.
 * @param ahora Fecha de la edición, para marcar las preguntas cuya redacción cambió.
 */
export function aplicarEdicionDePreguntas(anteriores: SurveyQuestion[], editadas: SurveyQuestion[], conRespuestas: boolean, ahora: string): ResultadoDeEdicion {
  const cambios: string[] = [];
  const previas = new Map(anteriores.map((pregunta) => [pregunta.id, pregunta]));
  const idsEditadas = new Set(editadas.map((pregunta) => pregunta.id));
  const resultado: SurveyQuestion[] = [];

  for (const nueva of editadas) {
    const vieja = previas.get(nueva.id);
    if (!vieja) {
      cambios.push(nueva.dato ? `Se pide un dato nuevo: «${corto(nueva.question)}»` : `Pregunta agregada: «${corto(nueva.question)}»`);
      resultado.push({ ...nueva, archivada: undefined });
      continue;
    }
    if (conRespuestas && vieja.type !== nueva.type) {
      return { preguntas: anteriores, cambios: [], error: `«${corto(vieja.question)}» ya tiene respuestas de tipo ${TIPOS[vieja.type] ?? vieja.type}: no se puede cambiar a ${TIPOS[nueva.type] ?? nueva.type}. Agrega una pregunta nueva y archiva esta.` };
    }
    const siguiente: SurveyQuestion = { ...nueva };
    if (vieja.archivada && !nueva.archivada) cambios.push(`Pregunta restaurada: «${corto(nueva.question)}»`);
    if (!vieja.archivada && nueva.archivada) cambios.push(`Pregunta archivada: «${corto(nueva.question)}» (sus respuestas se conservan)`);
    if (vieja.question.trim() !== nueva.question.trim()) {
      cambios.push(`Redacción cambiada: «${corto(vieja.question)}» → «${corto(nueva.question)}»`);
      if (conRespuestas) siguiente.editadaEn = ahora;
    } else if (vieja.editadaEn) {
      siguiente.editadaEn = vieja.editadaEn;
    }
    if (Boolean(vieja.sensible) !== Boolean(nueva.sensible)) cambios.push(`«${corto(nueva.question)}» ${nueva.sensible ? 'ahora se marca como dato sensible (pide autorización expresa)' : 'ya no se marca como dato sensible'}`);
    if (vieja.required !== nueva.required) cambios.push(`«${corto(nueva.question)}» ahora es ${nueva.required ? 'obligatoria' : 'opcional'}`);
    if (!vieja.archivada && conRespuestas === false && vieja.type !== nueva.type) cambios.push(`«${corto(nueva.question)}» cambió a ${TIPOS[nueva.type] ?? nueva.type}`);
    const opcionesViejas = vieja.options ?? [];
    const opcionesNuevas = nueva.options ?? [];
    const agregadas = opcionesNuevas.filter((opcion) => !opcionesViejas.includes(opcion));
    const quitadas = opcionesViejas.filter((opcion) => !opcionesNuevas.includes(opcion));
    if (agregadas.length || quitadas.length) {
      cambios.push(`Opciones de «${corto(nueva.question)}»${agregadas.length ? `: se agregó ${agregadas.map((o) => `«${o}»`).join(', ')}` : ''}${quitadas.length ? `${agregadas.length ? ';' : ':'} se quitó ${quitadas.map((o) => `«${o}»`).join(', ')} (las respuestas con esas opciones se conservan)` : ''}`);
    }
    const reglaVieja = JSON.stringify(vieja.mostrarSi ?? null);
    const reglaNueva = JSON.stringify(nueva.mostrarSi ?? null);
    if (reglaVieja !== reglaNueva) cambios.push(nueva.mostrarSi ? `Cambió cuándo se muestra «${corto(nueva.question)}»` : `«${corto(nueva.question)}» ahora se muestra siempre`);
    resultado.push(siguiente);
  }

  // Lo que ya no viene: con respuestas se archiva y queda al final; sin respuestas se quita.
  for (const vieja of anteriores) {
    if (idsEditadas.has(vieja.id)) continue;
    if (conRespuestas) {
      if (!vieja.archivada) cambios.push(`Pregunta archivada: «${corto(vieja.question)}» (sus respuestas se conservan)`);
      resultado.push({ ...vieja, archivada: true });
    } else {
      cambios.push(vieja.dato ? `Ya no se pide: «${corto(vieja.question)}»` : `Pregunta quitada: «${corto(vieja.question)}»`);
    }
  }

  // Los datos de contacto se ordenan solos al principio: no cuentan como un cambio de orden.
  const ordenViejo = anteriores.filter((pregunta) => idsEditadas.has(pregunta.id) && !pregunta.dato).map((pregunta) => pregunta.id).join('|');
  const ordenNuevo = editadas.filter((pregunta) => previas.has(pregunta.id) && !pregunta.dato).map((pregunta) => pregunta.id).join('|');
  if (ordenViejo !== ordenNuevo) cambios.push('Cambió el orden de las preguntas');

  return { preguntas: resultado, cambios };
}

/** Una edición guardada en el historial de la encuesta. */
export interface CambioDeEncuesta {
  fecha: string;
  autor: string | null;
  cambios: string[];
}

/** Máximo de ediciones que se guardan: suficiente para auditar sin que el registro crezca sin fin. */
export const MAXIMO_HISTORIAL = 100;
