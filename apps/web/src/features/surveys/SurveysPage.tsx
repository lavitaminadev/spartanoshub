/**
 * @fileoverview Listado de encuestas: creación, edición, resultados y borrado.
 *
 * El acceso a la ruta ya filtra por rol (`SURVEY_MANAGE_ROLES` en `feature.manifest.ts`, vía
 * `ProtectedRoute`). Las acciones destructivas se restringen adicionalmente para que el botón
 * visible coincida con lo que acepta el backend.
 */

import { useState, type JSX } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { useEmpresaActiva } from '../../shared/empresa-activa';
import { CompartirEncuesta } from './CompartirEncuesta';
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
import { FilterBar } from '../../shared/FilterBar';
import { useUrlFilters } from '../../shared/use-url-filters';
import { useAuth } from '../../core/auth';
import type { Survey, SurveyType } from '@espartanos/shared';
import './surveys.css';
import { puedeAccion } from '../../core/acciones';

const TYPE_LABELS: Record<SurveyType, string> = { internal: 'Equipo', customer: 'Clientes' };
const TYPE_FILTERS: Array<{ value: 'all' | SurveyType; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'internal', label: 'Equipo' },
  { value: 'customer', label: 'Clientes' },
];

/** Claves que esta pantalla filtra. Limpiar suelta solo estas y no parámetros ajenos. */
const FILTER_KEYS = ['tipo', 'estado', 'empresa'] as const;

const STATUS_FILTER_OPTIONS = [
  { value: 'draft', label: 'Borrador' },
  { value: 'active', label: 'Publicada' },
  { value: 'closed', label: 'Cerrada' },
];

function nextSurveyStatus(status: Survey['status']): { status: Survey['status']; label: string; toast: string } {
  if (status === 'draft') return { status: 'active', label: 'Publicar', toast: 'Encuesta publicada' };
  if (status === 'active') return { status: 'closed', label: 'Cerrar', toast: 'Encuesta cerrada' };
  return { status: 'active', label: 'Reabrir', toast: 'Encuesta reabierta' };
}


/**
 * @param soloLectura - Portal de la empresa: lista y resultados, sin crear, editar, publicar,
 *   enviar ni eliminar. El servidor igualmente rechaza esas acciones para el cargo cliente.
 */
