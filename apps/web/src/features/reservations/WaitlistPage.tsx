import { useDeferredValue } from 'react';
import { useQuery } from '@tanstack/react-query';
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

  const { data: clientsResp } = useQuery<{ data: Client[] }>({ queryKey: ['clients'], queryFn: () => api.get('/clients') });
  const clients = Array.isArray((clientsResp as any)?.data) ? (clientsResp as any).data : [];
  const { data: forms = [] } = useQuery<ReservationForm[]>({ queryKey: ['reservation-forms', clientFilter], queryFn: () => api.get(`/reservations/forms?clientId=${encodeURIComponent(clientFilter)}`), enabled: Boolean(clientFilter) });

  const dateRange = dateFilter ? { from: browserDateBoundaryUtc(dateFilter), to: browserDateBoundaryUtc(dateFilter, true) } : {};
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
      <select className="input" aria-label="Filtrar por local" value={formFilter} disabled={!clientFilter || forms.length === 0} onChange={(event) => setFormFilter(event.target.value)}>
        <option value="">Todos los locales de la empresa</option>{forms.map((form) => <option value={form.id} key={form.id}>{form.name}</option>)}
      </select>
      <label className="filter-date">Fecha<input className="input" type="date" aria-label="Filtrar por fecha" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></label>
      <button type="button" className="btn btn-outline btn-sm" disabled={!filtros.hasAny} onClick={filtros.clear}>Limpiar</button>
    </div>

    {error ? (isForbiddenError(error) ? <ForbiddenState /> : <QueryErrorState title="No pudimos cargar la lista de espera" message={error.message} onRetry={() => void refetch()} retrying={isFetching} />)
      : isFetching && !waitlistPage ? <LoadingSpinner text="Buscando reservas en espera..." />
      : items.length === 0 ? <EmptyState icon="clock" title="Sin reservas en espera" description="Las solicitudes que queden en lista de espera aparecerán aquí." />
      : <div className="crm-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Cliente</th>
              <th>Personas</th>
              <th>Hora solicitada</th>
              <th>Tiempo de espera</th>
              <th>Notas</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => <tr key={item.id}>
              <td>{index + 1}</td>
              <td><strong>{item.guestName}</strong><br /><small>{item.guestPhone || item.guestEmail || 'Sin contacto'}</small></td>
              <td>{item.partySize}</td>
              <td>{new Date(item.startsAt).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}</td>
              <td>{waitingTimeLabel(item.createdAt)}</td>
              {/* Quien devuelve la llamada necesita la alergia y la ocasion, no solo la nota interna. */}
              <td>{(() => {
                const respuestas = respuestasLegibles(item.answers, forms.find((form) => form.id === item.formId)?.fieldSchema);
                if (!item.internalNotes && respuestas.length === 0) return '—';
                return <>{item.internalNotes && <span>{item.internalNotes}</span>}{respuestas.map((dato) => <small key={dato.clave} className="waitlist-dato">{dato.etiqueta}: {dato.valor}</small>)}</>;
              })()}</td>
              <td>
                <div className="actions-cell">
                  {item.guestPhone && <a className="btn btn-outline btn-sm" href={`https://wa.me/${item.guestPhone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>}
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
