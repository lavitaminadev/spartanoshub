import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { EmptyState } from '../../shared/EmptyState';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { ExploradorDePeriodo } from '../reports/ExploradorDePeriodo';
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
    {/*
      Las UD no viajan al portal.

      Son la contabilidad con la que la agencia mide su propia capacidad, no un resultado del
      restaurante. Mostrarle «consumiste 12,25 UD» abre una conversación sobre el reparto interno
      de Espartanos que él no pidió. El saldo del mes sí lo ve en su inicio, porque decide si
      puede pedir otra pieza; el detalle y el consumo histórico viven en la ficha de la cuenta.
    */}
    <ExploradorDePeriodo clientId={empresa.clientId} showUdMetrics={false} />
    {reports.length ? <div className="client-monthly-reports">{reports.map((report) => <MonthlyReportCard key={report.id} report={report} detailed showUdMetrics={false} />)}</div> : <EmptyState icon="document" title="Sin informes publicados" description="Cuando el equipo termine y apruebe un informe mensual, aparecerá aquí automáticamente." />}
  </div>;
}
