/**
 * @fileoverview Listado de encuestas: creación, edición, resultados y borrado.
 *
 * El acceso a la ruta ya filtra por rol (`SURVEY_MANAGE_ROLES` en `feature.manifest.ts`, vía
 * `ProtectedRoute`). Las acciones destructivas se restringen adicionalmente para que el botón
 * visible coincida con lo que acepta el backend.
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
import { useDeleteSurvey, useSurveys, useUpdateSurvey } from './useSurveys';
import { publicSurveyUrl } from '../../core/public-url';
import { useAuth } from '../../core/auth';
import type { Survey, SurveyType } from '@espartanos/shared';
import './surveys.css';

const TYPE_LABELS: Record<SurveyType, string> = { internal: 'Equipo', customer: 'Clientes' };
const TYPE_FILTERS: Array<{ value: 'all' | SurveyType; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'internal', label: 'Equipo' },
  { value: 'customer', label: 'Clientes' },
];

function nextSurveyStatus(status: Survey['status']): { status: Survey['status']; label: string; toast: string } {
  if (status === 'draft') return { status: 'active', label: 'Publicar', toast: 'Encuesta publicada' };
  if (status === 'active') return { status: 'closed', label: 'Cerrar', toast: 'Encuesta cerrada' };
  return { status: 'active', label: 'Reabrir', toast: 'Encuesta reabierta' };
}

function qrUrl(url: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(url)}`;
}

export function SurveysPage(): JSX.Element {
  const { data: surveys = [], isLoading, error, refetch, isFetching } = useSurveys();
  const deleteMutation = useDeleteSurvey();
  const statusMutation = useUpdateSurvey();
  const [confirmDelete, setConfirmDelete] = useState<Survey | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | SurveyType>('all');
  const { user } = useAuth();
  const canDeleteSurvey = Boolean(user && (user.role === 'admin' || user.role === 'dev' || user.role === 'operations_director'));

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
  const channelUrl = (survey: Survey, source: string) => publicSurveyUrl(survey.id, survey.publicUrl, source);
  const copyPublicSurveyLink = async (survey: Survey, source = 'link') => {
    await navigator.clipboard.writeText(channelUrl(survey, source));
    triggerToast('Enlace de encuesta copiado');
  };

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
      render: (survey) => {
        const next = nextSurveyStatus(survey.status);
        return (
          <div className="actions-cell">
            <Link className="btn btn-outline btn-sm" to={`/surveys/create?id=${survey.id}`}>Editar</Link>
            <Link className="btn btn-outline btn-sm" to={`/surveys/${survey.id}/results`}>Ver resultados</Link>
            {survey.status === 'active' && survey.distribution?.includes('link') && <button type="button" className="btn btn-outline btn-sm" onClick={() => copyPublicSurveyLink(survey)}>Copiar link</button>}
            {survey.status === 'active' && survey.distribution?.includes('email') && <a className="btn btn-outline btn-sm" href={`mailto:?subject=${encodeURIComponent(survey.title)}&body=${encodeURIComponent(channelUrl(survey, 'email'))}`}>Email</a>}
            {survey.status === 'active' && survey.distribution?.includes('qr') && <a className="btn btn-outline btn-sm" href={qrUrl(channelUrl(survey, 'qr'))} target="_blank" rel="noreferrer">QR</a>}
            <button
              type="button"
              className={survey.status === 'active' ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm'}
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate(
                { id: survey.id, patch: { status: next.status } },
                { onSuccess: () => triggerToast(next.toast), onError: (error) => triggerToast(`No se pudo cambiar estado: ${error.message}`, 'error') },
              )}
            >
              {next.label}
            </button>
            {canDeleteSurvey && (
              <button
                type="button"
                className="btn btn-outline btn-danger btn-sm"
                onClick={() => setConfirmDelete(survey)}
              >
                Eliminar
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="page survey-module">
      <PageHero
        eyebrow="MEDICIÓN"
        title="Encuestas"
        subtitle="Encuestas al equipo y clientes: preguntas, publicación, respuestas y seguimiento."
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
          icon="survey"
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
