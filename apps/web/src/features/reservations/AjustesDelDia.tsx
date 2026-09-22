import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { puedeAccion } from '../../core/acciones';
import { Modal } from '../../shared/Modal';
import type { Reservation, ReservationForm } from './types';

/**
 * @fileoverview Lo que se cambia el mismo día, sin entrar al constructor.
 *
 * Bajar el cupo de esta noche, avisar de una obra en la calle o apagar la terraza obligaba a
 * abrir la configuración completa y recorrerla. Además, quien podía abrirla podía cambiar también
 * los campos, los textos legales, la medición y la publicación: no había forma de dejar lo chico
 * en manos de quien atiende sin dejarle lo grande.
 *
 * Se guarda por su propia ruta y mandando sólo lo tocado. El constructor guarda su borrador
 * entero, así que mandar desde aquí una copia vieja del resto revertiría lo que se hubiera
 * guardado allí mientras esta ventana estaba abierta.
 */

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  local: ReservationForm;
  /** Raíz del módulo: cambia entre el panel del equipo y el portal de la empresa. */
  base?: string;
}

interface Zona { id: string; name?: string; active?: boolean; capacity?: number }
interface Cierre { id: string; startsAt: string; endsAt: string; reason?: string }

/** Estados que ocupan cupo: las que todavía van a llegar. */
/** Lo que cuenta contra el tope del día, igual que en el servidor: las activas y quienes ya llegaron. */
const ACTIVAS = ['pending', 'confirmed', 'rescheduled', 'attended'];

/** Un día local, en los límites que entiende el listado: de 00:00 a 23:59 en la hora del navegador. */
function rangoDelDia(dia: string, desde = '00:00', hasta = '23:59'): { from: string; to: string } {
  return { from: new Date(`${dia}T${desde}`).toISOString(), to: new Date(`${dia}T${hasta}`).toISOString() };
}

function hoyLocal(): string {
  const ahora = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;
}

