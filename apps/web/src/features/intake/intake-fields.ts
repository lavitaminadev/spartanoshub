/**
 * @fileoverview Campos del formulario de solicitud, declarados por área.
 *
 * Un solo formulario con secciones, no tres formularios distintos: quien pide no siempre sabe
 * si lo suyo es diseño o audiovisual, y hacerle elegir el formulario antes de describir el
 * trabajo le traslada una decisión que le corresponde a Operaciones.
 *
 * Agregar o quitar un campo se hace acá y en ningún otro lugar. El backend los guarda como JSON
 * sin esquema fijo justamente para que esto no requiera migración: lo que se filtra y se ordena
 * —cuenta, plazo, prioridad, responsable— sí son columnas y no vive en esta lista.
 */

/** Áreas que ejecutan trabajo. Coincide con `WorkRequestArea` del backend. */
export const AREAS = [
  { value: 'design', label: 'Diseño', icon: '🎨', hint: 'Piezas gráficas: posts, carruseles, historias, flyers.' },
  { value: 'audiovisual', label: 'Audiovisual', icon: '🎬', hint: 'Video, reels y sesiones de foto.' },
  { value: 'community', label: 'Community', icon: '💬', hint: 'Publicación, calendario y respuesta en redes.' },
] as const;

export type AreaValue = (typeof AREAS)[number]['value'];

export interface IntakeField {
  /** Clave con la que se guarda dentro del JSON. No cambiarla rompe el histórico. */
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'date';
  required?: boolean;
  options?: Array<[string, string]>;
  placeholder?: string;
  /** Ayuda breve bajo el campo, para no tener que preguntarlo por mensaje después. */
  help?: string;
}

/**
 * Campos creativos por área.
 *
 * Son los datos sin los cuales el trabajo se devuelve para preguntar. Todo lo demás va en la
 * descripción: un formulario largo se llena mal, y un campo mal llenado es peor que uno vacío.
 */
export const CREATIVE_FIELDS: Record<AreaValue, IntakeField[]> = {
  design: [
    {
      name: 'formato', label: 'Formato', type: 'select', required: true,
      options: [
        ['post', 'Post'], ['carrusel', 'Carrusel'], ['historia', 'Historia'],
        ['flyer_digital', 'Flyer digital'], ['flyer_impreso', 'Flyer para impresión'], ['otro', 'Otro'],
      ],
    },
    { name: 'soporte', label: 'Dónde se publica o se imprime', type: 'text', placeholder: 'Instagram, menú del local, gigantografía…' },
    { name: 'copy', label: 'Texto que debe ir en la pieza', type: 'textarea', placeholder: 'Copia acá el texto exacto, con precios y condiciones.', help: 'Si el texto no está definido, dilo: se produce con texto de relleno y vuelve a corrección.' },
    { name: 'referencias', label: 'Referencias', type: 'text', placeholder: 'Enlace a Drive, a una publicación o a una campaña anterior' },
  ],
  audiovisual: [
    {
      name: 'tipoAudiovisual', label: 'Tipo de producción', type: 'select', required: true,
      options: [['reel', 'Reel'], ['video', 'Video'], ['sesion_foto', 'Sesión de fotos'], ['cobertura', 'Cobertura de evento']],
    },
    { name: 'locacion', label: 'Locación', type: 'text', placeholder: 'Local, estudio, exterior…' },
    { name: 'fechaGrabacion', label: 'Fecha de grabación', type: 'date', help: 'La fecha del rodaje, distinta del plazo de entrega.' },
    { name: 'duracion', label: 'Duración estimada', type: 'text', placeholder: '15 s, 1 min, media jornada…' },
    { name: 'talento', label: '¿Requiere talento o modelo?', type: 'select', options: [['no', 'No'], ['si', 'Sí'], ['por_definir', 'Por definir']] },
  ],
  community: [
    {
      name: 'red', label: 'Red', type: 'select', required: true,
      options: [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['tiktok', 'TikTok'], ['whatsapp', 'WhatsApp'], ['otra', 'Otra']],
    },
    { name: 'fechaPublicacion', label: 'Fecha de publicación', type: 'date' },
    { name: 'objetivo', label: 'Objetivo', type: 'select', options: [['alcance', 'Alcance'], ['interaccion', 'Interacción'], ['reservas', 'Reservas'], ['ventas', 'Ventas']] },
    { name: 'tono', label: 'Tono y mensaje clave', type: 'textarea', placeholder: 'Qué tiene que quedarle a quien lo lee.' },
  ],
};

export const PRIORITIES: Array<[string, string]> = [
  ['low', 'Baja'],
  ['normal', 'Normal'],
  ['high', 'Alta'],
  ['urgent', 'Urgente'],
];

export const STATUS_LABELS: Record<string, string> = {
  new: 'Nueva',
  in_review: 'En revisión',
  accepted: 'Aceptada',
  converted: 'Convertida',
  rejected: 'Rechazada',
};

/**
 * Devuelve los campos obligatorios del área que quedaron sin responder.
 *
 * Se valida acá y no en el backend porque la lista cambia sin desplegar; el backend acepta
 * cualquier forma del JSON a propósito.
 *
 * @param area - Área elegida en el formulario.
 * @param values - Valores cargados hasta ahora.
 * @returns Etiquetas de los campos faltantes, en el orden en que aparecen en pantalla.
 */
export function missingCreativeFields(area: AreaValue, values: Record<string, string>): string[] {
  return CREATIVE_FIELDS[area]
    .filter((field) => field.required && !values[field.name]?.trim())
    .map((field) => field.label);
}

/** Quita los campos vacíos para no guardar claves sin valor en el JSON. */
export function compactValues(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value?.trim()));
}
