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
/** Dato de contacto predefinido: se muestra con su campo propio y se valida su formato. */
export type SurveyContactField = 'nombre' | 'rut' | 'correo' | 'telefono';
/** Regla para mostrar una pregunta sólo según lo contestado en otra. */
export interface SurveyShowRule {
    preguntaId: string;
    /** Valores de la otra pregunta que la muestran (notas como texto: `'1'`, `'2'`…). */
    valores: string[];
}
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
    /** Si es un dato de contacto (siempre de tipo `text`). Los datos no se promedian en resultados. */
    dato?: SurveyContactField;
    /** Mostrarla sólo si otra pregunta tiene ciertos valores. */
    mostrarSi?: SurveyShowRule;
}
/** Aceptación que se pide cuando la encuesta solicita datos personales. */
export interface SurveyConsent {
    /** Texto exacto que se muestra y que se guarda con la respuesta. */
    texto: string;
    version: string;
    responsable: string;
    privacyUrl?: string | null;
    privacyText?: string | null;
}
/** Encuesta completa: definición, distribución y estado agregado. */
export interface Survey {
    id: string;
    /** Empresa dueña cuando es una encuesta de clientes; ausente para encuestas internas/agencia. */
    clientId?: string;
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
    /** Sólo en la página pública, cuando la encuesta pide datos personales. */
    consentimiento?: SurveyConsent | null;
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
        gradientFrom?: string;
        gradientTo?: string;
        gradientAngle?: string;
        /** Plantilla con que se creó, sólo informativa. */
        plantilla?: string;
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
    /**
     * Cada respuesta con quién la dejó, más reciente primero. Sólo la entrega el servidor: el
     * respaldo local sin red no sabe quién respondió.
     */
    respuestas?: SurveyIndividualResponse[];
}
/** Una respuesta tal como se lee en los resultados, con su autor si llegó por una reserva. */
export interface SurveyIndividualResponse {
    id: string;
    submittedAt: string;
    rating: number | null;
    /** Sólo en respuestas que llegaron por la invitación de una reserva. */
    respondentName: string | null;
    respondentEmail: string | null;
    reservationId: string | null;
    /** Lo que la persona quiso decirle al equipo en privado. */
    teamMessage: string | null;
    /** Nulo si dejó la nota y no siguió. */
    completedAt: string | null;
    /** Canal por el que llegó: `qr`, `whatsapp`, `reserva`… `null` si no se sabe. */
    origen?: string | null;
    /** Cuándo aceptó el uso de sus datos, si la encuesta los pidió. */
    privacyConsentAt?: string | null;
    answers: Record<string, string | number>;
}
//# sourceMappingURL=survey.d.ts.map