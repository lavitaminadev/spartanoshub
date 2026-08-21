/**
 * @fileoverview Ficha de un lead: sus datos, sus acciones y por dónde pasó.
 *
 * Es la **única** ficha de lead del CRM. Hasta ahora convivían dos —una por cada listado— y
 * cada una sabía hacer cosas que la otra no: esta mostraba el recorrido pero solo guardaba
 * notas, y la del listado antiguo cambiaba la etapa, convertía en cliente y registraba
 * actividad pero no enseñaba el historial. Quien abría un lead veía una ficha distinta según
 * de dónde viniera, y ninguna de las dos estaba completa.
 *
 * El historial es la mitad del valor de esta pantalla: el registro de recorrido guarda cada
 * cambio de etapa con su duración y su autor, y se muestra como una historia —de lo más
 * antiguo a lo más reciente— porque lo que se quiere saber es por dónde pasó y cuánto tardó,
 * no cuál fue lo último.
 */

import { useEffect, useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { Modal } from '../../shared/Modal';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { StatusBadge } from '../../shared/StatusBadge';
import { triggerToast } from '../../shared/toast-events';
import { ProcessCommentThread } from '../../shared/ProcessCommentThread';
import { roleLabel } from '../../core/role-labels';
import { STAGES } from './stage-labels';
import { useCrmScope } from './crm-scope';
import './lead-detail.css';

interface Lead {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  status: string;
  source?: string | null;
  sourceDetail?: string | null;
  campaignName?: string | null;
  discardReason?: string | null;
  notes?: string | null;
  assignedTo?: string | null;
  clientId?: string | null;
  estimatedAmount?: number | string | null;
  qualityScore?: number;
  fitStatus?: 'qualified' | 'review' | 'discarded';
  tags?: string[];
  consentCapturedAt?: string | null;
  convertedToClientId?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Paso {
  id: string;
  fromStage?: string | null;
  toStage: string;
  durationHours?: number | string | null;
  changedBy?: string | null;
  reason?: string | null;
  createdAt: string;
}

interface UserOption { id: string; name: string }

interface Interaccion {
  id: string;
  type: string;
  description?: string;
  date: string;
}

interface Props {
  lead: Lead;
  /** Nombre de la etapa, con el vocabulario del tablero. */
  etapaLabel: (stage: string) => string;
  /** Nombre de quien movió cada paso, resuelto por quien abre la ficha. */
  nombreDe: (id?: string | null) => string | undefined;
  onClose: () => void;
}

/** Orígenes que ya se usan, como sugerencia. No es una lista cerrada. */
const FUENTES_SUGERIDAS = ['Meta Ads', 'Google Ads', 'manual', 'importacion', 'referido', 'sitio web'];

const TIPOS_ACTIVIDAD: Array<{ value: string; label: string }> = [
  { value: 'call', label: 'Llamada' },
  { value: 'email', label: 'Correo' },
  { value: 'meeting', label: 'Reunión' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'note', label: 'Nota' },
];

/** Horas a una unidad que se lee de un vistazo. */
function duracion(horas?: number | string | null): string | null {
  const valor = Number(horas);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  if (valor < 1) return `${Math.round(valor * 60)} min`;
  if (valor < 48) return `${Math.round(valor)} h`;
  return `${Math.round(valor / 24)} días`;
}

/** Enlace de WhatsApp: `wa.me` solo acepta dígitos, sin `+` ni espacios. */
function whatsapp(telefono?: string | null): string | undefined {
  const digitos = telefono?.replace(/\D/g, '');
  return digitos ? `https://wa.me/${digitos}` : undefined;
}

/**
 * Fecha local, o un guion cuando no hay una utilizable.
 *
 * `new Date(undefined).toLocaleDateString()` devuelve «Invalid Date», que se imprimía tal cual
 * en la ficha. Un lead sin fecha de ingreso es raro pero existe —los que llegaron por vías que
 * no la escribían—, y mostrar eso parece un sistema roto en vez de un dato que falta.
 */
function fecha(valor?: string | null): string {
  if (!valor) return '—';
  const parsed = new Date(valor);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('es-CL');
}

/** Monto con formato local, o `''` cuando no hay ninguno. Vacío y cero no son lo mismo. */
function montoInicial(valor?: number | string | null): string {
  if (valor === null || valor === undefined || valor === '') return '';
  return String(Number(valor));
}

export function LeadDetailDrawer({ lead: leadInicial, nombreDe, etapaLabel, onClose }: Props): JSX.Element {
  const queryClient = useQueryClient();
  // Las cuentas que esta persona alcanza, para poder mover el lead de empresa sin una consulta
  // propia: la barra ya las tiene resueltas.
  const scope = useCrmScope();

  /*
    El lead llega ya cargado desde el listado y además se vuelve a pedir.
    No es redundante: el listado trae los campos que dibuja en la tabla, y la ficha necesita
    varios que no están ahí —puntaje, consentimiento, monto—. Usar el del listado como valor
    inicial evita el parpadeo de una ficha vacía mientras llega el detalle.
  */
  const { data: lead = leadInicial } = useQuery<Lead>({
    queryKey: ['lead', leadInicial.id],
    queryFn: () => api.get(`/crm/leads/${leadInicial.id}`),
    placeholderData: leadInicial,
  });

  const [nota, setNota] = useState(lead.notes ?? '');
  const [etapa, setEtapa] = useState(lead.status);
  const [responsable, setResponsable] = useState(lead.assignedTo ?? '');
  const [monto, setMonto] = useState(montoInicial(lead.estimatedAmount));
  const [calificacion, setCalificacion] = useState(lead.fitStatus ?? 'review');
  const [etiquetas, setEtiquetas] = useState((lead.tags ?? []).join(', '));
  const [motivo, setMotivo] = useState(lead.discardReason ?? '');
  const [tarea, setTarea] = useState({ title: '', dueAt: '' });
  const [fuente, setFuente] = useState(lead.source ?? '');
  const [empresa, setEmpresa] = useState(lead.clientId ?? '');
  const [aviso, setAviso] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [confirmarAnonimizar, setConfirmarAnonimizar] = useState(false);
  const [actividadAbierta, setActividadAbierta] = useState(false);
  const [actividad, setActividad] = useState({ type: 'call', description: '', date: '' });

  // El detalle puede llegar después del primer dibujo con valores que el listado no traía.
  // Sin esto, el monto y el responsable se quedaban en lo que mostraba la tabla.
  useEffect(() => {
    setNota(lead.notes ?? '');
    setEtapa(lead.status);
    setResponsable(lead.assignedTo ?? '');
    setMonto(montoInicial(lead.estimatedAmount));
    setCalificacion(lead.fitStatus ?? 'review');
    setEtiquetas((lead.tags ?? []).join(', '));
    setMotivo(lead.discardReason ?? '');
    setFuente(lead.source ?? '');
    setEmpresa(lead.clientId ?? '');
  }, [
    lead.id, lead.notes, lead.status, lead.assignedTo, lead.estimatedAmount,
    lead.fitStatus, lead.tags, lead.discardReason, lead.source, lead.clientId,
  ]);

  const { data: historial, isLoading } = useQuery<Paso[]>({
    queryKey: ['crm-lead-historial', lead.id],
    queryFn: () => api.get(`/crm/leads/${lead.id}/historial`),
  });

  const { data: actividades } = useQuery<{ data: Interaccion[]; total: number }>({
    queryKey: ['lead-interactions', lead.id],
    queryFn: () => api.get(`/crm/interactions?leadId=${lead.id}&limit=20`),
  });

  /**
   * Equipo al que se puede asignar el lead.
   *
   * `/users` responde a veces con el arreglo y a veces con `{ data }` según por dónde se pida,
   * y el resto de la aplicación ya lo trata así. Dar por hecho una de las dos formas hacía que
   * abrir cualquier ficha tumbara la pantalla completa con «.map is not a function».
   */
  const { data: usuariosResp } = useQuery<UserOption[] | { data: UserOption[] }>({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });
  const usuarios = Array.isArray(usuariosResp) ? usuariosResp : usuariosResp?.data ?? [];

  const refrescar = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['lead', lead.id] }),
      queryClient.invalidateQueries({ queryKey: ['crm-lead-historial', lead.id] }),
      queryClient.invalidateQueries({ queryKey: ['leads'] }),
      queryClient.invalidateQueries({ queryKey: ['crm-leads-board'] }),
    ]);
  };

  /**
   * Guarda los cuatro campos editables en una sola llamada.
   *
   * Van juntos y no en cuatro botones porque se cambian juntos: se atiende al lead, se mueve de
   * etapa, se anota lo conversado y se estima el monto en el mismo momento. Cuatro guardados
   * separados producen cuatro entradas en el recorrido para una sola conversación.
   */
  const guardar = useMutation({
    mutationFn: () => api.put(`/crm/leads/${lead.id}`, {
      notes: nota,
      status: etapa,
      // Cadena vacía significa devolverlo a la bandeja común; el servidor distingue `null` de
      // omitido justamente para permitirlo.
      assignedTo: responsable || null,
      estimatedAmount: monto === '' ? undefined : Number(monto),
      fitStatus: calificacion,
      // Se separan por coma, como en la importación, para que la misma persona escriba igual en
      // los dos sitios. Vacío limpia las etiquetas en vez de dejarlas como estaban.
      tags: etiquetas.split(',').map((t) => t.trim()).filter(Boolean),
      // Solo viaja si el lead queda descartado: un motivo guardado en un lead vivo reaparece
      // como explicación de un cierre que no ocurrió.
      discardReason: etapa === 'lost' ? motivo : '',
      source: fuente.trim(),
      // Vacío deja el lead sin cuenta, que es el estado natural de un prospecto de la agencia.
      clientId: empresa || null,
    }),
    onSuccess: async () => {
      setAviso({ tone: 'success', text: 'Ficha actualizada.' });
      await refrescar();
    },
    onError: (error: Error) => setAviso({ tone: 'error', text: error.message }),
  });

  /**
   * Tareas abiertas sobre este lead.
   *
   * Comparten módulo con las aprobaciones porque comparten forma —un pendiente con dueño y
   * fecha—; lo que las distingue es cómo se cierran. Acá se muestran las de este registro, que
   * es donde se deciden: anotar «llamar el martes» mientras se cuelga el teléfono, y no en una
   * pantalla aparte a la que hay que acordarse de entrar.
   */
  const { data: tareas } = useQuery<Array<{ id: string; title: string; status: string; dueAt?: string | null }>>({
    queryKey: ['lead-tasks', lead.id],
    queryFn: () => api.get(`/tasks/lead/${lead.id}`),
  });

  const crearTarea = useMutation({
    mutationFn: () => api.post('/tasks', {
      title: tarea.title.trim(),
      entityType: 'lead',
      entityId: lead.id,
      // La cuenta viaja cuando la hay: un prospecto de la agencia todavía no tiene cliente.
      clientId: lead.clientId || undefined,
      assignedTo: responsable || undefined,
      dueAt: tarea.dueAt ? new Date(tarea.dueAt).toISOString() : undefined,
    }),
    onSuccess: async () => {
      setTarea({ title: '', dueAt: '' });
      await queryClient.invalidateQueries({ queryKey: ['lead-tasks', lead.id] });
    },
    onError: (error: Error) => setAviso({ tone: 'error', text: error.message }),
  });

  const completarTarea = useMutation({
    mutationFn: (id: string) => api.put(`/tasks/${id}`, { status: 'done' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lead-tasks', lead.id] }),
    onError: (error: Error) => setAviso({ tone: 'error', text: error.message }),
  });

  const convertir = useMutation({
    mutationFn: () => api.post<{ client: { id: string; name: string } }>(`/crm/leads/${lead.id}/convert`),
    onSuccess: async (resultado) => {
      setAviso({ tone: 'success', text: `${resultado.client.name} quedó creado como cliente y ya puede iniciar onboarding.` });
      await Promise.all([refrescar(), queryClient.invalidateQueries({ queryKey: ['clients'] })]);
    },
    onError: (error: Error) => setAviso({ tone: 'error', text: error.message }),
  });

  /**
   * Deja constancia de que se habló con esta persona.
   *
   * Escribe la interacción y, si el lead seguía en «Nuevo», lo mueve a «Contactado». Son dos
   * cosas que siempre ocurrían juntas y que había que hacer por separado, de modo que la
   * bandeja de «sin contactar» seguía acusando a leads que ya se habían llamado.
   */
  const registrarContacto = useMutation({
    mutationFn: async () => {
      await api.post('/crm/interactions', { leadId: lead.id, type: 'call', description: 'Contacto registrado desde la ficha' });
      if (lead.status === 'new') await api.put(`/crm/leads/${lead.id}`, { status: 'contacted' });
    },
    onSuccess: async () => {
      setAviso({ tone: 'success', text: 'Contacto registrado.' });
      await Promise.all([refrescar(), queryClient.invalidateQueries({ queryKey: ['lead-interactions', lead.id] })]);
    },
    onError: (error: Error) => setAviso({ tone: 'error', text: error.message }),
  });

  const registrarActividad = useMutation({
    mutationFn: async () => {
      await api.post('/crm/interactions', {
        leadId: lead.id,
        type: actividad.type,
        description: actividad.description.trim(),
        date: actividad.date ? new Date(actividad.date).toISOString() : undefined,
      });
      /*
        Una reunión con fecha futura **es** una visita agendada, así que la etapa se mueve sola.
        Dejarlo a mano producía justo la contradicción que el inicio del CRM señala como
        pendiente: leads con visita anotada que el embudo seguía contando como calificados sin
        fecha. Solo avanza; si el lead ya iba más adelante no se le hace retroceder.
      */
      const futura = actividad.date && new Date(actividad.date) > new Date();
      const avanza = ['new', 'contacted', 'quote_sent'].includes(lead.status);
      if (actividad.type === 'meeting' && futura && avanza) {
        await api.put(`/crm/leads/${lead.id}`, { status: 'meeting_scheduled' });
      }
    },
    onSuccess: async () => {
      setActividadAbierta(false);
      setActividad({ type: 'call', description: '', date: '' });
      setAviso({ tone: 'success', text: 'Actividad agregada.' });
      await refrescar();
      await queryClient.invalidateQueries({ queryKey: ['lead-interactions', lead.id] });
      await queryClient.invalidateQueries({ queryKey: ['crm-interactions'] });
    },
    onError: (error: Error) => setAviso({ tone: 'error', text: error.message }),
  });

  const exportar = useMutation({
    mutationFn: () => api.get<Record<string, unknown>>(`/data-protection/leads/${lead.id}/export`),
    onSuccess: (datos) => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' }));
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `lead-${lead.id}.json`;
      enlace.click();
      URL.revokeObjectURL(url);
    },
    onError: (error: Error) => triggerToast(error.message, 'error'),
  });

  const anonimizar = useMutation({
    mutationFn: () => api.delete(`/data-protection/leads/${lead.id}/anonymize`),
    onSuccess: async () => {
      setConfirmarAnonimizar(false);
      triggerToast('Lead anonimizado.', 'success');
      await refrescar();
      onClose();
    },
    onError: (error: Error) => triggerToast(error.message, 'error'),
  });

  const enlaceWhatsapp = whatsapp(lead.phone);

  /**
   * Cuándo se habló por última vez con esta persona.
   *
   * Sale de la interacción más reciente que ya ocurrió: una reunión agendada para el jueves no
   * es gestión hecha, y contarla como tal haría que un lead sin atender pareciera atendido.
   */
  const ultimoContacto = (actividades?.data ?? [])
    .map((registro) => new Date(registro.date))
    .filter((fecha) => fecha <= new Date())
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const sinCambios =
    nota === (lead.notes ?? '') &&
    etapa === lead.status &&
    responsable === (lead.assignedTo ?? '') &&
    monto === montoInicial(lead.estimatedAmount);

  return (
    <Modal open onClose={onClose} title={lead.name}>
      <div className="lead-detail">
        {aviso ? <div className={`alert alert-${aviso.tone}`} role={aviso.tone === 'error' ? 'alert' : 'status'}>{aviso.text}</div> : null}

        <dl className="lead-detail-datos">
          <dt>Teléfono</dt>
          <dd>{lead.phone || '—'}</dd>

          <dt>Correo</dt>
          <dd>{lead.email || '—'}</dd>

          {lead.company ? (<><dt>Empresa</dt><dd>{lead.company}</dd></>) : null}

          <dt>Origen</dt>
          <dd>{lead.campaignName || lead.source || '—'}{lead.sourceDetail ? ` · ${lead.sourceDetail}` : ''}</dd>

          {lead.fitStatus ? (<><dt>Calidad</dt><dd><StatusBadge status={lead.fitStatus} /></dd></>) : null}

          {typeof lead.qualityScore === 'number' ? (
            <>
              <dt>Puntaje</dt>
              <dd>
                <span className={`lead-score ${lead.qualityScore >= 70 ? 'lead-score-good' : lead.qualityScore >= 35 ? 'lead-score-mid' : 'lead-score-bad'}`}>
                  {lead.qualityScore} / 100
                </span>
              </dd>
            </>
          ) : null}

          <dt>Consentimiento</dt>
          <dd>{lead.consentCapturedAt ? new Date(lead.consentCapturedAt).toLocaleString('es-CL') : 'No registrado'}</dd>

          {lead.discardReason ? (<><dt>Motivo de cierre</dt><dd>{lead.discardReason}</dd></>) : null}
        </dl>

        {/*
          «Sin gestión aún» no es lo mismo que una fecha vieja, y es la distinción que decide
          qué hacer: a quien nunca se llamó hay que llamarlo, a quien se llamó hace un mes hay
          que insistirle. Antes solo se veía la fecha de ingreso, que no dice nada de eso.
        */}
        <p className="lead-detail-fechas">
          Último contacto: <strong>{ultimoContacto ? ultimoContacto.toLocaleDateString('es-CL') : 'sin gestión aún'}</strong>
          {' · '}Ingresó el {fecha(lead.createdAt)}
        </p>

        <div className="lead-detail-acciones">
          {lead.phone ? <a className="btn btn-outline btn-sm" href={`tel:${lead.phone}`}>Llamar</a> : null}
          {enlaceWhatsapp ? (
            <a className="btn btn-outline btn-sm" href={enlaceWhatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
          ) : null}
          {lead.email ? <a className="btn btn-outline btn-sm" href={`mailto:${lead.email}`}>Correo</a> : null}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={registrarContacto.isPending}
            onClick={() => registrarContacto.mutate()}
          >
            {registrarContacto.isPending ? 'Registrando...' : 'Registrar contacto'}
          </button>
          {/* Abre el mismo formulario de actividad, ya puesto en reunión: agendar una visita es
              anotar una reunión con fecha, y tener dos caminos para lo mismo los desincroniza. */}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => { setActividad({ type: 'meeting', description: '', date: '' }); setActividadAbierta(true); }}
          >
            Agendar visita
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setActividadAbierta(true)}>Registrar actividad</button>
        </div>

        <div className="lead-detail-edicion">
          <label>
            <span>Etapa</span>
            <select className="input" value={etapa} onChange={(event) => setEtapa(event.target.value)}>
              {STAGES.map((stage) => (
                // «Venta» exige haber convertido el lead en cliente: el servidor lo rechaza si
                // no, así que se deshabilita en vez de dejar intentarlo y fallar.
                <option key={stage} value={stage} disabled={stage === 'won' && !lead.convertedToClientId && lead.status !== 'won'}>
                  {stage === 'won' && !lead.convertedToClientId ? 'Venta (requiere convertir)' : etapaLabel(stage)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Responsable</span>
            <select className="input" value={responsable} onChange={(event) => setResponsable(event.target.value)}>
              <option value="">Sin asignar</option>
              {usuarios.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.name}</option>)}
            </select>
          </label>

          <label>
            <span>Monto estimado</span>
            <input
              className="input"
              type="number"
              min={0}
              step="1000"
              value={monto}
              onChange={(event) => setMonto(event.target.value)}
              placeholder="Sin estimar"
            />
          </label>

          <label>
            <span>Calificación</span>
            <select className="input" value={calificacion} onChange={(event) => setCalificacion(event.target.value as Lead['fitStatus'])}>
              <option value="review">Pendiente</option>
              <option value="qualified">Calificado</option>
              <option value="discarded">Descartado</option>
            </select>
          </label>

          <label>
            <span>Etiquetas</span>
            <input
              className="input"
              value={etiquetas}
              onChange={(event) => setEtiquetas(event.target.value)}
              placeholder="Sin etiquetas"
            />
          </label>

          <label>
            <span>Fuente</span>
            {/* Texto con sugerencias y no una lista cerrada: `source` es libre en la base y ya
                guarda valores que ningún catálogo declara. Cerrarlo acá dejaría sin poder
                corregir justamente los leads que llegaron con un origen raro. */}
            <input
              className="input"
              list="fuentes-conocidas"
              value={fuente}
              onChange={(event) => setFuente(event.target.value)}
              placeholder="Sin origen"
            />
            <datalist id="fuentes-conocidas">
              {FUENTES_SUGERIDAS.map((valor) => <option key={valor} value={valor} />)}
            </datalist>
          </label>

          <label>
            <span>Empresa</span>
            <select className="input" value={empresa} onChange={(event) => setEmpresa(event.target.value)}>
              <option value="">Sin empresa</option>
              {scope.clients.map((cuenta) => <option key={cuenta.id} value={cuenta.id}>{cuenta.name}</option>)}
            </select>
          </label>

          {/* Solo cuando la etapa es de cierre: preguntar por qué se perdió algo que sigue vivo
              invita a rellenarlo, y ese campo alimenta el informe de por qué se pierden negocios. */}
          {etapa === 'lost' ? (
            <label>
              <span>Motivo de descarte</span>
              <input
                className="input"
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                placeholder="Precio, ubicación, no responde..."
              />
            </label>
          ) : null}
        </div>

        <label className="lead-detail-nota">
          <span>Notas</span>
          <textarea
            className="input"
            rows={3}
            value={nota}
            onChange={(event) => setNota(event.target.value)}
            placeholder="Qué se conversó, qué quedó pendiente..."
          />
        </label>

        {!lead.convertedToClientId ? (
          <div className="lead-detail-convertir">
            <button type="button" className="btn btn-outline btn-sm" disabled={convertir.isPending} onClick={() => convertir.mutate()}>
              {convertir.isPending ? 'Convirtiendo...' : 'Convertir en cliente'}
            </button>
            <small>Crea la cuenta y habilita su onboarding. Es lo que permite marcarlo como venta.</small>
          </div>
        ) : null}

        <section className="lead-detail-historial">
          <h3>Tareas</h3>
          <div className="lead-detail-tarea-nueva">
            <input
              className="input"
              value={tarea.title}
              onChange={(event) => setTarea({ ...tarea, title: event.target.value })}
              placeholder="Nueva tarea… (ej. Llamar mañana)"
            />
            <input
              className="input"
              type="date"
              value={tarea.dueAt}
              onChange={(event) => setTarea({ ...tarea, dueAt: event.target.value })}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              // El servidor exige tres caracteres: comprobarlo acá evita un error por algo que
              // se ve en el propio campo.
              disabled={crearTarea.isPending || tarea.title.trim().length < 3}
              onClick={() => crearTarea.mutate()}
            >
              {crearTarea.isPending ? 'Añadiendo...' : 'Añadir'}
            </button>
          </div>

          {!tareas?.length ? (
            <p className="lead-detail-vacio">Sin tareas todavía.</p>
          ) : (
            <ul className="lead-detail-tareas">
              {tareas.map((pendiente) => {
                const cerrada = pendiente.status === 'done' || pendiente.status === 'cancelled';
                const vencida = !cerrada && pendiente.dueAt && new Date(pendiente.dueAt) < new Date();
                return (
                  <li key={pendiente.id} className={cerrada ? 'esta-cerrada' : vencida ? 'esta-vencida' : ''}>
                    <label>
                      <input
                        type="checkbox"
                        checked={cerrada}
                        disabled={cerrada || completarTarea.isPending}
                        onChange={() => completarTarea.mutate(pendiente.id)}
                      />
                      <span>{pendiente.title}</span>
                    </label>
                    {pendiente.dueAt ? (
                      <time>{fecha(pendiente.dueAt)}</time>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="lead-detail-historial">
          <h3>Actividad comercial</h3>
          {!actividades?.data?.length ? (
            <p className="lead-detail-vacio">Sin actividad registrada todavía.</p>
          ) : (
            <ul className="lead-detail-actividades">
              {actividades.data.map((registro) => (
                <li key={registro.id}>
                  <time>{new Date(registro.date).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}</time>
                  <div>
                    <strong>{TIPOS_ACTIVIDAD.find((tipo) => tipo.value === registro.type)?.label ?? registro.type}</strong>
                    {registro.description ? <span>{registro.description}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lead-detail-historial">
          <h3>Historial de etapas</h3>
          {isLoading ? (
            <LoadingSpinner text="Cargando el recorrido..." />
          ) : !historial?.length ? (
            // Un lead creado antes de que existiera el registro no tiene pasos, y eso no es un
            // error: decirlo evita que se lea como que el historial está roto.
            <p className="lead-detail-vacio">
              Todavía no hay movimientos registrados. Aparecerán al cambiarle la etapa.
            </p>
          ) : (
            <ol className="lead-detail-pasos">
              {historial.map((paso) => {
                const permanencia = duracion(paso.durationHours);
                return (
                  <li key={paso.id}>
                    <time>{new Date(paso.createdAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}</time>
                    <div>
                      <strong>
                        {paso.fromStage
                          ? `${etapaLabel(paso.fromStage)} → ${etapaLabel(paso.toStage)}`
                          : `Ingresó como ${etapaLabel(paso.toStage)}`}
                      </strong>
                      <span>
                        {/* Sin autor significa que lo movió el sistema, no que se desconozca. */}
                        {paso.changedBy ? nombreDe(paso.changedBy) ?? roleLabel('dev') : 'Automático'}
                        {permanencia ? ` · estuvo ${permanencia} en la etapa anterior` : ''}
                      </span>
                      {paso.reason ? <em>{paso.reason}</em> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="lead-detail-historial">
          <h3>Bitácora</h3>
          <ProcessCommentThread basePath={`/crm/leads/${lead.id}`} />
        </section>

        <section className="lead-detail-privacidad">
          <h3>Datos personales</h3>
          <div className="lead-detail-acciones">
            <button type="button" className="btn btn-outline btn-sm" disabled={exportar.isPending} onClick={() => exportar.mutate()}>
              Descargar sus datos
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirmarAnonimizar(true)}>
              Anonimizar
            </button>
          </div>
          <small>Anonimizar es irreversible: borra los datos de contacto y conserva las cifras agregadas.</small>
        </section>

        <div className="lead-detail-pie">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cerrar</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={guardar.isPending || sinCambios}
            onClick={() => guardar.mutate()}
          >
            {guardar.isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {actividadAbierta ? (
        <Modal open onClose={() => setActividadAbierta(false)} title="Registrar actividad">
          <div className="modal-form">
            <label>
              Tipo
              <select className="input" value={actividad.type} onChange={(event) => setActividad({ ...actividad, type: event.target.value })}>
                {TIPOS_ACTIVIDAD.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}
              </select>
            </label>
            <label>
              Fecha y hora
              <input className="input" type="datetime-local" value={actividad.date} onChange={(event) => setActividad({ ...actividad, date: event.target.value })} />
              <small className="field-hint">Vacío registra la hora actual. Una fecha futura sirve como seguimiento.</small>
            </label>
            <label>
              Detalle
              <textarea
                className="input"
                rows={5}
                maxLength={10000}
                value={actividad.description}
                onChange={(event) => setActividad({ ...actividad, description: event.target.value })}
                placeholder="Acuerdo, próximo paso o contexto relevante..."
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setActividadAbierta(false)}>Cancelar</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={registrarActividad.isPending || !actividad.description.trim()}
                onClick={() => registrarActividad.mutate()}
              >
                {registrarActividad.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {confirmarAnonimizar ? (
        <Modal open onClose={() => setConfirmarAnonimizar(false)} title="Anonimizar este lead">
          <div className="modal-form">
            <p>Se borran nombre, correo y teléfono de forma permanente. Las cifras agregadas se conservan.</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setConfirmarAnonimizar(false)}>Cancelar</button>
              <button type="button" className="btn btn-danger" disabled={anonimizar.isPending} onClick={() => anonimizar.mutate()}>
                {anonimizar.isPending ? 'Anonimizando...' : 'Anonimizar'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </Modal>
  );
}