export function SurveysPage({ soloLectura = false }: { soloLectura?: boolean } = {}): JSX.Element {
  const { data: surveys = [], isLoading, error, refetch, isFetching } = useSurveys();
  const deleteMutation = useDeleteSurvey();
  const statusMutation = useUpdateSurvey();
  const [confirmDelete, setConfirmDelete] = useState<Survey | null>(null);
  const [compartir, setCompartir] = useState<Survey | null>(null);
  const [confirmarCierre, setConfirmarCierre] = useState<Survey | null>(null);
  const [correoDe, setCorreoDe] = useState<Survey | null>(null);
  const enviarCorreo = useMutation({
    mutationFn: (survey: Survey) => api.post<{ enviados: number; fallidos: number; invalidos: number }>(`/surveys/${encodeURIComponent(survey.id)}/send-email`, {}),
    onSuccess: (resultado) => {
      setCorreoDe(null);
      triggerToast(`Enviada a ${resultado.enviados} persona${resultado.enviados === 1 ? '' : 's'}${resultado.fallidos ? ` · ${resultado.fallidos} ${resultado.fallidos === 1 ? 'no salió' : 'no salieron'}` : ''}${resultado.invalidos ? ` · ${resultado.invalidos} ${resultado.invalidos === 1 ? 'correo inválido omitido' : 'correos inválidos omitidos'}` : ''}`);
    },
  });
  // Los filtros viven en la dirección: volver desde una encuesta conserva lo filtrado, recargar
  // no borra el trabajo y la vista se puede mandar por mensaje.
  const filtros = useUrlFilters(FILTER_KEYS);
  const typeFilter = (filtros.values.tipo || 'all') as 'all' | SurveyType;
  const { user } = useAuth();
  // Empresas visibles para esta persona: el servidor ya recorta la lista a las suyas.
  const empresaActiva = useEmpresaActiva();
  const { data: clientsResponse } = useQuery<{ data?: Array<{ id: string; name: string; capabilities?: { surveys?: boolean } }> }>({
    queryKey: ['clients'], queryFn: () => api.get('/clients'),
  });
  const empresas = clientsResponse?.data ?? [];
  const empresaPorId = new Map(empresas.map((empresa) => [empresa.id, empresa]));
  const canDeleteSurvey = Boolean(user && (user.role === 'admin' || user.role === 'dev' || user.role === 'operations_director')) && puedeAccion(user, 'surveys.borrar');
  const puedeEnviar = puedeAccion(user, 'surveys.enviar');

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

  const visible = surveys.filter((survey) => {
    /*
     * La empresa sobre la que se trabaja manda también acá.
     *
     * Esta pantalla mostraba todas las encuestas que la sesión alcanzaba, así que quien atiende
     * dos locales veía las del otro bajo el nombre del que tenía elegido: es el caso que hace
     * enviar una encuesta a los clientes equivocados.
     */
    if (empresaActiva.clientId && survey.clientId && survey.clientId !== empresaActiva.clientId) return false;
    if (typeFilter !== 'all' && survey.type !== typeFilter) return false;
    if (filtros.values.estado && survey.status !== filtros.values.estado) return false;
    if (filtros.values.empresa === 'equipo' && survey.clientId) return false;
    if (filtros.values.empresa && filtros.values.empresa !== 'equipo' && survey.clientId !== filtros.values.empresa) return false;
    const buscado = filtros.search.trim().toLowerCase();
    return !buscado || survey.title.toLowerCase().includes(buscado);
  });

  const cambiarEstado = (survey: Survey) => {
    const next = nextSurveyStatus(survey.status);
    statusMutation.mutate(
      { id: survey.id, patch: { status: next.status } },
      { onSuccess: () => { triggerToast(next.toast); setConfirmarCierre(null); }, onError: (error) => triggerToast(`No se pudo cambiar estado: ${error.message}`, 'error') },
    );
  };

  const columns: Column<Survey>[] = [
    {
      key: 'title',
      label: 'Nombre',
      sortable: true,
      render: (survey) => <span className="survey-nombre"><strong>{survey.title}</strong><small>{TYPE_LABELS[survey.type]}{survey.createdAt ? ` · ${new Date(survey.createdAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</small></span>,
      exportValue: (survey) => `${survey.title} (${TYPE_LABELS[survey.type]}${survey.createdAt ? `, ${new Date(survey.createdAt).toLocaleDateString('es-CL')}` : ''})`,
    },
    {
      key: 'clientId',
      label: 'Empresa',
      sortable: true,
      sortValue: (survey) => (survey.clientId ? empresaPorId.get(survey.clientId)?.name ?? '' : ''),
      render: (survey) => {
        if (!survey.clientId) return <span className="survey-empresa is-equipo">Equipo interno</span>;
        const empresa = empresaPorId.get(survey.clientId);
        return <span className="survey-empresa">{empresa?.name ?? 'Empresa no disponible'}{empresa?.capabilities?.surveys === false && <small className="survey-empresa-apagada">Encuestas desactivado</small>}</span>;
      },
      exportValue: (survey) => (survey.clientId ? empresaPorId.get(survey.clientId)?.name ?? '' : 'Equipo interno'),
    },
    {
      key: 'status',
      label: 'Estado',
      render: (survey) => <StatusBadge status={survey.status} />,
      exportValue: (survey) => survey.status,
    },
    { key: 'responses', label: 'Respuestas', sortable: true },
    {
      key: 'actions',
      label: 'Acciones',
      exportable: false,
      render: (survey) => {
        const next = nextSurveyStatus(survey.status);
        return (
          <div className="survey-acciones">
            <div className="survey-acciones-principales">
              {/* Publicada se puede compartir; en borrador el enlace todavía no responde, y se ofrece publicar. */}
              {survey.status === 'active' && <button type="button" className="btn btn-primary btn-sm" onClick={() => setCompartir(survey)}>Compartir</button>}
              {!soloLectura && survey.status !== 'active' && (
                <button type="button" className="btn btn-primary btn-sm" disabled={statusMutation.isPending} onClick={() => cambiarEstado(survey)}>{next.label}</button>
              )}
              <Link className="btn btn-outline btn-sm" to={soloLectura ? `/portal/surveys/${survey.id}/results` : `/surveys/${survey.id}/results`}>Resultados</Link>
              {soloLectura && survey.status === 'active' && <a className="btn btn-outline btn-sm" href={survey.publicUrl || `/survey/${survey.id}`} target="_blank" rel="noopener noreferrer">Abrir ↗</a>}
            </div>
            {!soloLectura && (
              <div className="survey-acciones-secundarias">
                <Link to={`/surveys/create?id=${survey.id}`}>Editar</Link>
                <Link to={`/surveys/create?duplicar=${survey.id}`} title="Crear una copia como borrador">Duplicar</Link>
                {survey.status === 'active' && <button type="button" disabled={statusMutation.isPending} onClick={() => setConfirmarCierre(survey)}>Cerrar</button>}
                {canDeleteSurvey && <button type="button" className="peligro" onClick={() => setConfirmDelete(survey)}>Eliminar</button>}
              </div>
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
        actions={soloLectura ? undefined : <Link className="btn btn-primary" to="/surveys/create">+ Nueva encuesta</Link>}
      />

      <div className="survey-type-switch" role="group" aria-label="Filtrar por tipo de encuesta">
        {TYPE_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={typeFilter === filter.value ? 'active' : ''}
            aria-pressed={typeFilter === filter.value}
            onClick={() => filtros.setValue('tipo', filter.value === 'all' ? '' : filter.value)}
          >
            <strong>{filter.value === 'all' ? surveys.length : surveys.filter((survey) => survey.type === filter.value).length}</strong>
            <span>{filter.label}</span>
          </button>
        ))}
      </div>

      <FilterBar
        search={filtros.search}
        onSearchChange={filtros.setSearch}
        searchPlaceholder="Buscar por título..."
        filters={[
          ...(soloLectura ? [] : [{ key: 'empresa', label: 'Empresa', options: [{ value: 'equipo', label: 'Equipo interno' }, ...empresas.map((empresa) => ({ value: empresa.id, label: empresa.name }))], allLabel: 'Todas las empresas' }]),
          { key: 'estado', label: 'Estado', options: STATUS_FILTER_OPTIONS, allLabel: 'Todos los estados' },
        ]}
        values={filtros.values}
        onFilterChange={filtros.setValue}
        onClear={filtros.hasAny ? filtros.clear : undefined}
      />

      {/* Sin filtro no hay ninguna; con filtro las hay pero ninguna calza. Son dos situaciones
          distintas y con la misma pantalla vacía parecen la misma: que el módulo no funciona. */}
      {visible.length === 0 ? (
        filtros.hasAny || typeFilter !== 'all' ? (
          <EmptyState
            icon="survey"
            title="Ninguna encuesta calza con este filtro"
            description="Prueba con otro estado o borra la búsqueda para ver todas."
            action={<button type="button" className="btn btn-outline" onClick={filtros.clear}>Limpiar filtros</button>}
          />
        ) : (
          <EmptyState
            icon="survey"
            title="Todavía no hay encuestas"
            description={soloLectura ? 'Cuando el equipo publique una encuesta para tu empresa, sus resultados aparecerán aquí.' : 'Crea la primera encuesta para el equipo o para tus clientes.'}
            action={soloLectura ? undefined : <Link className="btn btn-primary" to="/surveys/create">Crear encuesta</Link>}
          />
        )
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

      {/* Se confirma antes de enviar: sale un correo por persona y no se puede deshacer. */}
      <ConfirmDialog
        open={Boolean(correoDe)}
        title="Enviar la encuesta por correo"
        description={`Se enviará «${correoDe?.title ?? ''}» a ${correoDe?.recipients?.length ?? 0} destinatario${correoDe?.recipients?.length === 1 ? '' : 's'}, un correo a cada uno. Envíala solo a personas que aceptaron recibir comunicaciones de la empresa.`}
        confirmLabel="Enviar"
        pending={enviarCorreo.isPending}
        error={enviarCorreo.error?.message}
        onClose={() => setCorreoDe(null)}
        onConfirm={() => { if (correoDe) enviarCorreo.mutate(correoDe); }}
      />

      <ConfirmDialog
        open={Boolean(confirmarCierre)}
        title="Cerrar encuesta"
        description={`«${confirmarCierre?.title ?? ''}» dejará de recibir respuestas. Los enlaces y QR ya compartidos mostrarán que no está disponible. Puedes reabrirla cuando quieras.`}
        confirmLabel="Cerrar encuesta"
        pending={statusMutation.isPending}
        error={statusMutation.error?.message}
        onClose={() => setConfirmarCierre(null)}
        onConfirm={() => { if (confirmarCierre) cambiarEstado(confirmarCierre); }}
      />

      <CompartirEncuesta survey={compartir} onCerrar={() => setCompartir(null)} puedeEnviarCorreo={puedeEnviar} onEnviarCorreo={(survey) => { setCompartir(null); enviarCorreo.reset(); setCorreoDe(survey); }} />
    </div>
  );
}
