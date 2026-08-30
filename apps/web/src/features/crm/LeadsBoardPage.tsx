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

import { useEffect, useMemo, useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { KanbanBoard, type KanbanColumn } from '../../shared/KanbanBoard';
import { FilterBar } from '../../shared/FilterBar';
import { useUrlFilters } from '../../shared/use-url-filters';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { EmptyState } from '../../shared/EmptyState';
import { Pagination } from '../../shared/Pagination';
import { Modal } from '../../shared/Modal';
import { LeadDetailDrawer } from './LeadDetailDrawer';
import { ImportLeadsModal } from './ImportLeadsModal';
import { ExportButtons, type ExportDocument } from '../../shared/export';
import { STAGES, STAGE_ACCENT, STAGE_LABEL } from './stage-labels';
import { CONTACT_STATUS_OPTIONS } from '../../shared/status-palette';
import { useCrmScope } from './crm-scope';
import { useAuth } from '../../core/auth';
import { useStageLabels } from './use-stage-labels';
import { COLUMNAS_OPCIONALES, guardarColumnas, leerColumnas, type ColumnaOpcional } from './columnas-leads';
import { useVocabulario } from './use-vocabulario';
import { LEAD_DISCARD_REASONS, LEAD_SOURCES, etiquetaDeFuente } from '@espartanos/shared';
import { colorDePersona, mensajeDePrimerContacto, whatsapp } from './contacto';
import { CALIFICACIONES, CALIFICACION_TITULO, rotuloDeCalificacion } from './calificacion';
import { marcaDeInactividad } from './inactividad';
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
  fitStatus?: 'qualified' | 'in_review' | 'review' | 'unqualified';
  trafficLight?: 'green' | 'yellow' | 'red' | null;
  qualityScore?: number;
  tags?: string[] | null;
  estimatedAmount?: number | null;
  /** Tareas abiertas sobre el lead. Las cuenta el servidor al listar. */
  openTasks?: number;
  /** Días sin cambiar de etapa y su gravedad. Los calcula el servidor: los plazos son ajustes. */
  idleDays?: number;
  idleLevel?: 'notice' | 'warning' | 'critical' | null;
  /** La tarea que vence antes: lo que falta hacer, no lo último que se hizo. */
  nextStep?: { title: string; dueAt: string | null; overdue: boolean } | null;
  createdAt: string;
  updatedAt: string;
}

interface UserOption { id: string; name: string }
interface LeadsPage { data: Lead[]; total: number; limit: number; offset: number }

const LEADS_PAGE_SIZE = 100;

const FILTER_KEYS = ['responsable', 'etapa', 'calidad', 'campana'] as const;

/** Forma en que se mira el embudo. Se recuerda en la URL, junto con los filtros. */
type Vista = 'tablero' | 'tabla';

