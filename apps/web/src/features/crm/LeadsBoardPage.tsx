/**
 * @fileoverview Prospectos de la agencia: tablero por etapa y tabla, en una sola pantalla.
 *
 * Es la **única** pantalla del embudo comercial. Antes eran dos —un tablero y una tabla— que
 * consultaban exactamente la misma petición (`domain=commercial&limit=100`) y mostraban el mismo
 * dato con distinta forma. Cada una había ganado capacidades que la otra no tenía, así que lo
 * que se podía hacer con un prospecto dependía de por cuál de las dos se hubiera entrado.
 *
 * Ahora la forma es una preferencia de quien mira, no dos pantallas: el tablero para trabajar
 * el día —arrastrar, ver dónde se atasca— y la tabla para revisar muchos a la vez y actuar en
 * lote. Los filtros, la exportación y la ficha son los mismos en las dos.
 *
 * Muestra **solo el embudo comercial**. Los estados del ciclo de reserva —reservado, asistió, no
 * asistió— viven en el mismo campo pero describen otra cosa: la visita de un comensal al local de
 * un cliente, no una venta de la agencia. Mezclarlos haría que arrastrar una tarjeta moviera un
 * lead a un estado que su dominio no admite, y el servidor lo rechazaría con un error que en
 * pantalla se lee como que el tablero está roto.
 *
 * Las columnas vacías se muestran igual. Si desaparecieran, la forma del embudo cambiaría según
 * dónde hay gente, y dejaría de verse dónde se está atascando el trabajo.
 */

import { useMemo, useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { KanbanBoard, type KanbanColumn } from '../../shared/KanbanBoard';
import { FilterBar } from '../../shared/FilterBar';
import { useUrlFilters } from '../../shared/use-url-filters';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { EmptyState } from '../../shared/EmptyState';
import { Modal } from '../../shared/Modal';
import { StatusBadge } from '../../shared/StatusBadge';
import { matchesSearch } from '../../shared/search';
import { LeadDetailDrawer } from './LeadDetailDrawer';
import { ImportLeadsModal } from './ImportLeadsModal';
import { ExportButtons, type ExportDocument } from '../../shared/export';
import { STAGES, STAGE_ACCENT, STAGE_LABEL } from './stage-labels';
import { CONTACT_STATUS_OPTIONS } from '../../shared/status-palette';
import { useCrmScope } from './crm-scope';
import { useAuth } from '../../core/auth';
import { useStageLabels } from './use-stage-labels';
import { useVocabulario } from './use-vocabulario';
import { colorDePersona, whatsapp } from './contacto';
import './leads-board.css';

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
  assignedTo?: string | null;
  clientId?: string | null;
  fitStatus?: 'qualified' | 'review' | 'discarded';
  tags?: string[] | null;
  estimatedAmount?: number | null;
  /** Tareas abiertas sobre el lead. Las cuenta el servidor al listar. */
  openTasks?: number;
  /** La tarea que vence antes: lo que falta hacer, no lo último que se hizo. */
  nextStep?: { title: string; dueAt: string | null; overdue: boolean } | null;
  createdAt: string;
  updatedAt: string;
}

interface UserOption { id: string; name: string }
interface ClientOption { id: string; name: string }

const FILTER_KEYS = ['cliente', 'responsable', 'etapa', 'calidad'] as const;

/** Días sin movimiento tras los que la tarjeta se marca. Coincide con el valor del inicio. */
const COOLING_DAYS = 7;

/** Forma en que se mira el embudo. Se recuerda en la URL, junto con los filtros. */
type Vista = 'tablero' | 'tabla';

/** Iconos de origen. Se reconoce de dónde vino la tarjeta sin leer la línea de texto. */
const ICONO_ORIGEN: Record<string, string> = {
  meta_lead_ads: '📣',
  meta: '📣',
  formulario: '🌐',
  web: '🌐',
  whatsapp: '💬',
  telefono: '📞',
  presencial: '🤝',
  referido: '⭐',
  manual: '✍️',
  import: '⬆️',
};

/** Icono del origen, o un punto neutro para los que no tienen uno propio. */
function iconoOrigen(origen?: string | null): string {
  return ICONO_ORIGEN[String(origen ?? '').toLowerCase()] ?? '•';
}

/** Monto abreviado: en una tarjeta de 255 px, «$12,5M» cabe y «$12.500.000» no. */
function montoCorto(valor: number): string {
  if (valor >= 1_000_000) return `${(valor / 1_000_000).toLocaleString('es-CL', { maximumFractionDigits: 1 })}M`;
  return `${valor.toLocaleString('es-CL')}`;
}

