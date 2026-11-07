export interface MonthlyReport {
  id: string;
  clientId: string;
  clientName?: string;
  year: number;
  month: number;
  title: string;
  status: 'draft' | 'published';
  executiveSummary?: string;
  metrics: Record<string, number>;
  /** Las mismas métricas del mes anterior, congeladas al generar. Ausentes en informes viejos. */
  metricsPrevious?: Record<string, number>;
  /** Primer día del período con que se comparó, `YYYY-MM-DD`. */
  previousPeriodStart?: string;
  insights?: string[];
  recommendations?: string;
  salesGenerated: number;
  adSpend: number;
  leads: number;
  bookings: number;
  conversions: number;
  publishedAt?: string;
}

export const reportPeriod = (report: Pick<MonthlyReport, 'year' | 'month'>) => new Date(report.year, report.month - 1, 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
export const reportMoney = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value || 0);

/**
 * La variación entre dos cifras, en porcentaje entero, o `null` cuando no se puede calcular.
 *
 * Sin base no hay porcentaje: pasar de 0 a 8 no es «+800%», es «de nada a ocho». Devolver `null`
 * obliga a quien muestra la cifra a decir eso en palabras en vez de inventar un número que
 * parecería medido.
 */
export function variacion(actual: number, previo: number): number | null {
  if (!Number.isFinite(actual) || !Number.isFinite(previo) || previo === 0) return null;
  return Math.round(((actual - previo) / previo) * 100);
}

/** Cómo se dice una variación: el signo delante, y el caso sin base en palabras. */
export function textoDeVariacion(actual: number, previo: number): string {
  const pct = variacion(actual, previo);
  if (pct === null) return previo === 0 && actual > 0 ? 'sin base previa' : 'sin cambio medible';
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}
