import type { SurveyContactField, SurveyQuestion, SurveyType } from '@espartanos/shared';
import { DATOS_DE_CONTACTO } from '@espartanos/shared';

/**
 * Plantillas para empezar una encuesta con preguntas probadas.
 *
 * Cada una trae sus reglas: las preguntas de seguimiento aparecen solas según la nota, así la
 * encuesta es corta para quien quedó conforme y útil para entender a quien no.
 */

interface PreguntaDePlantilla extends Omit<SurveyQuestion, 'id' | 'mostrarSi'> {
  clave: string;
  mostrarSi?: { clave: string; valores: string[] };
}

export interface PlantillaDeEncuesta {
  id: string;
  nombre: string;
  descripcion: string;
  publico: SurveyType;
  titulo: string;
  bienvenida: string;
  preguntas: PreguntaDePlantilla[];
  datos: Array<{ dato: SurveyContactField; obligatorio: boolean }>;
}

const NOTAS_BAJAS = ['1', '2', '3'];
const NOTAS_ALTAS = ['4', '5'];

export const PLANTILLAS: PlantillaDeEncuesta[] = [
  {
    id: 'post-visita',
    nombre: 'Satisfacción post-visita',
    descripcion: 'Nota con estrellas y seguimiento según cómo le fue.',
    publico: 'customer',
    titulo: 'Tu visita',
    bienvenida: 'Gracias por visitarnos. ¿Nos cuentas cómo te fue? Toma menos de un minuto.',
    preguntas: [
      { clave: 'nota', type: 'rating', question: '¿Cómo fue tu visita?', required: true },
      { clave: 'mejor', type: 'multiple-choice', question: '¿Qué fue lo mejor?', required: false, options: ['La atención', 'La comida', 'El ambiente', 'El precio'], mostrarSi: { clave: 'nota', valores: NOTAS_ALTAS } },
      { clave: 'fallo', type: 'multiple-choice', question: '¿Qué falló?', required: true, options: ['La atención', 'El tiempo de espera', 'La comida', 'El precio', 'La limpieza'], mostrarSi: { clave: 'nota', valores: NOTAS_BAJAS } },
      { clave: 'volveria', type: 'multiple-choice', question: '¿Volverías?', required: false, options: ['Sí', 'Tal vez', 'No'] },
      /*
       * Quién atendió, y si un anuncio pesó en la decisión.
       *
       * La nota dice cómo estuvo el local; no dice de qué turno ni de quién. Y el Pixel sabe de
       * dónde vino el clic, pero no si el anuncio influyó: eso sólo lo puede decir la persona.
       * Las dos van opcionales: obligarlas cuesta respuestas completas, que valen más.
       */
      { clave: 'atendio', type: 'text', question: '¿Quién te atendió?', required: false },
      { clave: 'anuncio', type: 'multiple-choice', question: '¿Viste algún anuncio nuestro antes de venir?', required: false, options: ['Sí, y me animó a venir', 'Sí, pero ya pensaba venir', 'No vi ninguno'] },
      { clave: 'comentario', type: 'text', question: '¿Algo más que quieras contarnos?', required: false },
    ],
    datos: [{ dato: 'nombre', obligatorio: false }, { dato: 'correo', obligatorio: false }],
  },
  {
    id: 'nps',
    nombre: 'Recomendación (NPS)',
    descripcion: 'La pregunta de 0 a 10 y el porqué según la respuesta.',
    publico: 'customer',
    titulo: '¿Nos recomendarías?',
    bienvenida: 'Tu respuesta nos ayuda a mejorar. Son dos preguntas.',
    preguntas: [
      { clave: 'nps', type: 'nps', question: '¿Qué tan probable es que nos recomiendes a un amigo?', required: true },
      { clave: 'mejorar', type: 'text', question: '¿Qué tendríamos que hacer para que nos pongas un 10?', required: false, mostrarSi: { clave: 'nps', valores: ['0', '1', '2', '3', '4', '5', '6', '7', '8'] } },
      { clave: 'valoras', type: 'text', question: '¿Qué es lo que más valoras de nosotros?', required: false, mostrarSi: { clave: 'nps', valores: ['9', '10'] } },
    ],
    datos: [],
  },
  {
    id: 'evento',
    nombre: 'Evento',
    descripcion: 'Evaluación del evento con datos para invitar al próximo.',
    publico: 'customer',
    titulo: 'Tu opinión del evento',
    bienvenida: 'Gracias por acompañarnos. Queremos que el próximo sea todavía mejor.',
    preguntas: [
      { clave: 'nota', type: 'rating', question: '¿Cómo evaluarías el evento?', required: true },
      { clave: 'fallo', type: 'text', question: '¿Qué mejorarías?', required: false, mostrarSi: { clave: 'nota', valores: NOTAS_BAJAS } },
      { clave: 'proximo', type: 'multiple-choice', question: '¿Te gustaría que te avisemos del próximo?', required: true, options: ['Sí', 'No'] },
    ],
    datos: [{ dato: 'nombre', obligatorio: true }, { dato: 'correo', obligatorio: true }, { dato: 'telefono', obligatorio: false }],
  },
  {
    id: 'clima',
    nombre: 'Clima del equipo',
    descripcion: 'Cómo se siente el equipo y qué lo ayudaría.',
    publico: 'internal',
    titulo: 'Pulso del equipo',
    bienvenida: 'Es anónima. Nos ayuda a saber cómo acompañarte mejor.',
    preguntas: [
      { clave: 'nota', type: 'rating', question: '¿Cómo te sentiste en el trabajo esta semana?', required: true },
      { clave: 'ayuda', type: 'multiple-choice', question: '¿Qué te ayudaría más?', required: false, options: ['Prioridades más claras', 'Menos carga', 'Más apoyo del equipo', 'Mejores herramientas'], mostrarSi: { clave: 'nota', valores: NOTAS_BAJAS } },
      { clave: 'comentario', type: 'text', question: '¿Algo que quieras contarnos?', required: false },
    ],
    datos: [],
  },
];

/** Pregunta de un dato de contacto, con id estable para poder quitarla o volver a ponerla. */
export function preguntaDeDato(dato: SurveyContactField, obligatorio: boolean): SurveyQuestion {
  return { id: `dato-${dato}`, type: 'text', question: DATOS_DE_CONTACTO[dato].pregunta, required: obligatorio, dato };
}

/** Las preguntas listas de una plantilla, con ids nuevos y las reglas apuntando a ellos. */
export function preguntasDePlantilla(plantilla: PlantillaDeEncuesta): SurveyQuestion[] {
  const ids = new Map(plantilla.preguntas.map((pregunta) => [pregunta.clave, crypto.randomUUID()]));
  const preguntas = plantilla.preguntas.map(({ clave, mostrarSi, ...resto }) => ({
    ...resto,
    id: ids.get(clave)!,
    ...(mostrarSi ? { mostrarSi: { preguntaId: ids.get(mostrarSi.clave)!, valores: mostrarSi.valores } } : {}),
  }));
  return [...preguntas, ...plantilla.datos.map((item) => preguntaDeDato(item.dato, item.obligatorio))];
}
