import { useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { EmptyState } from '../../shared/EmptyState';
import { Modal } from '../../shared/Modal';
import { triggerToast } from '../../shared/toast-events';

interface ServiceRequestRow {
  id: string;
  type: string;
  status: string;
  requesterName: string;
  requesterEmail: string;
  requesterRut?: string | null;
  requesterPhone?: string | null;
  message?: string | null;
  resolutionNote?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  account: 'Crear cuenta o acceso',
  company: 'Alta de empresa o cliente',
  rectification: 'Rectificación de datos',
  anonymization: 'Anonimización / supresión',
  portability: 'Portabilidad / exportación',
  removal: 'Baja o desvinculación',
  support: 'Soporte o incidencia',
};

const STATUS_LABELS: Record<string, string> = {
  received: 'Recibida',
  in_review: 'En revisión',
  resolved: 'Resuelta',
  rejected: 'Rechazada',
  more_info: 'Requiere más info',
};

export function ServiceRequestsPanel(): JSX.Element {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [pendingAction, setPendingAction] = useState<{ id: string; status: string; label: string } | null>(null);
  const [note, setNote] = useState('');

  const { data: rows = [], isLoading, error, refetch, isFetching } = useQuery<ServiceRequestRow[]>({
    queryKey: ['service-requests', statusFilter],
    queryFn: () => api.get(`/service-requests${statusFilter ? `?status=${statusFilter}` : ''}`),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, status, resolutionNote }: { id: string; status: string; resolutionNote?: string }) =>
      api.put(`/service-requests/${id}`, { status, resolutionNote }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['service-requests'] }); setPendingAction(null); setNote(''); triggerToast('Solicitud actualizada'); },
    onError: (err: Error) => triggerToast(err.message, 'error'),
  });

  const anonymizeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/service-requests/${id}/anonymize`),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['service-requests'] }); triggerToast('Datos anonimizados'); },
    onError: (err: Error) => triggerToast(err.message, 'error'),
  });

  const visible = rows.filter((row) => !statusFilter || row.status === statusFilter);

  return (
    <section>
      <div className="section-toolbar">
        <div><span className="page-eyebrow">SOLICITUDES</span><h2>Bandeja de solicitudes</h2><p className="page-subtitle">Llegan desde la página pública (login → "Solicitudes"). Cada resolución queda auditada.</p></div>
        <button className="btn btn-outline" onClick={() => refetch()} disabled={isFetching}>{isFetching ? 'Actualizando...' : 'Actualizar'}</button>
      </div>
      <div className="reservation-flow-switch admin-solicitudes-filters" role="group" aria-label="Filtrar por estado">
        {['', 'received', 'in_review', 'more_info', 'resolved', 'rejected'].map((status) => (
          <button key={status || 'all'} className={statusFilter === status ? 'active' : ''} onClick={() => setStatusFilter(status)}>
            <strong>{status === '' ? rows.length : rows.filter((r) => r.status === status).length}</strong>
            <span>{status === '' ? 'Todas' : STATUS_LABELS[status]}</span>
          </button>
        ))}
      </div>

      {isLoading ? <LoadingSpinner text="Cargando solicitudes..." /> :
        error ? <QueryErrorState title="No pudimos cargar las solicitudes" message={error.message} onRetry={() => refetch()} retrying={isFetching} /> :
        visible.length === 0 ? <EmptyState icon="inbox" title="Sin solicitudes" description="Las solicitudes enviadas desde la página pública aparecerán aquí." /> :
        <div className="admin-solicitudes">
          {visible.map((row) => (
            <article className="admin-solicitud-card" key={row.id}>
              <header>
                <span className={`solicitud-status is-${row.status}`}>{STATUS_LABELS[row.status] ?? row.status}</span>
                <strong>{TYPE_LABELS[row.type] ?? row.type}</strong>
                <small>{new Date(row.createdAt).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}</small>
              </header>
              <div className="admin-solicitud-facts">
                <span><small>Solicitante</small><strong>{row.requesterName}</strong></span>
                <span><small>Correo</small><strong>{row.requesterEmail}</strong></span>
                <span><small>RUT</small><strong>{row.requesterRut || '—'}</strong></span>
                <span><small>Teléfono</small><strong>{row.requesterPhone || '—'}</strong></span>
              </div>
              {row.message ? <p>{row.message}</p> : null}
              {row.resolutionNote ? <div className="solicitud-resolution"><strong>Resolución</strong><p>{row.resolutionNote}</p>{row.resolvedAt ? <small>{new Date(row.resolvedAt).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}</small> : null}</div> : null}
              {row.status !== 'resolved' && row.status !== 'rejected' && (
                <footer className="solicitud-actions">
                  {(row.type === 'anonymization' || row.type === 'removal') && (
                    <button className="btn btn-primary btn-sm" disabled={anonymizeMutation.isPending} onClick={() => anonymizeMutation.mutate(row.id)}>{anonymizeMutation.isPending ? 'Anonimizando...' : 'Anonimizar datos'}</button>
                  )}
                  <button className="btn btn-primary btn-sm" disabled={resolveMutation.isPending} onClick={() => setPendingAction({ id: row.id, status: 'resolved', label: row.type === 'account' ? 'Aprobar y crear cuenta' : row.type === 'support' ? 'Resolver' : 'Aprobar' })}>{row.type === 'account' ? 'Aprobar' : row.type === 'support' ? 'Resolver' : 'Aprobar'}</button>
                  <button className="btn btn-outline btn-sm" disabled={resolveMutation.isPending} onClick={() => setPendingAction({ id: row.id, status: 'more_info', label: 'Solicitar más información' })}>Más información</button>
                  <button className="btn btn-outline btn-danger btn-sm" disabled={resolveMutation.isPending} onClick={() => setPendingAction({ id: row.id, status: 'rejected', label: 'Rechazar' })}>Rechazar</button>
                </footer>
              )}
              {row.type === 'account' && row.status === 'resolved' && <footer className="solicitud-actions"><small className="page-subtitle">Crea la cuenta desde Usuarios con el correo del solicitante para completar el acceso.</small></footer>}
            </article>
          ))}
        </div>}

      <Modal open={Boolean(pendingAction)} onClose={() => { setPendingAction(null); setNote(''); }} title={pendingAction?.label ?? 'Acción'}>
        <form className="modal-form" onSubmit={(event) => { event.preventDefault(); if (pendingAction) resolveMutation.mutate({ id: pendingAction.id, status: pendingAction.status, resolutionNote: note.trim() || undefined }); }}>
          <label>Nota de resolución<textarea className="input" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder={pendingAction?.status === 'more_info' ? 'Indica qué información falta…' : 'Registra qué se hizo para dejar constancia…'} /></label>
          {pendingAction?.status === 'rejected' && <div className="alert alert-error">Rechazará la solicitud. La persona verá el motivo en su consulta de estado.</div>}
          <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setPendingAction(null)}>Cancelar</button><button className="btn btn-primary" type="submit" disabled={resolveMutation.isPending}>{resolveMutation.isPending ? 'Guardando...' : 'Confirmar'}</button></div>
        </form>
      </Modal>
    </section>
  );
}
