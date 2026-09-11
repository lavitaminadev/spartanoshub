import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { plainDateInZone } from './local-time';

type Managed = {
  referenceCode: string; guestName: string; startsAt: string; partySize: number; status: string;
  guestConfirmedAt?: string | null; canCancel: boolean; canReschedule: boolean; timezone: string;
  publicSlug: string; maxPartySize?: number; localName?: string; serviceId?: string; resourceId?: string;
};
interface Slot { startsAt: string; available: number }

/** Días que se ofrecen para cambiar la hora. Coincide con lo que muestra la página del local. */
const DIAS_A_LA_VISTA = 14;

export function PublicReservationManagementPage() {
  const { token = '' } = useParams();
  const booking = useQuery<Managed>({ queryKey: ['reservation-management', token], queryFn: () => api.get(`/public/reservations/manage/${token}`), retry: false });
  const cancel = useMutation({ mutationFn: () => api.post(`/public/reservations/manage/${token}/cancel`, {}), onSuccess: () => booking.refetch() });
  const confirm = useMutation({ mutationFn: () => api.post(`/public/reservations/manage/${token}/confirm`, {}) });

  const [cambiando, setCambiando] = useState(false);
  const [personas, setPersonas] = useState<number | null>(null);
  const [dia, setDia] = useState('');
  const [hora, setHora] = useState('');

  const item = booking.data;
  const personasElegidas = personas ?? item?.partySize ?? 1;
  const desde = item ? plainDateInZone(new Date(), item.timezone) : '';

  /*
   * Los mismos cupos que ve quien reserva por primera vez, calculados para la cantidad de
   * personas elegida. Antes había que escribir fecha y hora a ciegas y esperar a que el servidor
   * dijera que no; ahora solo se puede elegir lo que existe.
   */
  const disponibles = useQuery<{ slots: Slot[]; pausedUntil?: string }>({
    queryKey: ['management-slots', item?.publicSlug, desde, personasElegidas, item?.serviceId, item?.resourceId],
    queryFn: () => api.get(`/public/reservations/${item!.publicSlug}/slots?${new URLSearchParams({
      from: desde, days: String(DIAS_A_LA_VISTA), partySize: String(personasElegidas),
      ...(item?.serviceId ? { serviceId: item.serviceId } : {}), ...(item?.resourceId ? { resourceId: item.resourceId } : {}),
    })}`),
    enabled: Boolean(cambiando && item?.publicSlug),
    staleTime: 30_000,
  });

  const porDia = useMemo(() => {
    const mapa = new Map<string, Slot[]>();
    for (const slot of disponibles.data?.slots ?? []) {
      if (slot.available < 1 || !item) continue;
      const clave = plainDateInZone(new Date(slot.startsAt), item.timezone);
      mapa.set(clave, [...(mapa.get(clave) ?? []), slot]);
    }
    return mapa;
  }, [disponibles.data, item]);

  const reschedule = useMutation({
    // Sin hora nueva se conserva la actual: así se puede cambiar solo la cantidad de personas.
    mutationFn: () => api.post(`/public/reservations/manage/${token}/reschedule`, { startsAt: hora || item!.startsAt, partySize: personasElegidas }),
    onSuccess: () => { setCambiando(false); setDia(''); setHora(''); setPersonas(null); booking.refetch(); },
  });

  if (booking.isLoading) return <LoadingSpinner text="Cargando tu reserva..." />;
  if (booking.error || !item) return <main className="public-booking-error"><h1>Enlace no disponible</h1><p>Puede haber vencido o ya no estar vigente.</p></main>;

  // El servidor explica por qué no pudo: que la agenda está en pausa, que ese horario ya no
  // existe o que la reserva dejó de admitir cambios. Un texto genérico obligaba a adivinar.
  const fallo = reschedule.error || cancel.error || confirm.error;
  const motivoDelError = fallo instanceof Error && fallo.message ? fallo.message : fallo ? 'No se pudo guardar el cambio. Revisa que el horario siga disponible.' : '';
  const formatoHora = (iso: string) => new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: item.timezone });
  const formatoDia = (clave: string) => new Date(`${clave}T12:00:00Z`).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const maximo = item.maxPartySize ?? 8;
  const hayCambio = Boolean(hora) || personasElegidas !== item.partySize;

  return <main className="public-booking"><section className="booking-success">
    {item.localName && <span className="page-eyebrow">{item.localName}</span>}
    <h1>Gestiona tu reserva</h1>
    <p><strong>{item.referenceCode}</strong></p>
    <p>{item.guestName} · {item.partySize} persona{item.partySize === 1 ? '' : 's'}</p>
    <p className="success-datetime">{new Date(item.startsAt).toLocaleString('es-CL', { dateStyle: 'full', timeStyle: 'short', timeZone: item.timezone })}</p>
    {item.guestConfirmedAt && <p className="success-text">Asistencia confirmada el {new Date(item.guestConfirmedAt).toLocaleString('es-CL', { timeZone: item.timezone })}.</p>}
    {item.status === 'cancelled_client' ? <p>Tu reserva fue cancelada y el cupo quedó liberado.</p> : item.canCancel ? <div className="success-actions">
      {confirm.isSuccess || item.guestConfirmedAt ? <p className="success-text">Confirmaste tu asistencia. ¡Te esperamos!</p> : <button className="btn btn-primary" disabled={confirm.isPending} onClick={() => confirm.mutate()}>{confirm.isPending ? 'Confirmando...' : 'Confirmar asistencia'}</button>}
      {item.canReschedule && !cambiando && <button type="button" className="btn btn-outline" onClick={() => setCambiando(true)}>Cambiar hora o personas</button>}
      {item.canReschedule && cambiando && <form className="reschedule-form reschedule-form-stack" onSubmit={(event) => { event.preventDefault(); if (hayCambio) reschedule.mutate(); }}>
        <label>¿Cuántas personas vienen?
          <select className="input" value={personasElegidas} onChange={(event) => { setPersonas(Number(event.target.value)); setHora(''); }}>
            {Array.from({ length: maximo }, (_, index) => index + 1).map((n) => <option key={n} value={n}>{n} persona{n === 1 ? '' : 's'}</option>)}
          </select>
          <small>Para más de {maximo} personas escribe al local: los grupos grandes se coordinan con el equipo.</small>
        </label>
        {!item.publicSlug ? null : disponibles.isLoading ? <p className="page-subtitle">Buscando horarios disponibles...</p>
          : disponibles.data?.pausedUntil ? <p className="page-subtitle">El local no está recibiendo cambios de horario por ahora.</p>
          : porDia.size === 0 ? <p className="page-subtitle">No quedan horarios para {personasElegidas} persona{personasElegidas === 1 ? '' : 's'} en los próximos {DIAS_A_LA_VISTA} días. Puedes mantener tu hora actual.</p>
          : <>
            <label>Nuevo día (opcional)
              <select className="input" value={dia} onChange={(event) => { setDia(event.target.value); setHora(''); }}>
                <option value="">Mantener mi día y hora actuales</option>
                {[...porDia.keys()].map((clave) => <option key={clave} value={clave}>{formatoDia(clave)}</option>)}
              </select>
            </label>
            {dia && <div className="reschedule-slots" role="group" aria-label="Horarios disponibles">
              {(porDia.get(dia) ?? []).map((slot) => <button type="button" key={slot.startsAt} className={`btn btn-sm ${hora === slot.startsAt ? 'btn-primary' : 'btn-outline'}`} aria-pressed={hora === slot.startsAt} onClick={() => setHora(slot.startsAt)}>{formatoHora(slot.startsAt)}</button>)}
            </div>}
          </>}
        <div className="success-actions">
          <button className="btn btn-primary" disabled={!hayCambio || reschedule.isPending}>{reschedule.isPending ? 'Guardando...' : 'Guardar cambio'}</button>
          <button type="button" className="btn btn-outline" onClick={() => { setCambiando(false); setDia(''); setHora(''); setPersonas(null); reschedule.reset(); }}>Volver</button>
        </div>
      </form>}
      <button className="btn btn-outline" disabled={cancel.isPending} onClick={() => { if (window.confirm('¿Cancelar esta reserva? El cupo quedará disponible.')) cancel.mutate(); }}>{cancel.isPending ? 'Cancelando...' : 'Cancelar reserva'}</button>
    </div> : <p>Esta reserva ya no admite cambios en línea.</p>}
    {motivoDelError && <p className="error-text">{motivoDelError}</p>}
  </section></main>;
}
