import { reportMoney, reportPeriod, textoDeVariacion, variacion } from './monthly-report.types';
import type { MonthlyReport } from './monthly-report.types';

interface Props { report: MonthlyReport; actions?: React.ReactNode; detailed?: boolean; showUdMetrics?: boolean }

/** La clase de color de una variación; `sin-base` cuando no hay con qué dividir y no hay signo. */
function claseDeVariacion(actual: number, previo: number): string {
  const pct = variacion(actual, previo);
  return pct === null ? 'sin-base' : pct >= 0 ? 'sube' : 'baja';
}

export function MonthlyReportCard({ report, actions, detailed = false, showUdMetrics = true }: Props) {
  const metrics = report.metrics ?? {};
  /*
   * La comparación sólo existe si se guardó al generar el informe.
   *
   * Los informes anteriores a esto no la tienen, y no se calcula al abrirlos a propósito: un
   * documento firmado debe seguir mostrando la comparación del día que se firmó.
   */
  const previo = report.metricsPrevious;
  return <article className={`monthly-report-card ${detailed ? 'is-detailed' : ''}`}>
    <header><div><span className="page-eyebrow">{reportPeriod(report).toUpperCase()}</span><h3>{report.title}</h3><small>{report.clientName}</small></div><div className="monthly-report-actions">{actions}<span className={`report-state ${report.status}`}>{report.status === 'published' ? 'Publicado' : 'Borrador'}</span></div></header>
    <div className="monthly-report-kpis">
      <span><small>Inversión</small><strong>{reportMoney(report.adSpend)}</strong></span>
      <span><small>Leads</small><strong>{report.leads}</strong>{previo && <i className={claseDeVariacion(report.leads, previo.leads ?? 0)}>{textoDeVariacion(report.leads, previo.leads ?? 0)}</i>}</span>
      <span><small>Reservas</small><strong>{report.bookings}</strong>{previo && <i className={claseDeVariacion(report.bookings, previo.bookings ?? 0)}>{textoDeVariacion(report.bookings, previo.bookings ?? 0)}</i>}</span>
      <span><small>Conversiones</small><strong>{report.conversions}</strong>{previo && <i className={claseDeVariacion(report.conversions, previo.conversions ?? 0)}>{textoDeVariacion(report.conversions, previo.conversions ?? 0)}</i>}</span>
      <span><small>Ventas atribuidas</small><strong>{reportMoney(report.salesGenerated)}</strong></span>
    </div>
    {previo && <p className="report-comparacion">Comparado con el mes anterior{report.previousPeriodStart ? ` (desde el ${new Date(`${report.previousPeriodStart}T12:00:00`).toLocaleDateString('es-CL', { day: '2-digit', month: 'long' })})` : ''}.</p>}
    {report.executiveSummary && <p className="report-summary">{report.executiveSummary}</p>}
    {detailed && <div className="monthly-report-detail">
      <section><h4>Lecturas principales</h4>{report.insights?.length ? <ul>{report.insights.map((insight, index) => <li key={index}>{insight}</li>)}</ul> : <p>Sin hallazgos editoriales agregados.</p>}</section>
      <section><h4>Operación del período</h4><dl><div><dt>Piezas entregadas</dt><dd>{metrics.deliveredPieces ?? 0}</dd></div>{showUdMetrics && <div><dt>UD consumidas</dt><dd>{metrics.consumedUd ?? 0}</dd></div>}<div><dt>Reuniones completadas</dt><dd>{metrics.completedMeetings ?? 0}</dd></div><div><dt>Ausencias a reservas</dt><dd>{metrics.noShows ?? 0}</dd></div></dl></section>
      {report.recommendations && <section><h4>Próximas decisiones</h4><p>{report.recommendations}</p></section>}
    </div>}
  </article>;
}
