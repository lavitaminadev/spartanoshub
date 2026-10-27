/**
 * @fileoverview Saneo de lo que entra a la bitácora de auditoría.
 *
 * La bitácora guarda qué se cambió, no los secretos que viajaron con el cambio. Se limpia por dos
 * vías que se complementan: por el **nombre** del campo (`password`, `clave`, `rut`…) y por el
 * **valor** (un token pegado en un texto libre, una URL con credencial). Con sólo la primera, un
 * secreto escrito en un comentario o en una URL pasaba intacto.
 *
 * Toda entrada a `audit_logs` pasa por aquí: tanto el interceptor de peticiones como
 * `AuditService.log`, que es por donde entran los registros hechos a mano desde los servicios.
 */

export const REDACTADO = '[REDACTED]';
const RECORTE_DE_TEXTO = 2000;
const PROFUNDIDAD_MAXIMA = 6;
const ELEMENTOS_MAXIMOS = 50;

/** Nombres que delatan un secreto por sí solos, estén donde estén dentro del campo. */
const NOMBRE_SENSIBLE = /passw|passwd|contrase|secret|token|authorization|cookie|credential|temporary|api[-_ ]?key|private[-_ ]?key|bearer|signature|refresh/i;

/** Palabras que sólo son sensibles enteras: `pin` sí, `pinned` y `shipping` no. */
const PALABRA_SENSIBLE = new Set(['pin', 'rut', 'clave', 'pwd', 'pass', 'otp', 'cvv']);

/** Parte un nombre de campo en palabras: `userRut`, `user_rut` y `user-rut` dan `user`, `rut`. */
function palabrasDe(nombre: string): string[] {
  return nombre.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9ñ]+/).filter(Boolean);
}

/** Si el nombre del campo indica que su valor es un secreto o un identificador personal fuerte. */
export function esNombreSensible(nombre: string): boolean {
  if (NOMBRE_SENSIBLE.test(nombre)) return true;
  return palabrasDe(nombre).some((palabra) => PALABRA_SENSIBLE.has(palabra));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parámetros de una URL cuyo valor es una credencial. */
const PARAMETRO_SECRETO = /([?&;](?:access_token|refresh_token|id_token|token|api[-_]?key|apikey|key|secret|client_secret|password|passwd|pwd|clave|sig|signature|auth|code)=)[^&\s#"'<>]+/gi;

/** `usuario:clave@host` dentro de una URL. */
const CREDENCIAL_EN_URL = /(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/:@]+:[^\s/@]+@/gi;

/** `token: abc`, `clave=abc`, `password es abc`: un secreto nombrado dentro de un texto libre. */
const SECRETO_NOMBRADO = /\b(password|passwd|contraseña|contrasena|clave|token|secret|secreto|api[-_ ]?key|pin)\s*(?:[:=]|es|is)\s*["']?[^\s"',;&]{3,}/gi;

/** Formas de token con prefijo conocido o estructura propia. */
const FORMAS_DE_TOKEN: RegExp[] = [
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g, // JWT
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}/g, // Stripe y afines
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g, // GitHub
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g, // Slack
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS
  /\bAIza[0-9A-Za-z_-]{30,}/g, // Google
  /\bya29\.[A-Za-z0-9_-]{20,}/g, // OAuth de Google
  /\bEAA[A-Za-z0-9]{20,}/g, // Meta
];

/** RUT con o sin puntos: un identificador personal fuerte que no debe quedar en un texto libre. */
const RUT_EN_TEXTO = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/g;

/** Cadena larga y opaca con letras y dígitos: lo que casi siempre es una llave y casi nunca es prosa. */
const CADENA_OPACA = /[A-Za-z0-9_-]{32,}/g;

/**
 * Recorta de un texto lo que es una credencial por su **valor**, sin mirar el campo que lo contiene.
 *
 * Los identificadores (UUID) se respetan: son lo que la bitácora existe para cruzar.
 */
export function sanearTexto(texto: string): string {
  let limpio = texto
    .replace(CREDENCIAL_EN_URL, `$1${REDACTADO}@`)
    .replace(PARAMETRO_SECRETO, `$1${REDACTADO}`)
    .replace(SECRETO_NOMBRADO, (_, nombre: string) => `${nombre}=${REDACTADO}`);
  for (const forma of FORMAS_DE_TOKEN) limpio = limpio.replace(forma, REDACTADO);
  limpio = limpio.replace(RUT_EN_TEXTO, REDACTADO);
  limpio = limpio.replace(CADENA_OPACA, (cadena) => (UUID.test(cadena) || !/[A-Za-z]/.test(cadena) || !/\d/.test(cadena) ? cadena : REDACTADO));
  return limpio.length > RECORTE_DE_TEXTO ? `${limpio.slice(0, RECORTE_DE_TEXTO)}...` : limpio;
}

/**
 * Copia saneada de cualquier valor que vaya a la bitácora.
 *
 * - Los campos con nombre sensible se reemplazan enteros.
 * - Todo texto se limpia por valor y se recorta.
 * - Lo que queda más hondo que `PROFUNDIDAD_MAXIMA` no se conserva: dejarlo pasar crudo era la
 *   salida por la que un secreto anidado esquivaba el saneo.
 */
export function sanearParaBitacora(valor: unknown, profundidad = 0): unknown {
  if (valor == null) return valor;
  if (typeof valor === 'string') return sanearTexto(valor);
  if (typeof valor !== 'object') return valor;
  if (valor instanceof Date) return valor.toISOString();
  if (profundidad >= PROFUNDIDAD_MAXIMA) return '[TRUNCATED]';
  if (Array.isArray(valor)) return valor.slice(0, ELEMENTOS_MAXIMOS).map((elemento) => sanearParaBitacora(elemento, profundidad + 1));
  return Object.fromEntries(
    Object.entries(valor as Record<string, unknown>).map(([clave, elemento]) => [
      clave,
      esNombreSensible(clave) ? REDACTADO : sanearParaBitacora(elemento, profundidad + 1),
    ]),
  );
}
