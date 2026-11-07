import { DataSource } from 'typeorm';

/**
 * Las doce métricas de un período, y el gasto y las ventas que las acompañan.
 *
 * Es la única definición de «cómo le fue a esta empresa entre dos fechas». La usan el informe
 * mensual —que la congela, la redacta y la publica— y el explorador —que la calcula al vuelo para
 * el rango que se pida—. Una sola función porque son la misma pregunta: si el explorador tuviera
 * sus propios agregados, un día diría una cifra distinta a la del informe sobre el mismo mes y no
 * habría forma de saber cuál de los dos miente.
 */
export interface MetricasDelPeriodo {
  impressions: number;
  clicks: number;
  leads: number;
  conversions: number;
  bookings: number;
  attendedBookings: number;
  noShows: number;
  deliveredPieces: number;
  consumedUd: number;
  meetings: number;
  completedMeetings: number;
  wonOpportunities: number;
}

export interface ResultadoDelPeriodo {
  /** Primer día incluido, en `YYYY-MM-DD`. */
  desde: string;
  /** Primer día **excluido**, en `YYYY-MM-DD`: el rango es `[desde, hasta)`. */
  hasta: string;
  metricas: MetricasDelPeriodo;
  /** Inversión publicitaria del período, en la moneda que traiga la integración. */
  inversion: number;
  /** Ventas atribuidas: oportunidades ganadas en el período, en CLP. */
  ventas: number;
}

/**
 * Convierte una fecha a `YYYY-MM-DD` en hora local, que es la que usan las consultas.
 *
 * `toISOString()` no sirve acá: pasa a UTC, y en Chile eso corre el día hacia atrás, de modo que
 * un rango que empieza el 1 preguntaría desde el 30 del mes anterior.
 */
export function comoFecha(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

/** El rango `[desde, hasta)` que cubre un mes calendario completo. */
export function rangoDelMes(year: number, month: number): { desde: string; hasta: string } {
  return { desde: comoFecha(new Date(year, month - 1, 1)), hasta: comoFecha(new Date(year, month, 1)) };
}

/**
 * Mide un rango `[desde, hasta)` para una empresa.
 *
 * @param desde - Primer día incluido, `YYYY-MM-DD`.
 * @param hasta - Primer día excluido, `YYYY-MM-DD`. Un rango vacío devuelve ceros, no un error:
 * el explorador pregunta por rangos que pueden no tener nada, y «cero reservas» es una respuesta.
 */
export async function metricasDelPeriodo(
  dataSource: DataSource,
  organizationId: string,
  clientId: string,
  desde: string,
  hasta: string,
): Promise<ResultadoDelPeriodo> {
  const params = [organizationId, clientId, desde, hasta];
  const [[ads], [bookings], [production], [meetings], [sales]] = await Promise.all([
    dataSource.query('SELECT COALESCE(SUM(spend),0) spend, COALESCE(SUM(impressions),0) impressions, COALESCE(SUM(clicks),0) clicks, COALESCE(SUM(leads),0) leads, COALESCE(SUM(conversions),0) conversions FROM integration_metrics WHERE organization_id = ? AND client_id = ? AND metric_date >= ? AND metric_date < ?', params),
    dataSource.query("SELECT COUNT(*) total, SUM(CASE WHEN status = 'attended' THEN 1 ELSE 0 END) attended, SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) noShow FROM reservations WHERE organization_id = ? AND client_id = ? AND starts_at >= ? AND starts_at < ?", params),
    dataSource.query("SELECT COUNT(*) delivered, COALESCE(SUM(ud_amount),0) ud FROM pieces WHERE organization_id = ? AND client_id = ? AND delivered_at >= ? AND delivered_at < ? AND status = 'delivered'", params),
    dataSource.query("SELECT COUNT(*) total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) completed FROM meetings WHERE organization_id = ? AND client_id = ? AND scheduled_at >= ? AND scheduled_at < ?", params),
    dataSource.query("SELECT COALESCE(SUM(amount),0) total, COUNT(*) count FROM crm_opportunities WHERE organization_id = ? AND client_id = ? AND stage IN ('won','closed_won') AND updated_at >= ? AND updated_at < ?", params),
  ]);
  return {
    desde,
    hasta,
    metricas: {
      impressions: Number(ads?.impressions ?? 0),
      clicks: Number(ads?.clicks ?? 0),
      leads: Number(ads?.leads ?? 0),
      conversions: Number(ads?.conversions ?? 0),
      bookings: Number(bookings?.total ?? 0),
      attendedBookings: Number(bookings?.attended ?? 0),
      noShows: Number(bookings?.noShow ?? 0),
      deliveredPieces: Number(production?.delivered ?? 0),
      consumedUd: Number(production?.ud ?? 0),
      meetings: Number(meetings?.total ?? 0),
      completedMeetings: Number(meetings?.completed ?? 0),
      wonOpportunities: Number(sales?.count ?? 0),
    },
    inversion: Number(ads?.spend ?? 0),
    ventas: Number(sales?.total ?? 0),
  };
}

export type ModoDeComparacion = 'anterior' | 'ano_anterior' | 'ninguna';

/**
 * El rango con el que se compara, de igual duración que el pedido.
 *
 * `anterior` toma los mismos días inmediatamente antes, de modo que comparar catorce días es
 * comparar contra catorce y no contra un mes. `ano_anterior` corre las dos fechas doce meses
 * atrás, que es lo que sirve donde el negocio es estacional: un diciembre no se compara con un
 * noviembre.
 */
export function rangoDeComparacion(desde: string, hasta: string, modo: ModoDeComparacion): { desde: string; hasta: string } | null {
  if (modo === 'ninguna') return null;
  const inicio = new Date(`${desde}T12:00:00`);
  const fin = new Date(`${hasta}T12:00:00`);
  if (modo === 'ano_anterior') {
    return {
      desde: comoFecha(new Date(inicio.getFullYear() - 1, inicio.getMonth(), inicio.getDate())),
      hasta: comoFecha(new Date(fin.getFullYear() - 1, fin.getMonth(), fin.getDate())),
    };
  }
  /*
   * Un mes calendario se compara con el mes calendario anterior, no con sus mismos días.
   *
   * Restar la duración funciona para un rango cualquiera y falla justo en el caso del informe
   * mensual: marzo tiene 31 días, así que restarle 31 a su inicio cae el 29 de enero y la
   * comparación se lleva tres días de enero además de todo febrero. Se detecta el mes completo
   * —empieza el día 1 y termina el día 1 del mes siguiente— y entonces se corre un mes, que es lo
   * que el calendario sabe hacer sin contar días.
   */
  const esMesCompleto = inicio.getDate() === 1 && fin.getDate() === 1
    && (fin.getFullYear() * 12 + fin.getMonth()) - (inicio.getFullYear() * 12 + inicio.getMonth()) === 1;
  if (esMesCompleto) {
    return { desde: comoFecha(new Date(inicio.getFullYear(), inicio.getMonth() - 1, 1)), hasta: desde };
  }
  const dias = Math.max(1, Math.round((fin.getTime() - inicio.getTime()) / 86_400_000));
  return {
    desde: comoFecha(new Date(inicio.getTime() - dias * 86_400_000)),
    hasta: desde,
  };
}
