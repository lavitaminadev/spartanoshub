/**
 * La región que la persona declaró en el formulario, para el parámetro `st` de Meta.
 *
 * Los formularios instantáneos de Lead Ads preguntan la región con frecuencia, y esa respuesta
 * queda guardada entre las del formulario. Meta la acepta como parámetro de emparejamiento y la
 * cuenta para la calidad del evento, así que enviarla no cuesta ningún dato nuevo: ya se pidió.
 *
 * No se deduce ni se rellena. Si la pregunta no está o vino en blanco no se manda nada: un valor
 * inventado produce un hash que no empareja con nadie y le enseña a Meta algo falso.
 *
 * La normalización —minúsculas, sin tildes ni signos— la aplica la cola al hashear, tal como Meta
 * exige para los estados fuera de Estados Unidos.
 */

/** Respuesta de un formulario, tal como la guarda la captura. */
type Respuesta = { question?: unknown; answer?: unknown };

/**
 * Cómo se reconoce la pregunta de la región.
 *
 * Se compara sobre el texto sin tildes ni signos porque quien redacta el anuncio escribe la
 * pregunta a mano y cambia entre campañas: «¿Cuál es tu región?» y «Cual es tu region» son la
 * misma pregunta. Meta además antepone un carácter invisible en algunas, que la limpieza quita.
 */
const PALABRAS_DE_REGION = ['region', 'comuna', 'ciudad', 'provincia'];

/** Deja un texto comparable: sin tildes, sin signos y en minúsculas. */
function comparable(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * @param metadata - Lo que se guardó de la captura, con las respuestas del formulario.
 * @returns La región declarada, o `undefined` si no la hay.
 */
export function regionDelLead(metadata: unknown): string | undefined {
  const respuestas = (metadata as { answers?: unknown })?.answers;
  if (!Array.isArray(respuestas)) return undefined;

  for (const fila of respuestas as Respuesta[]) {
    const pregunta = comparable(fila?.question);
    if (!PALABRAS_DE_REGION.some((palabra) => pregunta.includes(palabra))) continue;

    const respuesta = String(fila?.answer ?? '').trim();
    if (respuesta) return respuesta;
  }

  return undefined;
}
