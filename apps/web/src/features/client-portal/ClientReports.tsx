import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { EmptyState } from '../../shared/EmptyState';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { MonthlyReportCard } from '../reports/MonthlyReportCard';
import type { MonthlyReport } from '../reports/monthly-report.types';
import { PageHero } from '../../shared/PageHero';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { useEmpresaDeDatos } from './empresa-de-datos';
import { SoloEmpresaPropia } from './SoloEmpresaPropia';

export function ClientReports() {
  const empresa = useEmpresaDeDatos();
  const { data: reports = [], isLoading, error, refetch } = useQuery<MonthlyReport[]>({ queryKey: ['client-monthly-reports', empresa.userId, empresa.clientId], enabled: empresa.disponible, queryFn: () => api.get(`/reporting/monthly-reports?clientId=${encodeURIComponent(empresa.clientId)}`) });
  if (!empresa.disponible) return <SoloEmpresaPropia nombre={empresa.nombre} seccion="Los informes" />;
  if (isLoading) return <LoadingSpinner text="Cargando informes publicados..." />;
  if (error) return <QueryErrorState title="No pudimos cargar tus informes" message={error.message} error={error} onRetry={() => refetch()} />;
  return <div className="page client-reports-page">
    <PageHero
      tone="portal"
      eyebrow="TRANSPARENCIA DE RESULTADOS"
      title="Mis informes"
      subtitle="Resultados con métricas verificables."
      actions={<button className="btn btn-outline" disabled={!reports.length} onClick={() => window.print()}>Imprimir / guardar PDF</button>}
    />
    {reports.length ? <div className="client-monthly-reports">{reports.map((report) => <MonthlyReportCard key={report.id} report={report} detailed />)}</div> : <EmptyState icon="document" title="Sin informes publicados" description="Cuando el equipo termine y apruebe un informe mensual, aparecerá aquí automáticamente." />}
  </div>;
}
