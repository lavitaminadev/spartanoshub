import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../core/api';
import { DataTable, type Column } from '../../shared/DataTable';
import { FilterBar } from '../../shared/FilterBar';
import { useUrlFilters } from '../../shared/use-url-filters';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { EmptyState } from '../../shared/EmptyState';
import type { Automation, AutomationCatalog } from './automation-types';

/**
 * Listado de automatizaciones.
 *
 * El interruptor de activación va acá y no dentro del editor a propósito: apagar una
 * automatización que está causando problemas tiene que poder hacerse de un clic, sin abrir su
 * flujo ni arriesgarse a guardar un cambio a medias mientras se busca el botón.
 */
export function AutomationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const filtros = useUrlFilters(['estado']);
  const { data, isLoading, error, refetch } = useQuery<Automation[]>({
    queryKey: ['automations'],
    queryFn: () => api.get('/automations'),
  });

  const { data: catalog } = useQuery<AutomationCatalog>({
    queryKey: ['automations-catalog'],
    queryFn: () => api.get('/automations/catalog'),
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.post(`/automations/${id}/active`, { isActive }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
      setFeedback({ tone: 'success', text: variables.isActive ? 'Automatización activada' : 'Automatización desactivada' });
    },
    onError: (mutationError: Error) => {
      // Al activar, el servidor revalida el flujo completo. Si el catálogo cambió desde que
      // se guardó, el error explica qué falta y hay que mostrarlo tal cual.
      setFeedback({ tone: 'error', text: mutationError.message || 'No se pudo cambiar el estado' });
    },
  });

  const triggerLabel = (key: string) => catalog?.triggers.find((trigger) => trigger.key === key)?.label ?? key;

  const columns: Column<Automation>[] = [
    {
      key: 'name',
      label: 'Nombre',
      sortable: true,
      render: (row) => (
        <button type="button" className="link-button" onClick={() => navigate(`/automations/${row.id}`)}>
          <strong>{row.name}</strong>
          {row.description ? <small>{row.description}</small> : null}
        </button>
      ),
    },
    { key: 'triggerType', label: 'Se dispara con', sortable: true, render: (row) => triggerLabel(row.triggerType) },
    { key: 'version', label: 'Versión', sortable: true, render: (row) => `v${row.version}` },
    {
      key: 'isActive',
      label: 'Estado',
      sortable: true,
      exportValue: (row) => (row.isActive ? 'activa' : 'inactiva'),
      render: (row) => (
        <label className="switch-field">
          <input
            type="checkbox"
            checked={row.isActive}
            disabled={toggle.isPending}
            onChange={() => toggle.mutate({ id: row.id, isActive: !row.isActive })}
          />
          <span>{row.isActive ? 'Activa' : 'Inactiva'}</span>
        </label>
      ),
    },
    {
      key: 'runs',
      label: 'Ejecuciones',
      exportable: false,
      render: (row) => (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate(`/automations/${row.id}/runs`)}>
          Ver historial
        </button>
      ),
    },
  ];

  if (isLoading) return <LoadingSpinner />;
  if (error) return <QueryErrorState message={(error as Error).message} onRetry={() => void refetch()} />;

  const todas = data ?? [];
  const automations = todas.filter((row) => {
    if (filtros.values.estado === 'activas' && !row.isActive) return false;
    if (filtros.values.estado === 'pausadas' && row.isActive) return false;
    const buscado = filtros.search.trim().toLowerCase();
    return !buscado || row.name.toLowerCase().includes(buscado);
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Automatizaciones</span>
          <h1>Flujos automáticos</h1>
          <p className="page-subtitle">
            Cuando ocurre algo en el sistema, se evalúan condiciones y se ejecutan acciones.
            Toda automatización nueva nace desactivada.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/automations/nuevo')}>
          + Nueva automatización
        </button>
      </div>

      {feedback ? <div className={`alert alert-${feedback.tone === 'success' ? 'success' : 'error'}`}>{feedback.text}</div> : null}

      <FilterBar
        search={filtros.search}
        onSearchChange={filtros.setSearch}
        searchPlaceholder="Buscar por nombre..."
        filters={[{
          key: 'estado',
          label: 'Estado',
          allLabel: 'Activas y pausadas',
          options: [{ value: 'activas', label: 'Activas' }, { value: 'pausadas', label: 'Pausadas' }],
        }]}
        values={filtros.values}
        onFilterChange={filtros.setValue}
        onClear={filtros.hasAny ? filtros.clear : undefined}
      />

      {automations.length === 0 ? (
        filtros.hasAny ? (
          <EmptyState
            title="Ninguna automatización calza con este filtro"
            description="Prueba con otro estado o borra la búsqueda para verlas todas."
            action={<button type="button" className="btn btn-outline" onClick={filtros.clear}>Limpiar filtros</button>}
          />
        ) : (
          <EmptyState
            title="Aún no hay automatizaciones"
            description="Crea la primera para que el sistema reaccione solo a los cambios del pipeline."
          />
        )
      ) : (
        <DataTable
          columns={columns}
          data={automations}
          keyExtractor={(row) => row.id}
          storageKey="automations"
          exportFileName="automatizaciones"
        />
      )}
    </div>
  );
}
