import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { localInputToUtc } from './local-time';

type Managed = { referenceCode: string; guestName: string; startsAt: string; partySize: number; status: string; guestConfirmedAt?: string | null; canCancel: boolean; canReschedule: boolean; timezone: string; publicSlug: string };

export function PublicReservationManagementPage() {
  const { token = '' } = useParams();
  const booking = useQuery<Managed>({ queryKey: ['reservation-management', token], queryFn: () => api.get(`/public/reservations/manage/${token}`), retry: false });
  const cancel = useMutation({ mutationFn: () => api.post(`/public/reservations/manage/${token}/cancel`, {}) , onSuccess: () => booking.refetch() });
  const confirm = useMutation({ mutationFn: () => api.post(`/public/reservations/manage/${token}/confirm`, {}) });
  const [rescheduleAt, setRescheduleAt] = useState('');
  const reschedule = useMutation({ mutationFn: () => api.post(`/public/reservations/manage/${token}/reschedule`, { startsAt: localInputToUtc(rescheduleAt, booking.data?.timezone || 'America/Santiago') }), onSuccess: () => { setRescheduleAt(''); booking.refetch(); } });
  if (booking.isLoading) return <LoadingSpinner text="Cargando tu reserva..." />;
  if (booking.error || !booking.data) return <main className="public-booking-error"><h1>Enlace no disponible</h1><p>Puede haber vencido o ya no estar vigente.</p></main>;
  const item = booking.data;
  // El servidor explica por que no pudo: que la agenda esta en pausa, que ese horario ya no
  // existe o que la reserva dejo de admitir cambios. Un texto generico obligaba a adivinar.
  const fallo = reschedule.error || cancel.error || confirm.error;
  const motivoDelError = fallo instanceof Error && fallo.message ? fallo.message : fallo ? 'No se pudo guardar el cambio. Revisa que el horario siga disponible.' : '';

  return <main className="public-booking"><section className="booking-success"><h1>Gestiona tu reserva</h1><p><strong>{item.referenceCode}</strong></p><p>{item.guestName} · {item.partySize} persona{item.partySize === 1 ? '' : 's'}</p><p className="success-datetime">{new Date(item.startsAt).toLocaleString('es-CL', { dateStyle: 'full', timeStyle: 'short', timeZone: item.timezone })}</p>{item.guestConfirmedAt && <p className="success-text">Asistencia confirmada el {new Date(item.guestConfirmedAt).toLocaleString('es-CL')}.</p>}{item.status === 'cancelled_client' ? <p>Tu reserva fue cancelada y el cupo quedó liberado.</p> : item.canCancel ? <div className="success-actions">{confirm.isSuccess || item.guestConfirmedAt ? <p className="success-text">Confirmaste tu asistencia. ¡Te esperamos!</p> : <button className="btn btn-primary" disabled={confirm.isPending} onClick={() => confirm.mutate()}>{confirm.isPending ? 'Confirmando...' : 'Confirmar asistencia'}</button>}{item.canReschedule && <form className="reschedule-form" onSubmit={(event) => { event.preventDefault(); reschedule.mutate(); }}><label>Reagendar<input className="input" type="datetime-local" required value={rescheduleAt} onChange={(event) => setRescheduleAt(event.target.value)} />{item.publicSlug && <small>¿No sabes qué horas quedan? <Link to={`/book/${item.publicSlug}`} target="_blank" rel="noreferrer">Míralas en la página del local</Link>.</small>}</label><button className="btn btn-primary" disabled={reschedule.isPending}>{reschedule.isPending ? 'Validando...' : 'Reagendar'}</button></form>}<button className="btn btn-outline" disabled={cancel.isPending} onClick={() => { if (window.confirm('¿Cancelar esta reserva? El cupo quedará disponible.')) cancel.mutate(); }}>{cancel.isPending ? 'Cancelando...' : 'Cancelar reserva'}</button></div> : <p>Esta reserva ya no admite cambios en línea.</p>}{motivoDelError && <p className="error-text">{motivoDelError}</p>}</section></main>;
}
