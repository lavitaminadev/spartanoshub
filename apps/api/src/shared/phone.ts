/** Largo máximo de un número en formato internacional, sin el `+`. */
const MAX_DIGITS = 15;

/**
 * Prefijo que se antepone cuando el número no trae uno propio.
 *
 * Se lee en cada llamada y no al cargar el módulo: leerlo una sola vez ata el valor al orden
 * en que se importan los archivos, y deja de poder cambiarse en una prueba.
 *
 * `META_PHONE_DEFAULT_COUNTRY_CODE` se sigue aceptando porque ya está en uso.
 */
function defaultCountryPrefix(): string {
  const configured = process.env.DEFAULT_PHONE_COUNTRY_PREFIX ?? process.env.META_PHONE_DEFAULT_COUNTRY_CODE;
  return configured?.replace(/\D/g, '') || '56';
}

/**
 * Lleva un teléfono a formato internacional, para que el mismo número escrito de distintas
 * formas produzca siempre la misma clave.
 *
 * Es lo que permite reconocer que una persona ya existe. Antes solo se descartaba lo que no
 * fuera dígito o `+`, de modo que `+56912345678` y `912345678` eran claves distintas: como el
 * mismo número llega con prefijo desde un formulario web y sin él desde Meta Lead Ads, la
 * duplicación era sistemática y no ocasional. Y como el contacto se deriva del lead, cada
 * lead duplicado arrastraba su propio contacto duplicado.
 *
 * Reglas, en orden:
 *
 * 1. Un `+` explícito significa que quien escribió ya indicó el país. Se respeta.
 * 2. Un cero inicial es notación local de larga distancia y no forma parte del número.
 * 3. Si ya empieza con el prefijo del país y tiene largo de número internacional, se deja.
 * 4. En cualquier otro caso se antepone el prefijo por defecto.
 *
 * @param value - Teléfono tal como lo escribió una persona.
 * @returns El número en formato `+<país><número>`, o `undefined` si no queda nada utilizable.
 */
export function normalizePhone(value?: string | null): string | undefined {
  if (!value) return undefined;

  const hadPlus = value.trim().startsWith('+');
  const digits = value.replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return undefined;

  if (hadPlus) return `+${digits.slice(0, MAX_DIGITS)}`;

  // Un número que ya trae su prefijo de país es más largo que uno local. Nueve dígitos o menos
  // en Chile es un número sin prefijo, así que se le antepone.
  const prefix = defaultCountryPrefix();
  const alreadyInternational = digits.startsWith(prefix) && digits.length > 9;
  const withPrefix = alreadyInternational ? digits : `${prefix}${digits}`;
  return `+${withPrefix.slice(0, MAX_DIGITS)}`;
}

/**
 * Variante sin el `+`, para los destinos que lo exigen así.
 *
 * Meta y Google comparan hashes de números sin signo ni separadores; enviar el `+` produce un
 * hash que no casa con nadie, y el evento se acepta sin servir para nada.
 */
export function normalizePhoneDigits(value?: string | null): string | undefined {
  return normalizePhone(value)?.slice(1);
}
