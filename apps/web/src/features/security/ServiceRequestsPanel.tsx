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
  const [editing, setEditing] = useState<ServiceRequestRow | null>(null);
  const [draft, setDraft] = useState({ type: '', requesterName: '', requesterEmail: '', requesterRut: '', requesterPhone: '', message: '', status: '', resolutionNote: '' });

  const { data: rows = [], isLoading, error, refetch, isFetching } = useQuery<ServiceRequestRow[]>({
    queryKey: ['service-requests', statusFilter],
    queryFn: () => api.get(`/service-requests${statusFilter ? `?status=${statusFilter}` : ''}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => api.put(`/service-requests/${id}`, payload),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['service-requests'] }); setPendingAction(null); setEditing(null); setNote(''); triggerToast('Solicitud actualizada'); },
    onError: (err: Error) => triggerToast(err.message, 'error'),
  });

  const anonymizeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/service-requests/${id}/anonymize`),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['service-requests'] }); triggerToast('Datos anonimizados'); },
    onError: (err: Error) => triggerToast(err.message, 'error'),
  });

  const openEdit = (row: ServiceRequestRow) => {
    setEditing(row);
    setDraft({ type: row.type, requesterName: row.requesterName, requesterEmail: row.requesterEmail, requesterRut: row.requesterRut ?? '', requesterPhone: row.requesterPhone ?? '', message: row.message ?? '', status: row.status, resolutionNote: row.resolutionNote ?? '' });
  };

  const visible = rows.filter((row) => !statusFilter || row.status === statusFilter);

  return (
    <section>
      <div className="section-toolbar">
        <div><span className="page-eyebrow">SOLICITUDES</span><h2>Bandeja de solicitudes</h2><p className="page-subtitle">Llegan desde la página pública (login → "Solicitudes y consulta"). Puedes editar datos, cambiar el estado y reabrir; cada cambio queda auditado.</p></div>
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
              <footer className="solicitud-actions">
                {(row.type === 'anonymization' || row.type === 'removal') && row.status !== 'resolved' && (
                  <button className="btn btn-primary btn-sm" disabled={anonymizeMutation.isPending} onClick={() => anonymizeMutation.mutate(row.id)}>{anonymizeMutation.isPending ? 'Anonimizando...' : 'Anonimizar datos'}</button>
                )}
                {row.status !== 'resolved' && row.status !== 'rejected' && (
                  <>
                    <button className="btn btn-primary btn-sm" disabled={updateMutation.isPending} onClick={() => setPendingAction({ id: row.id, status: 'resolved', label: row.type === 'account' ? 'Aprobar' : row.type === 'support' ? 'Resolver' : 'Aprobar' })}>{row.type === 'account' ? 'Aprobar' : row.type === 'support' ? 'Resolver' : 'Aprobar'}</button>
                    <button className="btn btn-outline btn-sm" disabled={updateMutation.isPending} onClick={() => setPendingAction({ id: row.id, status: 'more_info', label: 'Solicitar más información' })}>Más información</button>
                    <button className="btn btn-outline btn-danger btn-sm" disabled={updateMutation.isPending} onClick={() => setPendingAction({ id: row.id, status: 'rejected', label: 'Rechazar' })}>Rechazar</button>
                  </>
                )}
                {(row.status === 'resolved' || row.status === 'rejected') && (
                  <button className="btn btn-outline btn-sm" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: row.id, payload: { status: 'received' } })}>Reabrir</button>
                )}
                <button className="btn btn-outline btn-sm" onClick={() => openEdit(row)}>Editar</button>
              </footer>
              {row.type === 'account' && row.status === 'resolved' && <small className="page-subtitle">Crea la cuenta desde Usuarios con el correo del solicitante para completar el acceso.</small>}
            </article>
          ))}
        </div>}

      <Modal open={Boolean(pendingAction)} onClose={() => { setPendingAction(null); setNote(''); }} title={pendingAction?.label ?? 'Acción'}>
        <form className="modal-form" onSubmit={(event) => { event.preventDefault(); if (pendingAction) updateMutation.mutate({ id: pendingAction.id, payload: { status: pendingAction.status, resolutionNote: note.trim() || undefined } }); }}>
          <label>Nota de resolución<textarea className="input" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder={pendingAction?.status === 'more_info' ? 'Indica qué información falta…' : 'Registra qué se hizo para dejar constancia…'} /></label>
          {pendingAction?.status === 'rejected' && <div className="alert alert-error">Rechazará la solicitud. La persona verá el motivo en su consulta de estado.</div>}
          <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setPendingAction(null)}>Cancelar</button><button className="btn btn-primary" type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Guardando...' : 'Confirmar'}</button></div>
        </form>
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => { setEditing(null); setNote(''); }} title="Editar solicitud">
        <form className="modal-form" onSubmit={(event) => { event.preventDefault(); if (!editing) return; updateMutation.mutate({ id: editing.id, payload: { type: draft.type, requesterName: draft.requesterName, requesterEmail: draft.requesterEmail, requesterRut: draft.requesterRut || undefined, requesterPhone: draft.requesterPhone || undefined, message: draft.message || undefined, status: draft.status, resolutionNote: draft.resolutionNote || undefined } }); }}>
          <label>Tipo de solicitud<select className="input" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Nombre del solicitante<input className="input" value={draft.requesterName} onChange={(event) => setDraft({ ...draft, requesterName: event.target.value })} /></label>
          <div className="form-row">
            <label>Correo<input className="input" type="email" value={draft.requesterEmail} onChange={(event) => setDraft({ ...draft, requesterEmail: event.target.value })} /></label>
            <label>RUT<input className="input" value={draft.requesterRut} onChange={(event) => setDraft({ ...draft, requesterRut: event.target.value })} /></label>
          </div>
          <label>Teléfono<input className="input" value={draft.requesterPhone} onChange={(event) => setDraft({ ...draft, requesterPhone: event.target.value })} /></label>
          <label>Mensaje<textarea className="input" rows={3} value={draft.message} onChange={(event) => setDraft({ ...draft, message: event.target.value })} /></label>
          <label>Estado<select className="input" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Nota de resolución<textarea className="input" rows={3} value={draft.resolutionNote} onChange={(event) => setDraft({ ...draft, resolutionNote: event.target.value })} /></label>
          <div className="alert alert-info">Cada cambio queda registrado en la bitácora de auditoría con el responsable, la fecha y el antes/después.</div>
          <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>Cancelar</button><button className="btn btn-primary" type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}</button></div>
        </form>
      </Modal>
    </section>
  );
}
