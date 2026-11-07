import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { ExploradorDePeriodo } from './ExploradorDePeriodo';
import { MonthlyReportsPanel } from './MonthlyReportsPanel';
import { PageHero } from '../../shared/PageHero';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { useAuth } from '../../core/auth';
import { useEmpresaActiva } from '../../shared/empresa-activa';
import { isModuleInPhaseScope } from '../../core/phase-scope';

interface ReportData {
  totalRevenue: number;
  activeProjects: number;
  avgUdPerClient: number;
  monthlyData?: { month: string; revenue: number; ud: number }[];
  topClients?: { name: string; revenue: number }[];
}

const money = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value || 0);
const monthLabel = (value: string) => new Date(`${value}-01T12:00:00`).toLocaleDateString('es-CL', { month: 'short', year: '2-digit' }).replace('.', '');

export function ReportsPage() {
  const user = useAuth((state) => state.user);
  const reportQuery = useQuery<ReportData>({ queryKey: ['reports'], queryFn: () => api.get('/reporting/reports') });
  if (reportQuery.isLoading) return <LoadingSpinner text="Construyendo reporte operativo..." />;
  if (reportQuery.error) return <QueryErrorState title="No pudimos construir el reporte" message={reportQuery.error.message} error={reportQuery.error} onRetry={() => reportQuery.refetch()} />;
  if (!reportQuery.data) return null;

  const data = reportQuery.data;
  const monthly = data.monthlyData ?? [];
  const topClients = data.topClients ?? [];
  const maxRevenue = Math.max(...monthly.map((row) => row.revenue), 1);
  const maxUd = Math.max(...monthly.map((row) => row.ud), 1);
  const maxClientRevenue = Math.max(...topClients.map((row) => row.revenue), 1);
  const current = monthly.at(-1);
  const previous = monthly.at(-2);
  const revenueChange = current && previous && previous.revenue > 0 ? Math.round((current.revenue - previous.revenue) * 100 / previous.revenue) : null;
  const udBudgetVisible = isModuleInPhaseScope('udBudget', user?.moduleLifecycle, user?.role)
    && (user?.permissions ? user.permissions.udBudget !== undefined && user.permissions.udBudget !== 'none' : user?.features ? user.features.udBudget !== false : true);

  return (
    <div className="page reports-page">
      <PageHero
        eyebrow="LECTURA EJECUTIVA"
        title="Reportes"
        subtitle="Ingresos, carga y distribución real."
        aside={<div className="report-period"><small>Ventana analítica</small><strong>Últimos 12 meses</strong><span>{monthly.length ? `${monthLabel(monthly[0].month)} - ${monthLabel(monthly.at(-1)!.month)}` : 'Sin movimientos registrados'}</span></div>}
      />

      <section className="report-kpis" aria-label="Indicadores principales">
        <article className="report-kpi-primary"><span>Ingresos pagados</span><strong>{money(data.totalRevenue)}</strong><small>{revenueChange == null ? 'Sin base mensual para comparar' : `${revenueChange >= 0 ? '+' : ''}${revenueChange}% respecto al mes anterior`}</small></article>
        <article><span>Piezas activas</span><strong>{data.activeProjects}</strong><small>Sin entregar ni cancelar</small></article>
        {udBudgetVisible && <article><span>Capacidad promedio</span><strong>{data.avgUdPerClient} <i>UD</i></strong><small>Presupuesto base por cliente</small></article>}
      </section>

      <div className="report-layout">
        <section className="report-panel report-trend"><header><div><span className="page-eyebrow">EVOLUCIÓN</span><h2>Actividad mensual</h2></div><div className="report-legend"><span><i className="revenue" />Ingresos</span>{udBudgetVisible && <span><i className="ud" />UD producidas</span>}</div></header>
          {monthly.length ? <div className="monthly-tracks">{monthly.map((row) => <article key={row.month}><time>{monthLabel(row.month)}</time><div className="metric-track"><span className="revenue" style={{ width: `${Math.max(row.revenue ? 3 : 0, row.revenue * 100 / maxRevenue)}%` }} /><b>{money(row.revenue)}</b></div>{udBudgetVisible && <div className="metric-track"><span className="ud" style={{ width: `${Math.max(row.ud ? 3 : 0, row.ud * 100 / maxUd)}%` }} /><b>{row.ud} UD</b></div>}</article>)}</div> : <div className="panel-empty"><strong>Aún no existe una serie mensual</strong><span>Se formará automáticamente al registrar entregas e ingresos pagados.</span></div>}
          {udBudgetVisible && <p className="data-note">Ingresos y UD usan escalas independientes para evitar comparaciones visuales engañosas.</p>}
        </section>

        <section className="report-panel top-clients"><header><div><span className="page-eyebrow">CONCENTRACIÓN</span><h2>Clientes por ingresos</h2></div></header>
          {topClients.length ? <div className="ranked-clients">{topClients.map((client, index) => <article key={`${client.name}-${index}`}><b>{String(index + 1).padStart(2, '0')}</b><div><span><strong>{client.name}</strong><small>{money(client.revenue)}</small></span><i><em style={{ width: `${client.revenue * 100 / maxClientRevenue}%` }} /></i></div></article>)}</div> : <div className="panel-empty"><strong>Sin ingresos atribuidos</strong><span>Los clientes aparecerán al existir registros pagados.</span></div>}
        </section>
      </div>
      <SelectorDeEmpresaParaExplorar showUdMetrics={udBudgetVisible} />
      <MonthlyReportsPanel showUdMetrics={udBudgetVisible} />
    </div>
  );
}

/**
 * El explorador, sobre la empresa que el marco tiene elegida.
 *
 * El resto de esta página mira la agencia entera: ingresos, concentración, carga. El explorador no
 * puede, y el servidor responde 400 a un rango sin empresa, así que hace falta una elegida.
 *
 * La elección no se pregunta acá: viene de `empresa-activa`, la misma que usan la cabecera, el
 * inicio y las reservas. Tenía su propio selector, y con eso elegir una empresa en esta página no
 * cambiaba nada en las otras —y al revés—, de modo que dos pantallas abiertas podían estar
 * mirando locales distintos sin que nada lo dijera.
 */
function SelectorDeEmpresaParaExplorar({ showUdMetrics }: { showUdMetrics: boolean }) {
  const { clientId, empresas, nombre, elegir, varias } = useEmpresaActiva();

  // Sin encabezado propio: el explorador ya trae el suyo, y puestos los dos la página decía
  // «Explorar un período» dos veces seguidas.
  return <section className="report-panel explorador-anfitrion">
    {clientId
      ? <>
          {/* Se nombra la empresa medida: el selector del marco queda arriba y fuera de la vista
              al desplazarse, y una tabla de cifras sin nombre no se puede leer. */}
          <p className="explorador-midiendo" role="status">Midiendo <strong>{nombre}</strong></p>
          <ExploradorDePeriodo clientId={clientId} showUdMetrics={showUdMetrics} />
        </>
      : <div className="panel-empty">
          <strong>Elige una empresa</strong>
          <span>Las métricas del rango son de una empresa concreta; sumar varias no diría nada.</span>
          {/* El atajo: elegir acá cambia la empresa del marco, no una sólo de esta página. */}
          {varias && <select className="input" aria-label="Empresa del análisis" value="" onChange={(evento) => elegir(evento.target.value)}>
            <option value="">Selecciona una empresa</option>
            {empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.name}</option>)}
          </select>}
        </div>}
  </section>;
}
