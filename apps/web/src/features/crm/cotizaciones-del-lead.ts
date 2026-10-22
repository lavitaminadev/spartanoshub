const DIA_MS = 86_400_000;

/**
 * La frase que resume cuántas veces se cotizó a un prospecto: «Cotizó 2 veces, la última hace 40 días».
 *
 * Devuelve `null` cuando no hay cotizaciones enviadas: ausencia y cero no son lo mismo, y quien
 * la muestra debe omitir la línea en vez de escribir «0 veces».
 */
export function lineaDeCotizaciones(veces: number, ultimaEn: string | null | undefined, ahora: Date = new Date()): string | null {
  if (!veces || veces < 1) return null;
  const cuantas = veces === 1 ? 'Cotizó 1 vez' : `Cotizó ${veces} veces`;
  if (!ultimaEn) return cuantas;
  const dias = Math.max(0, Math.floor((ahora.getTime() - new Date(ultimaEn).getTime()) / DIA_MS));
  const cuando = dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`;
  return `${cuantas}, la última ${cuando}`;
}
