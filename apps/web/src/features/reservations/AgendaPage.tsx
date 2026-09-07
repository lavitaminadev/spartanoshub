/**
 * @fileoverview Agenda del servicio: tablero del día agrupado por zona/área.
 *
 * Cada local configura sus propias zonas en `resourcesConfig` (Terraza, Salón, Barra...).
 * Esta vista lee ese catálogo tal cual está
 * configurado y ubica las reservas del día en columnas por zona, ordenadas por hora.
 * Si el formulario no define zonas, todo cae en una única columna "General".
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { ForbiddenState } from '../../shared/ForbiddenState';
import { isForbiddenError } from '../../core/api';
import { EmptyState } from '../../shared/EmptyState';
import { Modal } from '../../shared/Modal';
import { CYCLE_COLORS, RESERVATION_STATUS_OPTIONS, findStatusOption } from '../../shared/status-palette';
import type { Reservation, ReservationForm } from './types';
import { localDateBoundsUtc } from './local-time';
import './AgendaPage.css';

interface Client { id: string; name: string }
/** Página de reservas. `data` es el nombre con que responden todas las listas del sistema. */
interface ReservationPage { data: Reservation[]; total: number; page: number; pageSize: number; pages: number }
interface GroupRequest { id: string; guestName: string; guestEmail?: string; guestPhone?: string; partySize: number; eventType: string; preferredDate?: string; preferredTime?: string; notes?: string; status: string; quoteAmount?: string; quoteMessage?: string; quoteExpiresAt?: string; createdAt: string }

const GENERAL_ZONE_ID = '__general__';
const NO_SHOW_STATUSES = new Set(['no_show']);
const EMPTY_RESERVATIONS: Reservation[] = [];

/** Fecha en formato `YYYY-MM-DD` a partir de un `Date` local. */
function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shiftDate(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  const next = new Date(year, month - 1, day + days);
  return dateKey(next);
}

