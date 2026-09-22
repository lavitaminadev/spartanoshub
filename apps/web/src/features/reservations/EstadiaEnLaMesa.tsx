import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import type { Reservation } from './types';

/**
 * @fileoverview Cuánto se queda en la mesa quien ya llegó.
 *
 * El lugar de una reserva asistida se libera a su hora de fin. «Se fue» la adelanta a ahora y
 * deja el lugar libre para reservar; «Sigue en la mesa» la alarga media hora. Si nadie marca
 * nada, el sistema la da por terminada cuando cierra el local, y así lo dice.
 */

/** Pasado este margen desde el fin, la estadía es de otro día y los botones ya no ayudan. */
const MARGEN_PARA_MARCAR_MS = 12 * 3_600_000;

interface Props {
  reserva: Reservation;
  zonaHoraria?: string;
  onCambio: (reserva: Reservation) => void;
}

const hora = (valor: string | Date, zonaHoraria?: string) =>
  new Date(valor).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zonaHoraria });

export function EstadiaEnLaMesa({ reserva, zonaHoraria, onCambio }: Props) {
  const queryClient = useQueryClient();
  const [sobreCupo, setSobreCupo] = useState(false);
  const marcar = useMutation({
    mutationFn: (accion: 'se_fue' | 'sigue') => api.post<{ reserva: Reservation; sobreCupo: boolean }>(`/reservations/${reserva.id}/salida`, { accion }),
    onSuccess: (respuesta) => {
      setSobreCupo(respuesta.sobreCupo);
      void queryClient.invalidateQueries({ queryKey: ['reservations'] });
      void queryClient.invalidateQueries({ queryKey: ['agenda-reservations'] });
      void queryClient.invalidateQueries({ queryKey: ['reservation-history', reserva.id] });
      onCambio(respuesta.reserva);
    },
  });

  if (reserva.status !== 'attended') return null;

  if (reserva.leftAt) {
    return <div className="estadia-en-la-mesa is-cerrada">
      <span className="page-eyebrow">ESTADÍA</span>
      {reserva.departureSource === 'local_closed'
        ? <p><strong>Cerrada por el sistema a las {hora(reserva.leftAt, zonaHoraria)}.</strong> Nadie marcó la salida y se tomó esa hora como máximo: no es la hora real en que se fue.</p>
        : <p><strong>Se fue a las {hora(reserva.leftAt, zonaHoraria)}.</strong> El lugar quedó libre desde entonces.</p>}
    </div>;
  }

  const fin = reserva.endsAt ? new Date(reserva.endsAt) : null;
  if (!fin || Date.now() > fin.getTime() + MARGEN_PARA_MARCAR_MS) return null;
  const yaPaso = Date.now() > fin.getTime();

  return <div className="estadia-en-la-mesa">
    <span className="page-eyebrow">ESTADÍA</span>
    <p>
      <strong>En la mesa.</strong>{' '}
      {yaPaso
        ? <>Su lugar se liberó a las {hora(fin, zonaHoraria)}. Si siguen sentados, alárgala para que no se vuelva a ofrecer.</>
        : <>El lugar se libera a las {hora(fin, zonaHoraria)}.</>}
    </p>
    <div className="estadia-acciones">
      <button type="button" className="btn btn-primary btn-sm" disabled={marcar.isPending} onClick={() => marcar.mutate('se_fue')}>Se fue</button>
      <button type="button" className="btn btn-outline btn-sm" disabled={marcar.isPending} onClick={() => marcar.mutate('sigue')}>Sigue en la mesa · +30 min</button>
    </div>
    {sobreCupo && <p className="estadia-aviso">Alargarla puede dejar esa franja sobre el cupo: revisa las reservas que vienen.</p>}
    {marcar.error && <p className="error-text">{marcar.error instanceof Error ? marcar.error.message : 'No se pudo guardar. Inténtalo otra vez.'}</p>}
  </div>;
}