const CALIDADES: Array<{ value: string; label: string }> = [
  { value: 'qualified', label: 'Calificado' },
  { value: 'review', label: 'Por revisar' },
  { value: 'discarded', label: 'Descartado' },
];

function iniciales(nombre: string): string {
  return nombre.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? '').join('');
}

/**
 *  vista - Forma en que se presenta el embudo. La decide la ruta y no un control interno:
 *   «Tablero» y «Leads» son dos secciones con nombre propio en la barra, y un alternador dentro
 *   de una sola pantalla dejaba ambiguo cuál se estaba mirando.
 */
export function LeadsBoardPage({ vista }: { vista: Vista }): JSX.Element {
  const queryClient = useQueryClient();
  // De qué empresa es el CRM que se está mirando. Lo decide la barra, no esta pantalla.
  const scope = useCrmScope();
  const { user } = useAuth();
  // Cómo llama esta empresa a sus etapas. Vacío mientras carga: se ven los nombres de fábrica.
  const rotulos = useStageLabels(scope.clientId);
  // Cómo llama esta empresa a sus cosas. Devuelve el nombre de fábrica para lo que no renombró.
  const { termino } = useVocabulario(scope.clientId);
  const filtros = useUrlFilters(FILTER_KEYS);
  const [aviso, setAviso] = useState<{ tono: 'success' | 'error'; texto: string } | null>(null);
  const [abierto, setAbierto] = useState<Lead | null>(null);
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set());
  const [etapaEnLote, setEtapaEnLote] = useState('contacted');
  const [importarAbierto, setImportarAbierto] = useState(false);
  const [crearAbierto, setCrearAbierto] = useState(false);
  const [metaAbierto, setMetaAbierto] = useState(false);
  /** Lead cuyo cambio de etapa se está eligiendo por menú, en vez de arrastrando. */
  const [moviendo, setMoviendo] = useState<Lead | null>(null);
  const [formulario, setFormulario] = useState({ name: '', email: '', phone: '', company: '', source: 'manual', notes: '' });
  const [meta, setMeta] = useState({ pageId: '', leadgenId: '' });

  const { data, isLoading, error, refetch } = useQuery<{ data: Lead[] }>({
    // La empresa elegida forma parte de la clave: cambiarla trae otro embudo, no el mismo
    // filtrado, así que su resultado no puede reutilizar la caché del anterior.
    queryKey: ['crm-leads-board', scope.domain, scope.clientId],
    // Sin `limit` el backend pagina de a 20 y ocultaba en silencio los prospectos más antiguos.
    // El máximo del endpoint (100) sigue siendo una cota informal: si el embudo crece más allá,
    // esta pantalla necesita paginación real.
    queryFn: () => api.get(
      `/crm/leads?domain=${scope.domain}&limit=100${scope.clientId ? `&clientId=${encodeURIComponent(scope.clientId)}` : ''}`,
    ),
  });

  const { data: usuarios } = useQuery<{ data: UserOption[] }>({
    queryKey: ['users-min'],
    queryFn: () => api.get('/users'),
  });
  const { data: clientes } = useQuery<{ data: ClientOption[] }>({
    queryKey: ['clients-min'],
    queryFn: () => api.get('/clients'),
  });

  const equipo = useMemo(() => usuarios?.data ?? [], [usuarios]);
  const cartera = useMemo(() => clientes?.data ?? [], [clientes]);
  const nombreDe = (id?: string | null) => equipo.find((u) => u.id === id)?.name;

  const refrescar = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['crm-leads-board'] }),
    // También el inicio: sus avisos se calculan sobre estos mismos estados y quedarían viejos.
    queryClient.invalidateQueries({ queryKey: ['crm-home'] }),
    /*
     * Y la bitácora del lead, que el servidor acaba de escribir.
     *
     * Cada movimiento queda registrado con la etapa que deja, la que toma y cuánto duró en la
     * anterior. Sin invalidar esto, arrastrar una tarjeta y abrir su ficha enseguida mostraba el
     * recorrido sin el paso recién hecho: el dato estaba guardado y la pantalla no lo pedía de
     * nuevo, así que parecía que mover no dejaba rastro.
     */
    queryClient.invalidateQueries({ queryKey: ['crm-lead-historial'] }),
    queryClient.invalidateQueries({ queryKey: ['lead'] }),
    // El panel cuenta por etapa: mover una tarjeta cambia sus barras.
    queryClient.invalidateQueries({ queryKey: ['crm-dashboard'] }),
  ]);

  /** Clave exacta del embudo que se está mirando, para tocar solo esa caché y no la de otra empresa. */
  const claveDelTablero = ['crm-leads-board', scope.domain, scope.clientId] as const;

  /**
   * Cambio de etapa de una tarjeta.
   *
   * La tarjeta se mueve **antes** de que el servidor conteste y vuelve sola si falla. Antes se
   * esperaba a la respuesta y al refresco de la lista completa, así que soltar la tarjeta la
   * dejaba de vuelta en su columna original durante ese tiempo: se veía como que el arrastre no
   * había funcionado, y la reacción natural era volver a arrastrarla.
   *
   * El refresco sigue ocurriendo al terminar: el servidor puede haber cambiado algo más —la
   * fecha de actualización, la marca de enfriamiento— y la vista adelantada solo mueve la
   * tarjeta de columna.
   */
  const mover = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.put(`/crm/leads/${id}`, { status }),
    onMutate: async ({ id, status }) => {
      // Se cancela lo que esté en vuelo: una respuesta anterior llegando después pisaría el
      // adelanto y devolvería la tarjeta a su columna vieja.
      await queryClient.cancelQueries({ queryKey: claveDelTablero });
      const previo = queryClient.getQueryData<{ data: Lead[] }>(claveDelTablero);
      queryClient.setQueryData<{ data: Lead[] }>(claveDelTablero, (actual) => (actual
        ? { ...actual, data: actual.data.map((lead) => (lead.id === id ? { ...lead, status } : lead)) }
        : actual));
      return { previo };
    },
    onError: (err: Error, _variables, contexto) => {
      if (contexto?.previo) queryClient.setQueryData(claveDelTablero, contexto.previo);
      setAviso({
        tono: 'error',
        texto: err.message
          ? `No se pudo mover: ${err.message}`
          : 'No se pudo mover el lead y el servidor no dijo por qué.',
      });
    },
    onSuccess: () => setAviso({ tono: 'success', texto: 'Lead movido' }),
    // En ambos casos: al fallar, para recuperar el estado real; al acertar, para traer lo que el
    // servidor haya cambiado además de la etapa.
    onSettled: () => refrescar(),
  });

  /**
   * Hacerse cargo de un lead que no tiene dueño.
   *
   * Es el gesto que más se repite en un equipo donde cada persona ve lo suyo y lo que está
   * libre: se mira la bandeja común y se toma uno. Hacerlo por la ficha son cuatro pasos
   * —abrir, buscar el desplegable, elegirse, guardar— para decir «este lo llevo yo».
   *
   * Solo aparece sobre lo que nadie tiene: sobre un lead con dueño sería quitárselo, que es
   * otra decisión y se toma en la ficha, donde se ve de quién es.
   */
  const tomar = useMutation({
    mutationFn: (id: string) => api.put(`/crm/leads/${id}`, { assignedTo: user?.id }),
    onSuccess: async () => {
      await refrescar();
      setAviso({ tono: 'success', texto: 'Lead tomado. Ahora aparece como tuyo.' });
    },
    onError: (err: Error) => setAviso({ tono: 'error', texto: err.message || 'No se pudo tomar el lead' }),
  });

  /**
   * Cambio de etapa sobre varios prospectos a la vez.
   *
   * Se usa `allSettled` y no `all`: con `all`, un solo rechazo abandonaba el resto y dejaba la
   * tanda a medias sin decir cuáles habían pasado. Los que fallan quedan seleccionados, de modo
   * que reintentar es volver a pulsar y no rehacer la selección a mano.
   */
  const moverEnLote = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const resultados = await Promise.allSettled(ids.map((id) => api.put(`/crm/leads/${id}`, { status })));
      const fallidos = ids.filter((_, indice) => resultados[indice]?.status === 'rejected');
      return { actualizados: ids.length - fallidos.length, fallidos };
    },
    onSuccess: async (resultado, variables) => {
      await refrescar();
      if (resultado.fallidos.length) {
        setSeleccion(new Set(resultado.fallidos));
        setAviso({
          tono: 'error',
          texto: `Se movieron ${resultado.actualizados}. ${resultado.fallidos.length} no pudieron cambiarse y siguen seleccionados para reintentar.`,
        });
        return;
      }
      setSeleccion(new Set());
      setAviso({ tono: 'success', texto: `${resultado.actualizados} prospectos movidos a ${etapaLabel(variables.status).toLowerCase()}.` });
    },
    onError: (err: Error) => setAviso({ tono: 'error', texto: err.message }),
  });

  const crear = useMutation({
    mutationFn: () => api.post('/crm/leads', {
      name: formulario.name.trim(),
      email: formulario.email.trim() || undefined,
      phone: formulario.phone.trim() || undefined,
      company: formulario.company.trim() || undefined,
      source: formulario.source,
      notes: formulario.notes.trim() || undefined,
    }),
    onSuccess: async () => {
      setCrearAbierto(false);
      setFormulario({ name: '', email: '', phone: '', company: '', source: 'manual', notes: '' });
      setAviso({ tono: 'success', texto: 'Prospecto creado y agregado al embudo.' });
      await refrescar();
    },
    onError: (err: Error) => setAviso({ tono: 'error', texto: err.message }),
  });

  /**
   * Rescate de un lead concreto de Meta Lead Ads.
   *
   * No es la vía normal de captación —de eso se encarga el webhook— sino el repuesto para
   * cuando un envío no llegó: con el identificador de la página y el del formulario se baja ese
   * lead, se normaliza y se evalúa como cualquier otro.
   */
  const sincronizarMeta = useMutation({
    mutationFn: () => api.post('/integrations/meta/leads/sync', meta),
    onSuccess: async () => {
      setMeta({ pageId: '', leadgenId: '' });
      setMetaAbierto(false);
      setAviso({ tono: 'success', texto: 'Lead descargado, normalizado y evaluado.' });
      await refrescar();
    },
    onError: (err: Error) => setAviso({ tono: 'error', texto: err.message }),
  });

  const leads = useMemo(() => {
    const todos = data?.data ?? [];
    return todos.filter((lead) => {
      if (filtros.values.cliente && lead.clientId !== filtros.values.cliente) return false;
      if (filtros.values.responsable && lead.assignedTo !== filtros.values.responsable) return false;
      if (filtros.values.etapa && lead.status !== filtros.values.etapa) return false;
      if (filtros.values.calidad && lead.fitStatus !== filtros.values.calidad) return false;
      return matchesSearch(filtros.search, [lead.name, lead.email, lead.phone, lead.company, lead.source, lead.sourceDetail, lead.campaignName]);
    });
  }, [data, filtros.values.cliente, filtros.values.responsable, filtros.values.etapa, filtros.values.calidad, filtros.search]);

  const seleccionVisible = useMemo(() => leads.filter((lead) => seleccion.has(lead.id)).map((lead) => lead.id), [leads, seleccion]);
  const todosVisiblesSeleccionados = leads.length > 0 && seleccionVisible.length === leads.length;

  const alternarSeleccion = (id: string) => {
    setSeleccion((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  };

  const alternarTodos = () => {
    setSeleccion((actual) => {
      const siguiente = new Set(actual);
      if (todosVisiblesSeleccionados) leads.forEach((lead) => siguiente.delete(lead.id));
      else leads.forEach((lead) => siguiente.add(lead.id));
      return siguiente;
    });
  };

  /*
    Las columnas dependen del embudo que se está mirando, no son siempre las del comercial.

    Un contacto de campaña recorre el ciclo de una visita —ingresa, reserva, asiste o no—, no el
    embudo de venta de la agencia. Con las columnas del comercial en un CRM de cliente, arrastrar
    una tarjeta pedía un estado que ese lead no admite y el servidor lo rechazaba con «el estado
    "contacted" no corresponde a un lead de la audiencia de un local». La regla del servidor está
    bien; era la pantalla la que ofrecía lo imposible.
  */
  /**
   * Rótulo de un estado, del embudo que corresponda.
   *
   * Una sola función para toda la pantalla: el filtro, el cambio en lote, la tabla, la
   * exportación y la ficha muestran lo mismo. Con el mapa del comercial aplicado a un contacto
   * de campaña, «reserved» se imprimía crudo y «Calificado» aparecía donde no existe.
   */
  const etapaLabel = (estado: string) => rotulos[estado]
    ?? (scope.esAgencia
      ? STAGE_LABEL[estado] ?? estado
      : CONTACT_STATUS_OPTIONS.find((opcion) => opcion.value === estado)?.label ?? estado);

  /** Estados a los que se puede mover un lead del embudo que se está mirando. */
  const etapasDelEmbudo = scope.esAgencia
    ? [...STAGES]
    : CONTACT_STATUS_OPTIONS.map((opcion) => opcion.value);

  /*
   * El mismo documento alimenta el CSV y el PDF, así que no pueden divergir: agregar una columna
   * acá la agrega a los dos formatos. Exporta lo filtrado y no todo, que es lo que se está
   * mirando en pantalla, y el filtro queda anotado en el encabezado para que el archivo se
   * entienda semanas después.
   */
  const documento: ExportDocument<Lead> = {
    fileName: 'prospectos',
    title: 'Prospectos del embudo comercial',
    subtitle: `${leads.length} de ${(data?.data ?? []).length} prospectos`,
    meta: [
      { label: 'Cliente', value: cartera.find((c) => c.id === filtros.values.cliente)?.name ?? 'Todos' },
      { label: 'Responsable', value: nombreDe(filtros.values.responsable) ?? 'Todo el equipo' },
      { label: 'Etapa', value: filtros.values.etapa ? etapaLabel(filtros.values.etapa) : 'Todas' },
      { label: 'Búsqueda', value: filtros.search || 'Sin filtrar' },
    ],
    columns: [
      { header: 'Nombre', value: (l) => l.name, width: 22 },
      { header: 'Empresa', value: (l) => l.company, width: 18 },
      { header: 'Teléfono', value: (l) => l.phone, width: 14 },
      { header: 'Correo', value: (l) => l.email, width: 22 },
      { header: 'Etapa', value: (l) => etapaLabel(l.status), width: 13 },
      { header: 'Origen', value: (l) => l.campaignName || l.source, width: 15 },
      { header: 'Responsable', value: (l) => nombreDe(l.assignedTo) ?? 'Sin asignar', width: 14 },
    ],
    rows: leads,
    footer: 'Espartanos · CRM',
  };

  const columnas = useMemo<KanbanColumn[]>(
    () => (scope.esAgencia
      ? STAGES.map((stage) => ({ id: stage, label: rotulos[stage] ?? STAGE_LABEL[stage], accent: STAGE_ACCENT[stage] }))
      : CONTACT_STATUS_OPTIONS.map((estado) => ({
        id: estado.value,
        label: rotulos[estado.value] ?? estado.label,
        accent: estado.color,
      }))),
    [scope.esAgencia, rotulos],
  );

  if (isLoading) return <LoadingSpinner text="Cargando el embudo..." />;
  if (error) {
    return <QueryErrorState title="No pudimos cargar el embudo" message={(error as Error).message} onRetry={() => void refetch()} />;
  }

  const hayLeads = (data?.data ?? []).length > 0;

  return (
    <div className="page leads-board">
      <div className="page-header">
        <div>
          {/* El encabezado sigue a la empresa elegida: es lo que evita mirar un embudo creyendo
              que es el de otra, ahora que la misma pantalla sirve a las dos. */}
          <span className={scope.esAgencia ? 'crm-scope is-agency' : 'crm-scope'}>{scope.empresa}</span>
          <span className="page-eyebrow">{scope.esAgencia ? 'EMBUDO COMERCIAL' : 'CONTACTOS DE CAMPAÑA'}</span>
          <h1>{termino(scope.esAgencia ? 'prospectos' : 'leads')}</h1>
          <p className="page-subtitle">
            {scope.esAgencia
              ? 'Empresas que Espartanos quiere sumar como clientes.'
              : `Personas que llegaron por las campañas de ${scope.empresa}.`}
          </p>
        </div>
        <div className="page-header-actions">
          <ExportButtons document={documento} />
          <button type="button" className="btn btn-outline" onClick={() => setMetaAbierto(true)}>Traer de Meta</button>
          <button type="button" className="btn btn-outline" onClick={() => setImportarAbierto(true)}>Importar CSV</button>
          <button type="button" className="btn btn-primary" onClick={() => { setAviso(null); setCrearAbierto(true); }}>+ Nuevo prospecto</button>
        </div>
      </div>

      {/*
        El motivo del rechazo, con un botón para cerrarlo.

        Cuando el servidor rechaza un movimiento, la tarjeta vuelve a su columna: sin leer el
        motivo, eso se interpreta como que «no guarda», y lleva a repetir el mismo gesto en vez
        de corregir la causa. El error se queda hasta que alguien lo cierra —un aviso que se
        desvanece se pierde justo mientras se mira la tarjeta volver— y trae la palabra literal
        del servidor, que es la única que dice qué falló.
      */}
      {aviso ? (
        <div className={`alert alert-${aviso.tono}`} role={aviso.tono === 'error' ? 'alert' : 'status'}>
          <span>{aviso.texto}</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setAviso(null)}>Cerrar</button>
        </div>
      ) : null}

      <FilterBar
        search={filtros.search}
        onSearchChange={filtros.setSearch}
        searchPlaceholder="Buscar por nombre, empresa, correo, teléfono o campaña..."
        filters={[
          { key: 'cliente', label: 'Cliente', allLabel: 'Todos los clientes', options: cartera.map((c) => ({ value: c.id, label: c.name })) },
          { key: 'responsable', label: 'Responsable', allLabel: 'Todo el equipo', options: equipo.map((u) => ({ value: u.id, label: u.name })) },
          { key: 'etapa', label: 'Etapa', allLabel: 'Todas las etapas', options: etapasDelEmbudo.map((s) => ({ value: s, label: etapaLabel(s) })) },
          { key: 'calidad', label: 'Calidad', allLabel: 'Toda calidad', options: CALIDADES },
        ]}
        values={filtros.values}
        onFilterChange={filtros.setValue}
        onClear={filtros.hasAny ? filtros.clear : undefined}
      />

      {/* Sin alternador: la sección ya dice qué se está mirando. Queda el conteo, que es lo
          único que ese bloque aportaba de información. */}
      <div className="leads-board-vistas">
        <span className="leads-board-conteo">{leads.length} de {(data?.data ?? []).length}</span>
      </div>

      {seleccionVisible.length > 0 ? (
        <div className="leads-board-lote">
          <strong>{seleccionVisible.length} seleccionado{seleccionVisible.length === 1 ? '' : 's'}</strong>
          <select className="input" value={etapaEnLote} onChange={(event) => setEtapaEnLote(event.target.value)}>
            {/* «Venta» exige convertir cada prospecto en cliente, y eso no se puede hacer en
                lote sin decidir uno por uno: se deja fuera en vez de fallar en la mitad. */}
            {etapasDelEmbudo.filter((stage) => stage !== 'won').map((stage) => <option key={stage} value={stage}>{etapaLabel(stage)}</option>)}
          </select>
          <button
            type="button"
            className="btn btn-sm btn-accent"
            disabled={moverEnLote.isPending}
            onClick={() => moverEnLote.mutate({ ids: seleccionVisible, status: etapaEnLote })}
          >
            {moverEnLote.isPending ? 'Aplicando...' : 'Mover etapa'}
          </button>
          <button type="button" className="btn btn-outline btn-sm" disabled={moverEnLote.isPending} onClick={() => setSeleccion(new Set())}>Limpiar</button>
        </div>
      ) : null}

      {!hayLeads ? (
        <EmptyState
          title="Todavía no hay prospectos en el embudo"
          description="Cuando entre el primero —por formulario, por integración, importado o creado a mano— aparecerá acá."
        />
      ) : vista === 'tablero' ? (
        <KanbanBoard
          columns={columnas}
          items={leads}
          keyExtractor={(lead) => lead.id}
          columnOf={(lead) => lead.status}
          onMove={(lead, stage) => mover.mutate({ id: lead.id, status: stage })}
          emptyMessage="Ningún prospecto calza con este filtro."
          renderCard={(lead) => {
            const frio = Date.now() - new Date(lead.updatedAt).getTime() > COOLING_DAYS * 86_400_000;
            const responsable = nombreDe(lead.assignedTo);
            return (
              <div
                className={`leads-board-card${frio ? ' esta-frio' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setAbierto(lead)}
                // Enter y espacio además del clic: la tarjeta es el único camino a la ficha, y
                // dejarla solo para el ratón la vuelve inalcanzable por teclado.
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setAbierto(lead); }
                }}
              >
                <div className="leads-board-card-head">
                  <strong>
                    <span className="leads-board-icono" title={lead.source ?? 'Sin origen'}>{iconoOrigen(lead.source)}</span>
                    {lead.name}
                  </strong>
                  {/* Un hueco donde va el responsable se lee como un dato que falta; una
                      interrogación dice que nadie lo ha tomado, que es la información. */}
                  {responsable
                    ? (
                      // El color sale del identificador, no de una lista fija: reconocer de quién
                      // es una tarjeta al barrer la columna es más rápido que leer dos iniciales.
                      <span
                        className="leads-board-avatar"
                        title={`Lo está trabajando ${responsable}`}
                        style={{
                          color: colorDePersona(lead.assignedTo),
                          borderColor: colorDePersona(lead.assignedTo),
                        }}
                      >
                        {iniciales(responsable)}
                      </span>
                    )
                    : <span className="leads-board-avatar es-libre" title="Nadie lo ha tomado todavía">?</span>}
                </div>
                {lead.phone ? <span className="leads-board-contacto">📞 {lead.phone}</span> : null}
                {lead.estimatedAmount ? <span className="leads-board-monto">💰 {montoCorto(Number(lead.estimatedAmount))}</span> : null}
                <span className="leads-board-origen">
                  {lead.campaignName || lead.source || 'Sin origen'} · {new Date(lead.createdAt).toLocaleDateString('es-CL')}
                </span>
                {/*
                  Lo que falta hacer, no lo último que se hizo.

                  Quien mira el tablero está decidiendo a quién llamar ahora, y para eso la última
                  nota no sirve: sirve la tarea que vence antes, marcada si ya se pasó de fecha.
                */}
                {lead.nextStep ? (
                  <span className={`leads-board-paso${lead.nextStep.overdue ? ' esta-vencido' : ''}`} title="Próximo paso">
                    → {lead.nextStep.title}
                    {lead.nextStep.dueAt ? ` · ${new Date(lead.nextStep.dueAt).toLocaleDateString('es-CL')}` : ''}
                  </span>
                ) : null}
                {/* El aviso de frío va en la tarjeta y no solo en el informe: se actúa mirando el
                    tablero, no leyendo un número al final del mes. */}
                {frio ? <span className="leads-board-frio">Sin movimiento hace +{COOLING_DAYS} días</span> : null}
                <div className="leads-board-pie">
                  {lead.fitStatus
                    ? <span className={`leads-board-chip es-${lead.fitStatus}`}>{CALIDADES.find((c) => c.value === lead.fitStatus)?.label}</span>
                    : null}
                  {lead.openTasks ? <span className="leads-board-chip es-tarea" title="Tareas pendientes">✓ {lead.openTasks}</span> : null}
                  {/*
                    WhatsApp desde la tarjeta.

                    Es el canal por el que de verdad se responde a un lead de campaña, y tenerlo
                    solo en la ficha convertía «escribirle» en abrir, buscar y pulsar. `noreferrer`
                    porque abre en otra pestaña.
                  */}
                  {whatsapp(lead.phone) ? (
                    <a
                      className="leads-board-wa"
                      href={whatsapp(lead.phone)}
                      target="_blank"
                      rel="noreferrer"
                      title={`Escribir por WhatsApp a ${lead.name}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      💬
                    </a>
                  ) : null}
                  {/*
                    Cambiar de etapa sin arrastrar.

                    Arrastrar es cómodo con ratón y penoso en un teléfono, donde la columna se
                    desplaza bajo el dedo. Este botón hace lo mismo por menú, y es además el
                    camino accesible para quien no usa puntero.
                  */}
                  <button
                    type="button"
                    className="leads-board-mover"
                    title="Mover de etapa"
                    onClick={(event) => { event.stopPropagation(); setMoviendo(lead); }}
                  >
                    ⇄
                  </button>
                  {!lead.assignedTo ? (
                    <button
                      type="button"
                      className="leads-board-tomar"
                      disabled={tomar.isPending}
                      // La tarjeta entera abre la ficha: sin esto, tomar el lead la abriría además.
                      onClick={(event) => { event.stopPropagation(); tomar.mutate(lead.id); }}
                    >
                      Tomar
                    </button>
                  ) : null}
                </div>
              </div>
            );
          }}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todos los visibles"
                    checked={todosVisiblesSeleccionados}
                    onChange={alternarTodos}
                  />
                </th>
                <th>{termino(scope.esAgencia ? 'prospecto' : 'lead')}</th><th>Contacto</th>
                <th>{termino('empresa')}</th><th>Origen</th><th>Etapa</th>
                <th>Etiqueta</th><th>Calidad</th><th>{termino('responsable')}</th><th>Ingreso</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${lead.name}`}
                      checked={seleccion.has(lead.id)}
                      onChange={() => alternarSeleccion(lead.id)}
                    />
                  </td>
                  <td data-label="Prospecto">
                    <button type="button" className="link-button" onClick={() => setAbierto(lead)}>{lead.name}</button>
                  </td>
                  {/* Teléfono y correo juntos: para contactar se mira una sola celda, y separarlos
                      en dos columnas obligaba a leer la fila de punta a punta. */}
                  <td data-label="Contacto">
                    {lead.phone || '—'}
                    {lead.email ? <small>{lead.email}</small> : null}
                  </td>
                  <td data-label="Empresa">{lead.company || '—'}</td>
                  <td data-label="Origen">{lead.campaignName || lead.source || '—'}</td>
                  <td data-label="Etapa">{etapaLabel(lead.status)}</td>
                  <td data-label="Etiqueta">{lead.tags?.length ? lead.tags.join(' · ') : '—'}</td>
                  <td data-label="Calidad">{lead.fitStatus ? <StatusBadge status={lead.fitStatus} /> : '—'}</td>
                  <td data-label="Responsable">{nombreDe(lead.assignedTo) ?? 'Sin asignar'}</td>
                  <td data-label="Ingreso">{new Date(lead.createdAt).toLocaleDateString('es-CL')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!leads.length ? <p className="crm-dash-vacio">Ningún prospecto calza con este filtro.</p> : null}
        </div>
      )}

      {abierto ? (
        <LeadDetailDrawer lead={abierto} nombreDe={nombreDe} etapaLabel={etapaLabel} onClose={() => setAbierto(null)} />
      ) : null}

      {/*
        Cambiar de etapa por menú: lo mismo que arrastrar, para quien no puede o no quiere.

        Ofrece solo las etapas del embudo de este lead, y no la que ya tiene: «mover a donde
        está» no es una opción, es una forma de no hacer nada.
      */}
      {moviendo ? (
        <Modal open onClose={() => setMoviendo(null)} title={`Mover a ${moviendo.name} de etapa`}>
          <div className="modal-form">
            <p>Está en <strong>{etapaLabel(moviendo.status)}</strong>.</p>
            <div className="leads-board-mover-opciones">
              {etapasDelEmbudo.filter((estado) => estado !== moviendo.status).map((estado) => (
                <button
                  key={estado}
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={mover.isPending}
                  onClick={() => { mover.mutate({ id: moviendo.id, status: estado }); setMoviendo(null); }}
                >
                  {etapaLabel(estado)}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setMoviendo(null)}>Cancelar</button>
            </div>
          </div>
        </Modal>
      ) : null}

      <ImportLeadsModal open={importarAbierto} onClose={() => { setImportarAbierto(false); void refrescar(); }} />

      {crearAbierto ? (
        <Modal open onClose={() => setCrearAbierto(false)} title="Nuevo prospecto">
          <div className="modal-form">
            <label>Nombre<input className="input" value={formulario.name} onChange={(e) => setFormulario({ ...formulario, name: e.target.value })} /></label>
            <label>Empresa<input className="input" value={formulario.company} onChange={(e) => setFormulario({ ...formulario, company: e.target.value })} /></label>
            <label>Correo<input className="input" type="email" value={formulario.email} onChange={(e) => setFormulario({ ...formulario, email: e.target.value })} /></label>
            <label>Teléfono<input className="input" value={formulario.phone} onChange={(e) => setFormulario({ ...formulario, phone: e.target.value })} /></label>
            <label>Notas<textarea className="input" rows={3} value={formulario.notes} onChange={(e) => setFormulario({ ...formulario, notes: e.target.value })} /></label>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setCrearAbierto(false)}>Cancelar</button>
              <button type="button" className="btn btn-primary" disabled={crear.isPending || formulario.name.trim().length < 2} onClick={() => crear.mutate()}>
                {crear.isPending ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {metaAbierto ? (
        <Modal open onClose={() => setMetaAbierto(false)} title="Traer un lead de Meta">
          <div className="modal-form">
            <p className="field-hint">
              Para rescatar un envío que el webhook no entregó. Los dos identificadores salen del
              Administrador de anuncios: el de la página y el del formulario enviado.
            </p>
            <label>ID de la página<input className="input" value={meta.pageId} onChange={(e) => setMeta({ ...meta, pageId: e.target.value })} placeholder="1234567890" /></label>
            <label>ID del envío (leadgen)<input className="input" value={meta.leadgenId} onChange={(e) => setMeta({ ...meta, leadgenId: e.target.value })} placeholder="9876543210" /></label>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setMetaAbierto(false)}>Cancelar</button>
              <button type="button" className="btn btn-primary" disabled={!meta.pageId || !meta.leadgenId || sincronizarMeta.isPending} onClick={() => sincronizarMeta.mutate()}>
                {sincronizarMeta.isPending ? 'Trayendo...' : 'Traer'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
