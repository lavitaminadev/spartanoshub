/**
 * @fileoverview Listado de encuestas: creación, edición, resultados y borrado.
 *
 * El acceso a la ruta ya filtra por rol (`SURVEY_MANAGE_ROLES` en `feature.manifest.ts`, vía
 * `ProtectedRoute`). Las acciones destructivas se restringen adicionalmente para que el botón
 * visible coincida con lo que acepta el backend.
 */

import { useState, type JSX } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, type Column } from '../../shared/DataTable';
import { StatusBadge } from '../../shared/StatusBadge';
import { EmptyState } from '../../shared/EmptyState';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { PageHero } from '../../shared/PageHero';
import { triggerToast } from '../../shared/toast-events';
import { useDeleteSurvey, useSurveys, useUpdateSurvey } from './useSurveys';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import type { Survey, SurveyType } from '@espartanos/shared';
import './surveys.css';

const TYPE_LABELS: Record<SurveyType, string> = { internal: 'Equipo', customer: 'Clientes' };
const TYPE_FILTERS: Array<{ value: 'all' | SurveyType; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'internal', label: 'Equipo' },
  { value: 'customer', label: 'Clientes' },
];

interface PostVisitaForm { id: string; name: string; mode: string; status: string; publicSlug?: string }
interface SurveyContactRequest { id: string; guestName?: string | null; email?: string | null; phone?: string | null; message?: string | null; rating?: number | null; status: string; createdAt: string }

function isSurveyMode(mode?: string): boolean {
  return mode === 'survey' || mode === 'request';
}

const CONTACT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente de contactar',
  contacted: 'Contactada',
  resolved: 'Resuelta',
};

function nextSurveyStatus(status: Survey['status']): { status: Survey['status']; label: string; toast: string } {
  if (status === 'draft') return { status: 'active', label: 'Publicar', toast: 'Encuesta publicada' };
  if (status === 'active') return { status: 'closed', label: 'Cerrar', toast: 'Encuesta cerrada' };
  return { status: 'active', label: 'Reabrir', toast: 'Encuesta reabierta' };
}

