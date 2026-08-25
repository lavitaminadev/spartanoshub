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

import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LEAD_DISCARD_REASONS, LEAD_SOURCES, etiquetaDeFuente } from '@espartanos/shared';
import { api } from '../../core/api';
import { Modal } from '../../shared/Modal';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { StatusBadge } from '../../shared/StatusBadge';
import { triggerToast } from '../../shared/toast-events';
import { roleLabel } from '../../core/role-labels';
import { useAuth } from '../../core/auth';
import { STAGES } from './stage-labels';
import { CONTACT_STATUS_OPTIONS } from '../../shared/status-palette';
import { mensajeDePrimerContacto, whatsapp } from './contacto';
import { useCrmScope } from './crm-scope';
import { useVocabulario } from './use-vocabulario';
import './lead-detail.css';

interface Lead {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  status: string;
  /** Embudo al que pertenece: decide qué estados admite. Lo manda el servidor con el lead. */
  domain?: 'audience' | 'commercial';
  source?: string | null;
  sourceDetail?: string | null;
  campaignName?: string | null;
  discardReason?: string | null;
  notes?: string | null;
  assignedTo?: string | null;
  clientId?: string | null;
  estimatedAmount?: number | string | null;
  qualityScore?: number;
  fitStatus?: 'qualified' | 'review' | 'unqualified';
  trafficLight?: 'green' | 'yellow' | 'red' | null;
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

/**
 * Opciones de origen para un lead concreto.
 *
 * Al catálogo se le antepone el valor que ese lead ya trae cuando no está declarado. Sin eso,
 * abrir un lead antiguo lo mostraba con el primer origen de la lista y bastaba con guardar
 * cualquier otro campo para reescribirle el origen sin que nadie lo pidiera.
 */
function fuentesPara(actual?: string | null): Array<{ value: string; label: string }> {
  const catalogo = LEAD_SOURCES.map((fuente) => ({ value: fuente.value, label: fuente.label }));
  if (!actual || catalogo.some((fuente) => fuente.value === actual)) return catalogo;
  return [{ value: actual, label: `${actual} (origen anterior)` }, ...catalogo];
}

const TIPOS_ACTIVIDAD: Array<{ value: string; label: string }> = [
  { value: 'call', label: 'Llamada' },
  { value: 'email', label: 'Correo' },
  { value: 'meeting', label: 'Reunión' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'note', label: 'Nota' },
];

function motivoInicial(valor?: string | null): { catalogo: string; detalle: string } {
  if (!valor) return { catalogo: '', detalle: '' };
  if ((LEAD_DISCARD_REASONS as readonly string[]).includes(valor)) return { catalogo: valor, detalle: '' };
  return { catalogo: 'Otro', detalle: valor.replace(/^Otro:\s*/i, '') };
}

/** Horas a una unidad que se lee de un vistazo. */
function duracion(horas?: number | string | null): string | null {
  const valor = Number(horas);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  if (valor < 1) return `${Math.round(valor * 60)} min`;
  if (valor < 48) return `${Math.round(valor)} h`;
  return `${Math.round(valor / 24)} días`;
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
  const currentUser = useAuth((state) => state.user);
  // Las cuentas que esta persona alcanza, para poder mover el lead de empresa sin una consulta
  // propia: la barra ya las tiene resueltas.
  const scope = useCrmScope();
  // Cómo llama esta empresa a sus cosas. De fábrica para lo que no haya renombrado.
  const { termino } = useVocabulario(scope.clientId);
  // El portal no elige cuenta ni equipo: su empresa viene firmada en la sesión.
  const esPortalCliente = currentUser?.role === 'client';
  /*
   * Estados a los que se puede mover este lead.
   *
   * Se decide por el dominio del propio lead y no por la empresa elegida arriba: la ficha se
   * abre desde una lista que ya está acotada, pero un prospecto de la agencia y un contacto de
   * campaña no admiten los mismos estados, y es el lead —no la barra— quien lo determina.
   */
  const etapasDelEmbudo = (leadInicial.domain ?? scope.domain) === 'commercial'
    ? [...STAGES]
    : CONTACT_STATUS_OPTIONS.map((opcion) => opcion.value);

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

  const [nombre, setNombre] = useState(lead.name);
  const [telefono, setTelefono] = useState(lead.phone ?? '');
  const [correo, setCorreo] = useState(lead.email ?? '');
  const [nota, setNota] = useState(lead.notes ?? '');
  const [etapa, setEtapa] = useState(lead.status);
  const [responsable, setResponsable] = useState(lead.assignedTo ?? '');
  const [monto, setMonto] = useState(montoInicial(lead.estimatedAmount));
  const [calificacion, setCalificacion] = useState(lead.fitStatus ?? 'review');
  const [semaforo, setSemaforo] = useState(lead.trafficLight ?? '');
  const [etiquetas, setEtiquetas] = useState((lead.tags ?? []).join(', '));
  const [motivoCatalogo, setMotivoCatalogo] = useState(motivoInicial(lead.discardReason).catalogo);
  const [motivoOtro, setMotivoOtro] = useState(motivoInicial(lead.discardReason).detalle);
  const [tarea, setTarea] = useState({ title: '', dueAt: '' });
  const [fuente, setFuente] = useState(lead.source ?? '');
  /** La empresa donde trabaja el contacto, distinta de la cuenta de Espartanos que lo tiene. */
  const [empresaDelContacto, setEmpresaDelContacto] = useState(lead.company ?? '');
  const [campana, setCampana] = useState(lead.campaignName ?? '');
  const [empresa, setEmpresa] = useState(lead.clientId ?? '');
  const [aviso, setAviso] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [confirmarAnonimizar, setConfirmarAnonimizar] = useState(false);
  const [actividadAbierta, setActividadAbierta] = useState(false);
  const [actividad, setActividad] = useState({ type: 'call', description: '', date: '' });
  // Una respuesta tardía del detalle no puede sobrescribir lo que la persona ya empezó a
  // corregir. Se vuelve a habilitar la sincronización después de un guardado confirmado.
  const cambiosLocales = useRef(false);
  const editar = <T,>(setter: (value: T) => void, value: T) => {
    cambiosLocales.current = true;
    setter(value);
  };

  // El detalle puede llegar después del primer dibujo con valores que el listado no traía.
  // Sin esto, el monto y el responsable se quedaban en lo que mostraba la tabla.
  useEffect(() => {
    if (cambiosLocales.current) return;
    setNombre(lead.name);
    setTelefono(lead.phone ?? '');
    setCorreo(lead.email ?? '');
    setNota(lead.notes ?? '');
    setEtapa(lead.status);
    setResponsable(lead.assignedTo ?? '');
    setEmpresaDelContacto(lead.company ?? '');
    setCampana(lead.campaignName ?? '');
    setMonto(montoInicial(lead.estimatedAmount));
    setCalificacion(lead.fitStatus ?? 'review');
    setSemaforo(lead.trafficLight ?? '');
    setEtiquetas((lead.tags ?? []).join(', '));
    setMotivoCatalogo(motivoInicial(lead.discardReason).catalogo);
    setMotivoOtro(motivoInicial(lead.discardReason).detalle);
    setFuente(lead.source ?? '');
    setEmpresa(lead.clientId ?? '');
  }, [
    lead.id, lead.name, lead.phone, lead.email, lead.notes, lead.status, lead.assignedTo,
    lead.company, lead.campaignName,
    lead.estimatedAmount, lead.fitStatus, lead.trafficLight, lead.tags, lead.discardReason, lead.source, lead.clientId,
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
   * Quién puede hacerse cargo del lead.
   *
   * Sale de `/crm/leads/responsables` y no de `/users`. Aquél lista la organización entera, así
   * que el CRM de una empresa ofrecía como responsables a personas de otra: el lead quedaba
   * asignado a alguien que no lo iba a ver nunca, porque su alcance de cuenta no llega ahí.
   * Además devolvía correo, cargo y teléfono de todo el equipo para llenar un desplegable, y
   * por eso estaba cerrado al portal.
   *
   * La empresa la resuelve el servidor: al portal le impone la suya y para el equipo interno
   * comprueba que alcance la que pide. Ya no hace falta apagar la consulta por cargo.
   */
  const { data: usuariosResp } = useQuery<UserOption[]>({
    queryKey: ['crm-responsables', scope.clientId],
    queryFn: () => api.get(
      `/crm/leads/responsables${scope.clientId ? `?clientId=${encodeURIComponent(scope.clientId)}` : ''}`,
    ),
    // Sin responsables asignables la ficha sigue sirviendo: se guarda «Sin asignar».
    retry: false,
  });
  const asignables = usuariosResp ?? [];

  /**
   * Campañas dadas de alta para esta empresa, más la que el lead ya trae.
   *
   * Comparte la clave `crm-campaigns` con Administración y el tablero, así que dar de alta una
   * campaña la deja disponible aquí sin recargar.
   */
  const { data: campanasResp } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['crm-campaigns', scope.clientId],
    queryFn: () => api.get(`/crm/campaigns${scope.clientId ? `?clientId=${encodeURIComponent(scope.clientId)}` : ''}`),
    retry: false,
  });
  const campanasDisponibles = useMemo(() => {
    const nombres = (campanasResp ?? []).map((campana) => campana.name);
    // La del lead va primero y solo si falta: las de Meta entran por importación con nombres que
    // nadie dio de alta, y sin esto guardar cualquier otro campo se las borraba.
    return lead.campaignName && !nombres.includes(lead.campaignName)
      ? [lead.campaignName, ...nombres]
      : nombres;
  }, [campanasResp, lead.campaignName]);
  /*
   * Quien ya lo tiene se conserva como opción aunque no esté en la lista.
   *
   * Hay leads asignados desde antes de que la lista se acotara por empresa. Sin esto, abrir uno
   * de ésos mostraba el desplegable en «Sin asignar» y bastaba con guardar cualquier otro campo
   * para desasignarlo sin que nadie lo pidiera.
   */
  const usuarios = lead.assignedTo && !asignables.some((persona) => persona.id === lead.assignedTo)
    ? [{ id: lead.assignedTo, name: `${nombreDe(lead.assignedTo)} (fuera de esta empresa)` }, ...asignables]
    : asignables;

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
    mutationFn: () => api.put<Lead>(`/crm/leads/${lead.id}`, {
      // Un lead entra por una integración o un archivo, y llega con lo que venía escrito. El
      // teléfono con un dígito de más es el único camino para llamar, y hasta ahora no había
      // dónde corregirlo: se editaba en la base o no se editaba.
      name: nombre.trim(),
      phone: telefono.trim(),
      email: correo.trim(),
      notes: nota,
      status: etapa,
      // Cadena vacía significa devolverlo a la bandeja común; el servidor distingue `null` de
      // omitido justamente para permitirlo.
      assignedTo: responsable || null,
      estimatedAmount: monto === '' ? undefined : Number(monto),
      fitStatus: calificacion,
      trafficLight: semaforo || null,
      // Se separan por coma, como en la importación, para que la misma persona escriba igual en
      // los dos sitios. Vacío limpia las etiquetas en vez de dejarlas como estaban.
      tags: etiquetas.split(',').map((t) => t.trim()).filter(Boolean),
      // Solo viaja si el lead queda descartado: un motivo guardado en un lead vivo reaparece
      // como explicación de un cierre que no ocurrió.
      discardReason: etapa === 'lost'
        ? (motivoCatalogo === 'Otro' ? `Otro: ${motivoOtro.trim()}` : motivoCatalogo)
        : '',
      source: fuente.trim(),
      company: empresaDelContacto.trim(),
      campaignName: campana.trim(),
      // Vacío deja el lead sin cuenta, que es el estado natural de un prospecto de la agencia.
      clientId: empresa || null,
    }),
    onSuccess: async (actualizado) => {
      cambiosLocales.current = false;
      queryClient.setQueryData(['lead', lead.id], actualizado);
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
      setAviso({ tone: 'success', text: 'Tarea guardada.' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['lead-tasks', lead.id] }),
        queryClient.invalidateQueries({ queryKey: ['crm-leads-board'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks-mine'] }),
      ]);
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
      /*
       * Cada embudo tiene su forma de decir «hay algo agendado»: la agencia mueve a «visita
       * agendada» y el local a «reservó». Antes se mandaba siempre la comercial, así que sobre
       * un contacto de campaña la actividad quedaba escrita y el cambio de etapa fallaba.
       */
      const comercial = (leadInicial.domain ?? 'commercial') === 'commercial';
      if (actividad.type === 'call' && comercial && lead.status === 'new') {
        await api.put(`/crm/leads/${lead.id}`, { status: 'contacted' });
      }
      const avanza = comercial
        ? ['new', 'contacted', 'quote_sent'].includes(lead.status)
        : lead.status === 'new';
      if (actividad.type === 'meeting' && futura && avanza) {
        await api.put(`/crm/leads/${lead.id}`, {
          status: comercial ? 'meeting_scheduled' : 'reserved',
        });
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

  // El interés sale de la campaña que lo trajo y, si no la hay, de su empresa: es lo que la
  // persona reconoce como el motivo por el que dejó sus datos.
  const enlaceWhatsapp = whatsapp(lead.phone, mensajeDePrimerContacto({
    nombre: lead.name,
    empresa: scope.empresa,
    interes: lead.campaignName || lead.company,
  }));

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
    // Los campos nuevos entran acá o «Guardar» se quedaría apagado justo al corregir un nombre.
    nombre === lead.name &&
    telefono === (lead.phone ?? '') &&
    correo === (lead.email ?? '') &&
    nota === (lead.notes ?? '') &&
    etapa === lead.status &&
    responsable === (lead.assignedTo ?? '') &&
    monto === montoInicial(lead.estimatedAmount);
  const motivoActual = motivoInicial(lead.discardReason);
  const fichaSinCambios = sinCambios
    && calificacion === (lead.fitStatus ?? 'review')
    && semaforo === (lead.trafficLight ?? '')
    && etiquetas === (lead.tags ?? []).join(', ')
    && fuente === (lead.source ?? '')
    && empresaDelContacto === (lead.company ?? '')
    && campana === (lead.campaignName ?? '')
    && empresa === (lead.clientId ?? '')
    && motivoCatalogo === motivoActual.catalogo
    && motivoOtro === motivoActual.detalle;

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
          <dd>{lead.campaignName || etiquetaDeFuente(lead.source) || '—'}{lead.sourceDetail ? ` · ${lead.sourceDetail}` : ''}</dd>

          {lead.fitStatus ? (<><dt>Calidad</dt><dd><StatusBadge status={lead.fitStatus} /></dd></>) : null}

          {/*
            El puntaje automático no se muestra.

            Convivía con el semáforo diciendo lo mismo con dos escalas distintas —un número de
            cero a cien y tres colores—, y cuando discrepaban no había forma de saber cuál
            mandaba. La prioridad la pone quien atiende, y esa es el semáforo. La columna
            `quality_score` se sigue calculando para ordenar y para los informes; lo que se
            retira es el número en pantalla, no el dato.
          */}

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

        {/*
          Llamar y escribir por WhatsApp se quedan para todos: no cambian nada del sistema.
          Lo que escribe —registrar gestión, mover de etapa, editar— es del equipo.
        */}
        <div className="lead-detail-acciones">
          {lead.phone ? <a className="btn btn-outline btn-sm" href={`tel:${lead.phone}`}>Llamar</a> : null}
          {enlaceWhatsapp ? (
            <a className="btn btn-outline btn-sm" href={enlaceWhatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
          ) : null}
          {lead.email ? <a className="btn btn-outline btn-sm" href={`mailto:${lead.email}`}>Correo</a> : null}
          {scope.puedeEditar ? (
            <>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => { setActividad({ type: 'call', description: '', date: '' }); setActividadAbierta(true); }}
              >
                Registrar contacto
              </button>
              {/* Ambos accesos terminan en el mismo formulario y la misma escritura. */}
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => { setActividad({ type: 'meeting', description: '', date: '' }); setActividadAbierta(true); }}
              >
                Agendar visita
              </button>
            </>
          ) : null}
        </div>

        <div className="lead-detail-edicion">
          {/*
            Identidad y contacto, editables.

            Un lead entra por una integración o por un archivo y llega con lo que venía escrito:
            el nombre en mayúsculas, el teléfono con un dígito de más, el correo con un espacio.
            Eso se veía en la ficha y no se podía corregir en ella.
          */}
          <label>
            <span>Nombre</span>
            <input className="input" value={nombre} onChange={(event) => editar(setNombre, event.target.value)} disabled={!scope.puedeEditar} />
          </label>

          <label>
            <span>Teléfono</span>
            <input
              className="input"
              value={telefono}
              onChange={(event) => editar(setTelefono, event.target.value)}
              disabled={!scope.puedeEditar}
              placeholder="Sin teléfono"
            />
          </label>

          <label>
            <span>Correo</span>
            <input
              className="input"
              type="email"
              value={correo}
              onChange={(event) => editar(setCorreo, event.target.value)}
              disabled={!scope.puedeEditar}
              placeholder="Sin correo"
            />
          </label>

          <label>
            <span>Etapa</span>
            {/*
              Las etapas son las del embudo de este lead, no siempre las comerciales.

              Un contacto de campaña recorre el ciclo de una visita, y el servidor rechaza
              cualquier otro estado. Ofreciendo las comerciales, la ficha dejaba elegir algo que
              al guardar respondía 400 y se leía como que la pantalla estaba rota.
            */}
            <select className="input" value={etapa} onChange={(event) => editar(setEtapa, event.target.value)} disabled={!scope.puedeEditar}>
              {etapasDelEmbudo.map((stage) => <option key={stage} value={stage}>{etapaLabel(stage)}</option>)}
            </select>
          </label>

          <label>
            <span>Responsable</span>
            <select className="input" value={responsable} onChange={(event) => editar(setResponsable, event.target.value)} disabled={!scope.puedeEditar}>
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
              onChange={(event) => editar(setMonto, event.target.value)}
              disabled={!scope.puedeEditar}
              placeholder="Sin estimar"
            />
          </label>

          <label>
            <span>Calificación</span>
            <select className="input" value={calificacion} onChange={(event) => editar(setCalificacion, event.target.value as Lead['fitStatus'])} disabled={!scope.puedeEditar}>
              <option value="review">Pendiente</option>
              <option value="qualified">Calificado</option>
              <option value="unqualified">No calificado</option>
            </select>
          </label>

          <label>
            <span>Semáforo</span>
            <select className="input" value={semaforo} onChange={(event) => editar(setSemaforo, event.target.value as typeof semaforo)} disabled={!scope.puedeEditar}>
              <option value="">Sin etiqueta</option>
              <option value="green">Verde</option>
              <option value="yellow">Amarillo</option>
              <option value="red">Rojo</option>
            </select>
          </label>

          <label>
            <span>Etiquetas</span>
            <input
              className="input"
              value={etiquetas}
              onChange={(event) => editar(setEtiquetas, event.target.value)}
              disabled={!scope.puedeEditar}
              placeholder="Sin etiquetas"
            />
          </label>

          <label>
            <span>Fuente</span>
            {/* Lista cerrada y no texto libre: agrupar por origen solo significa algo si
                «Meta Ads» se escribe de una sola forma. Los orígenes que ya existen fuera del
                catálogo se conservan como opción propia, así que un lead antiguo se puede
                seguir corrigiendo sin que guardar le cambie el origen solo. */}
            <select
              className="input"
              value={fuente}
              onChange={(event) => editar(setFuente, event.target.value)}
              disabled={!scope.puedeEditar}
            >
              <option value="">Sin origen</option>
              {fuentesPara(lead.source).map((opcion) => (
                <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
              ))}
            </select>
          </label>

          {/*
            La empresa de la persona, escrita por quien la registra.

            Antes este rótulo cubría otra cosa: era el desplegable de cuentas de Espartanos, es
            decir «de quién es este CRM». Dos ideas distintas bajo la misma palabra —dónde
            trabaja el contacto, y qué cliente de la agencia lo tiene— y en pantalla se leía como
            si el contacto perteneciera a una empresa de la cartera de Espartanos. El dato propio
            del lead no tenía dónde escribirse: entraba por importación y no se podía corregir.
          */}
          <label>
            <span>Empresa</span>
            <input
              className="input"
              value={empresaDelContacto}
              onChange={(event) => editar(setEmpresaDelContacto, event.target.value)}
              disabled={!scope.puedeEditar}
              placeholder="Dónde trabaja o qué representa"
            />
          </label>

          {/*
            Campaña que lo trajo.

            Se elige de las dadas de alta en Administración para esta empresa, no se escribe
            libre: de que el nombre coincida depende que el costo por lead cuente algo, y
            «Verano» escrito de dos formas son dos campañas con la mitad de los leads cada una.
            La que el lead ya trae se conserva como opción aunque no esté dada de alta —así
            entran las de la importación de Meta— para que guardar no se la borre.
          */}
          <label>
            <span>{termino('campana')}</span>
            <select
              className="input"
              value={campana}
              onChange={(event) => editar(setCampana, event.target.value)}
              disabled={!scope.puedeEditar}
            >
              <option value="">Sin {termino('campana').toLowerCase()}</option>
              {campanasDisponibles.map((nombre) => <option key={nombre} value={nombre}>{nombre}</option>)}
            </select>
          </label>

          {/*
            De qué cuenta de Espartanos es este contacto.

            No se ofrece en el portal: su empresa viene firmada en la sesión y el servidor
            rechaza moverlo fuera de ella, así que un desplegable ahí solo prometería algo
            imposible. Para el equipo interno sigue siendo editable, que es como se corrige un
            contacto que entró a la cuenta equivocada.
          */}
          {!esPortalCliente && scope.clients.length ? (
            <label>
              <span>Cuenta de Espartanos</span>
              <select className="input" value={empresa} onChange={(event) => editar(setEmpresa, event.target.value)} disabled={!scope.puedeEditar}>
                <option value="">Prospecto de la agencia</option>
                {scope.clients.map((cuenta) => <option key={cuenta.id} value={cuenta.id}>{cuenta.name}</option>)}
              </select>
            </label>
          ) : null}

          {/* Solo cuando la etapa es de cierre: preguntar por qué se perdió algo que sigue vivo
              invita a rellenarlo, y ese campo alimenta el informe de por qué se pierden negocios. */}
          {etapa === 'lost' ? (
            <label>
              <span>Motivo de descarte</span>
              <select
                className="input"
                value={motivoCatalogo}
                onChange={(event) => editar(setMotivoCatalogo, event.target.value)}
                disabled={!scope.puedeEditar}
              >
                <option value="">Selecciona un motivo</option>
                {LEAD_DISCARD_REASONS.map((razon) => <option key={razon} value={razon}>{razon}</option>)}
              </select>
              {motivoCatalogo === 'Otro' ? (
                <input className="input" value={motivoOtro} onChange={(event) => editar(setMotivoOtro, event.target.value)} disabled={!scope.puedeEditar} placeholder="Especifica el motivo" />
              ) : null}
            </label>
          ) : null}
        </div>

        <label className="lead-detail-nota">
          <span>Notas</span>
          <textarea
            className="input"
            rows={3}
            value={nota}
            onChange={(event) => editar(setNota, event.target.value)}
            disabled={!scope.puedeEditar}
            placeholder="Qué se conversó, qué quedó pendiente..."
          />
        </label>

        {/*
          Convertir crea una **empresa cliente**: alguien a quien la agencia presta servicios.

          Un contacto de campaña es otra cosa —una persona que respondió a la campaña del local de
          un cliente— y el botón se le ofrecía igual: pulsarlo metía a un comensal en la cartera
          de la agencia con su nombre como razón social. El servidor ahora lo rechaza; acá se
          esconde, porque ofrecer algo que siempre va a fallar es peor que no ofrecerlo.
        */}
        {scope.puedeEditar && scope.esAgencia && !lead.clientId && !lead.convertedToClientId && (leadInicial.domain ?? 'commercial') === 'commercial' ? (
          <div className="lead-detail-convertir">
            <button type="button" className="btn btn-outline btn-sm" disabled={convertir.isPending} onClick={() => convertir.mutate()}>
              {convertir.isPending ? 'Convirtiendo...' : 'Convertir en cliente'}
            </button>
            <small>Crea una empresa cliente de Espartanos. Es una acción separada del cierre del lead.</small>
          </div>
        ) : null}

        <section className="lead-detail-historial">
          <h3>Tareas</h3>
          {scope.puedeEditar ? <div className="lead-detail-tarea-nueva">
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
          </div> : null}

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
                        disabled={!scope.puedeEditar || cerrada || completarTarea.isPending}
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

        {/*
          Sin hilo de comentarios en la ficha de un lead.

          A un lead lo atiende una persona, así que el hilo repetía lo que ya dicen las notas y
          el historial de gestiones, y obligaba a decidir en cuál de los tres escribir. Se
          conserva donde sí hay varios interlocutores —trabajos y sesiones—, que es para lo que
          existe: ahí lo escrito es una conversación y acá era una nota con otro nombre.

          El hilo no se borra: `/crm/leads/:id/comments` sigue en pie y lo ya escrito se
          conserva. Lo que se retira es el tercer sitio donde escribir lo mismo.
        */}

        {/*
          Borrar los datos de una persona o llevárselos son decisiones de quien responde por
          ellos ante la ley, y eso es la agencia. El portal del cliente los ve, no los administra.
        */}
        {scope.puedeEditar ? (
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
        ) : null}

        <div className="lead-detail-pie">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cerrar</button>
          {scope.puedeEditar ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={guardar.isPending || fichaSinCambios || (etapa === 'lost' && (!motivoCatalogo || (motivoCatalogo === 'Otro' && !motivoOtro.trim())))}
              onClick={() => guardar.mutate()}
            >
              {guardar.isPending ? 'Guardando...' : 'Guardar cambios'}
            </button>
          ) : null}
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
