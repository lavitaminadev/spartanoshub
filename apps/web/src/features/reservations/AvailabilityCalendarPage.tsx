import { useEmpresaActiva } from '../../shared/empresa-activa';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { ForbiddenState } from '../../shared/ForbiddenState';
import { isForbiddenError } from '../../core/api';
import { EmptyState } from '../../shared/EmptyState';
import type { ReservationForm } from './types';
import './AvailabilityCalendarPage.css';
import { useAutoSeleccionUnica } from './use-auto-seleccion';

interface Client { id: string; name: string }
interface OccupancyDay { date: string; count: number; pct: number | null }
interface OccupancyResponse { month: string; capacity: number; days: OccupancyDay[] }

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Umbrales de ocupación: por debajo de 70% se lee como holgado, entre 70 y 90 como ajustado, sobre 90 como saturado. */
function occupancyTone(pct: number): 'low' | 'mid' | 'high' {
  if (pct >= 90) return 'high';
  if (pct >= 70) return 'mid';
  return 'low';
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

/**
 * Arma la grilla de semanas de un mes calendario (semanas que empiezan en lunes),
 * rellenando con `null` los días fuera de mes al inicio y al final de la primera
 * y última semana, de modo que el grid siempre tenga columnas de 7 días.
 */
function buildMonthGrid(date: Date): Array<Array<number | null>> {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay(): 0=domingo..6=sábado; convertimos a offset desde lunes.
  const leadingBlanks = (firstDay.getDay() + 6) % 7;

  const cells: Array<number | null> = [...Array(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: Array<Array<number | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function AvailabilityCalendarPage() {
  const { user } = useAuth();
  const clientMode = user?.role === 'client';
  const [searchParams] = useSearchParams();
  const navegar = useNavigate();
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  /*
    La empresa sobre la que se trabaja, no la de la sesión.
    Quien atiende más de una la elige una vez y todas las pantallas la respetan; con la de la
    sesión, elegir un local en el CRM dejaba esta pantalla mostrando el otro.
  */
  const empresaActiva = useEmpresaActiva();
  const [clientId, setClientId] = useState(() => clientMode ? empresaActiva.clientId || user?.clientId || '' : searchParams.get('clientId') ?? '');
  useEffect(() => {
    if (clientMode && empresaActiva.clientId && empresaActiva.clientId !== clientId) setClientId(empresaActiva.clientId);
  }, [clientMode, empresaActiva.clientId, clientId]);
  const [formId, setFormId] = useState(searchParams.get('formId') ?? '');

  const { data: clientsResp } = useQuery<{ data: Client[] }>({ queryKey: ['clients'], queryFn: () => api.get('/clients'), enabled: !clientMode });
  const clients = clientMode ? [{ id: clientId, name: 'Mi empresa' }] : (Array.isArray(clientsResp?.data) ? clientsResp?.data : undefined) ?? [];
  useAutoSeleccionUnica(clients, clientId, setClientId);
  const { data: forms = [] } = useQuery<ReservationForm[]>({
    queryKey: ['reservation-forms', clientId], queryFn: () => api.get(`/reservations/forms?clientId=${encodeURIComponent(clientId)}`), enabled: Boolean(clientId),
  });
  // Un local recién creado ya queda seleccionado en el calendario. Así la empresa
  // no aterriza en una vista "todos" sin darse cuenta de que debe elegir su local.
  useEffect(() => {
    if (clientMode && !formId && forms.length === 1) setFormId(forms[0].id);
  }, [clientMode, formId, forms]);

  const month = monthKey(cursor);
  const { data: occupancy, isLoading, error, refetch, isFetching } = useQuery<OccupancyResponse>({
    queryKey: ['reservation-occupancy', month, clientId, formId],
    queryFn: () => api.get(`/reservations/analytics/occupancy?${new URLSearchParams({ month, clientId, ...(formId ? { formId } : {}) })}`),
    enabled: Boolean(clientId),
  });

  const dayByDate = useMemo(() => {
    const map = new Map<string, OccupancyDay>();
    for (const day of occupancy?.days ?? []) map.set(day.date, day);
    return map;
  }, [occupancy]);

  const weeks = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const hasCapacity = (occupancy?.capacity ?? 0) > 0;
  /*
   * Los días que el local no abre.
   *
   * Sin esto, un domingo cerrado y un domingo vacío se ven igual: la celda sin número podía
   * significar «nadie reservó» o «no abrimos», y son decisiones distintas. Sólo se sabe cuando hay
   * una página elegida —o una sola posible—, porque el horario es de cada una.
   */
  const localDelCalendario = forms.find((form) => form.id === formId) ?? (forms.length === 1 ? forms[0] : undefined);
  const diasQueAbre = useMemo(() => {
    const ventanas = (localDelCalendario?.scheduleConfig as { windows?: Array<{ day: number }> } | undefined)?.windows ?? [];
    return new Set(ventanas.map((ventana) => ventana.day));
  }, [localDelCalendario]);
  const todayKey = monthKey(new Date()) === month ? new Date().getDate() : null;

  const dateKeyFor = (day: number) => `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return <div className="page availability-calendar-page">
    <div className="reservation-section-head">
      <div><span className="page-eyebrow">DISPONIBILIDAD</span><h1>Calendario de disponibilidad</h1></div>
    </div>

    <div className="availability-toolbar">
      {!clientMode && <select className="input" aria-label="Selecciona un cliente" value={clientId} onChange={(event) => { setClientId(event.target.value); setFormId(''); }}>
        <option value="">Selecciona un cliente</option>
        {clients.map((client: Client) => <option key={client.id} value={client.id}>{client.name}</option>)}
      </select>}
      <select className="input" aria-label="Selecciona una página de reserva" value={formId} disabled={!clientId || forms.length === 0} onChange={(event) => setFormId(event.target.value)}>
        <option value="">Todas las páginas de reserva</option>
        {forms.map((form) => <option key={form.id} value={form.id}>{form.name}</option>)}
      </select>
      <div className="availability-month-nav">
        <button type="button" className="btn btn-outline btn-sm" aria-label="Mes anterior" onClick={() => setCursor((current) => addMonths(current, -1))}>◀</button>
        <strong>{cursor.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}</strong>
        <button type="button" className="btn btn-outline btn-sm" aria-label="Mes siguiente" onClick={() => setCursor((current) => addMonths(current, 1))}>▶</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Hoy</button>
      </div>
    </div>

    {!clientId ? (
      <EmptyState icon="calendar" title="Elige una empresa" description="Después puedes elegir una de sus reservas para no mezclar su ocupación con las demás." />
    ) : isLoading ? (
      <LoadingSpinner text="Calculando ocupación..." />
    ) : error ? (
      isForbiddenError(error) ? <ForbiddenState /> : <QueryErrorState title="No pudimos cargar la ocupación" message={error.message} onRetry={() => void refetch()} retrying={isFetching} />
    ) : <>
      <div className="availability-calendar" role="table" aria-label="Calendario mensual de ocupación">
        <div className="availability-weekday-row" role="row">
          {WEEKDAY_LABELS.map((label) => <span key={label} role="columnheader">{label}</span>)}
        </div>
        {weeks.map((week, weekIndex) => <div className="availability-week-row" role="row" key={weekIndex}>
          {week.map((day, dayIndex) => {
            if (day === null) return <div className="availability-cell is-empty" key={dayIndex} aria-hidden="true" />;
            const info = dayByDate.get(dateKeyFor(day));
            const pct = info?.pct ?? null;
            const isToday = todayKey === day;
            const cerrado = diasQueAbre.size > 0 && !diasQueAbre.has(new Date(cursor.getFullYear(), cursor.getMonth(), day).getDay());
            // Cuánto queda por vender, que es lo que se mira para decidir si abrir un cupo más.
            const libres = hasCapacity && info ? Math.max(0, (occupancy?.capacity ?? 0) - info.count) : null;
            /*
             * Cada día abre su agenda.
             *
             * El calendario mostraba la ocupación y ahí terminaba: ver que un jueves está al 90%
             * sin poder abrirlo obligaba a ir a la agenda y buscar la fecha a mano.
             */
            const fecha = dateKeyFor(day);
            return <button
              type="button"
              className={`availability-cell ${isToday ? 'is-today' : ''} ${cerrado ? 'is-cerrado' : ''}`}
              key={dayIndex}
              aria-label={cerrado ? `${fecha}: el local no abre` : `Ver la agenda del ${fecha}`}
              onClick={() => navegar(`${clientMode ? '/portal' : ''}/reservations/agenda?${new URLSearchParams({ date: fecha, ...(clientId ? { clientId } : {}), ...(formId ? { formId } : {}) })}`)}
            >
              <span className="availability-day-number">{day}</span>
              {cerrado ? <span className="availability-cerrado">Cerrado</span> : info ? (
                <>
                  {hasCapacity && pct !== null ? (
                    <span className={`availability-badge tone-${occupancyTone(pct)}`} title={`${info.count} reserva(s) · ${pct}% de ocupación`}>{pct}%</span>
                  ) : (
                    <span className="availability-badge tone-neutral" title={`${info.count} reserva(s), sin tope diario configurado`}>{info.count}</span>
                  )}
                  <span className="availability-detalle">{info.count} {info.count === 1 ? 'persona' : 'personas'}{libres !== null ? ` · ${libres} ${libres === 1 ? 'libre' : 'libres'}` : ''}</span>
                </>
              ) : null}
            </button>;
          })}
        </div>)}
      </div>

      <div className="availability-legend" aria-label="Leyenda de ocupación">
        <span className="legend-item"><i className="legend-dot tone-low" /> Baja (&lt;70%)</span>
        <span className="legend-item"><i className="legend-dot tone-mid" /> Media (70-90%)</span>
        <span className="legend-item"><i className="legend-dot tone-high" /> Alta (&gt;90%)</span>
        {!hasCapacity && <span className="legend-item"><i className="legend-dot tone-neutral" /> Sin tope diario configurado (se muestra el número de reservas)</span>}
        {diasQueAbre.size > 0 && <span className="legend-item"><i className="legend-dot tone-cerrado" /> El local no abre</span>}
      </div>
    </>}
  </div>;
}
