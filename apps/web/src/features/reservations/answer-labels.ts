import type { FormField } from './types';

/**
 * Etiquetas de las respuestas que el servidor agrega fuera del `fieldSchema`.
 *
 * `createPublic` guarda estas claves junto a las respuestas del formulario, asi que no tienen
 * un campo publicado del que tomar el enunciado. Sin esta tabla se mostraban con su nombre
 * tecnico a quien atiende el turno.
 */
const ETIQUETAS_DEL_SISTEMA: Record<string, string> = {
  groupEventType: 'Tipo de celebración',
  groupEventNotes: 'Notas del grupo',
  childrenCount: 'Niños',
  accessibilityNeed: 'Accesibilidad',
  dietaryNotes: 'Restricciones alimentarias',
};

/** Respuestas que conviene destacar en el tablero del dia, en el orden en que se atienden. */
const DESTACADAS = ['dietaryNotes', 'accessibilityNeed', 'childrenCount', 'groupEventType'] as const;

export interface RespuestaLegible {
  clave: string;
  etiqueta: string;
  valor: string;
  destacada: boolean;
}

/** Convierte un valor de respuesta en algo mostrable, sin inventar contenido. */
function comoTexto(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '';
  if (Array.isArray(valor)) return valor.join(', ');
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  return String(valor);
}

/**
 * Empareja cada respuesta con el enunciado que vio quien reservo.
 *
 * El enunciado sale del `fieldSchema` del formulario, que es la unica fuente que sabe como se
 * pregunto. Una respuesta sin campo publicado —porque el formulario cambio despues, o porque la
 * agrega el servidor— cae en la tabla del sistema y, si tampoco esta ahi, conserva su clave:
 * perder el dato seria peor que mostrarlo con un nombre feo.
 */
export function respuestasLegibles(
  answers: Record<string, unknown> | undefined,
  fieldSchema: FormField[] | undefined,
): RespuestaLegible[] {
  if (!answers) return [];
  const porId = new Map((fieldSchema || []).map((field) => [field.id, field.label]));
  return Object.entries(answers)
    .map(([clave, valor]) => ({
      clave,
      etiqueta: porId.get(clave) || ETIQUETAS_DEL_SISTEMA[clave] || clave,
      valor: comoTexto(valor),
      destacada: (DESTACADAS as readonly string[]).includes(clave),
    }))
    .filter((item) => item.valor !== '');
}

/** Solo lo que el turno necesita ver de un vistazo. */
export function respuestasDestacadas(
  answers: Record<string, unknown> | undefined,
  fieldSchema: FormField[] | undefined,
): RespuestaLegible[] {
  return respuestasLegibles(answers, fieldSchema).filter((item) => item.destacada);
}

/** Cuatro UTM de una solicitud, en una linea. */
export interface OrigenUtm { utmSource?: string | null; utmMedium?: string | null; utmCampaign?: string | null; utmContent?: string | null }

/**
 * Campana por la que llego una solicitud, en una linea legible.
 *
 * Devuelve cadena vacia cuando no hubo UTM: la solicitud llego por enlace directo, QR o
 * busqueda, y escribir "directo" ahi la atribuiria a un origen que nadie midio.
 */
export function origenDeSolicitud(origen: OrigenUtm): string {
  return [origen.utmSource, origen.utmMedium, origen.utmCampaign, origen.utmContent]
    .map((parte) => parte?.trim())
    .filter((parte): parte is string => Boolean(parte))
    .join(' · ');
}
