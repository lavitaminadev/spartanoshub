import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { EmptyState } from '../../shared/EmptyState';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { Modal } from '../../shared/Modal';
import type { Reservation, ReservationForm } from './types';
import { localDateBoundsUtc, plainDateInZone } from './local-time';
import './ReservationOperationsPage.css';

interface Client { id: string; name: string }
interface ReservationPage { data: Reservation[]; total: number }
const EMPTY_RESERVATIONS: Reservation[] = [];

/**
 * Entrada operativa de Fase 1. Una reserva se configura y opera por local; el formulario
 * público es una salida del local, no la unidad de trabajo que se le muestra al restaurante.
 * Durante la transición el API conserva `reservation_forms` como almacenamiento compatible.
 */
export function ReservationOperationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState('');
  const [localId, setLocalId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [localName, setLocalName] = useState('');

  const { data: clientsResponse, isLoading: loadingClients } = useQuery<{ data: Client[] }>({
    queryKey: ['clients'], queryFn: () => api.get('/clients'),
  });
  const clients = clientsResponse?.data ?? [];
  const effectiveClientId = clientId || clients[0]?.id || '';

  const { data: locals = [], isLoading: loadingLocals, error: localsError, refetch } = useQuery<ReservationForm[]>({
    queryKey: ['reservation-locals', effectiveClientId],
    queryFn: () => api.get(`/reservations/forms?clientId=${encodeURIComponent(effectiveClientId)}`),
    enabled: Boolean(effectiveClientId),
  });
  const selectedLocal = locals.find((local) => local.id === localId) ?? locals[0];
  const effectiveLocalId = localId || selectedLocal?.id || '';

  // El resumen decía "hoy" pero antes consultaba todo el historial del local. Se calcula el día
  // civil con la zona del propio local para no cruzar cenas con el día siguiente en UTC.
  const today = plainDateInZone(new Date(), selectedLocal?.timezone || 'America/Santiago');
  const todayRange = selectedLocal ? localDateBoundsUtc(today, selectedLocal.timezone) : { from: '', to: '' };
  const { data: reservationsResponse, isLoading: loadingReservations } = useQuery<ReservationPage>({
    queryKey: ['reservation-local-day', effectiveClientId, effectiveLocalId, today, todayRange.from],
    queryFn: () => api.get(`/reservations?${new URLSearchParams({ clientId: effectiveClientId, formId: effectiveLocalId, from: todayRange.from, to: todayRange.to, pageSize: '100' })}`),
    enabled: Boolean(effectiveClientId && effectiveLocalId),
  });
  const reservations = reservationsResponse?.data ?? EMPTY_RESERVATIONS;
  const summary = useMemo(() => ({
    total: reservations.length,
    pending: reservations.filter((item) => ['pending', 'confirmed', 'rescheduled'].includes(item.status)).length,
    attended: reservations.filter((item) => item.status === 'attended').length,
    noShow: reservations.filter((item) => item.status === 'no_show').length,
  }), [reservations]);

  const createLocal = useMutation({
    mutationFn: () => api.post<ReservationForm>('/reservations/forms', { clientId: effectiveClientId, name: localName.trim(), mode: 'appointment' }),
    onSuccess: (local) => {
      queryClient.invalidateQueries({ queryKey: ['reservation-locals', effectiveClientId] });
      setCreateOpen(false); setLocalName(''); navigate(`/reservations/locals/${local.id}`);
    },
  });

  if (loadingClients) return <LoadingSpinner text="Preparando Reservas..." />;

  return <div className="page reservation-operations-page">
    <header className="reservation-operations-hero">
      <div>
        <span className="page-eyebrow">RESERVAS · FASE 1</span>
        <h1>Operación del local</h1>
        <p className="page-subtitle">Configura el canal de reservas y opera el turno sin planillas.</p>
      </div>
      <button className="btn btn-primary" type="button" onClick={() => setCreateOpen(true)}>Agregar local</button>
    </header>

    <section className="reservation-local-picker" aria-label="Local en operación">
      <label>Cuenta
        <select className="input" value={effectiveClientId} onChange={(event) => { setClientId(event.target.value); setLocalId(''); }}>
          {clients.length === 0 ? <option value="">Sin cuentas disponibles</option> : clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
      </label>
      <label>Local
        <select className="input" value={effectiveLocalId} disabled={loadingLocals || locals.length === 0} onChange={(event) => setLocalId(event.target.value)}>
          {locals.length === 0 ? <option value="">Sin locales configurados</option> : locals.map((local) => <option key={local.id} value={local.id}>{local.name}</option>)}
        </select>
      </label>
      {selectedLocal && <span className={`reservation-channel-status is-${selectedLocal.status}`}>{selectedLocal.status === 'published' ? 'Canal abierto' : selectedLocal.status === 'paused' ? 'Canal pausado' : 'Pendiente de publicación'}</span>}
    </section>

    {localsError ? <QueryErrorState title="No pudimos cargar los locales" message={localsError.message} onRetry={() => void refetch()} />
      : !effectiveClientId ? <EmptyState icon="calendar" title="Primero crea una cuenta" description="Reservas se organiza por cuenta y local." />
        : loadingLocals ? <LoadingSpinner text="Cargando locales..." />
          : !selectedLocal ? <EmptyState icon="calendar" title="Configura tu primer local" description="Agrega el local, define horarios y cupos, y luego publica su enlace de reservas." action={<button className="btn btn-primary" type="button" onClick={() => setCreateOpen(true)}>Agregar local</button>} />
            : <>
              <section className="reservation-operation-actions" aria-label="Acciones del local">
                <Link className="reservation-operation-card primary" to={`/reservations/agenda?clientId=${encodeURIComponent(effectiveClientId)}&formId=${encodeURIComponent(effectiveLocalId)}`}><span>01</span><div><strong>Operar el turno</strong><small>Ver agenda, registrar llegada, inasistencia y cierre por excepción.</small></div><b>Ir a la agenda</b></Link>
                <Link className="reservation-operation-card" to={`/reservations/locals/${selectedLocal.id}`}><span>02</span><div><strong>Abrir local</strong><small>Configuración, reservas, grupos, cupones y enlace público.</small></div><b>Abrir</b></Link>
                <a className="reservation-operation-card" href={`/book/${selectedLocal.publicSlug}`} target="_blank" rel="noreferrer"><span>03</span><div><strong>Ver enlace público</strong><small>La experiencia guiada que usa quien reserva.</small></div><b>Abrir enlace</b></a>
              </section>

              <section className="reservation-operation-summary" aria-label="Resumen de hoy">
                <div><span>Reservas de hoy</span><strong>{loadingReservations ? '—' : summary.total}</strong></div>
                <div><span>Por recibir</span><strong>{loadingReservations ? '—' : summary.pending}</strong></div>
                <div><span>Asistieron</span><strong>{loadingReservations ? '—' : summary.attended}</strong></div>
                <div><span>Inasistencias</span><strong>{loadingReservations ? '—' : summary.noShow}</strong></div>
              </section>

              <section className="reservation-readiness">
                <div><span className="page-eyebrow">ANTES DE ABRIR EL CANAL</span><h2>Configuración de {selectedLocal.name}</h2></div>
                <ul>
                  <li><strong>{selectedLocal.scheduleConfig?.windows?.length ? 'Listo' : 'Pendiente'}</strong> Horarios y turnos</li>
                  <li><strong>{selectedLocal.capacityPerSlot > 0 ? 'Listo' : 'Pendiente'}</strong> Tope por franja: {selectedLocal.capacityPerSlot || 'sin definir'} comensales</li>
                  <li><strong>{selectedLocal.durationMinutes > 0 ? 'Listo' : 'Pendiente'}</strong> Duración de mesa: {selectedLocal.durationMinutes || 'sin definir'} min</li>
                  <li><strong>{selectedLocal.minimumNoticeHours >= 0 ? 'Listo' : 'Pendiente'}</strong> Anticipación mínima: {selectedLocal.minimumNoticeHours} h</li>
                </ul>
              </section>
            </>}

    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Agregar local">
      <form className="modal-form" onSubmit={(event) => { event.preventDefault(); createLocal.mutate(); }}>
        <p className="page-subtitle">El local es la unidad operativa. Después configurarás horarios, cupos y el enlace público.</p>
        <label>Cuenta<select className="input" value={effectiveClientId} onChange={(event) => setClientId(event.target.value)} required><option value="">Selecciona una cuenta</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
        <label>Nombre del local<input className="input" value={localName} onChange={(event) => setLocalName(event.target.value)} placeholder="Ej. Casa Costanera - Providencia" required maxLength={180} /></label>
        {createLocal.error && <div className="alert alert-error">No fue posible crear el local. Revisa los datos e inténtalo nuevamente.</div>}
        <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setCreateOpen(false)}>Cancelar</button><button className="btn btn-primary" disabled={createLocal.isPending}>{createLocal.isPending ? 'Creando...' : 'Continuar a configuración'}</button></div>
      </form>
    </Modal>
  </div>;
}
