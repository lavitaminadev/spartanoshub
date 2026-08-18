import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { EmptyState } from '../../shared/EmptyState';
import { Timeline, type TimelineEntry } from '../../shared/Timeline';
import { RUN_STATUS_LABEL, type AutomationRun, type AutomationRunStep } from './automation-types';

/**
 * Historial de ejecuciones de una automatización.
 *
 * Es la pantalla que convierte "la automatización no hizo nada" en una respuesta. Cada
 * ejecución se abre paso a paso con lo que recibió, lo que produjo y, si falló, en qué nodo
 * y por qué.
 */
export function AutomationRunsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [openRunId, setOpenRunId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery<AutomationRun[]>({
    queryKey: ['automation-runs', id],
    queryFn: () => api.get(`/automations/${id}/runs`),
    // Hay ejecuciones esperando su turno o su reanudación, así que la vista se refresca sola:
    // sin esto habría que recargar a mano para ver avanzar algo que sí está avanzando.
    refetchInterval: 15_000,
  });

  const { data: detail } = useQuery<{ run: AutomationRun; steps: AutomationRunStep[] }>({
    queryKey: ['automation-run-detail', openRunId],
    queryFn: () => api.get(`/automations/runs/${openRunId}`),
    enabled: Boolean(openRunId),
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <QueryErrorState message={(error as Error).message} onRetry={() => void refetch()} />;

  const runs = data ?? [];

  const stepEntries: TimelineEntry[] = (detail?.steps ?? []).map((step) => ({
    id: step.id,
    at: step.createdAt,
    origin: 'system',
    title: `${step.nodeKey} · ${STEP_STATUS_LABEL[step.status]}`,
    accent: step.status === 'failed' ? '#b90749' : step.status === 'skipped' ? '#706a73' : '#0fb9b1',
    detail: (
      <>
        {step.error ? <p className="run-step-error">{step.error}</p> : null}
        {step.output ? <pre className="run-step-json">{JSON.stringify(step.output, null, 2)}</pre> : null}
        {step.durationMs !== null && step.durationMs !== undefined ? <span className="run-step-duration">{step.durationMs} ms</span> : null}
      </>
    ),
  }));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Automatizaciones</span>
          <h1>Historial de ejecuciones</h1>
          <p className="page-subtitle">Cada vez que el evento ocurrió y qué hizo el flujo.</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-outline" onClick={() => navigate(`/automations/${id}`)}>Ver flujo</button>
          <button type="button" className="btn btn-outline" onClick={() => navigate('/automations')}>Volver</button>
        </div>
      </div>

      {runs.length === 0 ? (
        <EmptyState
          title="Sin ejecuciones todavía"
          description="Aparecerán aquí en cuanto ocurra el evento que dispara esta automatización y esté activa."
        />
      ) : (
        <div className="run-list">
          {runs.map((run) => (
            <article key={run.id} className={`run-row is-${run.status}`}>
              <button type="button" className="run-row-head" onClick={() => setOpenRunId(openRunId === run.id ? null : run.id)}>
                <span className={`run-status is-${run.status}`}>{RUN_STATUS_LABEL[run.status]}</span>
                <span className="run-entity">{run.entityType} · {run.entityId.slice(0, 8)}</span>
                <time dateTime={run.createdAt}>{new Date(run.createdAt).toLocaleString('es-CL')}</time>
                {run.attempts > 0 ? <span className="run-attempts">{run.attempts} intento{run.attempts === 1 ? '' : 's'}</span> : null}
                {run.resumeAt ? <span className="run-resume">Reanuda {new Date(run.resumeAt).toLocaleString('es-CL')}</span> : null}
              </button>

              {run.lastError ? <p className="run-error">{run.lastError}</p> : null}

              {openRunId === run.id ? (
                <div className="run-steps">
                  {stepEntries.length === 0
                    ? <p className="run-steps-empty">Esta ejecución todavía no registró pasos.</p>
                    : <Timeline entries={stepEntries} />}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

const STEP_STATUS_LABEL: Record<AutomationRunStep['status'], string> = {
  completed: 'ejecutado',
  failed: 'falló',
  skipped: 'omitido',
};
