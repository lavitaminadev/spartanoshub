/**
 * @fileoverview Tipos del dominio de Encuestas.
 *
 * Cubre tanto encuestas al equipo (`internal`, el mismo espíritu que el Pulso Espartano pero
 * a demanda y con preguntas propias) como encuestas a clientes finales (`customer`, el
 * complemento de las encuestas post-visita que hoy viven dentro de Reservas). Vive como
 * feature propia porque el ciclo de vida —crear, distribuir, cerrar, leer resultados— es el
 * mismo para ambos públicos aunque el destinatario cambie.
 */

/** A quién se dirige la encuesta. Determina el copy de la UI y el canal de distribución. */
export type SurveyType = 'internal' | 'customer';

/**
 * Formato de una pregunta.
 *
 * - `nps`: «¿Qué tan probable es que recomiendes...?», escala 0-10.
 * - `rating`: escala corta (1-5), para satisfacción puntual.
 * - `text`: respuesta abierta.
 * - `multiple-choice`: una opción entre `options`.
 */
export type QuestionType = 'nps' | 'rating' | 'text' | 'multiple-choice';

/** Estado del ciclo de vida de una encuesta. */
export type SurveyStatus = 'draft' | 'active' | 'closed';

/** Canal por el que se distribuye una encuesta activa. */
export type SurveyDistributionChannel = 'email' | 'qr' | 'link';

/** Pregunta individual dentro de una encuesta. */
export interface SurveyQuestion {
  /** Identificador estable dentro de la encuesta; las respuestas se guardan contra este id. */
  id: string;
  type: QuestionType;
  question: string;
  /** Si es `true`, el formulario de respuesta no permite enviar sin contestarla. */
  required: boolean;
  /** Solo aplica a `multiple-choice`. */
  options?: string[];
}

/** Encuesta completa: definición, distribución y estado agregado. */
export interface Survey {
  id: string;
  title: string;
  type: SurveyType;
  questions: SurveyQuestion[];
  status: SurveyStatus;
  createdAt: string;
  createdBy: string;
  /**
   * Destinatarios explícitos (correos o ids de usuario/cliente), cuando la distribución fue
   * dirigida. Ausente cuando la encuesta se distribuye por enlace o QR abierto, donde no hay
   * lista previa de a quién le llegó.
   */
  recipients?: string[];
  /** Canales de distribución habilitados. Vacío o ausente mientras la encuesta es `draft`. */
  distribution?: SurveyDistributionChannel[];
  publicUrl?: string;
  ga4MeasurementId?: string | null;
  /** Conteo de respuestas recibidas. Se mantiene desnormalizado para listar sin agregar. */
  responses: number;
  /** Configuración visual de la página pública de la encuesta (colores, logo, fuente). */
  designConfig?: {
    primaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
    backgroundImage?: string;
    backgroundMode?: string;
    backgroundGradient?: string;
    backgroundOpacity?: string;
    backgroundSize?: string;
    backgroundPosition?: string;
    textColor?: string;
    fontFamily?: string;
    logoUrl?: string;
    welcome?: string;
    buttonRadius?: string;
    fieldRadius?: string;
  };
  /** Configuración de Google Reviews integrada al finalizar la encuesta. */
  googleReview?: {
    url?: string;
    /** Umbral de estrellas (1-5): rating >= minRating → redirige directo. Si no, pregunta si quiere contacto. */
    minRating?: number;
    /** Texto que se muestra cuando la calificación es baja. */
    lowRatingMessage?: string;
  };
}

/** Una respuesta completa de una persona a una encuesta. */
export interface SurveyResponse {
  surveyId: string;
  /**
   * Id de quien respondió. Para encuestas internas, el id de usuario; para encuestas a
   * clientes, un id de contacto/reserva si se conoce o un identificador anónimo generado en
   * el momento de responder.
   */
  respondentId: string;
  /** Respuesta por id de pregunta. Numérica para `nps`/`rating`, texto para el resto. */
  answers: Record<string, string | number>;
  submittedAt: string;
}

/** Agregado de una pregunta `nps`: puntaje -100..100 y el desglose que lo explica. */
export interface NpsQuestionResult {
  type: 'nps';
  score: number | null;
  promoters: number;
  passives: number;
  detractors: number;
}

/** Agregado de una pregunta `rating`: promedio y distribución por valor. */
export interface RatingQuestionResult {
  type: 'rating';
  average: number | null;
  /** Conteo de respuestas por valor de escala, p. ej. `{ '1': 2, '5': 14 }`. */
  distribution: Record<string, number>;
}

/** Agregado de una pregunta `multiple-choice`: conteo por opción. */
export interface ChoiceQuestionResult {
  type: 'multiple-choice';
  counts: Record<string, number>;
}

/** Agregado de una pregunta `text`: las respuestas crudas, para lista y nube de palabras. */
export interface TextQuestionResult {
  type: 'text';
  answers: string[];
}

/** Resultado agregado de una pregunta, con la forma que corresponde a su `type`. */
export type SurveyQuestionResult = {
  questionId: string;
  question: string;
  required: boolean;
  totalAnswers: number;
} & (NpsQuestionResult | RatingQuestionResult | ChoiceQuestionResult | TextQuestionResult);

/** Resultados agregados de una encuesta, listos para el dashboard. */
export interface SurveyResultsSummary {
  surveyId: string;
  totalResponses: number;
  /** `null` cuando la encuesta no tiene destinatarios fijos (enlace o QR abiertos). */
  completionRate: number | null;
  questions: SurveyQuestionResult[];
  generatedAt: string;
}
