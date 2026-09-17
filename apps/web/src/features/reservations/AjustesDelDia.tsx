import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { puedeAccion } from '../../core/acciones';
import { Modal } from '../../shared/Modal';
import type { ReservationForm } from './types';

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

interface Zona { id: string; name?: string; active?: boolean }

export function AjustesDelDia({ abierto, onCerrar, local, base = '/reservations' }: Props) {
  const queryClient = useQueryClient();
  const design = (local.designConfig ?? {}) as Record<string, string | undefined>;
  const zonas = ((local.resourcesConfig ?? []) as Zona[]).filter((zona) => zona.id);

  const [cupoPorFranja, setCupoPorFranja] = useState('');
  const [topeDelDia, setTopeDelDia] = useState('');
  const [tolerancia, setTolerancia] = useState('');
  const [aviso, setAviso] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [zonasActivas, setZonasActivas] = useState<string[]>([]);
  const [diaCerrado, setDiaCerrado] = useState('');
  const [guardado, setGuardado] = useState(false);

  // Al abrir se parte de lo que hay guardado: la ventana puede quedar montada entre aperturas y
  // conservar lo que alguien escribió y no confirmó.
  useEffect(() => {
    if (!abierto) return;
    setCupoPorFranja(String(local.capacityPerSlot ?? ''));
    setTopeDelDia(String(local.dailyCapacity ?? 0));
    setTolerancia(String(design.toleranciaMinutos || ''));
    setAviso(String(design.notasDelLocal || ''));
    setWhatsapp(String(design.whatsappBusinessNumber || ''));
    setZonasActivas(zonas.filter((zona) => zona.active !== false).map((zona) => zona.id));
    setDiaCerrado('');
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

  const cerrarDia = useMutation({
    mutationFn: (dia: string) => api.post(`/reservations/forms/${local.id}/blocks`, {
      startsAt: `${dia}T00:00`, endsAt: `${dia}T23:59`, reason: 'Cierre de día completo',
    }),
    onSuccess: () => { refrescar(); setDiaCerrado(''); },
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
    if (whatsapp.trim() !== String(design.whatsappBusinessNumber || '').trim()) cambios.whatsappBusinessNumber = whatsapp.trim();
    const activasAhora = zonas.filter((zona) => zona.active !== false).map((zona) => zona.id);
    if (zonas.length > 0 && (activasAhora.length !== zonasActivas.length || activasAhora.some((id) => !zonasActivas.includes(id)))) cambios.zonasActivas = zonasActivas;
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
            <input className="input" type="datetime-local" aria-label="Pausar hasta" onChange={(evento) => evento.target.value && pausa.mutate(evento.target.value)} />
            <small>Elige hasta cuándo para pausar.</small></p>}
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
      </section>

      {zonas.length > 0 && <section className="ajustes-bloque">
        <h3>Zonas que reciben hoy</h3>
        <div className="ajustes-zonas">
          {zonas.map((zona) => <label key={zona.id} className="toggle-row">
            <input
              type="checkbox"
              checked={zonasActivas.includes(zona.id)}
              onChange={(evento) => setZonasActivas((actuales) => (evento.target.checked ? [...actuales, zona.id] : actuales.filter((id) => id !== zona.id)))}
            /> {zona.name || zona.id}
          </label>)}
        </div>
        <small>Apagar una zona no la borra: deja de ofrecerse mientras esté apagada.</small>
      </section>}

      <section className="ajustes-bloque">
        <h3>Lo que ve quien reserva</h3>
        <label>Aviso antes de reservar
          <small>Estacionamiento, vestimenta, avisos del día. Vacío no muestra nada.</small>
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
        <h3>Cerrar un día</h3>
        <div className="ajustes-grid">
          <label>Fecha
            <input className="input" type="date" value={diaCerrado} onChange={(evento) => setDiaCerrado(evento.target.value)} />
          </label>
          <button type="button" className="btn btn-outline" disabled={!diaCerrado || cerrarDia.isPending} onClick={() => cerrarDia.mutate(diaCerrado)}>
            {cerrarDia.isPending ? 'Cerrando...' : 'Cerrar ese día'}
          </button>
        </div>
        <small>Se deja de ofrecer horarios ese día. Las reservas ya tomadas no se cancelan solas.</small>
        {cerrarDia.error && <p className="error-text">{cerrarDia.error.message}</p>}
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