/** WhatsApp con el aviso ya escrito, editable antes de enviarlo. */
function whatsappDeAviso(reserva: Reservation): string | null {
  const digitos = (reserva.guestPhone ?? '').replace(/\D/g, '');
  if (digitos.length < 8) return null;
  const numero = digitos.length === 9 ? `56${digitos}` : digitos.length === 8 ? `569${digitos}` : digitos;
  const cuando = new Date(reserva.startsAt).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' });
  const mensaje = `Hola ${reserva.guestName.trim().split(/\s+/)[0]}, te escribimos por tu reserva del ${cuando}: tuvimos que cerrar ese horario. ¿Te podemos ofrecer otra hora?`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

/**
 * El momento en que vuelve a abrir mañana, en la hora del navegador.
 *
 * Pausar «hasta mañana» es lo que de verdad se pide cuando se corta el agua o el local se llenó,
 * y obligar a entender un selector de fecha y hora para eso convertía un gesto en un trámite.
 */
function hastaManana(): string {
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  manana.setHours(6, 0, 0, 0);
  const dosDigitos = (valor: number) => String(valor).padStart(2, '0');
  return `${manana.getFullYear()}-${dosDigitos(manana.getMonth() + 1)}-${dosDigitos(manana.getDate())}T06:00`;
}

/** Un cierre de día entero se escribió como 00:00–23:59; decirlo así se lee mejor que dos horas. */
function comoSeLee(cierre: Cierre): string {
  const desde = new Date(cierre.startsAt);
  const hasta = new Date(cierre.endsAt);
  const dia = desde.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short' });
  const todoElDia = desde.getHours() === 0 && desde.getMinutes() === 0 && hasta.getHours() === 23;
  if (todoElDia) return `${dia} · todo el día`;
  const hora = (fecha: Date) => fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  return `${dia} · ${hora(desde)} a ${hora(hasta)}`;
}

export function AjustesDelDia({ abierto, onCerrar, local, base = '/reservations' }: Props) {
  const queryClient = useQueryClient();
  const design = (local.designConfig ?? {}) as Record<string, string | undefined>;
  const zonas = ((local.resourcesConfig ?? []) as Zona[]).filter((zona) => zona.id);

  const [cupoPorFranja, setCupoPorFranja] = useState('');
  const [topeDelDia, setTopeDelDia] = useState('');
  const [tolerancia, setTolerancia] = useState('');
  const [aviso, setAviso] = useState('');
  const [estacionamiento, setEstacionamiento] = useState('');
  const [muestraEstacionamiento, setMuestraEstacionamiento] = useState(false);
  const [whatsapp, setWhatsapp] = useState('');
  const [zonasActivas, setZonasActivas] = useState<string[]>([]);
  const [cuposZona, setCuposZona] = useState<Record<string, string>>({});
  const [diaCerrado, setDiaCerrado] = useState('');
  const [desdeLaHora, setDesdeLaHora] = useState('');
  const [hastaLaHora, setHastaLaHora] = useState('');
  const [guardado, setGuardado] = useState(false);
  const [motivoDelCierre, setMotivoDelCierre] = useState('');

  // Al abrir se parte de lo que hay guardado: la ventana puede quedar montada entre aperturas y
  // conservar lo que alguien escribió y no confirmó.
  useEffect(() => {
    if (!abierto) return;
    setCupoPorFranja(String(local.capacityPerSlot ?? ''));
    setTopeDelDia(String(local.dailyCapacity ?? 0));
    setTolerancia(String(design.toleranciaMinutos || ''));
    setAviso(String(design.notasDelLocal || ''));
    setEstacionamiento(String(design.estacionamiento || ''));
    setMuestraEstacionamiento(Boolean(String(design.estacionamiento || '').trim()) && design.estacionamientoVisible !== 'false');
    setWhatsapp(String(design.whatsappBusinessNumber || ''));
    setZonasActivas(zonas.filter((zona) => zona.active !== false).map((zona) => zona.id));
    setCuposZona(Object.fromEntries(zonas.map((zona) => [zona.id, zona.capacity ? String(zona.capacity) : ''])));
    setDiaCerrado('');
    setDesdeLaHora('');
    setHastaLaHora('');
    setGuardado(false);
    // `local` cambia de identidad en cada refetch; basta con reaccionar a abrir y a cambiar de local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, local.id]);

  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: ['reservation-form', local.id] });
    void queryClient.invalidateQueries({ queryKey: ['reservation-forms'] });
    void queryClient.invalidateQueries({ queryKey: ['reservation-locals'] });
  };

  const guardar = useMutation({
    mutationFn: (cambios: Record<string, unknown>) => api.patch<ReservationForm>(`/reservations/forms/${local.id}/operacion`, cambios),
    onSuccess: () => { refrescar(); setGuardado(true); },
  });

  const pausa = useMutation({
    mutationFn: (until: string) => api.patch<ReservationForm>(`/reservations/forms/${local.id}/pause`, { until }),
    onSuccess: refrescar,
  });

  /*
   * Lo que hoy no se atiende, y cómo deshacerlo.
   *
   * Cerrar el día entero era lo único posible, cuando lo habitual es un tramo —«hoy después de
   * las 22:00 no» o «de 15 a 17 por mantención»—. Y una vez cerrado no había forma de volver
   * atrás desde aquí: quien opera el turno es justamente quien más necesita poder equivocarse.
   */
  const { data: cierres = [], refetch: recargarCierres } = useQuery<Cierre[]>({
    queryKey: ['reservation-blocks', local.id],
    queryFn: () => api.get(`/reservations/forms/${local.id}/blocks`),
    enabled: abierto,
  });

  const cerrarDia = useMutation({
    mutationFn: ({ dia, desde, hasta }: { dia: string; desde: string; hasta: string }) => api.post(`/reservations/forms/${local.id}/blocks`, {
      startsAt: `${dia}T${desde || '00:00'}`,
      endsAt: `${dia}T${hasta || '23:59'}`,
      reason: desde || hasta ? 'Cierre por tramo' : 'Cierre de día completo',
    }),
    onSuccess: () => { refrescar(); void recargarCierres(); setDiaCerrado(''); setDesdeLaHora(''); setHastaLaHora(''); },
  });

  const quitarCierre = useMutation({
    mutationFn: (id: string) => api.delete(`/reservations/blocks/${id}`),
    onSuccess: () => { refrescar(); void recargarCierres(); },
  });

  /*
   * Cuántas personas ya vienen hoy.
   *
   * Bajar el cupo a 18 cuando ya hay 22 confirmadas no las echa, pero quien opera el turno no tiene
   * ese número en la cabeza como el dueño. Decirlo junto al campo evita decidir a ciegas.
   */
  const hoy = hoyLocal();
  const { data: reservasDeHoy } = useQuery<{ data: Reservation[] }>({
    queryKey: ['reservas-del-dia', local.id, hoy],
    queryFn: () => api.get(`/reservations?${new URLSearchParams({ formId: local.id, ...rangoDelDia(hoy), pageSize: '200' })}`),
    enabled: abierto,
  });
  const personasHoy = (reservasDeHoy?.data ?? []).filter((item) => ACTIVAS.includes(item.status)).reduce((total, item) => total + item.partySize, 0);
  const topeNuevo = Number(topeDelDia);

  /*
   * A quién afecta el cierre que se está por hacer.
   *
   * El servidor no deja cerrar un rato con reservas dentro —con razón: esa gente llegaría a la
   * puerta—, pero la ventana sólo mostraba el error después de intentarlo, sin decir quiénes eran
   * ni cómo resolverlo. Ahora se ven antes, con cómo avisarles y cómo cancelarlas.
   */
  const { data: reservasDelCierre, refetch: recargarAfectadas } = useQuery<{ data: Reservation[] }>({
    queryKey: ['reservas-del-cierre', local.id, diaCerrado, desdeLaHora, hastaLaHora],
    queryFn: () => api.get(`/reservations?${new URLSearchParams({ formId: local.id, ...rangoDelDia(diaCerrado, desdeLaHora || '00:00', hastaLaHora || '23:59'), pageSize: '200' })}`),
    enabled: abierto && Boolean(diaCerrado),
  });
  const afectadas = (reservasDelCierre?.data ?? []).filter((item) => ACTIVAS.includes(item.status));

  const cancelarReserva = useMutation({
    mutationFn: (reserva: Reservation) => api.patch(`/reservations/${reserva.id}`, { status: 'cancelled_business', cancellationReason: motivoDelCierre.trim() }),
    onSuccess: () => { void recargarAfectadas(); void queryClient.invalidateQueries({ queryKey: ['reservations'] }); },
  });

  const pausadaHasta = design.bookingPausedUntil && new Date(design.bookingPausedUntil) > new Date() ? design.bookingPausedUntil : '';

  const enviar = () => {
    const cambios: Record<string, unknown> = {};
    const cupo = Number(cupoPorFranja);
    if (Number.isInteger(cupo) && cupo > 0 && cupo !== local.capacityPerSlot) cambios.capacityPerSlot = cupo;
    const tope = Number(topeDelDia);
    if (Number.isInteger(tope) && tope >= 0 && tope !== (local.dailyCapacity ?? 0)) cambios.dailyCapacity = tope;
    const espera = Number(tolerancia || 0);
    if (Number.isInteger(espera) && espera >= 0 && String(espera) !== String(design.toleranciaMinutos || '0')) cambios.toleranciaMinutos = espera;
    if (aviso.trim() !== String(design.notasDelLocal || '').trim()) cambios.notasDelLocal = aviso.trim();
    if (estacionamiento.trim() !== String(design.estacionamiento || '').trim()) cambios.estacionamiento = estacionamiento.trim();
    const mostrabaEstacionamiento = Boolean(String(design.estacionamiento || '').trim()) && design.estacionamientoVisible !== 'false';
    if (muestraEstacionamiento !== mostrabaEstacionamiento) cambios.estacionamientoVisible = muestraEstacionamiento;
    if (whatsapp.trim() !== String(design.whatsappBusinessNumber || '').trim()) cambios.whatsappBusinessNumber = whatsapp.trim();
    const activasAhora = zonas.filter((zona) => zona.active !== false).map((zona) => zona.id);
    if (zonas.length > 0 && (activasAhora.length !== zonasActivas.length || activasAhora.some((id) => !zonasActivas.includes(id)))) cambios.zonasActivas = zonasActivas;
    const cuposCambiados = Object.fromEntries(zonas
      .map((zona) => [zona.id, Number(cuposZona[zona.id])] as const)
      .filter(([id, valor]) => Number.isInteger(valor) && valor > 0 && valor !== zonas.find((zona) => zona.id === id)?.capacity));
    if (Object.keys(cuposCambiados).length > 0) cambios.cuposPorZona = cuposCambiados;
    if (Object.keys(cambios).length === 0) { onCerrar(); return; }
    guardar.mutate(cambios);
  };

  const puedeConfigurar = puedeAccion(useAuth.getState().user, 'reservations.configurar');

  return <Modal open={abierto} onClose={onCerrar} title={`Ajustes del día · ${local.name}`}>
    <div className="ajustes-del-dia">
      <p className="page-subtitle">Lo que cambia hoy. El horario semanal, los campos y la publicación se configuran aparte.</p>

      <section className="ajustes-bloque">
        <h3>Reservas abiertas</h3>
        {pausadaHasta
          ? <p className="ajustes-pausa is-pausada">Pausadas hasta {new Date(pausadaHasta).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}
            <button type="button" className="btn btn-outline btn-sm" disabled={pausa.isPending} onClick={() => pausa.mutate('')}>Reanudar</button></p>
          : <p className="ajustes-pausa">Recibiendo reservas
            {/* El caso real es «no más por hoy»: entenderlo no debería costar un calendario. */}
            <button type="button" className="btn btn-outline btn-sm" disabled={pausa.isPending} onClick={() => pausa.mutate(hastaManana())}>No más por hoy</button>
            <input className="input" type="datetime-local" aria-label="Pausar hasta" onChange={(evento) => evento.target.value && pausa.mutate(evento.target.value)} />
            <small>O elige hasta cuándo.</small></p>}
        {pausa.error && <p className="error-text">{pausa.error.message}</p>}
      </section>

      <section className="ajustes-bloque">
        <h3>Cupos</h3>
        <div className="ajustes-grid">
          <label>Personas por franja
            <input className="input" type="number" min="1" max="500" value={cupoPorFranja} onChange={(evento) => setCupoPorFranja(evento.target.value)} />
          </label>
          <label>Tope del día
            <small>Cero es sin tope propio.</small>
            <input className="input" type="number" min="0" max="5000" value={topeDelDia} onChange={(evento) => setTopeDelDia(evento.target.value)} />
          </label>
        </div>
        <p className="ajustes-hoy">Hoy vienen <strong>{personasHoy}</strong> {personasHoy === 1 ? 'persona' : 'personas'}{topeNuevo > 0 ? ` de un tope de ${topeNuevo}` : ''}.</p>
        {topeNuevo > 0 && personasHoy > topeNuevo && <p className="ajustes-alerta">El tope queda por debajo de lo que ya está reservado hoy: no se cancela a nadie, pero no entran reservas nuevas.</p>}
      </section>

      {zonas.length > 0 && <section className="ajustes-bloque">
        <h3>Zonas que reciben hoy</h3>
        <div className="ajustes-zonas">
          {zonas.map((zona) => <div key={zona.id} className="ajustes-zona"><label className="toggle-row">
            <input
              type="checkbox"
              checked={zonasActivas.includes(zona.id)}
              onChange={(evento) => setZonasActivas((actuales) => (evento.target.checked ? [...actuales, zona.id] : actuales.filter((id) => id !== zona.id)))}
            /> {zona.name || zona.id}</label>
            <label className="ajustes-zona-cupo">
              <input
                className="input"
                type="number"
                min={1}
                max={500}
                aria-label={`Personas por franja en ${zona.name || zona.id}`}
                placeholder={String(local.capacityPerSlot ?? '')}
                value={cuposZona[zona.id] ?? ''}
                disabled={!zonasActivas.includes(zona.id)}
                onChange={(evento) => setCuposZona((actuales) => ({ ...actuales, [zona.id]: evento.target.value }))}
              />
              <span>por franja</span>
            </label>
          </div>)}
        </div>
        {(() => {
          const suma = zonas.filter((zona) => zonasActivas.includes(zona.id)).reduce((total, zona) => total + (Number(cuposZona[zona.id]) || Number(cupoPorFranja) || 0), 0);
          const general = Number(cupoPorFranja) || 0;
          return suma > 0 && general > 0 && suma !== general
            ? <p className="ajustes-hoy">Las zonas encendidas suman <strong>{suma}</strong> por franja; el local recibe como máximo <strong>{general}</strong> en total{suma > general ? ', así que no se llenarán todas a la vez' : ', así que el cupo general nunca se completa'}.</p>
            : null;
        })()}
        <small>Cada zona se llena hasta su cupo, y todas juntas hasta el del local. Vacío usa el del local. Apagar una zona no la borra: deja de ofrecerse mientras esté apagada.</small>
      </section>}

      <section className="ajustes-bloque">
        <h3>Lo que ve quien reserva</h3>
        {/*
          * Estacionamiento, con su propio interruptor.
          *
          * Escrito dentro del aviso no se sabía si se mostraba. Escribir lo enciende, borrarlo lo
          * apaga, y se puede apagar a mano sin perder el texto para el día que vuelva a abrir.
          */}
        <div className="ajustes-estacionamiento">
          <label className="toggle-row">
            <input type="checkbox" checked={muestraEstacionamiento} disabled={!estacionamiento.trim()} onChange={(evento) => setMuestraEstacionamiento(evento.target.checked)} />
            Mostrar estacionamiento
          </label>
          <input
            className="input"
            maxLength={200}
            aria-label="Estacionamiento"
            placeholder="Ej.: convenio en Calle 123, 2 horas gratis"
            value={estacionamiento}
            onChange={(evento) => {
              const texto = evento.target.value;
              if (!estacionamiento.trim() && texto.trim()) setMuestraEstacionamiento(true);
              if (!texto.trim()) setMuestraEstacionamiento(false);
              setEstacionamiento(texto);
            }}
          />
          <small>{muestraEstacionamiento ? 'Se muestra en la página, antes de elegir la hora.' : estacionamiento.trim() ? 'Apagado: no se muestra, pero el texto queda guardado.' : 'Sin texto no se muestra nada.'}</small>
        </div>
        <label>Aviso antes de reservar
          <small>Vestimenta, avisos del día. Vacío no muestra nada.</small>
          <textarea className="input" rows={3} maxLength={400} value={aviso} onChange={(evento) => setAviso(evento.target.value)} />
        </label>
        <div className="ajustes-grid">
          <label>Tolerancia de llegada (min)
            <input className="input" type="number" min="0" max="120" step="5" value={tolerancia} onChange={(evento) => setTolerancia(evento.target.value)} />
          </label>
          <label>WhatsApp del local
            <input className="input" value={whatsapp} onChange={(evento) => setWhatsapp(evento.target.value)} />
          </label>
        </div>
      </section>

      <section className="ajustes-bloque">
        <h3>Cerrar un día o un tramo</h3>
        <div className="ajustes-grid ajustes-grid-cierre">
          <label>Fecha
            <input className="input" type="date" value={diaCerrado} onChange={(evento) => setDiaCerrado(evento.target.value)} />
          </label>
          <label>Desde <small>(opcional)</small>
            <input className="input" type="time" value={desdeLaHora} onChange={(evento) => setDesdeLaHora(evento.target.value)} />
          </label>
          <label>Hasta <small>(opcional)</small>
            <input className="input" type="time" value={hastaLaHora} onChange={(evento) => setHastaLaHora(evento.target.value)} />
          </label>
        </div>
        <button type="button" className="btn btn-outline" disabled={!diaCerrado || cerrarDia.isPending || afectadas.length > 0} onClick={() => cerrarDia.mutate({ dia: diaCerrado, desde: desdeLaHora, hasta: hastaLaHora })}>
          {cerrarDia.isPending ? 'Cerrando...' : desdeLaHora || hastaLaHora ? 'Cerrar ese tramo' : 'Cerrar el día completo'}
        </button>
        {diaCerrado && afectadas.length === 0 && <small>No hay reservas en ese rato: se puede cerrar.</small>}
        {afectadas.length > 0 && <div className="ajustes-afectadas">
          <strong>{afectadas.length} {afectadas.length === 1 ? 'reserva tiene' : 'reservas tienen'} hora en ese rato</strong>
          <small>Para cerrarlo, primero avísales y cancélalas —o reagéndalas desde su ficha—. Si no, llegarían a la puerta.</small>
          <label>Motivo que se les enviará
            <input className="input" maxLength={300} value={motivoDelCierre} onChange={(evento) => setMotivoDelCierre(evento.target.value)} placeholder="Ej. el local cierra por un evento privado" />
          </label>
          <ul>
            {afectadas.map((reserva) => <li key={reserva.id}>
              <span>{new Date(reserva.startsAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} · {reserva.guestName} · {reserva.partySize} {reserva.partySize === 1 ? 'persona' : 'personas'}</span>
              <span className="ajustes-afectadas-acciones">
                {(() => { const wsp = whatsappDeAviso(reserva); return wsp ? <a className="btn btn-outline btn-sm" href={wsp} target="_blank" rel="noopener noreferrer">Avisar</a> : null; })()}
                <button type="button" className="btn btn-outline btn-sm" disabled={!motivoDelCierre.trim() || cancelarReserva.isPending} onClick={() => cancelarReserva.mutate(reserva)}>Cancelar</button>
              </span>
            </li>)}
          </ul>
          {cancelarReserva.error && <p className="error-text">{cancelarReserva.error.message}</p>}
        </div>}
        {cerrarDia.error && <p className="error-text">{cerrarDia.error.message}</p>}

        {cierres.length > 0 && <ul className="ajustes-cierres">
          {cierres.map((cierre) => <li key={cierre.id}>
            <span>{comoSeLee(cierre)}{cierre.reason ? ` · ${cierre.reason}` : ''}</span>
            <button type="button" className="btn btn-outline btn-sm" disabled={quitarCierre.isPending} onClick={() => quitarCierre.mutate(cierre.id)}>Quitar</button>
          </li>)}
        </ul>}
        {quitarCierre.error && <p className="error-text">{quitarCierre.error.message}</p>}
      </section>

      {guardar.error && <p className="error-text">{guardar.error.message}</p>}
      {guardado && !guardar.isPending && <p className="ajustes-guardado">Guardado.</p>}

      <footer className="ajustes-pie">
        {puedeConfigurar && <Link className="btn btn-outline btn-sm" to={`${base}/forms/${local.id}/design?section=disponibilidad`} onClick={onCerrar}>Configuración completa</Link>}
        <div className="ajustes-pie-acciones">
          <button type="button" className="btn btn-outline" onClick={onCerrar}>Cerrar</button>
          <button type="button" className="btn btn-primary" disabled={guardar.isPending} onClick={enviar}>{guardar.isPending ? 'Guardando...' : 'Guardar cambios'}</button>
        </div>
      </footer>
    </div>
  </Modal>;
}
