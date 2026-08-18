/**
 * @fileoverview Recomendaciones que el local muestra al confirmar una reserva.
 *
 * Qué son: las cuatro líneas que aparecen bajo el código de reserva, escritas por el local.
 * Dónde se editan: constructor de reservas → paso «Diseño» → «Recomendaciones del local».
 * Dónde se guardan: `reservation_forms.design_config.venueTips`, como texto con un ítem por línea.
 * Dónde se muestran: `BookingSuccess.tsx`.
 *
 * Se guardan como texto plano y no como arreglo a propósito: `design_config` es un JSON que ya
 * edita gente no técnica desde un formulario, y un campo de varias líneas es más fácil de llenar
 * y de revisar que una lista con botones de agregar y quitar.
 */

/** Una sugerencia lista para usar, con el motivo por el que funciona. */
export interface VenueTipPreset {
  /** Clave estable. No cambiarla: identifica la sugerencia en la pantalla de edición. */
  key: string;
  /** Nombre del grupo, para agrupar las sugerencias al ofrecerlas. */
  category: string;
  /** El texto que vería quien reserva. */
  text: string;
  /** Por qué esta línea mejora la experiencia. Se muestra al elegirla, no al comensal. */
  why: string;
}

/**
 * Sugerencias por defecto, ordenadas por lo que más reduce fricción.
 *
 * El criterio no es decorar la pantalla: cada una responde una pregunta que la persona se va a
 * hacer igual, y que si no encuentra respondida termina en una llamada al local o en una
 * inasistencia. Las cuatro primeras son las que más peso tienen, y por eso son el valor inicial.
 *
 * - **Certidumbre**: saber qué esperar reduce la ansiedad previa y las llamadas de confirmación.
 * - **Control**: dar una salida clara —cómo cancelar— hace *más* probable que la persona
 *   asista, porque deja de sentir que se compromete a algo irreversible.
 * - **Reciprocidad**: un gesto pequeño y concreto del local se devuelve en asistencia.
 * - **Pertenencia**: nombrar a la persona que la recibirá convierte un trámite en una visita.
 */
export const VENUE_TIP_PRESETS: readonly VenueTipPreset[] = [
  {
    key: 'llegada',
    category: 'Antes de llegar',
    text: 'Te esperamos 10 minutos antes para acomodarte con calma.',
    why: 'Da una instrucción concreta y evita la duda de a qué hora conviene salir de casa.',
  },
  {
    key: 'ubicacion',
    category: 'Antes de llegar',
    text: 'Estamos en la esquina; si llegas en auto, hay estacionamiento a media cuadra.',
    why: 'Estacionar es la fricción que más tarde aparece y la que más retrasa la llegada.',
  },
  {
    key: 'cancelar',
    category: 'Tranquilidad',
    text: 'Si te surge algo, avísanos con tu código y liberamos la mesa sin problema.',
    why: 'Ofrecer la salida reduce la inasistencia: quien sabe que puede cancelar, avisa en vez de no aparecer.',
  },
  {
    key: 'contacto',
    category: 'Tranquilidad',
    text: '¿Alguna duda antes de venir? Escríbenos y te respondemos.',
    why: 'Un canal abierto evita que una duda menor se convierta en una cancelación silenciosa.',
  },
  {
    key: 'gesto',
    category: 'Un gesto',
    text: 'Cuéntanos si celebras algo y lo preparamos.',
    why: 'Invita a compartir un dato que permite personalizar y crea expectativa antes de llegar.',
  },
  {
    key: 'anfitrion',
    category: 'Un gesto',
    text: 'Pregunta por el equipo al llegar; te acompañamos a tu mesa.',
    why: 'Nombrar a quien recibe convierte un trámite en una visita esperada.',
  },
  {
    key: 'restriccion',
    category: 'Preparación',
    text: 'Si tienes alguna restricción alimentaria, avísanos y la tenemos lista.',
    why: 'Resuelve antes lo que de otro modo se resuelve en la mesa, con menos margen.',
  },
  {
    key: 'ninos',
    category: 'Preparación',
    text: 'Vienen niños contigo? Tenemos sillas y una carta pensada para ellos.',
    why: 'Responde una pregunta que condiciona la decisión de reservar, no solo la visita.',
  },
] as const;

/** Las cuatro que se dejan escritas al crear un formulario. */
export const DEFAULT_VENUE_TIP_KEYS = ['llegada', 'ubicacion', 'cancelar', 'contacto'] as const;

/** Texto inicial del campo: una sugerencia por línea. */
export function defaultVenueTipsText(): string {
  return DEFAULT_VENUE_TIP_KEYS
    .map((key) => VENUE_TIP_PRESETS.find((preset) => preset.key === key)?.text)
    .filter(Boolean)
    .join('\n');
}

/**
 * Convierte el texto guardado en las líneas que se muestran.
 *
 * Recorta a cuatro: más líneas dejan de leerse y compiten con el código de reserva, que es lo
 * único de esa pantalla que la persona necesita conservar.
 */
export function parseVenueTips(raw?: string): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);
}