/** Iconos de origen. Se reconoce de dónde vino la tarjeta sin leer la línea de texto. */
const ICONO_ORIGEN: Record<string, string> = {
  meta_lead_ads: '📣',
  meta: '📣',
  formulario_web: '🌐',
  formulario: '🌐',
  web: '🌐',
  portal_inmobiliario: '🏢',
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
  /*
   * Columnas visibles, recordadas por embudo.
   *
   * Cuáles sobran depende de lo que estés haciendo —llamar, cotizar, repartir—, así que se
   * elige en vez de decidirlo por todos. Se lee del navegador en el primer render y no en un
   * efecto: con un efecto la tabla se dibuja una vez con las de fábrica y salta al elegido.
   */
  const [columnasVisibles, setColumnasVisibles] = useState<ColumnaOpcional[]>(() => leerColumnas(scope.domain));
  const [columnasAbierto, setColumnasAbierto] = useState(false);
  /** Lead que se está descartando, mientras se elige el motivo. */
  const [descartando, setDescartando] = useState<{ lead: Lead; motivo: string; detalle: string } | null>(null);
  /*
   * Ver también los descartados de meses cerrados.
   *
   * No se recuerda entre visitas a propósito: es una consulta puntual —«¿qué descartamos en
   * marzo?»— y dejarla puesta devolvería la lista al problema que este corte resuelve, sin que
   * nadie recuerde haberla encendido.
   */
  const [verDescartados, setVerDescartados] = useState(false);
  const ve = (clave: ColumnaOpcional) => columnasVisibles.includes(clave);
  const alternarColumna = (clave: ColumnaOpcional) => {
    const siguiente = columnasVisibles.includes(clave)
      ? columnasVisibles.filter((actual) => actual !== clave)
      : COLUMNAS_OPCIONALES.map((columna) => columna.key).filter((actual) => (
        actual === clave || columnasVisibles.includes(actual)
      ));
    setColumnasVisibles(siguiente);
    guardarColumnas(scope.domain, siguiente);
  };
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set());
  /*
   * Etapa de destino del cambio en lote.
   *
   * Arranca en la primera del embudo que se está mirando y no en un valor fijo: `contacted` no
   * existe en el ciclo de reserva, así que en el CRM de un cliente el desplegable aparecía sin
   * selección coherente y «Mover etapa» mandaba un estado imposible para toda la tanda.
   */
  const [etapaEnLote, setEtapaEnLote] = useState('');
  const [importarAbierto, setImportarAbierto] = useState(false);
  const [crearAbierto, setCrearAbierto] = useState(false);
  const [metaAbierto, setMetaAbierto] = useState(false);
  const [pagina, setPagina] = useState(1);
  /** Lead cuyo cambio de etapa se está eligiendo por menú, en vez de arrastrando. */
  const [moviendo, setMoviendo] = useState<Lead | null>(null);
  const [formulario, setFormulario] = useState({ name: '', email: '', phone: '', company: '', source: 'otro', campaignName: '', notes: '', estimatedAmount: '', trafficLight: '' });
  const [meta, setMeta] = useState({ pageId: '', leadgenId: '' });

  const { data, isLoading, error, refetch } = useQuery<LeadsPage>({
    // La empresa elegida forma parte de la clave: cambiarla trae otro embudo, no el mismo
    // filtrado, así que su resultado no puede reutilizar la caché del anterior.
    queryKey: ['crm-leads-board', scope.domain, scope.clientId, pagina, filtros.search, filtros.values.responsable, filtros.values.etapa, filtros.values.calidad, filtros.values.campana, verDescartados],
    // El servidor limita cada respuesta a 100, pero el tablero no: se navega de página en página.
    // Así una empresa no pierde los contactos más antiguos cuando supera el primer centenar.
    queryFn: () => api.get(
      `/crm/leads?domain=${scope.domain}&limit=${LEADS_PAGE_SIZE}&offset=${(pagina - 1) * LEADS_PAGE_SIZE}${scope.clientId ? `&clientId=${encodeURIComponent(scope.clientId)}` : ''}${filtros.search ? `&search=${encodeURIComponent(filtros.search)}` : ''}${filtros.values.responsable ? `&assignedTo=${encodeURIComponent(filtros.values.responsable)}` : ''}${filtros.values.etapa ? `&status=${encodeURIComponent(filtros.values.etapa)}` : ''}${filtros.values.calidad ? `&fitStatus=${encodeURIComponent(filtros.values.calidad)}` : ''}${filtros.values.campana ? `&campaignName=${encodeURIComponent(filtros.values.campana)}` : ''}${verDescartados ? '&incluirDescartados=true' : ''}`,
    ),
  });

  // Cambiar de empresa, embudo o filtro siempre vuelve a la primera página. Dejar el número
  // anterior podía mostrar un tablero vacío aunque la empresa sí tuviera prospectos.
  useEffect(() => {
    setPagina(1);
  }, [scope.domain, scope.clientId, filtros.search, filtros.values.responsable, filtros.values.etapa, filtros.values.calidad, filtros.values.campana, verDescartados]);

  /**
   * Campañas de la empresa que se está mirando.
   *
   * Alimentan el filtro y las sugerencias del alta manual. Se piden acá y no por cada control
   * porque son la misma lista para los dos, y cambian de mes en mes: se comparte la caché de
   * `crm-campaigns`, que es la misma clave que usa Administración.
   */
  const { data: campanasResp } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['crm-campaigns', scope.clientId],
    queryFn: () => api.get(`/crm/campaigns${scope.clientId ? `?clientId=${encodeURIComponent(scope.clientId)}` : ''}`),
    // Sin campañas dadas de alta el filtro simplemente no ofrece opciones; no es un error.
    retry: false,
  });
  // Memorizado para conservar la identidad del arreglo: `?? []` crea uno nuevo en cada render y
  // con eso el filtro se rearmaba entero cada vez.
  const campanas = useMemo(() => campanasResp ?? [], [campanasResp]);

  /*
   * Quién puede tener leads de este CRM.
   *
   * Alimenta el filtro por responsable y la traducción de identificador a nombre. Sale del mismo
   * sitio que el desplegable de la ficha y acotado por empresa: con `/users` el filtro ofrecía
   * a toda la organización, así que en el CRM de una empresa se podía filtrar por personas que
   * no tienen ni un lead ahí y el resultado era siempre una lista vacía.
   */
  const { data: usuarios } = useQuery<UserOption[]>({
    queryKey: ['crm-responsables', scope.clientId],
    queryFn: () => api.get(
      `/crm/leads/responsables${scope.clientId ? `?clientId=${encodeURIComponent(scope.clientId)}` : ''}`,
    ),
    retry: false,
  });
  const equipo = useMemo(() => usuarios ?? [], [usuarios]);
  /** Si quien mira puede quedar a cargo de un lead de este CRM. Decide si se ofrece «Tomar». */
  const puedeTomar = Boolean(user?.id) && equipo.some((persona) => persona.id === user?.id);
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
  const claveDelTablero = ['crm-leads-board', scope.domain, scope.clientId, pagina, filtros.search, filtros.values.responsable, filtros.values.etapa, filtros.values.calidad, filtros.values.campana, verDescartados] as const;

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
    mutationFn: ({ id, status, discardReason }: { id: string; status: string; discardReason?: string }) => (
      api.put(`/crm/leads/${id}`, discardReason ? { status, discardReason } : { status })
    ),
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
   * Devuelve el lead a la bandeja común.
   *
   * `null` desasigna y `undefined` deja como está: el servidor distingue las dos cosas, y es lo
   * que permite soltar sin tener que abrir la ficha.
   */
  const soltar = useMutation({
    mutationFn: (id: string) => api.put(`/crm/leads/${id}`, { assignedTo: null }),
    onSuccess: async () => {
      await refrescar();
      setAviso({ tono: 'success', texto: 'Lead sin asignar. Cualquiera del equipo puede tomarlo.' });
    },
    onError: (err: Error) => setAviso({ tono: 'error', texto: err.message || 'No se pudo soltar el lead' }),
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
      /*
       * Nace en la empresa y el embudo que se están mirando.
       *
       * Sin esto, crear un contacto desde el CRM de una empresa lo guardaba sin empresa y en el
       * embudo comercial de la agencia: no fallaba nada, simplemente no aparecía donde se había
       * creado y sí donde no correspondía.
       */
      clientId: scope.clientId || undefined,
      domain: scope.domain,
      name: formulario.name.trim(),
      email: formulario.email.trim() || undefined,
      phone: formulario.phone.trim() || undefined,
      company: formulario.company.trim() || undefined,
      source: formulario.source,
      campaignName: formulario.campaignName.trim() || undefined,
      notes: formulario.notes.trim() || undefined,
      estimatedAmount: formulario.estimatedAmount === '' ? undefined : Number(formulario.estimatedAmount),
      trafficLight: formulario.trafficLight || undefined,
    }),
    onSuccess: async () => {
      setCrearAbierto(false);
      setFormulario({ name: '', email: '', phone: '', company: '', source: 'otro', campaignName: '', notes: '', estimatedAmount: '', trafficLight: '' });
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

  // La empresa ya es el contexto del CRM, elegido en la barra superior. No vuelve a filtrarse
  // acá: dos selectores de tenant permitían que la barra dijera una empresa y la lista otra.
  const leads = useMemo(() => data?.data ?? [], [data]);

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
    ?? (scope.domain === 'commercial'
      ? STAGE_LABEL[estado] ?? estado
      : CONTACT_STATUS_OPTIONS.find((opcion) => opcion.value === estado)?.label ?? estado);

  /** Estados a los que se puede mover un lead del embudo que se está mirando. */
  const etapasDelEmbudo = scope.domain === 'commercial'
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
    subtitle: `${leads.length} mostrados de ${data?.total ?? 0} prospectos`,
    meta: [
      { label: 'Empresa', value: scope.empresa },
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
      { header: 'Origen', value: (l) => l.campaignName || etiquetaDeFuente(l.source), width: 15 },
      { header: 'Responsable', value: (l) => nombreDe(l.assignedTo) ?? 'Sin asignar', width: 14 },
    ],
    rows: leads,
    footer: 'Espartanos · CRM',
  };

  const columnas = useMemo<KanbanColumn[]>(
    () => (scope.domain === 'commercial'
      ? STAGES.map((stage) => ({ id: stage, label: rotulos[stage] ?? STAGE_LABEL[stage], accent: STAGE_ACCENT[stage] }))
      : CONTACT_STATUS_OPTIONS.map((estado) => ({
        id: estado.value,
        label: rotulos[estado.value] ?? estado.label,
        accent: estado.color,
      }))),
    [scope.domain, rotulos],
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
          <span className="page-eyebrow">{scope.domain === 'commercial' ? 'EMBUDO COMERCIAL' : 'CONTACTOS DE CAMPAÑA'}</span>
          <h1>{termino(scope.domain === 'commercial' ? 'prospectos' : 'leads')}</h1>
          <p className="page-subtitle">
            {scope.esAgencia
              ? 'Empresas que Espartanos quiere sumar como clientes.'
              : `Leads comerciales de ${scope.empresa}.`}
          </p>
        </div>
        <div className="page-header-actions">
          {/*
            Elegir columnas solo tiene sentido donde hay columnas.

            En el tablero las tarjetas se agrupan por etapa y no hay tabla que recortar: el botón
            abría un diálogo que no cambiaba nada de lo que se estaba viendo, y ocupaba el primer
            sitio de la barra en la pestaña donde más estorba.

            Va fuera de `puedeEditar` a propósito: el portal del cliente también sufre la tabla
            ancha, y ocultar una columna no escribe nada en el servidor.
          */}
          {vista === 'tabla' ? (
            <button type="button" className="btn btn-outline" onClick={() => setColumnasAbierto(true)}>Columnas</button>
          ) : null}
          <ExportButtons document={documento} />
          {/* Escribir es del equipo. El portal del cliente mira: ofrecerle estos botones solo
              serviría para que el servidor los rechace y parezca que la pantalla está rota. */}
          {scope.puedeEditar ? (
            <>
              {/* Solo si la organización tiene integraciones encendidas: apagadas, este botón
                  únicamente puede fallar, y el error no dice que sea configuración. */}
              {user?.features?.integrations !== false ? (
                <button type="button" className="btn btn-outline" onClick={() => setMetaAbierto(true)}>Traer de Meta</button>
              ) : null}
              <button type="button" className="btn btn-outline" onClick={() => setImportarAbierto(true)}>Importar CSV</button>
              <button type="button" className="btn btn-primary" onClick={() => { setAviso(null); setCrearAbierto(true); }}>
                + Nuevo {termino(scope.domain === 'commercial' ? 'prospecto' : 'lead').toLowerCase()}
              </button>
            </>
          ) : null}
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
          { key: 'responsable', label: 'Responsable', allLabel: 'Todo el equipo', options: equipo.map((u) => ({ value: u.id, label: u.name })) },
          { key: 'etapa', label: 'Etapa', allLabel: 'Todas las etapas', options: etapasDelEmbudo.map((s) => ({ value: s, label: etapaLabel(s) })) },
          { key: 'calidad', label: CALIFICACION_TITULO, allLabel: 'Toda calificación', options: CALIFICACIONES },
          /*
            Las campañas son las de la empresa que se está mirando, no las de toda la
            organización: dos empresas pueden llamar igual a la suya, y ofrecer ambas dejaría
            elegir una que no devuelve nada.
          */
          { key: 'campana', label: termino('campana'), allLabel: 'Todas', options: campanas.map((campana) => ({ value: campana.name, label: campana.name })) },
        ]}
        values={filtros.values}
        onFilterChange={filtros.setValue}
        onClear={filtros.hasAny ? filtros.clear : undefined}
      />

      {/* Sin alternador: la sección ya dice qué se está mirando. Queda el conteo, que es lo
          único que ese bloque aportaba de información. */}
      <div className="leads-board-vistas">
        {/*
          Se dice que hay algo fuera de la vista, en vez de esconderlo callado.

          Una lista que oculta filas sin avisar se lee como datos perdidos. La casilla cuenta lo
          que hace —y filtrar por la etapa «Descartado» los muestra todos igualmente, así que
          esto es un atajo, no la única puerta.
        */}
        <label className="leads-board-descartados">
          <input
            type="checkbox"
            checked={verDescartados}
            onChange={(evento) => { setVerDescartados(evento.target.checked); setPagina(1); }}
          />
          <span>Ver descartados de meses anteriores</span>
        </label>
        <span className="leads-board-conteo">{leads.length} de {data?.total ?? 0}</span>
      </div>

      {seleccionVisible.length > 0 ? (
        <div className="leads-board-lote">
          <strong>{seleccionVisible.length} seleccionado{seleccionVisible.length === 1 ? '' : 's'}</strong>
          <select
            className="input"
            // Vacío hasta que se elige: obliga a decidir a dónde se mueve la tanda en vez de
            // aceptar un destino que nadie miró.
            value={etapaEnLote}
            onChange={(event) => setEtapaEnLote(event.target.value)}
          >
            <option value="">Mover a…</option>
            {etapasDelEmbudo.map((stage) => <option key={stage} value={stage}>{etapaLabel(stage)}</option>)}
          </select>
          <button
            type="button"
            className="btn btn-sm btn-accent"
            disabled={moverEnLote.isPending || !etapaEnLote}
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
          readOnly={!scope.puedeEditar}
          /*
            Descartar arrastrando también pide el motivo.

            El servidor lo exige, así que sin esto la tarjeta volvía sola a su columna con un
            error críptico. Se pregunta antes de mover: quien arrastra a Descartado ya decidió
            descartar, y el motivo es parte de esa decisión, no un trámite posterior.
          */
          onMove={(lead, stage) => {
            if (stage !== 'lost' || lead.status === 'lost') {
              mover.mutate({ id: lead.id, status: stage });
              return;
            }
            setDescartando({ lead, motivo: '', detalle: '' });
          }}
          emptyMessage="Ningún prospecto calza con este filtro."
          renderCard={(lead) => {
            const inactivo = marcaDeInactividad(lead.idleLevel ?? null, lead.idleDays ?? 0);
            const responsable = nombreDe(lead.assignedTo);
            return (
              <div
                className={`leads-board-card${inactivo ? ` esta-${lead.idleLevel}` : ''}`}
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
                    <span className="leads-board-icono" title={etiquetaDeFuente(lead.source) || 'Sin origen'}>{iconoOrigen(lead.source)}</span>
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
                {lead.trafficLight ? (
                  <span
                    className={`leads-board-semaforo es-${lead.trafficLight === 'green' ? 'verde' : lead.trafficLight === 'yellow' ? 'amarillo' : 'rojo'}`}
                    title="Prioridad manual"
                  >
                    <i /> {lead.trafficLight === 'green' ? 'Verde' : lead.trafficLight === 'yellow' ? 'Amarillo' : 'Rojo'}
                  </span>
                ) : null}
                {/* Sin puntaje en la tarjeta: el semáforo de al lado ya dice la prioridad, y
                    dos escalas para lo mismo obligan a decidir cuál se cree. */}
                <span className="leads-board-origen">
                  {lead.campaignName || etiquetaDeFuente(lead.source) || 'Sin origen'} · {new Date(lead.createdAt).toLocaleDateString('es-CL')}
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
                {inactivo ? <span className={inactivo.clase} title={inactivo.titulo}>{inactivo.texto}</span> : null}
                <div className="leads-board-pie">
                  {lead.fitStatus
                    ? <span className={`leads-board-chip es-${lead.fitStatus}`}>{rotuloDeCalificacion(lead.fitStatus)}</span>
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
                      href={whatsapp(lead.phone, mensajeDePrimerContacto({
                        nombre: lead.name,
                        empresa: scope.empresa,
                        interes: lead.campaignName || lead.company,
                      }))}
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
                  {scope.puedeEditar ? (
                    <button
                      type="button"
                      className="leads-board-mover"
                      title="Mover de etapa"
                      onClick={(event) => { event.stopPropagation(); setMoviendo(lead); }}
                    >
                      ⇄
                    </button>
                  ) : null}
                  {/*
                    Tomar solo lo ofrece quien puede quedar a cargo aquí.

                    Antes bastaba con poder editar, así que alguien de otra empresa se asignaba
                    un lead que después no volvía a ver: su alcance de cuenta no llega a esa
                    empresa, y el lead quedaba a nombre de quien no lo iba a atender. Es la misma
                    lista que llena el desplegable de la ficha, así que las dos formas de asignar
                    ofrecen exactamente a las mismas personas.
                  */}
                  {!lead.assignedTo && scope.puedeEditar && puedeTomar ? (
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
                  {/*
                    Soltarlo, para que vuelva a estar disponible.

                    Tomar era de ida: una vez asignado, devolverlo a la bandeja común obligaba a
                    abrir la ficha, cambiar el desplegable y guardar. Quien se dio cuenta de que
                    un lead no era suyo lo dejaba a su nombre, y ahí se quedaba sin que nadie más
                    lo pudiera tomar.

                    Solo lo ve quien lo tiene, y quien administra el CRM. Soltar el lead de otro
                    sin querer es exactamente el gesto que no debe estar a un clic de distancia.
                  */}
                  {lead.assignedTo && scope.puedeEditar
                    && (lead.assignedTo === user?.id || user?.permissions?.crm === 'manage') ? (
                      <button
                        type="button"
                        className="leads-board-tomar es-soltar"
                        disabled={soltar.isPending}
                        title={lead.assignedTo === user?.id ? 'Dejarlo sin asignar' : `Quitárselo a ${nombreDe(lead.assignedTo) ?? 'su responsable'}`}
                        onClick={(event) => { event.stopPropagation(); soltar.mutate(lead.id); }}
                      >
                        Soltar
                      </button>
                    ) : null}
                </div>
              </div>
            );
          }}
        />
      ) : (
        /*
          Las clases con las que el resto del proyecto dibuja sus tablas.

          Estaban puestas `table-wrap` y `table`, que **no tienen ni una regla de CSS**: la tabla
          salía sin contenedor de desplazamiento y sin el diseño de tarjetas para pantalla
          estrecha, así que en el teléfono se desbordaba a lo ancho. Era la pantalla que peor se
          veía, y la causa era un nombre de clase que nunca existió.
        */
        <div className="table-wrapper">
          <table className="data-table">
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
                <th className="col-prospecto">{termino(scope.domain === 'commercial' ? 'prospecto' : 'lead')}</th>
                {ve('phone') ? <th>Teléfono</th> : null}
                {ve('email') ? <th>Correo</th> : null}
                {ve('company') ? <th>{termino('empresa')}</th> : null}
                {ve('source') ? <th>Origen</th> : null}
                {ve('status') ? <th>Etapa</th> : null}
                {ve('tags') ? <th>Etiqueta</th> : null}
                {ve('fit') ? <th>{CALIFICACION_TITULO}</th> : null}
                {ve('owner') ? <th>{termino('responsable')}</th> : null}
                {ve('created') ? <th>Ingreso</th> : null}
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  {/*
                    Lleva `data-label` como todas.

                    En pantalla estrecha la tabla se convierte en tarjetas, y ese diseño usa la
                    etiqueta de cada celda como su título. Esta era la única sin ella en todo el
                    proyecto: la fila salía con una columna de título vacía y la casilla empujada
                    contra el borde, que es lo que descuadraba la tarjeta entera.
                  */}
                  <td data-label="Seleccionar" className="col-marcar">
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${lead.name}`}
                      checked={seleccion.has(lead.id)}
                      onChange={() => alternarSeleccion(lead.id)}
                    />
                  </td>
                  {/*
                    El nombre completo va en el `title`: la celda lo recorta con puntos suspensivos
                    para que la fila mida una línea, y quien necesite el nombre entero lo ve al
                    posarse encima o al abrir la ficha.
                  */}
                  <td data-label="Prospecto" className="col-prospecto">
                    <button type="button" className="link-button" title={lead.name} onClick={() => setAbierto(lead)}>{lead.name}</button>
                  </td>
                  {ve('phone') ? <td data-label="Teléfono">{lead.phone || '—'}</td> : null}
                  {ve('email') ? <td data-label="Correo" className="col-larga" title={lead.email ?? undefined}>{lead.email || '—'}</td> : null}
                  {ve('company') ? <td data-label="Empresa">{lead.company || '—'}</td> : null}
                  {ve('source') ? <td data-label="Origen" className="col-larga" title={lead.campaignName ?? undefined}>{lead.campaignName || etiquetaDeFuente(lead.source) || '—'}</td> : null}
                  {ve('status') ? <td data-label="Etapa">{etapaLabel(lead.status)}</td> : null}
                  {ve('tags') ? <td data-label="Etiqueta">{lead.tags?.length ? lead.tags.join(' · ') : '—'}</td> : null}
                  {ve('fit') ? <td data-label={CALIFICACION_TITULO}>{rotuloDeCalificacion(lead.fitStatus)}</td> : null}
                  {ve('owner') ? <td data-label="Responsable">{nombreDe(lead.assignedTo) ?? 'Sin asignar'}</td> : null}
                  {ve('created') ? <td data-label="Ingreso">{new Date(lead.createdAt).toLocaleDateString('es-CL')}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
          {!leads.length ? <p className="crm-dash-vacio">Ningún prospecto calza con este filtro.</p> : null}
        </div>
      )}

      <Pagination
        page={pagina}
        pageSize={LEADS_PAGE_SIZE}
        total={data?.total ?? 0}
        onPageChange={setPagina}
      />

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
                  onClick={() => {
                    if (estado === 'lost' && moviendo.status !== 'lost') {
                      setDescartando({ lead: moviendo, motivo: '', detalle: '' });
                      setMoviendo(null);
                      return;
                    }
                    mover.mutate({ id: moviendo.id, status: estado });
                    setMoviendo(null);
                  }}
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

      {descartando ? (
        <Modal open onClose={() => setDescartando(null)} title="¿Por qué se descarta?">
          <div className="modal-form">
            <p className="crm-admin-ayuda">
              Se descarta <strong>{descartando.lead.name}</strong>. El motivo es lo que después
              responde «¿por qué perdemos leads?», así que sin él el informe queda a medias.
            </p>
            <label>
              Motivo
              <select
                className="input"
                value={descartando.motivo}
                onChange={(evento) => setDescartando({ ...descartando, motivo: evento.target.value })}
              >
                <option value="">— Elige uno —</option>
                {LEAD_DISCARD_REASONS.map((razon) => <option key={razon} value={razon}>{razon}</option>)}
              </select>
            </label>
            {/* «Otro» sin detalle se agrupa como una barra vacía: peor que no haber preguntado. */}
            {descartando.motivo === 'Otro' ? (
              <label>
                Cuál
                <input
                  className="input"
                  value={descartando.detalle}
                  onChange={(evento) => setDescartando({ ...descartando, detalle: evento.target.value })}
                  placeholder="En pocas palabras"
                />
              </label>
            ) : null}
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setDescartando(null)}>Cancelar</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!descartando.motivo || (descartando.motivo === 'Otro' && !descartando.detalle.trim())}
                onClick={() => {
                  mover.mutate({
                    id: descartando.lead.id,
                    status: 'lost',
                    discardReason: descartando.motivo === 'Otro'
                      ? `Otro: ${descartando.detalle.trim()}`
                      : descartando.motivo,
                  });
                  setDescartando(null);
                }}
              >
                Descartar
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {columnasAbierto ? (
        <Modal open onClose={() => setColumnasAbierto(false)} title="Columnas de la lista">
          <div className="modal-form">
            <p className="crm-admin-ayuda">
              El nombre siempre se muestra: sin él la fila no identifica a nadie. Lo que elijas
              se recuerda en este equipo, y cada embudo guarda lo suyo.
            </p>
            <div className="leads-columnas">
              {COLUMNAS_OPCIONALES.map((columna) => (
                <label key={columna.key} className="leads-columna">
                  <input
                    type="checkbox"
                    checked={ve(columna.key)}
                    onChange={() => alternarColumna(columna.key)}
                  />
                  <span>{columna.label}</span>
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-primary" onClick={() => setColumnasAbierto(false)}>Listo</button>
            </div>
          </div>
        </Modal>
      ) : null}

      {crearAbierto ? (
        <Modal open onClose={() => setCrearAbierto(false)} title="Nuevo prospecto">
          <div className="modal-form">
            <label>Nombre<input className="input" value={formulario.name} onChange={(e) => setFormulario({ ...formulario, name: e.target.value })} /></label>
            <label>Empresa<input className="input" value={formulario.company} onChange={(e) => setFormulario({ ...formulario, company: e.target.value })} /></label>
            <label>Correo<input className="input" type="email" value={formulario.email} onChange={(e) => setFormulario({ ...formulario, email: e.target.value })} /></label>
            <label>Teléfono<input className="input" value={formulario.phone} onChange={(e) => setFormulario({ ...formulario, phone: e.target.value })} /></label>
            <label>Origen<select className="input" value={formulario.source} onChange={(e) => setFormulario({ ...formulario, source: e.target.value })}>
              {LEAD_SOURCES.map((fuente) => <option key={fuente.value} value={fuente.value}>{fuente.label}</option>)}
            </select></label>
            <label>Campaña<input className="input" list="campanas-nuevo-lead" value={formulario.campaignName} onChange={(e) => setFormulario({ ...formulario, campaignName: e.target.value })} placeholder="Opcional" /></label>
            {/* Sugerencias y no lista cerrada: una campaña recién lanzada todavía no está dada
                de alta en Administración, y no poder escribirla obliga a dejar el lead sin
                campaña justo cuando más importa atribuirlo. */}
            <datalist id="campanas-nuevo-lead">
              {campanas.map((campana) => <option key={campana.id} value={campana.name} />)}
            </datalist>
            <label>Monto estimado<input className="input" type="number" min={0} step="1000" value={formulario.estimatedAmount} onChange={(e) => setFormulario({ ...formulario, estimatedAmount: e.target.value })} placeholder="Opcional" /></label>
            <label>{termino('semaforo')}<select className="input" value={formulario.trafficLight} onChange={(e) => setFormulario({ ...formulario, trafficLight: e.target.value })}><option value="">Sin etiqueta</option><option value="green">Verde</option><option value="yellow">Amarillo</option><option value="red">Rojo</option></select></label>
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