function formatDateLabel(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const label = date.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function AgendaPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [dateFilter, setDateFilter] = useState(() => dateKey(new Date()));
  const [clientId, setClientId] = useState(searchParams.get('clientId') ?? '');
  // La entrada desde el centro del local debe abrir ese local, no el primero de otra lista.
  const [formId, setFormId] = useState(searchParams.get('formId') ?? '');
  const [mobileZone, setMobileZone] = useState<string>('');
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('Evento privado');
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [quoteRequest, setQuoteRequest] = useState<GroupRequest | null>(null);
  const [quote, setQuote] = useState({ amount: '', message: '', expiresAt: '' });

  const { data: clientsResp, isLoading: loadingClients, error: clientsError, refetch: refetchClients } = useQuery<{ data: Client[] }>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients'),
  });
  const clients = Array.isArray(clientsResp?.data) ? clientsResp!.data : [];

  const { data: formsArray = [], isLoading: loadingForms } = useQuery<ReservationForm[]>({
    queryKey: ['reservation-forms', clientId],
    queryFn: () => api.get(`/reservations/forms${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`),
    enabled: Boolean(clientId),
  });
  const forms = Array.isArray(formsArray) ? formsArray : [];
  const activeForm = forms.find((form) => form.id === formId) ?? forms[0];
  const effectiveFormId = formId || activeForm?.id || '';

  const dayRange = useMemo(
    () => activeForm ? localDateBoundsUtc(dateFilter, activeForm.timezone) : { from: '', to: '' },
    [activeForm, dateFilter],
  );
  const {
    data: reservationPage,
    isLoading: loadingReservations,
    isFetching: fetchingReservations,
    error: reservationsError,
    refetch: refetchReservations,
  } = useQuery<ReservationPage>({
    queryKey: ['agenda-reservations', clientId, effectiveFormId, dateFilter],
    queryFn: () => api.get(`/reservations?${new URLSearchParams({ clientId, formId: effectiveFormId, ...dayRange, pageSize: '100' })}`),
    enabled: Boolean(clientId && effectiveFormId),
  });
  const reservations = Array.isArray(reservationPage?.data) ? reservationPage.data : EMPTY_RESERVATIONS;
  const { data: groupRequests = [], refetch: refetchGroupRequests } = useQuery<GroupRequest[]>({
    queryKey: ['reservation-group-requests', effectiveFormId], queryFn: () => api.get(`/reservations/forms/${effectiveFormId}/group-requests`), enabled: Boolean(effectiveFormId),
  });
  const closeDay = useMutation({
    mutationFn: () => api.post('/reservations/close-day', { formId: effectiveFormId, date: dateFilter, reason: 'Cierre de turno por excepción' }),
    onSuccess: () => void refetchReservations(),
  });
  const createBlock = useMutation({
    mutationFn: () => api.post(`/reservations/forms/${effectiveFormId}/blocks`, { startsAt: new Date(blockStart).toISOString(), endsAt: new Date(blockEnd).toISOString(), reason: blockReason.trim() }),
    onSuccess: () => { setBlockOpen(false); void refetchReservations(); },
  });
  const updateGroupRequest = useMutation({ mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.patch(`/reservations/group-requests/${id}`, body), onSuccess: () => { setQuoteRequest(null); void refetchGroupRequests(); } });

  const zones = useMemo(() => {
    const configured = activeForm?.resourcesConfig ?? [];
    if (configured.length === 0) return [{ id: GENERAL_ZONE_ID, name: 'General' }];
    return configured.map((zone) => ({ id: zone.id, name: zone.name }));
  }, [activeForm]);

  const reservationsByZone = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    zones.forEach((zone) => map.set(zone.id, []));
    reservations.forEach((reservation) => {
      const zoneId = (reservation as Reservation & { resourceId?: string }).resourceId;
      const key = zoneId && map.has(zoneId) ? zoneId : GENERAL_ZONE_ID;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(reservation);
    });
    map.forEach((list) => list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));
    return map;
  }, [reservations, zones]);

  const summary = useMemo(() => {
    const total = reservations.length;
    const noShows = reservations.filter((reservation) => NO_SHOW_STATUSES.has(reservation.status)).length;
    const occupied = reservations.filter((reservation) => !['cancelled_client', 'cancelled_business'].includes(reservation.status)).length;
    const capacity = activeForm?.dailyCapacity || 0;
    const occupancyPct = capacity > 0 ? Math.round((occupied / capacity) * 100) : null;
    return { total, noShows, occupancyPct };
  }, [reservations, activeForm]);

  const isLoading = loadingClients || (Boolean(clientId) && loadingForms);
  if (isLoading) return <LoadingSpinner text="Preparando la agenda del servicio..." />;
  if (clientsError) return isForbiddenError(clientsError) ? <ForbiddenState /> : <QueryErrorState title="No pudimos abrir la agenda" message={clientsError.message} onRetry={() => void refetchClients()} />;

  const goToReservation = (reservation: Reservation) => {
    navigate(`/reservations?tab=bookings&search=${encodeURIComponent(reservation.referenceCode)}`);
  };

  return <div className="page agenda-page">
    <div className="agenda-head">
      <div>
        <span className="page-eyebrow">OPERACIÓN DIARIA</span>
        <h1>Agenda del servicio</h1>
        <p className="page-subtitle">Vista del día agrupada por zona, tal como cada cliente configura su local.</p>
      </div>
    </div>

    <div className="agenda-controls">
      <select className="input" aria-label="Cliente" value={clientId} onChange={(event) => { setClientId(event.target.value); setFormId(''); }}>
        <option value="">Selecciona un cliente</option>
        {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
      </select>
      <select className="input" aria-label="Local" value={effectiveFormId} disabled={!clientId || forms.length === 0} onChange={(event) => setFormId(event.target.value)}>
        {forms.length === 0
          ? <option value="">Sin locales configurados</option>
          : forms.map((form) => <option key={form.id} value={form.id}>{form.name}</option>)}
      </select>
      <div className="agenda-date-nav">
        <button type="button" className="btn btn-outline btn-sm" aria-label="Día anterior" onClick={() => setDateFilter((current) => shiftDate(current, -1))}>‹</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setDateFilter(dateKey(new Date()))}>Hoy</button>
        <button type="button" className="btn btn-outline btn-sm" aria-label="Día siguiente" onClick={() => setDateFilter((current) => shiftDate(current, 1))}>›</button>
        <input className="input" type="date" aria-label="Elegir fecha" value={dateFilter} onChange={(event) => setDateFilter(event.target.value || dateKey(new Date()))} />
      </div>
      <strong className="agenda-date-label">{formatDateLabel(dateFilter)}</strong>
      <button type="button" className="btn btn-outline btn-sm" disabled={!effectiveFormId} onClick={() => { setBlockStart(`${dateFilter}T13:00`); setBlockEnd(`${dateFilter}T23:00`); setBlockOpen(true); }}>Bloquear por evento</button>
      <button type="button" className="btn btn-outline btn-sm" disabled={!effectiveFormId || closeDay.isPending || new Date(`${dateFilter}T23:59:59`) > new Date()} onClick={() => { if (window.confirm('Se marcarán como asistidas las reservas abiertas de este turno y quedará registrado.')) closeDay.mutate(); }}>{closeDay.isPending ? 'Cerrando...' : 'Cerrar turno'}</button>
    </div>

    {!clientId
      ? <EmptyState icon="calendar" title="Elige una cuenta" description="Selecciona una cuenta y su local para ver la agenda del día." />
      : forms.length === 0 && !loadingForms
        ? <EmptyState icon="calendar" title="Sin locales configurados" description="Configura el primer local antes de abrir la agenda." />
        : <>
          <div className="agenda-summary" aria-label="Resumen del día">
            <div className="agenda-summary-badge"><strong>{fetchingReservations ? '—' : summary.total}</strong><span>Reservas hoy</span></div>
            <div className="agenda-summary-badge"><strong>{summary.occupancyPct === null ? '—' : `${summary.occupancyPct}%`}</strong><span>Ocupación</span></div>
            <div className="agenda-summary-badge is-warn"><strong>{fetchingReservations ? '—' : summary.noShows}</strong><span>No-shows</span></div>
          </div>
          <section className="reservation-readiness"><div><span className="page-eyebrow">SOLICITUDES SIN CUPO</span><h2>Grupos y eventos</h2><p className="page-subtitle">No ocupan agenda hasta que el equipo acuerde una fecha y cree la reserva definitiva.</p></div>{groupRequests.length === 0 ? <p className="page-subtitle">No hay solicitudes pendientes para este local.</p> : <div className="reservation-request-list">{groupRequests.map((request) => <article key={request.id} className="reservation-request-card"><div><strong>{request.guestName} · {request.partySize} personas</strong><span>{request.eventType} {request.preferredDate ? `· ${request.preferredDate}` : ''} {request.preferredTime ? `· ${request.preferredTime}` : ''}</span><small>{request.guestPhone || request.guestEmail || 'Sin contacto'}{request.notes ? ` · ${request.notes}` : ''}</small>{request.quoteAmount && <small>Cotización interna: ${Number(request.quoteAmount).toLocaleString('es-CL')} {request.quoteExpiresAt ? `· vence ${new Date(request.quoteExpiresAt).toLocaleDateString('es-CL')}` : ''}</small>}</div><div><span className="reservation-channel-status">{request.status}</span>{request.status === 'pending' && <button className="btn btn-outline btn-sm" type="button" disabled={updateGroupRequest.isPending} onClick={() => updateGroupRequest.mutate({ id: request.id, body: { status: 'contacted' } })}>Marcar contactada</button>}{['pending', 'contacted'].includes(request.status) && <button className="btn btn-outline btn-sm" type="button" onClick={() => { setQuoteRequest(request); setQuote({ amount: '', message: '', expiresAt: '' }); }}>Registrar cotización</button>}</div></article>)}</div>}</section>
          {closeDay.error && <p className="error-text">No se pudo cerrar el turno. Verifica que la fecha ya haya terminado.</p>}

          {reservationsError
            ? (isForbiddenError(reservationsError) ? <ForbiddenState /> : <QueryErrorState title="No pudimos cargar las reservas del día" message={reservationsError.message} onRetry={() => void refetchReservations()} retrying={fetchingReservations} />)
            : loadingReservations
              ? <LoadingSpinner text="Cargando reservas del día..." />
              : <>
                {zones.length > 1 && <div className="agenda-zone-tabs" role="tablist" aria-label="Zonas">
                  {zones.map((zone) => <button
                    key={zone.id}
                    type="button"
                    role="tab"
                    aria-selected={mobileZone ? mobileZone === zone.id : zone === zones[0]}
                    className={(mobileZone ? mobileZone === zone.id : zone === zones[0]) ? 'active' : ''}
                    onClick={() => setMobileZone(zone.id)}
                  >{zone.name}<span>{reservationsByZone.get(zone.id)?.length ?? 0}</span></button>)}
                </div>}

                <div className="agenda-board">
                  {zones.map((zone) => {
                    const items = reservationsByZone.get(zone.id) ?? [];
                    const isHiddenOnMobile = zones.length > 1 && (mobileZone ? mobileZone !== zone.id : zone !== zones[0]);
                    return <section key={zone.id} className={`agenda-column ${isHiddenOnMobile ? 'is-hidden-mobile' : ''}`} aria-label={zone.name}>
                      <header className="agenda-column-head"><h2>{zone.name}</h2><span>{items.length}</span></header>
                      {items.length === 0
                        ? <p className="agenda-column-empty">Sin reservas</p>
                        : <div className="agenda-column-body">
                          {items.map((reservation) => {
                            const option = findStatusOption(RESERVATION_STATUS_OPTIONS, reservation.status);
                            const color = option?.color ?? CYCLE_COLORS.pending;
                            return <button
                              key={reservation.id}
                              type="button"
                              className="agenda-card"
                              style={{ '--card-color': color } as React.CSSProperties}
                              onClick={() => goToReservation(reservation)}
                            >
                              <div className="agenda-card-time">{new Date(reservation.startsAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</div>
                              <div className="agenda-card-body">
                                <strong>{reservation.guestName}</strong>
                                <span>{reservation.partySize} persona{reservation.partySize === 1 ? '' : 's'}</span>
                              </div>
                              <span className="agenda-card-status" title={option?.label ?? reservation.status}>{option?.icon ?? '●'}</span>
                            </button>;
                          })}
                        </div>}
                    </section>;
                  })}
                </div>

                <ul className="agenda-legend" aria-label="Referencia de colores de estado">
                  {RESERVATION_STATUS_OPTIONS.map((option) => <li key={option.value}><span className="agenda-legend-dot" style={{ background: option.color }} />{option.label}</li>)}
                </ul>
              </>}
        </>}
    <Modal open={blockOpen} onClose={() => setBlockOpen(false)} title="Bloquear por evento privado">
      <form className="modal-form" onSubmit={(event) => { event.preventDefault(); if (!blockStart || !blockEnd || new Date(blockEnd) <= new Date(blockStart)) return; createBlock.mutate(); }}>
        <p className="page-subtitle">El tramo dejará de estar disponible para nuevas reservas. Si existen reservas en ese horario, revisa la agenda y contáctalas antes de cerrar el evento.</p>
        <label>Motivo interno<input className="input" value={blockReason} onChange={(event) => setBlockReason(event.target.value)} required maxLength={180} /></label>
        <div className="form-row"><label>Desde<input className="input" type="datetime-local" value={blockStart} onChange={(event) => setBlockStart(event.target.value)} required /></label><label>Hasta<input className="input" type="datetime-local" value={blockEnd} onChange={(event) => setBlockEnd(event.target.value)} required /></label></div>
        {createBlock.error && <p className="error-text">{createBlock.error instanceof Error ? createBlock.error.message : 'No se pudo crear el bloqueo. Verifica las fechas e inténtalo otra vez.'}</p>}
        <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setBlockOpen(false)}>Cancelar</button><button className="btn btn-primary" disabled={createBlock.isPending}>{createBlock.isPending ? 'Bloqueando...' : 'Confirmar bloqueo'}</button></div>
      </form>
    </Modal>
    <Modal open={Boolean(quoteRequest)} onClose={() => setQuoteRequest(null)} title="Registrar cotización interna">
      <form className="modal-form" onSubmit={(event) => { event.preventDefault(); if (quoteRequest) updateGroupRequest.mutate({ id: quoteRequest.id, body: { status: 'quoted', quoteAmount: Number(quote.amount), quoteMessage: quote.message, quoteExpiresAt: quote.expiresAt || undefined } }); }}><p className="page-subtitle">Se registra para el equipo; todavía no se envía al cliente ni confirma un cupo. Coordina con la persona y crea la reserva definitiva cuando acuerden fecha y condiciones.</p><label>Monto total<input className="input" type="number" min="0" required value={quote.amount} onChange={(event) => setQuote({ ...quote, amount: event.target.value })} /></label><label>Detalle interno<textarea className="input" required maxLength={5000} value={quote.message} onChange={(event) => setQuote({ ...quote, message: event.target.value })} placeholder="Incluye menú, extras, anticipo y condiciones." /></label><label>Vigencia <small>(opcional)</small><input className="input" type="datetime-local" value={quote.expiresAt} onChange={(event) => setQuote({ ...quote, expiresAt: event.target.value })} /></label>{updateGroupRequest.error && <p className="error-text">No se pudo guardar la cotización.</p>}<div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setQuoteRequest(null)}>Cancelar</button><button className="btn btn-primary" disabled={updateGroupRequest.isPending}>{updateGroupRequest.isPending ? 'Guardando...' : 'Guardar cotización interna'}</button></div></form>
    </Modal>
  </div>;
}
