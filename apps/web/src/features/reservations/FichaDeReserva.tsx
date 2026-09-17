import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import type { GuestHistory, Reservation, ReservationForm } from './types';
import { respuestasLegibles } from './answer-labels';

/**
 * @fileoverview Los datos de una reserva, iguales se abra donde se abra.
 *
 * El mismo turno se atendía con dos fichas distintas: la de la agenda no mostraba la mesa
 * asignada, ni el cupón, ni si la persona ya había venido antes, y esa es justamente la pantalla
 * donde se recibe a la gente. Quien atendía tenía la mitad peor de las dos.
 *
 * La lista de reservas todavía arma su propia ficha, con los consentimientos y la atribución de
 * Meta, que no hacen falta en el turno. Cuando esa pantalla migre a este componente, esos bloques
 * entran como secciones opcionales.
 */

interface Props {
  reserva: Reservation;
  local?: ReservationForm;
  /** Llamado después de guardar personas o mesa, para que la pantalla refresque su lista. */
  onGuardada?: () => void;
}

const ETIQUETAS_DE_ESTADO: Record<string, string> = {
  pending: 'Pendiente', confirmed: 'Confirmada', rescheduled: 'Reagendada', attended: 'Asistió',
  no_show: 'No llegó', waitlist: 'En lista de espera',
  cancelled_client: 'Cancelada por quien reservó', cancelled_business: 'Cancelada por el local',
};

