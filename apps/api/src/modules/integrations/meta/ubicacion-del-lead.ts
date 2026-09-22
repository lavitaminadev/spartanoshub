import { inferLocationFromPhone } from '../../../shared/geo-inference';

/**
 * @fileoverview Dónde vive quien dejó el lead, para los parámetros `ct` y `st` de Meta.
 *
 * Meta compara la región contra su propia lista de regiones y la ciudad contra la de ciudades.
 * Mandar una comuna como si fuera región no empareja con nadie: el dato no suma y además ocupa
 * el lugar de la región de verdad. Por eso cada respuesta va al parámetro que le corresponde.
 *
 * Nada se inventa. Lo único que el sistema completa por su cuenta es lo que puede deducir del
 * teléfono fijo —el código de área dice la zona—, que es la misma deducción que ya usa Reservas.
 * Un móvil chileno no codifica región, así que de un móvil no sale nada.
 */

/** Respuesta de un formulario, tal como la guarda la captura. */
type Respuesta = { question?: unknown; answer?: unknown };

/** Preguntas que responden con una región. */
const PALABRAS_DE_REGION = ['region', 'provincia'];

/** Preguntas que responden con una ciudad o comuna. */
const PALABRAS_DE_CIUDAD = ['comuna', 'ciudad', 'localidad'];

/** Deja un texto comparable: sin tildes, sin signos y en minúsculas. */
function comparable(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** La primera respuesta cuya pregunta mencione alguna de esas palabras. */
function respuestaQueMencione(respuestas: Respuesta[], palabras: string[]): string | undefined {
  for (const fila of respuestas) {
    const pregunta = comparable(fila?.question);
    if (!palabras.some((palabra) => pregunta.includes(palabra))) continue;
    const respuesta = String(fila?.answer ?? '').trim();
    if (respuesta) return respuesta;
  }
  return undefined;
}

/**
 * La ciudad y la región de un lead, cada una en su lugar.
 *
 * @param metadata - Lo que se guardó de la captura, con las respuestas del formulario.
 * @param telefono - Para completar lo que la persona no declaró, sólo si su fijo lo dice.
 * @returns Lo que se sepa. Lo que no, se omite.
 */
export function ubicacionDelLead(metadata: unknown, telefono?: string | null): { ciudad?: string; region?: string } {
  const respuestas = (metadata as { answers?: unknown })?.answers;
  const filas = Array.isArray(respuestas) ? respuestas as Respuesta[] : [];
  const declarada = {
    region: respuestaQueMencione(filas, PALABRAS_DE_REGION),
    ciudad: respuestaQueMencione(filas, PALABRAS_DE_CIUDAD),
  };
  if (declarada.region && declarada.ciudad) return declarada;

  const deducida = inferLocationFromPhone(telefono);
  return {
    region: declarada.region ?? deducida.region,
    ciudad: declarada.ciudad ?? deducida.city,
  };
}
