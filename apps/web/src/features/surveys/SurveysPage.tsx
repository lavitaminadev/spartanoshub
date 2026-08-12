/**
 * @fileoverview Listado de encuestas: creación, edición, resultados y borrado.
 *
 * El acceso a la ruta ya filtra por rol (`SURVEY_MANAGE_ROLES` en `feature.manifest.ts`, vía
 * `ProtectedRoute`), así que esta vista no repite esa validación: cualquiera que la ve, puede
 * gestionar encuestas.
 */

import { useState, type JSX } from 'react';
import { Link } from 'react-router-dom';
import { DataTable, type Column } from '../../shared/DataTable';
import { StatusBadge } from '../../shared/StatusBadge';
import { EmptyState } from '../../shared/EmptyState';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { PageHero } from '../../shared/PageHero';
import { triggerToast } from '../../shared/toast-events';
import { useDeleteSurvey, useSurveys } from './useSurveys';
import type { Survey, SurveyType } from './types';
import './surveys.css';

const TYPE_LABELS: Record<SurveyType, string> = { internal: 'Equipo', customer: 'Clientes' };
const TYPE_FILTERS: Array<{ value: 'all' | SurveyType; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'internal', label: 'Equipo' },
  { value: 'customer', label: 'Clientes' },
];

export function SurveysPage(): JSX.Element {
  const { data: surveys = [], isLoading, error, refetch, isFetching } = useSurveys();
  const deleteMutation = useDeleteSurvey();
  const [confirmDelete, setConfirmDelete] = useState<Survey | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | SurveyType>('all');

  if (isLoading) return <LoadingSpinner text="Cargando encuestas..." />;
  if (error) {
    return (
      <QueryErrorState
        title="No pudimos cargar las encuestas"
        message={error.message}
        onRetry={() => void refetch()}
        retrying={isFetching}
      />
    );
  }

  const visible = surveys.filter((survey) => typeFilter === 'all' || survey.type === typeFilter);

  const columns: Column<Survey>[] = [
    { key: 'title', label: 'Nombre', sortable: true },
    {
      key: 'type',
      label: 'Tipo',
      render: (survey) => TYPE_LABELS[survey.type],
      exportValue: (survey) => TYPE_LABELS[survey.type],
    },
    {
      key: 'status',
      label: 'Estado',
      render: (survey) => <StatusBadge status={survey.status} />,
      exportValue: (survey) => survey.status,
    },
    { key: 'responses', label: 'Respuestas', sortable: true },
    {
      key: 'createdAt',
      label: 'Fecha',
      sortable: true,
      sortValue: (survey) => survey.createdAt,
      render: (survey) => survey.createdAt ? new Date(survey.createdAt).toLocaleDateString('es-CL') : 'Sin fecha',
      exportValue: (survey) => survey.createdAt ? new Date(survey.createdAt).toLocaleDateString('es-CL') : '',
    },
    {
      key: 'actions',
      label: 'Acciones',
      exportable: false,
      render: (survey) => (
        <div className="actions-cell">
          <Link className="btn btn-outline btn-sm" to={`/surveys/create?id=${survey.id}`}>Editar</Link>
          <Link className="btn btn-outline btn-sm" to={`/surveys/${survey.id}/results`}>Ver resultados</Link>
          <button
            type="button"
            className="btn btn-outline btn-danger btn-sm"
            onClick={() => setConfirmDelete(survey)}
          >
            Eliminar
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page survey-module">
      <PageHero
        eyebrow="MEDICIÓN"
        title="Encuestas"
        subtitle="Encuestas al equipo y a clientes: preguntas, distribución y resultados en un solo lugar."
        actions={<Link className="btn btn-primary" to="/surveys/create">+ Nueva encuesta</Link>}
      />

      <div className="survey-type-switch" role="group" aria-label="Filtrar por tipo de encuesta">
        {TYPE_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={typeFilter === filter.value ? 'active' : ''}
            aria-pressed={typeFilter === filter.value}
            onClick={() => setTypeFilter(filter.value)}
          >
            <strong>{filter.value === 'all' ? surveys.length : surveys.filter((survey) => survey.type === filter.value).length}</strong>
            <span>{filter.label}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon="📋"
          title="Todavía no hay encuestas"
          description="Crea la primera encuesta para el equipo o para tus clientes."
          action={<Link className="btn btn-primary" to="/surveys/create">Crear encuesta</Link>}
        />
      ) : (
        <div className="survey-list">
          <DataTable
            columns={columns}
            data={visible}
            keyExtractor={(survey) => survey.id}
            storageKey="surveys"
            exportFileName="encuestas"
          />
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Eliminar encuesta"
        description={`¿Eliminar "${confirmDelete?.title ?? ''}"? Las respuestas ya recibidas se perderán junto con la encuesta.`}
        confirmLabel="Eliminar"
        pending={deleteMutation.isPending}
        error={deleteMutation.error?.message}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return;
          const title = confirmDelete.title;
          deleteMutation.mutate(confirmDelete.id, {
            onSuccess: () => { triggerToast(`Encuesta "${title}" eliminada`); setConfirmDelete(null); },
          });
        }}
      />
    </div>
  );
}
