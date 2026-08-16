/**
 * Progreso del primer acceso, para que recargar no obligue a empezar de cero.
 *
 * Activar una cuenta implica escribir el nombre, abrir cinco condiciones y aceptarlas una por una.
 * Todo eso vivía en memoria: un F5, un toque accidental de «atrás» o un navegador móvil que
 * descarta la pestaña borraban el avance y obligaban a releer los cinco puntos.
 *
 * Se guarda en `sessionStorage` y no en `localStorage` a propósito: el avance solo tiene sentido
 * dentro de la pestaña donde se está activando la cuenta, y cerrar el navegador debe borrarlo en
 * vez de dejarlo en el equipo.
 *
 * **Nunca se guarda la contraseña ni ningún token.** Lo escrito en los campos de contraseña se
 * pierde al recargar, y eso es lo correcto: dejar una contraseña en el almacenamiento del
 * navegador para ahorrarle a alguien volver a escribirla es un mal negocio.
 */

/** Lo único que se conserva: avance y respuestas, nada sensible. */
export interface FirstAccessProgress {
  step?: string;
  name?: string;
  phone?: string;
  /** Puntos que se abrieron para leer. */
  readTerms?: Record<string, boolean>;
  /** Puntos aceptados. */
  accepted?: Record<string, boolean>;
  /** Versión del texto que estaba vigente al guardar. */
  termsVersion?: string;
}

/** Clave por persona: dos cuentas en la misma pestaña no deben heredar el avance de la otra. */
export function progressKey(userId?: string | null): string | null {
  return userId ? `espartanos:first-access:${userId}` : null;
}

/** Campos que jamás deben persistirse, aunque alguien los agregue al objeto por descuido. */
const FORBIDDEN = ['password', 'passwordConfirmation', 'accessToken', 'refreshToken', 'token'];

/**
 * Guarda el avance descartando cualquier campo sensible.
 *
 * El filtro existe además de la disciplina de quien llama: si mañana alguien agrega la contraseña
 * al objeto de progreso, no llega al almacenamiento.
 */
export function saveProgress(userId: string | null | undefined, progress: FirstAccessProgress): void {
  const key = progressKey(userId);
  if (!key || typeof sessionStorage === 'undefined') return;

  const limpio: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(progress)) {
    if (FORBIDDEN.includes(campo)) continue;
    if (valor !== undefined) limpio[campo] = valor;
  }
  try {
    sessionStorage.setItem(key, JSON.stringify(limpio));
  } catch {
    // Sin espacio o con el almacenamiento bloqueado, el formulario sigue funcionando: perder el
    // avance es peor experiencia, no un fallo.
  }
}

/**
 * Recupera el avance de esta persona.
 *
 * Si la versión de las condiciones cambió desde que se guardó, las aceptaciones se descartan: dar
 * por aceptado un texto que la persona no leyó es justo lo que el control de versión evita en el
 * servidor, y aquí valdría lo mismo.
 */
export function loadProgress(userId: string | null | undefined, currentTermsVersion: string): FirstAccessProgress | null {
  const key = progressKey(userId);
  if (!key || typeof sessionStorage === 'undefined') return null;

  try {
    const crudo = sessionStorage.getItem(key);
    if (!crudo) return null;
    const guardado = JSON.parse(crudo) as FirstAccessProgress;

    if (guardado.termsVersion && guardado.termsVersion !== currentTermsVersion) {
      return { step: guardado.step, name: guardado.name, phone: guardado.phone };
    }
    return guardado;
  } catch {
    // Un valor corrupto no debe impedir activar la cuenta: se ignora y se empieza limpio.
    return null;
  }
}

/** Borra el avance. Se llama al completar la activación y al abandonarla. */
export function clearProgress(userId: string | null | undefined): void {
  const key = progressKey(userId);
  if (!key || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Nada que hacer: el avance caduca solo al cerrar la pestaña.
  }
}