export function FichaDeReserva({ reserva, local, onGuardada }: Props) {
  const queryClient = useQueryClient();
  const [personas, setPersonas] = useState(String(reserva.partySize));
  const [mesa, setMesa] = useState(reserva.tableLabel ?? '');
  const [nota, setNota] = useState(reserva.internalNotes ?? '');

  useEffect(() => {
    setPersonas(String(reserva.partySize));
    setMesa(reserva.tableLabel ?? '');
    setNota(reserva.internalNotes ?? '');
  }, [reserva.id, reserva.partySize, reserva.tableLabel, reserva.internalNotes]);

  const guardar = useMutation({
    mutationFn: (cambios: Record<string, unknown>) => api.patch(`/reservations/${reserva.id}`, cambios),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reservations'] });
      void queryClient.invalidateQueries({ queryKey: ['agenda-reservations'] });
      onGuardada?.();
    },
  });

  /* Si ya vino antes, para reconocerla al recibirla. El alcance lo decide el servidor. */
  const { data: historial } = useQuery<GuestHistory>({
    queryKey: ['guest-history', reserva.id],
    queryFn: () => api.get(`/reservations/${reserva.id}/guest-history`),
    staleTime: 60_000,
  });

  const zonas = local?.resourcesConfig ?? [];
  const zona = zonas.find((recurso) => recurso.id === reserva.resourceId);
  /*
   * Zonas a las que se puede mover.
   *
   * Las apagadas no se ofrecen porque hoy no reciben gente, pero la que ya tiene asignada se
   * muestra igual: si el local apagó su zona después de reservar, esconderla dejaría la ficha
   * diciendo que no tiene ninguna.
   */
  const zonasElegibles = zonas.filter((recurso) => recurso.active !== false || recurso.id === reserva.resourceId);
  /*
   * Todo lo que quedó guardado, no sólo los campos del formulario.
   *
   * Las preguntas de la visita —niños, alergias, fumadores, la nota que dejó— no viven en el
   * esquema del formulario: recorrer sólo los campos las dejaba fuera justo en la pantalla donde
   * se la recibe. Los rótulos salen del formulario cuando existen, y del catálogo cuando no.
   */
  const campos = respuestasLegibles(reserva.answers, local?.fieldSchema);
  const notasAnteriores = (historial?.anteriores ?? []).filter((anterior) => anterior.internalNotes?.trim());

  return <div className="ficha-de-reserva">
    <div className="booking-detail-grid">
      <div><span>Visitante</span><strong>{reserva.guestName}</strong></div>
      <div><span>Contacto</span><strong>{reserva.guestPhone || reserva.guestEmail || 'Sin contacto'}</strong></div>
      <div><span>Código</span><strong>#{reserva.referenceCode}</strong></div>
      <div><span>Estado</span><strong>{ETIQUETAS_DE_ESTADO[reserva.status] ?? reserva.status}</strong></div>
      <div><span>Personas</span>
        <div className="booking-editable">
          <input
            className="input"
            type="number"
            min={1}
            max={500}
            aria-label="Cantidad de personas"
            value={personas}
            onChange={(evento) => setPersonas(evento.target.value)}
            onBlur={() => {
              const cantidad = Number(personas);
              if (Number.isInteger(cantidad) && cantidad > 0 && cantidad !== reserva.partySize) guardar.mutate({ partySize: cantidad });
            }}
          />
        </div>
      </div>
      {/* La mesa la asigna el local: quien recibe la anota aquí, no en un papel aparte. */}
      <div><span>Mesa</span>
        <div className="booking-editable">
          <input
            className="input"
            maxLength={40}
            placeholder="Sin asignar"
            aria-label="Mesa asignada"
            value={mesa}
            onChange={(evento) => setMesa(evento.target.value)}
            onBlur={() => { if (mesa.trim() !== (reserva.tableLabel ?? '')) guardar.mutate({ tableLabel: mesa.trim() }); }}
          />
        </div>
      </div>
      {/*
        * La zona se corrige al recibir: quien reserva la elige sin conocer el local.
        *
        * Mover la reserva libera sola la zona de origen —el cupo se cuenta, no se guarda— y el
        * servidor rechaza el cambio si en la de destino no cabe.
        */}
      {zonasElegibles.length > 0 ? <div><span>Zona</span>
        <div className="booking-editable">
          <select
            className="input"
            aria-label="Zona asignada"
            value={reserva.resourceId ?? ''}
            disabled={guardar.isPending}
            onChange={(evento) => guardar.mutate({ resourceId: evento.target.value })}
          >
            <option value="">Sin zona asignada</option>
            {zonasElegibles.map((recurso) => <option key={recurso.id} value={recurso.id}>
              {recurso.name}{recurso.smokingAllowed ? ' · fumadores' : ' · no fumadores'}{recurso.active === false ? ' (apagada)' : ''}
            </option>)}
          </select>
        </div>
      </div> : zona ? <div><span>Zona</span><strong>{zona.name}{zona.smokingAllowed ? ' · fumadores' : ' · no fumadores'}</strong></div> : null}
      {reserva.couponCode && <div><span>Cupón aplicado</span><strong>{reserva.couponCode}</strong></div>}
    </div>
    {guardar.error && <p className="error-text">{guardar.error.message}</p>}

    {campos.length > 0 && <div className="booking-detail-extra">
      <span className="page-eyebrow">LO QUE COMPLETÓ AL RESERVAR</span>
      <ul className="booking-preferencias">
        {campos.map((dato) => (
          <li key={dato.clave} className={dato.destacada ? 'es-aviso' : ''}>
            <span>{dato.etiqueta}</span>
            <strong>{dato.valor}</strong>
          </li>
        ))}
      </ul>
    </div>}

    <div className="booking-detail-extra">
      <span className="page-eyebrow">QUIÉN RESERVA</span>
      {!historial ? <p className="page-subtitle">Revisando si ya reservó antes...</p>
        : historial.total === 0 ? <p className="page-subtitle">{historial.alcance === 'red' ? 'Primera vez que reserva en la empresa.' : 'Primera vez que reserva en este local.'}</p>
          : <>
            {/* Cuántas veces vino aquí y cuántas en otra reserva: son cosas distintas al recibirla. */}
            <p className="page-subtitle">
              Ya reservó {historial.total} {historial.total === 1 ? 'vez' : 'veces'} antes · {historial.attended} asistió{historial.noShow > 0 ? ` · ${historial.noShow} no llegó` : ''}
            </p>
            <p className="page-subtitle">
              {historial.enEsteLocal ?? historial.total} en este local
              {(historial.deOtrasReservas ?? 0) > 0 ? ` · ${historial.deOtrasReservas} en otra reserva de la misma empresa` : ''}
            </p>
            {/*
              * Lo que el equipo anotó las veces anteriores.
              *
              * «Llegó 40 minutos tarde» o «pidió mesa en el fondo» quedaba guardado en la reserva
              * de ese día y no se veía nunca más: la memoria del local se perdía en cada visita.
              */}
            {notasAnteriores.length > 0 && <ul className="ficha-notas-previas">
              {notasAnteriores.map((anterior) => <li key={anterior.id}>
                <span>{new Date(anterior.startsAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}{anterior.mismoLocal === false ? ' · otra reserva' : ''}</span>
                <strong>{anterior.internalNotes}</strong>
              </li>)}
            </ul>}
          </>}
    </div>

    {/*
      * La nota del equipo sobre esta visita.
      *
      * Se guardaba al anotar una reserva a mano y después no había dónde escribirla: quien recibe
      * es quien se entera de algo que hay que recordar, y no tenía dónde dejarlo.
      */}
    <div className="booking-detail-extra">
      <span className="page-eyebrow">NOTA DEL EQUIPO</span>
      <textarea
        className="input"
        rows={2}
        maxLength={2000}
        aria-label="Nota interna de esta reserva"
        placeholder="Lo que haya que recordar de esta visita. No se la mostramos a quien reservó."
        value={nota}
        onChange={(evento) => setNota(evento.target.value)}
        onBlur={() => { if (nota.trim() !== (reserva.internalNotes ?? '').trim()) guardar.mutate({ internalNotes: nota.trim() }); }}
      />
      <small>Sólo la ve el equipo. Se guarda al salir del campo y aparece la próxima vez que reserve.</small>
    </div>
  </div>;
}
