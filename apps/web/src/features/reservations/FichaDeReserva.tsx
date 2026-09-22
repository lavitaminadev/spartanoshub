import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import type { GuestHistory, Reservation, ReservationForm } from './types';
import { respuestasLegibles } from './answer-labels';
import { StatusBadge } from '../../shared/StatusBadge';
import { EstadiaEnLaMesa } from './EstadiaEnLaMesa';

/** Visitas anteriores que se muestran de entrada; el resto queda tras «Ver las N visitas». */
const VISITAS_A_LA_VISTA = 2;

/**
 * @fileoverview Los datos de una reserva, iguales se abra donde se abra.
 *
 * El mismo turno se atendía con dos fichas distintas: la de la agenda no mostraba la mesa
 * asignada, ni el cupón, ni si la persona ya había venido antes, y esa es justamente la pantalla
 * donde se recibe a la gente. Quien atendía tenía la mitad peor de las dos.
 *
 * La lista de reservas y la agenda la comparten. Lo que sólo tiene sentido en la lista —lo que
 * aceptó, la atribución de Meta, reagendar— queda en esa pantalla, debajo de esta ficha.
 */

interface Props {
  reserva: Reservation;
  local?: ReservationForm;
  /** Llamado después de guardar personas o mesa, para que la pantalla refresque su lista. */
  onGuardada?: () => void;
  /** Si se pasa, el cupón se vuelve un enlace a su detalle; sin él, sólo se muestra. */
  onVerCupon?: (codigo: string) => void;
}

export function FichaDeReserva({ reserva: recibida, local, onGuardada, onVerCupon }: Props) {
  const queryClient = useQueryClient();
  /* Marcar la salida devuelve la reserva al día; la pantalla que abrió la ficha puede tardar en refrescarla. */
  const [alDia, setAlDia] = useState<Reservation | null>(null);
  const reserva = alDia?.id === recibida.id ? alDia : recibida;
  const [verTodas, setVerTodas] = useState(false);
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
  /*
   * Lo que ya dice esta reserva no se repite como costumbre.
   *
   * «Declaró antes: sin gluten» junto a «Restricciones: sin gluten», o «Suele venir 2 personas»
   * en una reserva de 2, ocupaban la ficha sin decir nada nuevo. Se muestra sólo lo que difiere.
   */
  const yaDicho = new Set(campos.map((dato) => String(dato.valor).trim().toLowerCase()));
  const preferencias = historial?.preferencias;
  const alergiasNuevas = (preferencias?.alergias ?? []).filter((texto) => !yaDicho.has(texto.trim().toLowerCase()));
  const accesibilidadNueva = (preferencias?.accesibilidad ?? []).filter((texto) => !yaDicho.has(texto.trim().toLowerCase()));
  const zonaHabitualDistinta = preferencias?.zonaHabitual && preferencias.zonaHabitual !== reserva.resourceId ? preferencias.zonaHabitual : undefined;
  const personasDistintas = preferencias?.personasHabitual !== undefined && preferencias.personasHabitual !== reserva.partySize ? preferencias.personasHabitual : undefined;
  const otrasVeces = [preferencias?.vinoConNinos && 'vino con niños', preferencias?.usoCupon && !reserva.couponCode && 'usó cupón'].filter(Boolean).join(' · ');
  const anteriores = historial?.anteriores ?? [];
  const visitasVisibles = verTodas ? anteriores : anteriores.slice(0, VISITAS_A_LA_VISTA);

  return <div className="ficha-de-reserva">
    <div className="booking-detail-grid">
      <div><span>Visitante</span><strong>{reserva.guestName}</strong></div>
      <div><span>Contacto</span><strong>{reserva.guestPhone || reserva.guestEmail || 'Sin contacto'}</strong></div>
      <div><span>Código</span><strong>#{reserva.referenceCode}</strong></div>
      {/* En la zona del local: quien mira desde otra ciudad no debe ver la hora corrida. */}
      <div><span>Fecha</span><strong>{new Date(reserva.startsAt).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short', timeZone: local?.timezone })}</strong></div>
      <div><span>Estado</span><StatusBadge status={reserva.status} /></div>
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
      {(() => { const servicio = (local?.servicesConfig ?? []).find((item) => item.id === reserva.serviceId); return servicio ? <div><span>Servicio</span><strong>{servicio.name}</strong></div> : null; })()}
      {reserva.couponCode && <div><span>Cupón aplicado</span><strong>{onVerCupon
        ? <button type="button" className="link-button" onClick={() => onVerCupon(reserva.couponCode!)}>{reserva.couponCode}</button>
        : reserva.couponCode}</strong></div>}
    </div>
    {guardar.error && <p className="error-text">{guardar.error.message}</p>}
    <EstadiaEnLaMesa reserva={reserva} zonaHoraria={local?.timezone} onCambio={(nueva) => { setAlDia(nueva); onGuardada?.(); }} />

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
              {(historial.deOtrasReservas ?? 0) > 0 ? ` · ${historial.deOtrasReservas} en otro local de la empresa` : ''}
            </p>
            {/*
              * Lo que el equipo anotó las veces anteriores.
              *
              * «Llegó 40 minutos tarde» o «pidió mesa en el fondo» quedaba guardado en la reserva
              * de ese día y no se veía nunca más: la memoria del local se perdía en cada visita.
              */}
            {/*
              * Lo que hay que saber antes de que llegue.
              *
              * Sale de lo que ella misma completó en reservas anteriores, así que puede estar
              * desactualizado: ayuda a quien recibe, no reemplaza preguntar.
              */}
            {preferencias && <ul className="booking-preferencias">
              {preferencias.diasDesdeLaUltima !== undefined && <li><span>Última visita</span><strong>{preferencias.diasDesdeLaUltima === 0 ? 'Hoy' : `Hace ${preferencias.diasDesdeLaUltima} día${preferencias.diasDesdeLaUltima === 1 ? '' : 's'}`}</strong></li>}
              {zonaHabitualDistinta && <li><span>Suele sentarse en</span><strong>{zonas.find((item) => item.id === zonaHabitualDistinta)?.name || zonaHabitualDistinta}</strong></li>}
              {personasDistintas !== undefined && <li><span>Suele venir</span><strong>{personasDistintas} persona{personasDistintas === 1 ? '' : 's'}</strong></li>}
              {alergiasNuevas.map((texto) => <li key={texto} className="es-aviso"><span>Declaró antes</span><strong>{texto}</strong></li>)}
              {accesibilidadNueva.map((texto) => <li key={texto} className="es-aviso"><span>Accesibilidad</span><strong>{texto}</strong></li>)}
              {otrasVeces && <li><span>Otras veces</span><strong>{otrasVeces}</strong></li>}
            </ul>}
            <ul className="booking-historial">
              {visitasVisibles.map((previa) => <li key={previa.id}>{new Date(previa.startsAt).toLocaleDateString('es-CL', { dateStyle: 'medium' })} · {previa.partySize} persona{previa.partySize === 1 ? '' : 's'}{previa.mismoLocal === false ? ' · otro local' : ''} <StatusBadge status={previa.status} /></li>)}
            </ul>
            {anteriores.length > VISITAS_A_LA_VISTA && <button type="button" className="link-button ficha-ver-mas" onClick={() => setVerTodas((valor) => !valor)}>
              {verTodas ? 'Ver menos' : `Ver las ${anteriores.length} visitas`}
            </button>}
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
