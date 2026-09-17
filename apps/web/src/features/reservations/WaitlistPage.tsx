import { useDeferredValue } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { triggerToast } from '../../shared/toast-events';
import { Link } from 'react-router-dom';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { ForbiddenState } from '../../shared/ForbiddenState';
import { isForbiddenError } from '../../core/api';
import { EmptyState } from '../../shared/EmptyState';
import type { Reservation, ReservationForm } from './types';
import { respuestasLegibles } from './answer-labels';
import { browserDateBoundaryUtc } from './local-time';
import { useUrlFilters } from '../../shared/use-url-filters';

interface Client { id: string; name: string }
/** Página de reservas. `data` es el nombre con que responden todas las listas del sistema. */
interface ReservationPage { data: Reservation[]; total: number; page: number; pageSize: number; pages: number }

/**
 * Expresa el tiempo transcurrido desde `createdAt` en una unidad legible (minutos u horas).
 *
 * Solo se usa para la columna "tiempo de espera": no persiste nada, se recalcula en cada
 * render a partir de la hora actual.
 */
function waitingTimeLabel(createdAt?: string): string {
  if (!createdAt) return 'Sin dato';
  const elapsedMs = Date.now() - new Date(createdAt).getTime();
  if (Number.isNaN(elapsedMs) || elapsedMs < 0) return 'Sin dato';
  const minutes = Math.floor(elapsedMs / 60000);
  if (minutes < 1) return 'Recién';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
}

/** Claves que esta pantalla filtra. Limpiar suelta solo estas. */
const FILTER_KEYS = ['cliente', 'local', 'fecha'] as const;

/**
 * La lista usa la misma operación de reservas: desde el detalle se confirma sólo si el
 * servidor vuelve a comprobar que el cupo se liberó. Esta vista no promete promociones
 * automáticas que aún no existen.
 */
