export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export function imageOverlayAlpha(value?: string): number {
  const visibility = Math.max(0, Math.min(100, Number(value || 88))) / 100;
  return Number((1 - visibility).toFixed(3));
}

export function safeDesignChoice(value: string | undefined, allowed: readonly string[], fallback: string): string {
  return value && allowed.includes(value) ? value : fallback;
}

export function safeNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

/** Una ocasión de la grilla: imagen, título y una línea de texto. */
export interface Ocasion { titulo: string; texto?: string; imagen?: string }

/**
 * Lee la grilla de ocasiones guardada en el diseño.
 *
 * Viaja como JSON dentro de `designConfig`, que por lo demás es plano. Si el texto quedó mal
 * formado —una edición a mano, una copia incompleta— se devuelve vacío en vez de tumbar la página
 * pública: sin ocasiones se ve como antes, con una excepción no se ve nada.
 */
export function leerOcasiones(crudo: string | undefined): Ocasion[] {
  if (!crudo) return [];
  try {
    const lista = JSON.parse(crudo);
    if (!Array.isArray(lista)) return [];
    return lista
      .filter((item) => item && typeof item === 'object' && typeof item.titulo === 'string' && item.titulo.trim())
      .slice(0, 6)
      .map((item) => ({ titulo: String(item.titulo).trim(), texto: item.texto ? String(item.texto).trim() : undefined, imagen: item.imagen ? String(item.imagen).trim() : undefined }));
  } catch {
    return [];
  }
}

export function visible(value: string | undefined, fallback = true): boolean {
  if (value === 'false') return false;
  if (value === 'true') return true;
  return fallback;
}

export function slotDateKey(startsAt: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(startsAt));
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
