import { createHash } from 'node:crypto';
import { normalizeGeoValue } from '../../../shared/geo-inference';
import { normalizePhoneDigits } from '../../../shared/phone';

/**
 * Los datos de identificación que Meta exige hasheados, y cómo dejarlos listos.
 *
 * Meta compara digests, no valores: un correo con una mayúscula de más o un teléfono con un
 * espacio producen un hash distinto y el evento se acepta **sin emparejarse con nadie**. Por eso
 * la normalización es parte del formato, no una limpieza opcional.
 *
 * Vive aparte del servicio de envío porque ahora se aplica en dos momentos —al encolar y al
 * enviar— y con dos propósitos distintos: no guardar datos personales en claro, y no mandarlos
 * aunque un registro antiguo los traiga.
 */

/** Un digest de SHA-256 en hexadecimal. */
const SHA256_HEX = /^[a-f0-9]{64}$/i;

/**
 * Si un valor ya es un digest.
 *
 * Es lo que permite aplicar el hasheo dos veces sin estropearlo: hashear un hash produce un
 * valor que no casa con nadie, y el evento se enviaría, se aceptaría y no serviría para nada
 * —un fallo que no deja ninguna señal en ninguna parte—.
 */
export function yaEstaHasheado(valor: string): boolean {
  return SHA256_HEX.test(valor.trim());
}

/** Correo: sin espacios alrededor y en minúsculas. El interior de la dirección no se toca. */
export function normalizarCorreo(valor: string): string {
  return valor.trim().toLowerCase();
}

/**
 * Teléfono: solo dígitos, con código de país y sin `+`.
 *
 * Reutiliza la normalización común del proyecto para que el mismo número produzca la misma clave
 * acá, en el CRM y en Google. Si difiriera, el hash no casaría con nadie.
 */
export function normalizarTelefono(valor: string): string {
  return normalizePhoneDigits(valor) ?? '';
}

/** Nombre y apellido: igual que el correo, minúsculas y sin espacios sobrantes. */
export function normalizarNombre(valor: string): string {
  return valor.trim().toLowerCase();
}

/** Ciudad, región y país, en el formato que Meta espera. */
export function normalizarGeografia(valor: string): string {
  return normalizeGeoValue(valor);
}

/**
 * Normaliza y hashea una lista de valores de un mismo parámetro.
 *
 * Descarta lo que quede vacío tras normalizar, y omite el parámetro completo si no sobrevive
 * ninguno. La alternativa —hashear la cadena vacía— produce siempre el mismo digest, de modo que
 * Meta recibiría un identificador idéntico para toda persona cuyo dato no se pudo normalizar y
 * las trataría como una sola.
 *
 * Lo que ya viene hasheado pasa intacto, solo en minúsculas.
 *
 * @param valores - Tal como vienen del evento, o `undefined` si el parámetro no viaja.
 * @param normalizar - Formato que Meta exige para ese parámetro antes de hashear.
 * @returns Los digests en hexadecimal, o `undefined` si no queda ninguno que enviar.
 */
export function hashearTodos(
  valores: string[] | undefined,
  normalizar: (valor: string) => string,
): string[] | undefined {
  if (!valores?.length) return undefined;

  const digests = valores
    .map((valor) => valor ?? '')
    .map((valor) => (yaEstaHasheado(valor) ? valor.trim().toLowerCase() : normalizar(valor)))
    .filter((valor) => valor.length > 0)
    .map((valor) => (SHA256_HEX.test(valor) ? valor : createHash('sha256').update(valor).digest('hex')));

  return digests.length > 0 ? digests : undefined;
}

/**
 * Deja listos los identificadores de una persona, sin tocar lo que no se hashea.
 *
 * `lead_id`, `fbc`, `fbp`, la dirección y el navegador **no llevan hash**: son identificadores
 * que generó Meta o señales técnicas, y hashearlos los vuelve irreconocibles para ellos.
 */
export function prepararIdentificadores<T extends Record<string, unknown>>(userData: T): T {
  const datos = userData as Record<string, unknown>;
  return {
    ...userData,
    em: hashearTodos(datos.em as string[] | undefined, normalizarCorreo),
    ph: hashearTodos(datos.ph as string[] | undefined, normalizarTelefono),
    fn: hashearTodos(datos.fn as string[] | undefined, normalizarNombre),
    ln: hashearTodos(datos.ln as string[] | undefined, normalizarNombre),
    externalId: hashearTodos(datos.externalId as string[] | undefined, (valor) => valor.trim()),
    ct: hashearTodos(datos.ct as string[] | undefined, normalizarGeografia),
    st: hashearTodos(datos.st as string[] | undefined, normalizarGeografia),
    country: hashearTodos(datos.country as string[] | undefined, normalizarGeografia),
  } as T;
}

/**
 * Qué parámetro delata datos personales en claro justo antes de enviar.
 *
 * Es la última reja, y existe para que un error de programación no se convierta en una fuga: si
 * algún camino futuro deja de hashear, el evento no sale.
 *
 * @returns El nombre del parámetro en falta, o `null` si todo va hasheado.
 */
export function parametroSinHashear(userData: Record<string, unknown>): string | null {
  for (const parametro of ['em', 'ph', 'fn', 'ln', 'ct', 'st', 'country', 'externalId']) {
    const valores = userData[parametro] as string[] | undefined;
    if (!valores?.length) continue;
    if (valores.some((valor) => !SHA256_HEX.test(String(valor ?? '')))) return parametro;
  }
  return null;
}