export function WaitlistPage() {
  // En la dirección: quien atiende la lista abre un detalle, vuelve, y necesita seguir viendo lo
  // mismo. En estado local ese viaje de ida y vuelta borraba los tres filtros.
  const filtros = useUrlFilters(FILTER_KEYS);
  const clientFilter = filtros.values.cliente;
  const setClientFilter = (valor: string) => filtros.setValue('cliente', valor);
  const formFilter = filtros.values.local;
  const setFormFilter = (valor: string) => filtros.setValue('local', valor);
  const dateFilter = filtros.values.fecha;
  const setDateFilter = (valor: string) => filtros.setValue('fecha', valor);
  const searchInput = filtros.search;
  const setSearchInput = filtros.setSearch;
  const search = useDeferredValue(searchInput.trim());

  const queryClient = useQueryClient();
  /*
   * Pasar a alguien de la lista a una reserva de verdad.
   *
   * La lista servía para anotar y nada más: cuando se liberaba una mesa había que escribirle por
   * fuera y volver a anotar sus datos a mano en «Anotar reserva», así que la lista se llenaba y no
   * se usaba. Confirmar y abrir el mensaje en el mismo gesto es lo que la vuelve útil.
   *
   * El mensaje va con el texto escrito pero sin enviar: se revisa antes, como cualquier aviso.
   */
  const pasarAReserva = useMutation({
    mutationFn: (item: Reservation) => api.patch(`/reservations/${item.id}`, { status: 'confirmed' }),
    onSuccess: (_resultado, item) => {
      void queryClient.invalidateQueries({ queryKey: ['reservations-waitlist'] });
      triggerToast(`${item.guestName} pasó a reserva confirmada.`);
      const digitos = (item.guestPhone ?? '').replace(/\D/g, '');
      if (!digitos) return;
      const numero = digitos.length === 9 ? `56${digitos}` : digitos.length === 8 ? `569${digitos}` : digitos;
      const cuando = new Date(item.startsAt).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' });
      const mensaje = `Hola ${item.guestName.trim().split(/\s+/)[0]}, se liberó una mesa para ${item.partySize} ${item.partySize === 1 ? 'persona' : 'personas'} el ${cuando}. Te la dejamos reservada, ¿la confirmas?`;
      window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener');
    },
  });

  const { data: clientsResp } = useQuery<{ data: Client[] }>({ queryKey: ['clients'], queryFn: () => api.get('/clients') });
  const clients = (Array.isArray(clientsResp?.data) ? clientsResp?.data : undefined) ?? [];
  /*
   * Los locales se cargan siempre, no sólo con una empresa elegida.
   *
   * Sin ellos la tabla no sabe de qué local es cada persona —decía «Reserva no disponible»— ni
   * puede traducir lo que completó: mostraba «ocasion» en vez de «¿Celebras algo?».
   */
  const { data: forms = [] } = useQuery<ReservationForm[]>({ queryKey: ['reservation-forms', clientFilter], queryFn: () => api.get(`/reservations/forms${clientFilter ? `?clientId=${encodeURIComponent(clientFilter)}` : ''}`) });

  const dateRange: Record<string, string> = dateFilter ? { from: browserDateBoundaryUtc(dateFilter), to: browserDateBoundaryUtc(dateFilter, true) } : {};
  const query = new URLSearchParams({
    status: 'waitlist',
    page: '1',
    pageSize: '50',
    ...(clientFilter ? { clientId: clientFilter } : {}),
    ...(formFilter ? { formId: formFilter } : {}),
    ...(search ? { search } : {}),
    ...dateRange,
  });
  const { data: waitlistPage, isFetching, error, refetch } = useQuery<ReservationPage>({
    queryKey: ['reservations-waitlist', clientFilter, formFilter, dateFilter, search],
    queryFn: () => api.get(`/reservations?${query}`),
    placeholderData: (previous) => previous,
  });
  const items = Array.isArray(waitlistPage?.data) ? waitlistPage.data : [];

  const detailLink = (item: Reservation) => `/reservations/manage?${new URLSearchParams({ tab: 'bookings', search: item.referenceCode || item.guestName, ...(clientFilter ? { clientId: clientFilter } : {}), ...(formFilter ? { formId: formFilter } : {}) })}`;

  return <div className="page reservation-module">
    <div className="reservation-section-head">
      <div><span className="page-eyebrow">OPERACIÓN DIARIA</span><h1>Lista de espera</h1></div>
      <div className="reservation-actions"><p>{waitlistPage?.total ?? 0} en espera</p></div>
    </div>

    <div className="reservation-filters">
      <input className="input" type="search" aria-label="Buscar en lista de espera" placeholder="Buscar nombre, teléfono, correo o código" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
      <select className="input" aria-label="Filtrar por cliente" value={clientFilter} onChange={(event) => { setClientFilter(event.target.value); setFormFilter(''); }}>
        <option value="">Todos los clientes</option>
        {clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}
      </select>
      <select className="input" aria-label="Filtrar por página de reserva" value={formFilter} disabled={!clientFilter || forms.length === 0} onChange={(event) => setFormFilter(event.target.value)}>
        <option value="">Todas las páginas de reserva</option>{forms.map((form) => <option value={form.id} key={form.id}>{form.name}</option>)}
      </select>
      <label className="filter-date">Fecha<input className="input" type="date" aria-label="Filtrar por fecha" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></label>
      <button type="button" className="btn btn-outline btn-sm" disabled={!filtros.hasAny} onClick={filtros.clear}>Limpiar</button>
    </div>

    {error ? (isForbiddenError(error) ? <ForbiddenState /> : <QueryErrorState title="No pudimos cargar la lista de espera" message={error.message} onRetry={() => void refetch()} retrying={isFetching} />)
      : isFetching && !waitlistPage ? <LoadingSpinner text="Buscando reservas en espera..." />
      : items.length === 0 ? <EmptyState icon="clock" title="Sin reservas en espera" description="Las solicitudes que queden en lista de espera aparecerán aquí." />
      : <div className="crm-table-container">
        <table className="data-table waitlist-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Quién espera</th>
              <th>Personas</th>
              <th>Hora solicitada</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => <tr key={item.id}>
              <td data-label="#">{index + 1}</td>
              <td data-label="Quién espera"><strong>{item.guestName}</strong><br /><small>{item.guestPhone || item.guestEmail || 'Sin contacto'}</small>
                <br /><small className="waitlist-local">{forms.find((form) => form.id === item.formId)?.name || 'Reserva no disponible'}</small>
                {/* Quien devuelve la llamada necesita la alergia y la ocasión, no sólo la nota interna. */}
                {(() => {
                  const respuestas = respuestasLegibles(item.answers, forms.find((form) => form.id === item.formId)?.fieldSchema);
                  if (!item.internalNotes && respuestas.length === 0) return null;
                  return <div className="waitlist-notas">
                    {item.internalNotes && <small>{item.internalNotes}</small>}
                    {respuestas.map((dato) => <small key={dato.clave} className="waitlist-dato">{dato.etiqueta}: {dato.valor}</small>)}
                  </div>;
                })()}
              </td>
              <td data-label="Personas">{item.partySize}</td>
              <td data-label="Hora solicitada">{new Date(item.startsAt).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}
                <br /><small>Espera {waitingTimeLabel(item.createdAt)}</small>
              </td>
              <td data-label="Acciones">
                <div className="actions-cell">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={pasarAReserva.isPending}
                    onClick={() => pasarAReserva.mutate(item)}
                  >{pasarAReserva.isPending && pasarAReserva.variables?.id === item.id ? 'Pasando...' : 'Pasar a reserva'}</button>
                  {item.guestPhone && <a className="btn btn-outline btn-sm" href={`tel:${item.guestPhone}`}>Llamar</a>}
                  <Link className="btn btn-outline btn-sm" to={detailLink(item)}>Ver detalle</Link>
                </div>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>}
  </div>;
}
