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
  const filtros = useUrlFilters(FILTER_KEYS);
  const [aviso, setAviso] = useState<{ tono: 'success' | 'error'; texto: string } | null>(null);
  const [abierto, setAbierto] = useState<Lead | null>(null);
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set());
  const [etapaEnLote, setEtapaEnLote] = useState('contacted');
  const [importarAbierto, setImportarAbierto] = useState(false);
  const [crearAbierto, setCrearAbierto] = useState(false);
  const [metaAbierto, setMetaAbierto] = useState(false);
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
  ]);

  const mover = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.put(`/crm/leads/${id}`, { status }),
    onSuccess: async () => {
      await refrescar();
      setAviso({ tono: 'success', texto: 'Lead movido' });
    },
    onError: (err: Error) => setAviso({ tono: 'error', texto: err.message || 'No se pudo mover el lead' }),
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
  const etapaLabel = (estado: string) => (scope.esAgencia
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
      ? STAGES.map((stage) => ({ id: stage, label: STAGE_LABEL[stage], accent: STAGE_ACCENT[stage] }))
      : CONTACT_STATUS_OPTIONS.map((estado) => ({ id: estado.value, label: estado.label, accent: estado.color }))),
    [scope.esAgencia],
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
          <h1>{scope.esAgencia ? 'Prospectos' : 'Leads'}</h1>
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

      {aviso ? <div className={`alert alert-${aviso.tono}`} role={aviso.tono === 'error' ? 'alert' : 'status'}>{aviso.texto}</div> : null}

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
                  <strong>{lead.name}</strong>
                  {responsable ? <span className="leads-board-avatar" title={responsable}>{iniciales(responsable)}</span> : null}
                </div>
                {lead.phone ? <span className="leads-board-contacto">{lead.phone}</span> : null}
                <span className="leads-board-origen">
                  {lead.campaignName || lead.source || 'Sin origen'} · {new Date(lead.createdAt).toLocaleDateString('es-CL')}
                </span>
                {/* El aviso de frío va en la tarjeta y no solo en el informe: se actúa mirando el
                    tablero, no leyendo un número al final del mes. */}
                {frio ? <span className="leads-board-frio">Sin movimiento hace +{COOLING_DAYS} días</span> : null}
                {!lead.assignedTo ? <span className="leads-board-sin-duenio">Sin asignar</span> : null}
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
                <th>Prospecto</th><th>Empresa</th><th>Origen</th><th>Etapa</th>
                <th>Calidad</th><th>Responsable</th><th>Ingreso</th>
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
                    {lead.email ? <small>{lead.email}</small> : null}
                  </td>
                  <td data-label="Empresa">{lead.company || '—'}</td>
                  <td data-label="Origen">{lead.campaignName || lead.source || '—'}</td>
                  <td data-label="Etapa">{etapaLabel(lead.status)}</td>
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