export function SurveysPage(): JSX.Element {
  const { data: surveys = [], isLoading, error, refetch, isFetching } = useSurveys();
  const deleteMutation = useDeleteSurvey();
  const statusMutation = useUpdateSurvey();
  const [confirmDelete, setConfirmDelete] = useState<Survey | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | SurveyType>('all');
  const [section, setSection] = useState<'list' | 'postvisita'>('list');
  const qc = useQueryClient();
  const { user } = useAuth();
  const canPostVisita = Boolean(user && (user.role === 'admin' || user.role === 'dev' || user.role === 'operations_director' || user.role === 'community_manager'));
  const canDeleteSurvey = Boolean(user && (user.role === 'admin' || user.role === 'dev' || user.role === 'operations_director'));

  const { data: formsArray = [], isLoading: formsLoading } = useQuery<PostVisitaForm[]>({
    queryKey: ['reservation-forms-postvisita'],
    queryFn: () => api.get('/reservations/forms'),
    enabled: section === 'postvisita' && canPostVisita,
  });
  const postVisitaForms = formsArray.filter((form) => isSurveyMode(form.mode));

  const { data: contactRequests = [], isLoading: contactsLoading } = useQuery<SurveyContactRequest[]>({
    queryKey: ['survey-contact-requests'],
    queryFn: () => api.get('/reservations/survey-contact-requests'),
    enabled: section === 'postvisita' && canPostVisita,
  });
  const contactMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) => api.put(`/reservations/survey-contact-requests/${id}`, { status, notes }),
    onSuccess: async () => { await Promise.all([qc.invalidateQueries({ queryKey: ['survey-contact-requests'] }), qc.invalidateQueries({ queryKey: ['notifications'] })]); triggerToast('Solicitud de contacto actualizada'); },
    onError: (error: Error) => triggerToast(`No se pudo actualizar: ${error.message}`, 'error'),
  });

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
      render: (survey) => {
        const next = nextSurveyStatus(survey.status);
        return (
          <div className="actions-cell">
            <Link className="btn btn-outline btn-sm" to={`/surveys/create?id=${survey.id}`}>Editar</Link>
            <Link className="btn btn-outline btn-sm" to={`/surveys/${survey.id}/results`}>Ver resultados</Link>
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
        subtitle="Encuestas al equipo, a clientes y post-visita: preguntas, respuestas y seguimiento en un solo lugar."
        actions={<Link className="btn btn-primary" to="/surveys/create">+ Nueva encuesta</Link>}
      />

      <nav className="survey-tabs" aria-label="Secciones de encuestas">
        <button className={section === 'list' ? 'active' : ''} onClick={() => setSection('list')}><span>01</span><strong>Encuestas</strong><small>Equipo y clientes</small></button>
        {canPostVisita && <button className={section === 'postvisita' ? 'active' : ''} onClick={() => setSection('postvisita')}><span>02</span><strong>Post-visita y revisión</strong><small>Encuestas de reserva y seguimiento</small></button>}
      </nav>

      {section === 'postvisita' ? (
        <section className="postvisita-module">
          <div className="section-toolbar"><div><span className="page-eyebrow">ENCUESTAS DE RESERVA</span><h2>Encuestas post-visita</h2><p className="page-subtitle">Se envían por el enlace público de una reserva y se gestionan desde aquí, no desde reservas.</p></div><Link className="btn btn-primary" to="/reservations?create=1&mode=survey">+ Nueva encuesta post-visita</Link></div>
          {formsLoading ? <LoadingSpinner text="Cargando encuestas post-visita..." /> : postVisitaForms.length === 0 ? <EmptyState icon="survey" title="Todavía no hay encuestas post-visita" description="Crea una encuesta de reserva desde este flujo y aparecerá aquí para editarla." /> : <div className="postvisita-grid">{postVisitaForms.map((form) => <article className="postvisita-card" key={form.id}><div><span className="postvisita-mode">POST-VISITA</span><h3>{form.name}</h3><small>{form.status === 'published' ? 'Publicada' : form.status === 'paused' ? 'Pausada' : 'Borrador'}</small></div><Link className="btn btn-outline btn-sm" to={`/reservations/forms/${form.id}`}>Editar</Link></article>)}</div>}

          <div className="section-toolbar postvisita-review-head"><div><span className="page-eyebrow">SEGUIMIENTO</span><h2>Revisión de encuestas</h2><p className="page-subtitle">Cuando alguien califica bajo 4 estrellas se abre una solicitud de contacto y el equipo recibe una notificación.</p></div></div>
          {contactsLoading ? <LoadingSpinner text="Cargando revisiones..." /> : contactRequests.length === 0 ? <EmptyState icon="inbox" title="Sin calificaciones bajas" description="Las encuestas con calificación bajo 4 estrellas aparecerán aquí para contactar a la persona." /> : <div className="postvisita-review-list">{contactRequests.map((row) => <article className={`postvisita-review-card is-${row.status}`} key={row.id}><header><span className="postvisita-rating">{row.rating ?? '–'}<small>/5</small></span><div><strong>{row.guestName || 'Anónimo'}</strong><small>{row.email || row.phone || 'Sin contacto'}</small></div><StatusBadge status={row.status} /></header>{row.message ? <p>{row.message}</p> : <p className="postvisita-no-message">Sin comentario adicional.</p>}<footer><span>{CONTACT_STATUS_LABELS[row.status] ?? row.status} · {new Date(row.createdAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}</span><div className="actions-cell">{row.status === 'pending' && <button className="btn btn-outline btn-sm" disabled={contactMutation.isPending} onClick={() => contactMutation.mutate({ id: row.id, status: 'contacted' })}>Marcar contactada</button>}{(row.status === 'pending' || row.status === 'contacted') && <button className="btn btn-primary btn-sm" disabled={contactMutation.isPending} onClick={() => contactMutation.mutate({ id: row.id, status: 'resolved' })}>Resolver</button>}</div></footer></article>)}</div>}
        </section>
      ) : (
      <>
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

      </>
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
