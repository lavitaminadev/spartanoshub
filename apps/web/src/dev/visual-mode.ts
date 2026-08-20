/**
 * @fileoverview Modo visual: levanta la interfaz sin backend y con todos los modulos abiertos.
 *
 * Se activa solo con `npm run dev:visual`, que define `VITE_VISUAL=1` desde `.env.visual`.
 * En cualquier otro arranque este modulo no hace nada y la aplicacion habla con la API real.
 *
 * Garantiza tres cosas mientras esta activo:
 * - ninguna peticion sale a la red: axios responde desde este archivo;
 * - la sesion arranca iniciada como `admin`, con todos los modulos en `active` y permiso
 *   `manage`, de modo que las vistas son navegables tanto por menu como por URL directa;
 * - un endpoint sin respuesta declarada devuelve un vacio, nunca un error.
 *
 * No toca `src/core/`: la sesion se abre respondiendo el mismo `/auth/session` que consulta
 * `checkAuth()`, y los modulos se abren por `user.moduleLifecycle`, que es la via que
 * `isModuleInPhaseScope` ya consulta antes que el catalogo. El codigo de produccion corre
 * exactamente igual que antes.
 */

import axios, { type AxiosAdapter } from 'axios';
import { ORGANIZATION_MODULE_CATALOG, WEB_ONLY_MODULE_CATALOG } from '@espartanos/shared';

/** Verdadero solo bajo `npm run dev:visual`. */
export const VISUAL_MODE = import.meta.env.VITE_VISUAL === '1';

/**
 * Claves de modulo derivadas del catalogo compartido, no escritas a mano.
 *
 * Asi, un modulo nuevo queda visible en modo visual el mismo dia que se agrega al catalogo,
 * sin tener que acordarse de este archivo.
 */
const MODULE_KEYS: string[] = [...ORGANIZATION_MODULE_CATALOG, ...WEB_ONLY_MODULE_CATALOG]
  .map((item) => item.key);

/** Asigna el mismo valor a todos los modulos del catalogo. */
function forEveryModule<T>(value: T): Record<string, T> {
  return Object.fromEntries(MODULE_KEYS.map((key) => [key, value]));
}

/**
 * JWT sintetico con `exp` a ocho horas.
 *
 * `api.ts` lee ese claim para programar la renovacion proactiva. Sin un `exp` legible, el
 * temporizador no se programa; con uno vencido, la sesion se reiniciaria sola a media revision.
 */
function syntheticJwt(): string {
  const encode = (value: object): string =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const expiresAt = Math.floor(Date.now() / 1000) + 8 * 60 * 60;
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: 'visual', exp: expiresAt })}.visual`;
}

/**
 * Cargo con el que se revisa, tomado de `?rol=` en la dirección.
 *
 * El menú y varias pantallas cambian con el cargo, así que revisar siempre como `admin` deja sin
 * ver justo lo que está asignado a otros: el inicio del CRM, por ejemplo, es de dirección
 * comercial y de operaciones. Con esto se revisa cada vista desde el cargo que la va a usar,
 * cambiando la dirección y sin volver a entrar.
 *
 *   http://localhost:5176/crm?rol=commercial_director
 */
function rolDeRevision(): string {
  const solicitado = new URLSearchParams(window.location.search).get('rol');
  return solicitado?.trim() || 'admin';
}

/** Perfil con acceso total, usado para responder `/auth/me`. */
const VISUAL_USER = {
  id: 'visual-user',
  name: 'Modo Visual',
  email: 'visual@espartanos.local',
  role: rolDeRevision(),
  organizationId: 'visual-org',
  mustChangePassword: false,
  mustCompleteProfile: false,
  mustAcceptTerms: false,
  features: forEveryModule(true),
  moduleLifecycle: forEveryModule('active'),
  permissions: forEveryModule('manage'),
};

/**
 * Contenedores anidados que las vistas leen sin proteger el segundo nivel.
 *
 * `ReservationResults` escribe `data?.funnel.views`: cuida `data` pero no `funnel`, asi que un
 * `funnel` ausente revienta el componente. El patron se repite en diecisiete contenedores
 * distintos, contados sobre el codigo. Se rellenan todos de entrada en vez de ir agregandolos
 * de a uno cada vez que una vista falla.
 */
const NESTED_CONTAINERS = [
  'funnel', 'ud', 'bindings', 'pieces', 'memory', 'disk', 'database', 'team', 'redis',
  'pods', 'pixels', 'impact', 'commitments', 'errors', 'dimensions', 'apiKey', 'actions',
] as const;

/**
 * Vacio que satisface las tres formas de respuesta que consumen las vistas.
 *
 * Es un Array real —46 `useQuery` esperan `T[]` y llaman `.map()` directo— que ademas expone
 * `data`, `items` y `results`, porque otros 36 esperan `{ data: [...] }`. Un objeto plano
 * romperia a los primeros y un array pelado a los segundos; esto sirve a ambos sin que la
 * vista sepa que esta en modo visual.
 *
 * Los contenedores anidados reciben el mismo vacio, de modo que sobre ellos funcionen tanto
 * `.length` y `.map()` como el acceso a una propiedad suelta, que devuelve `undefined` y cae
 * en el `?? 0` que las vistas ya escriben.
 *
 * Se construye uno nuevo por peticion: compartir la instancia dejaria que una vista que
 * ordena o inserta en su copia altere lo que ve otra.
 */
function emptyPayload(depth = 0): unknown {
  const nested = depth === 0
    ? Object.fromEntries(NESTED_CONTAINERS.map((key) => [key, emptyPayload(depth + 1)]))
    : {};
  return Object.assign([], {
    data: [],
    items: [],
    results: [],
    rows: [],
    slots: [],
    fullDays: [],
    sources: [],
    permissions: {},
    total: 0,
    page: 1,
    limit: 20,
    unread: 0,
    ...nested,
  });
}

/**
 * Respuestas explicitas para los endpoints que deciden si la aplicacion arranca.
 *
 * Todo lo demas cae en `emptyPayload()`. Cuando una vista necesite datos con forma propia,
 * se agrega su patron aca y no hay que tocar nada mas.
 */
/** Bandeja de solicitudes en memoria para el modo visual. */
const visualRequests: any[] = [];

const ROUTES: Array<[RegExp, (config?: any) => unknown]> = [
  [/\/auth\/session$/, () => ({ authenticated: true, accessToken: syntheticJwt() })],
  [/\/auth\/refresh$/, () => ({ accessToken: syntheticJwt() })],
  [/\/auth\/login$/, () => ({ accessToken: syntheticJwt(), user: VISUAL_USER })],
  [/\/auth\/me$/, () => VISUAL_USER],
  [/\/me\/permissions$/, () => ({ permissions: forEveryModule('manage') })],
  [/\/auth\/logout$/, () => ({})],
  [/\/notifications\/unread/, () => ({ unread: 0 })],
  /*
   * Datos de ejemplo del CRM.
   *
   * El vacio generico deja las seis vistas en blanco, y una pantalla vacia no permite revisar si
   * una tarjeta cabe, si una columna se corta o si un porcentaje se lee. Estos datos no tocan
   * ninguna base: viven aca y solo existen bajo \`npm run dev:visual\`.
   *
   * Se eligieron para que cada vista muestre sus casos limite: un lead sin asignar, uno recien
   * ingresado, uno enfriandose y un descarte con motivo.
   */
  [/\/crm\/home\/dashboard/, () => ({
    days: 30,
    totals: {
      leads: 42, calificados: 18, conVisita: 11, ventas: 4,
      montoVendido: 32400000, pipelineAbierto: 96500000, ticketPromedio: 8100000, estancados: 6,
    },
    porEtapa: [
      { key: 'contacted', total: 14 }, { key: 'new', total: 9 }, { key: 'quote_sent', total: 7 },
      { key: 'meeting_scheduled', total: 5 }, { key: 'negotiation', total: 3 },
      { key: 'won', total: 4 }, { key: 'lost', total: 6 },
    ],
    porFuente: [
      { key: 'Meta Ads', total: 24 }, { key: 'Formulario web', total: 11 },
      { key: 'Referido', total: 5 }, { key: 'Portal', total: 2 },
    ],
    porDia: [1, 4, 2, 0, 3, 5, 1, 2, 6, 3, 0, 4, 7, 4].map((total, i) => ({
      key: new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10),
      total,
    })),
    motivosDeCierre: [
      { key: 'Precio', total: 3 }, { key: 'Sin respuesta', total: 2 }, { key: 'Otro', total: 1 },
    ],
  })],
  [/\/crm\/home$/, () => ({
    month: { leads: 42, ventas: 4, monto: 32400000 },
    urgentCount: 3,
    coolingDays: 7,
    alerts: [
      { key: 'sin_contactar', count: 9, sample: { id: 'l1', name: 'Ricardo Galvez Lopez', source: 'Meta Ads', campaignName: 'Primavera', createdAt: '2026-08-20T02:15:20.674Z' } },
      { key: 'sin_asignar', count: 3, sample: { id: 'l2', name: 'Fabiana Ibanez Escalona', source: 'Meta Ads', campaignName: 'Primavera', createdAt: '2026-08-19T02:15:20.676Z' } },
      { key: 'calificados_sin_visita', count: 7, sample: { id: 'l3', name: 'Matias Cancino Caceres', source: 'Formulario web', campaignName: null, createdAt: '2026-08-15T02:15:20.676Z' } },
    ],
    team: [
      { userId: 'u1', name: 'Mathias Quintana', open: 14, uncontacted: 3, cooling: 2 },
      { userId: 'u2', name: 'German Larre', open: 9, uncontacted: 1, cooling: 4 },
      { userId: 'u3', name: 'Maria Veronica Vera', open: 5, uncontacted: 0, cooling: 0 },
    ],
  })],
  [/\/crm\/leads\/[^/]+\/historial$/, () => ([
    { id: 'p1', fromStage: null, toStage: 'new', durationHours: null, changedBy: null, reason: null, createdAt: '2026-08-08T02:15:20.676Z' },
    { id: 'p2', fromStage: 'new', toStage: 'contacted', durationHours: 26.5, changedBy: 'u1', reason: null, createdAt: '2026-08-09T02:15:20.676Z' },
    { id: 'p3', fromStage: 'contacted', toStage: 'quote_sent', durationHours: 72, changedBy: 'u1', reason: null, createdAt: '2026-08-12T02:15:20.676Z' },
  ])],
  [/\/crm\/leads(\?|$)/, () => ({
    data: [
      { id: 'l1', name: 'Ricardo Galvez Lopez', phone: '+56983000089', email: 'galvezr941@gmail.com', status: 'new', source: 'Meta Ads', campaignName: 'Primavera', assignedTo: null, clientId: null, estimatedAmount: 4500000, createdAt: '2026-08-20T02:15:20.676Z', updatedAt: '2026-08-20T02:15:20.676Z' },
      { id: 'l2', name: 'Fabiana Ibanez Escalona', phone: '+56948532342', email: 'fabiana@gmail.com', status: 'contacted', source: 'Meta Ads', campaignName: 'Primavera', assignedTo: 'u1', clientId: null, estimatedAmount: 7800000, createdAt: '2026-08-17T02:15:20.676Z', updatedAt: '2026-08-19T02:15:20.676Z' },
      { id: 'l3', name: 'Matias Cancino Caceres', phone: '+56967338235', email: 'matias09@hotmail.com', status: 'quote_sent', source: 'Formulario web', campaignName: null, assignedTo: 'u1', clientId: null, estimatedAmount: 12000000, createdAt: '2026-08-14T02:15:20.676Z', updatedAt: '2026-08-10T02:15:20.676Z' },
      { id: 'l4', name: 'Yohana Valenzuela', phone: '+56996118555', email: 'yohana@gmail.com', status: 'meeting_scheduled', source: 'Referido', campaignName: null, assignedTo: 'u2', clientId: null, estimatedAmount: 9200000, createdAt: '2026-08-11T02:15:20.676Z', updatedAt: '2026-08-18T02:15:20.676Z' },
      { id: 'l5', name: 'Oriana Astete', phone: '+56987392203', email: 'oriana@gmail.com', status: 'negotiation', source: 'Meta Ads', campaignName: 'Invierno', assignedTo: 'u2', clientId: null, estimatedAmount: 15600000, createdAt: '2026-07-31T02:15:20.676Z', updatedAt: '2026-08-19T02:15:20.676Z' },
      { id: 'l6', name: 'Merida Colores', phone: '+56958036024', email: 'merida@gmail.com', status: 'won', source: 'Meta Ads', campaignName: 'Invierno', assignedTo: 'u1', clientId: null, estimatedAmount: 8100000, createdAt: '2026-07-21T02:15:20.676Z', updatedAt: '2026-08-16T02:15:20.676Z' },
      { id: 'l7', name: 'Maria Elena Donoso', phone: '+56966459555', email: 'elenadg30@hotmail.com', status: 'lost', source: 'Meta Ads', campaignName: 'Invierno', assignedTo: 'u1', clientId: null, discardReason: 'Precio', estimatedAmount: 0, createdAt: '2026-07-26T02:15:20.676Z', updatedAt: '2026-08-13T02:15:20.676Z' },
    ],
    total: 7,
  })],
  [/\/crm\/ingest-sources/, () => ([
    { id: 's1', name: 'Meta Ads', source: 'meta_ads', isActive: true, tokenHint: '...4a2f91', receivedCount: 24, lastReceivedAt: '2026-08-20T02:15:20.676Z', lastError: null, url: '' },
    { id: 's2', name: 'Portal inmobiliario', source: 'portal', isActive: true, tokenHint: '...b7c033', receivedCount: 0, lastReceivedAt: null, lastError: null, url: '' },
    { id: 's3', name: 'Formulario web', source: 'formulario_web', isActive: false, tokenHint: '...19ee42', receivedCount: 6, lastReceivedAt: '2026-08-15T02:15:20.676Z', lastError: 'El lead necesita telefono o correo', url: '' },
  ])],
  [/\/meetings/, () => ([
    { id: 'm1', title: 'Visita Fundo La Esperanza', scheduledAt: '2026-08-20T02:15:20.676Z', clientId: null },
    { id: 'm2', title: 'Llamada Oriana Astete', scheduledAt: '2026-08-22T02:15:20.676Z', clientId: null },
    { id: 'm3', title: 'Cierre Merida Colores', scheduledAt: '2026-08-25T02:15:20.676Z', clientId: null },
  ])],

  /*
   * El dashboard es la unica vista de las 33 que no se sostiene con el vacio generico:
   * `OperationalHome` desestructura `const { today, upcoming } = data` y lee `today.total`
   * derecho. Un `today` ausente la tumba, y uno vacio le hace imprimir «undefined» en pantalla.
   * Se responde con la forma declarada en `OperationalHomeData`, en cero.
   */
  [/\/reservations\/analytics\/operational-home/, () => ({
    date: new Date().toISOString().slice(0, 10),
    timezone: 'America/Santiago',
    today: { total: 0, attended: 0, pending: 0, noShow: 0, dailyCap: 0, occupancyPct: null },
    upcoming: [],
  })],
  [/\/integrations\/meta\/conversions\/outbox/, () => ({
    stats: { pending: 0, retry: 0, processing: 0, failed: 0, expired: 0, processed: 0, total: 0 },
    problems: [],
  })],
  [/\/reservations\/analytics\/metrics/, () => ({
    totals: { total: 0, attended: 0, no_show: 0, pending: 0, confirmed: 0, cancelled: 0 },
    daily: [],
    sources: [],
    funnel: { views: 0, starts: 0, completed: 0, conversionRate: null },
    days: 30,
  })],
  /*
   * El constructor del flujo (`ReservationBuilderPage`) es la otra vista que el vacio generico
   * no sostiene: lee `draft.designConfig.title` y `draft.timezone.split()` sin proteger el
   * segundo nivel, de modo que un formulario sin esos objetos la tumba. Se responde con un
   * formulario completo para poder revisar los cuatro pasos, incluido el entorno visual.
   */
  [/\/reservations\/forms\/[^/?]+$/, () => ({
    id: 'visual-form',
    clientId: 'visual-client',
    name: 'Reservas de verano',
    publicSlug: 'reservas-de-verano',
    status: 'published',
    mode: 'reservation',
    timezone: 'America/Santiago',
    durationMinutes: 60,
    bufferMinutes: 10,
    capacityPerSlot: 4,
    dailyCapacity: 40,
    minimumNoticeHours: 2,
    maximumAdvanceDays: 60,
    confirmationMode: 'automatic',
    fieldSchema: [
      { id: 'name', type: 'text', label: 'Nombre completo', required: true, system: true },
      { id: 'phone', type: 'phone', label: 'Teléfono', required: true, system: true },
      { id: 'email', type: 'email', label: 'Correo', required: false, system: true },
      { id: 'field_partysize', type: 'number', label: 'Número de personas', required: true },
      { id: 'field_consent', type: 'consent', label: 'Acepto la política de datos', required: true },
    ],
    designConfig: {
      title: 'Reserva tu mesa',
      welcome: 'Elige el horario que mejor te acomode.',
      primaryColor: '#0ec6b8',
      accentColor: '#ea0f63',
      backgroundColor: '#f4f5f7',
      textColor: '#0b0b0c',
      fontFamily: 'system-ui',
      backgroundMode: 'gradient',
      backgroundGradient: 'linear-gradient(135deg, #f4f5f7 0%, #d8f3f0 100%)',
      buttonRadius: '12',
      fieldRadius: '10',
    },
    scheduleConfig: { windows: [{ day: 4, start: '12:00', end: '23:00' }, { day: 5, start: '12:00', end: '23:30' }] },
    campaignId: 'verano-2026',
    crmEnabled: true,
    calendarEnabled: true,
    metaCapiEnabled: false,
    teamNotifications: ['equipo@espartanos.cl'],
    pixelId: null,
    pixelName: null,
    metaReady: false,
    ga4MeasurementId: null,
    capabilities: { reservations: true, crm: true, metaConversions: true },
    updatedAt: new Date().toISOString(),
  })],
  [/\/roles\/permissions$/, () => {
    const VISUAL_ROLES = ['admin','commercial_director','creative_director','operations_director','art_director','av_director','ai_lead','community_manager','designer','audiovisual','client'] as const;
    const ROLE_BASE: Record<string, 'manage'|'edit'|'view'|'none'> = { admin:'manage', operations_director:'edit', commercial_director:'edit', creative_director:'edit', art_director:'edit', av_director:'edit', ai_lead:'edit', community_manager:'view', designer:'view', audiovisual:'view', client:'none' };
    const matrix: Record<string, Record<string, string>> = {};
    for (const mod of MODULE_KEYS) {
      matrix[mod] = {};
      for (const role of VISUAL_ROLES) { matrix[mod][role] = ROLE_BASE[role] ?? 'view'; }
    }
    return { matrix };
  }],
  [/\/permission-overrides$/, () => ({
    items: [
      { id:'exc-001', userId:'user-cm', userName:'Valentina Rojas', userRole:'community_manager', module:'production', level:'edit', reason:'Campaña Q1 — necesita ver el tablero de producción por dos semanas', expiresAt: new Date(Date.now() + 14*864e5).toISOString(), status:'active', createdAt: new Date(Date.now() - 2*864e5).toISOString() },
      { id:'exc-002', userId:'user-designer', userName:'Joaquín Muñoz', userRole:'designer', module:'crm', level:'view', reason:'Cobertura de vacaciones — puede ver contactos pero no editar', expiresAt: new Date(Date.now() + 3*864e5).toISOString(), status:'active', createdAt: new Date(Date.now() - 864e5).toISOString() },
      { id:'exc-003', userId:'user-av', userName:'Diego Venegas', userRole:'audiovisual', module:'reports', level:'edit', reason:'Reporte trimestral del equipo AV', expiresAt: null, status:'active', createdAt: new Date(Date.now() - 5*864e5).toISOString() },
    ],
  })],
  /*
   * Pipeline comercial y automatizaciones.
   *
   * Van antes que la regla general de `/users` porque las pantallas nuevas piden `/users` sin
   * el filtro `isActive`, y sin una respuesta propia caerían en el vacío: los selectores de
   * responsable quedarían sin opciones y el tablero sin nombres.
   */
  [/\/crm\/opportunities/, () => ({
    total: 6,
    data: [
      { id: 'opp-1', name: 'Restaurante Ánimo — retainer mensual', amount: 1850000, stage: 'negotiation', probability: 70, assignedTo: 'user-admin', nextAction: 'Enviar propuesta ajustada', createdAt: '2026-07-28T12:00:00Z' },
      { id: 'opp-2', name: 'Café del Puerto — parrilla + audiovisual', amount: 920000, stage: 'proposal', probability: 45, assignedTo: 'user-ops', nextAction: 'Reunión de encuadre', createdAt: '2026-08-02T15:30:00Z' },
      { id: 'opp-3', name: 'Panadería Trigo — campaña de apertura', amount: 480000, stage: 'qualified', probability: 30, assignedTo: 'user-admin', createdAt: '2026-08-08T09:15:00Z' },
      { id: 'opp-4', name: 'Bar Sur — pauta trimestral', amount: 2400000, stage: 'new', probability: 15, createdAt: '2026-08-14T18:00:00Z' },
      { id: 'opp-5', name: 'Cocina Norte — retainer anual', amount: 3600000, stage: 'won', probability: 100, assignedTo: 'user-ops', createdAt: '2026-06-20T11:00:00Z' },
      { id: 'opp-6', name: 'Food truck Delta — piloto', amount: 320000, stage: 'lost', probability: 0, lossReason: 'sin_presupuesto', createdAt: '2026-07-05T14:20:00Z' },
    ],
  })],
  [/\/automations\/catalog$/, () => ({
    triggers: [
      { key: 'deal.created', label: 'Trato creado', entityType: 'opportunity', event: 'deal.created' },
      { key: 'deal.stage_changed', label: 'Cambio de etapa', entityType: 'opportunity', event: 'deal.stage_changed' },
      { key: 'deal.won', label: 'Trato ganado', entityType: 'opportunity', event: 'deal.won' },
      { key: 'deal.lost', label: 'Trato perdido', entityType: 'opportunity', event: 'deal.lost' },
      { key: 'lead.converted', label: 'Prospecto convertido', entityType: 'lead', event: 'lead.converted' },
      { key: 'task.overdue', label: 'Tarea vencida', entityType: 'approval', event: 'task.overdue' },
      { key: 'deal.stale', label: 'Trato sin seguimiento', entityType: 'opportunity', event: 'deal.stale' },
    ],
    actions: [
      { key: 'notify_user', label: 'Enviar notificación', requiredConfig: ['userId', 'title', 'message'] },
      { key: 'notify_assignee', label: 'Notificar al responsable', requiredConfig: ['title', 'message'] },
      { key: 'send_email', label: 'Enviar correo', requiredConfig: ['to', 'subject', 'body'] },
      { key: 'assign_user', label: 'Asignar responsable', requiredConfig: ['userId'] },
      { key: 'add_comment', label: 'Agregar nota al hilo', requiredConfig: ['body'] },
      { key: 'send_webhook', label: 'Enviar webhook', requiredConfig: ['url'] },
      { key: 'create_contract', label: 'Abrir contrato del trato ganado', requiredConfig: [] },
    ],
  })],
  [/\/automations\/runs\/[^/?]+$/, () => ({
    run: { id: 'run-1', automationId: 'auto-1', automationVersion: 2, triggerKey: 'deal.won:opp-5::2', entityType: 'opportunity', entityId: 'opp-5', status: 'completed', attempts: 0, createdAt: '2026-08-16T10:00:00Z', finishedAt: '2026-08-16T12:00:04Z' },
    steps: [
      { id: 'step-1', nodeId: 'cond-1', nodeType: 'condition', nodeKey: 'field', status: 'completed', output: { result: true }, durationMs: 3, createdAt: '2026-08-16T10:00:00Z' },
      { id: 'step-2', nodeId: 'delay-1', nodeType: 'delay', nodeKey: 'wait', status: 'skipped', durationMs: 1, createdAt: '2026-08-16T10:00:00Z' },
      { id: 'step-3', nodeId: 'act-1', nodeType: 'action', nodeKey: 'notify_assignee', status: 'completed', output: { notifiedUserId: 'user-ops' }, durationMs: 42, createdAt: '2026-08-16T12:00:04Z' },
    ],
  })],
  [/\/automations\/[^/?]+\/runs$/, () => ([
    { id: 'run-1', automationId: 'auto-1', automationVersion: 2, triggerKey: 'deal.won:opp-5::2', entityType: 'opportunity', entityId: 'opp-5abc1234', status: 'completed', attempts: 0, createdAt: '2026-08-16T10:00:00Z', finishedAt: '2026-08-16T12:00:04Z' },
    { id: 'run-2', automationId: 'auto-1', automationVersion: 2, triggerKey: 'deal.won:opp-9::2', entityType: 'opportunity', entityId: 'opp-9def5678', status: 'waiting', attempts: 0, resumeAt: '2026-08-18T14:00:00Z', createdAt: '2026-08-18T12:00:00Z' },
    { id: 'run-3', automationId: 'auto-1', automationVersion: 1, triggerKey: 'deal.won:opp-3::1', entityType: 'opportunity', entityId: 'opp-3ghi9012', status: 'failed', attempts: 5, lastError: 'La persona indicada no está activa en la organización', createdAt: '2026-08-10T08:00:00Z', finishedAt: '2026-08-10T09:04:00Z' },
  ])],
  [/\/automations\/[^/?]+$/, () => ({
    id: 'auto-1',
    name: 'Avisar al ganar un trato grande',
    description: 'Cuando se gana un trato sobre el millón, avisa al responsable pasadas dos horas.',
    triggerType: 'deal.won',
    isActive: true,
    version: 2,
    runAsUserId: 'user-admin',
    createdAt: '2026-08-01T10:00:00Z',
    updatedAt: '2026-08-16T09:00:00Z',
    graph: {
      nodes: [
        { id: 'trigger', type: 'trigger', key: 'deal.won', config: {}, position: { x: 140, y: 20 } },
        { id: 'cond-1', type: 'condition', key: 'field', config: { field: 'amount', operator: 'greater_than', value: '1000000' }, position: { x: 140, y: 150 } },
        { id: 'delay-1', type: 'delay', key: 'wait', config: { amount: 2, unit: 'hours' }, position: { x: 40, y: 290 } },
        { id: 'act-1', type: 'action', key: 'notify_assignee', config: { title: 'Trato ganado', message: 'El trato cerró en {{amount}}.' }, position: { x: 40, y: 420 } },
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'cond-1' },
        { id: 'e2', source: 'cond-1', target: 'delay-1', branch: 'true' },
        { id: 'e3', source: 'delay-1', target: 'act-1' },
      ],
    },
  })],
  [/\/automations$/, () => ([
    { id: 'auto-1', name: 'Avisar al ganar un trato grande', description: 'Sobre el millón, avisa al responsable pasadas dos horas.', triggerType: 'deal.won', isActive: true, version: 2, runAsUserId: 'user-admin', graph: { nodes: [], edges: [] }, createdAt: '2026-08-01T10:00:00Z', updatedAt: '2026-08-16T09:00:00Z' },
    { id: 'auto-2', name: 'Nota al perder un trato', description: 'Deja constancia del motivo en el hilo.', triggerType: 'deal.lost', isActive: false, version: 1, runAsUserId: 'user-ops', graph: { nodes: [], edges: [] }, createdAt: '2026-08-05T16:00:00Z', updatedAt: '2026-08-05T16:00:00Z' },
  ])],
  /*
   * `/users` sin filtros, que es como lo piden el tablero de pipeline y el editor de
   * automatizaciones. Devuelve el sobre `{ data }` porque es la forma que esas vistas leen;
   * la regla de abajo, con `isActive=true`, responde un arreglo pelado a quienes ya la usaban.
   */
  /*
   * Una pieza de producción, para poder abrir su detalle y su bitácora.
   *
   * Devuelve un arreglo pelado porque es lo que responde `ListPiecesUseCase`; envolverlo en
   * `{ data }` rompía el detalle con `pieces.find is not a function`.
   */
  [/\/production\/pieces$/, () => ([{
    id: 'piece-1', title: 'Parrilla agosto — pieza 3', type: 'post', status: 'internal_review',
    udAmount: 4, correctionCount: 1, difficultyLevel: 2, clientName: 'Cocina Norte',
    assignedTo: 'user-cm', assignedName: 'Valentina Rojas',
    createdAt: '2026-08-10T12:00:00Z', assignedAt: '2026-08-11T09:00:00Z',
  }])],
  /* Resultado de una importación, con filas buenas y una rechazada. */
  [/\/crm\/leads\/import$/, (config) => {
    const body = typeof config?.data === 'string' ? JSON.parse(config.data) : config?.data;
    const total = Array.isArray(body?.rows) ? body.rows.length : 0;
    return {
      imported: Math.max(0, total - 1),
      duplicates: total > 1 ? 1 : 0,
      failed: total > 2
        ? [{ row: 4, name: 'Fila de ejemplo', reason: 'Sin correo ni teléfono: no hay forma de reconocer a la persona' }]
        : [],
    };
  }],
  /*
   * Moodboards del cliente, con uno aprobado y uno en borrador.
   *
   * Los dos hacen falta para poder revisar la barrera: el selector de conversión solo debe
   * ofrecer el aprobado.
   */
  [/\/moodboards/, () => ({
    data: [
      { id: 'mb-1', clientId: 'visual-client', title: 'Verano 2026 — aprobado', status: 'approved', images: [], createdAt: '2026-08-01T10:00:00Z' },
      { id: 'mb-2', clientId: 'visual-client', title: 'Otoño — en borrador', status: 'draft', images: [], createdAt: '2026-08-10T10:00:00Z' },
    ],
    total: 2,
  })],
  /* Una solicitud audiovisual aceptada, para poder abrir el modal de conversión. */
  [/\/intake\/requests(\?|$)/, () => ({
    data: [{
      id: 'req-1', code: 'SOL-00001', clientId: 'visual-client', area: 'audiovisual',
      title: 'Reel de la carta nueva', description: 'Grabar los cuatro platos de la carta de primavera.',
      priority: 'high', status: 'accepted', assignedTo: 'user-av',
      creativeFields: { tipoAudiovisual: 'reel', locacion: '__no_aplica__', duracion: '30 s' },
      createdAt: '2026-08-14T10:00:00Z',
      client: { id: 'visual-client', name: 'Cocina Norte' },
      requester: { id: 'user-cm', name: 'Valentina Rojas' },
    }],
    total: 1,
  })],
  /* Hilo de trabajo. Sirve a las cinco áreas, así que la regla mira el sufijo. */
  [/\/comments$/, () => ({
    proceso: [
      { id: 'c1', body: 'Se ajustó el encuadre según el moodboard aprobado.', authorName: 'Joaquín Muñoz', authorRole: 'designer', visibility: 'internal', createdAt: '2026-08-14T15:20:00Z' },
      { id: 'c2', body: 'Falta el logo en vector; se pidió al cliente.', authorName: 'Valentina Rojas', authorRole: 'community_manager', visibility: 'internal', editedAt: '2026-08-15T10:05:00Z', createdAt: '2026-08-15T09:40:00Z' },
    ],
    revision: [
      { id: 'c3', body: 'Nos gusta la propuesta, solo cambiar el color del texto.', authorName: 'Cliente', authorRole: 'client', visibility: 'client', createdAt: '2026-08-16T11:00:00Z' },
    ],
  })],
  [/\/users$/, () => ({
    data: [
      { id: 'user-admin', name: 'Camila Riquelme', role: 'admin', isActive: true },
      { id: 'user-ops', name: 'María Paredes', role: 'operations_director', isActive: true },
      { id: 'user-cm', name: 'Valentina Rojas', role: 'community_manager', isActive: true },
    ],
    total: 3,
  })],
  [/\/users\?isActive=true$/, () => {
    const sampleUsers = [
      { id:'user-admin', name:'Camila Riquelme', role:'admin', isActive:true },
      { id:'user-cm', name:'Valentina Rojas', role:'community_manager', isActive:true },
      { id:'user-designer', name:'Joaquín Muñoz', role:'designer', isActive:true },
      { id:'user-av', name:'Diego Venegas', role:'audiovisual', isActive:true },
      { id:'user-ops', name:'María Paredes', role:'operations_director', isActive:true },
    ];
    return sampleUsers;
  }],
  [/\/health\/details$/, () => ({
    status: 'ok', uptime: 86400, timestamp: new Date().toISOString(), version: '1.0.0',
    database: { status: 'ok', connected: true, writable: true, message: 'Conexión activa' },
    memory: { status: 'ok', usagePercent: '34%', freeMb: 340, totalMb: 512 },
    disk: { status: 'ok', writable: true, message: 'Escritura verificada' },
    redis: { status: 'not_configured', message: 'Modo visual: sin Redis' },
  })],
  [/\/consent\/active$/, () => null], // null → muestra EmptyState "Sin consentimiento publicado"
  [/\/consent\/pending-count$/, () => ({ pending: 0, total: 0 })],
  [/\/settings\?prefix=security\.password$/, () => ({
    'security.password.minLength': '8',
    'security.password.requireUppercase': 'true',
    'security.password.requireNumber': 'true',
    'security.password.requireSpecial': 'false',
    'security.password.expiryDays': '90',
    'security.password.preventReuse': '5',
  })],
  [/\/organizations\/features$/, () => ({ features: forEveryModule(true) })],
  [/\/settings$/, () => {
    const lifecycleSettings: Array<{ key: string; value: string; source: 'organization' }> = [];
    for (const mod of ORGANIZATION_MODULE_CATALOG) {
      lifecycleSettings.push({ key: `modules.lifecycle.${mod.key}`, value: mod.lifecycle, source: 'organization' });
    }
    return lifecycleSettings;
  }],
  // Solicitudes (modo visual): simula la bandeja en memoria para probar el flujo completo.
  [/\/service-requests(\?[^/]*)?$/i, (config) => {
    const method = (config?.method ?? 'get').toLowerCase();
    const body = typeof config?.data === 'string' ? JSON.parse(config.data) : config?.data;
    if (method === 'post') {
      const row: any = {
        id: `visual-request-${visualRequests.length + 1}`,
        type: body?.type ?? 'support',
        status: 'received',
        requesterName: body?.requesterName ?? 'Modo Visual',
        requesterEmail: (body?.requesterEmail ?? 'visual@espartanos.local').toLowerCase(),
        requesterRut: body?.requesterRut ?? '11111111-1',
        requesterPhone: body?.requesterPhone ?? null,
        message: body?.message ?? null,
        resolutionNote: null,
        resolvedBy: null,
        resolvedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      visualRequests.unshift(row);
      return { id: row.id, status: row.status };
    }
    return visualRequests;
  }],
  [/\/service-requests\/status/i, (config) => {
    const url = config?.url ?? '';
    const email = new URLSearchParams((url.split('?')[1] ?? '')).get('email')?.toLowerCase() ?? '';
    const rut = new URLSearchParams((url.split('?')[1] ?? '')).get('rut') ?? '';
    return visualRequests
      .filter((r) => r.requesterEmail === email && r.requesterRut === rut)
      .map((r) => ({ id: r.id, type: r.type, status: r.status, message: r.message, resolutionNote: r.resolutionNote, createdAt: r.createdAt, resolvedAt: r.resolvedAt }));
  }],
  [/\/service-requests\/([^/?]+)\/anonymize$/i, (config) => {
    const id = config.url.split('/').filter(Boolean).pop();
    const row = visualRequests.find((r) => r.id === id);
    if (row) { row.status = 'resolved'; row.resolutionNote = 'Datos anonimizados (modo visual)'; row.resolvedBy = 'visual-user'; row.resolvedAt = new Date().toISOString(); }
    return row ?? { id, status: 'resolved' };
  }],
  [/\/service-requests\/([^/?]+)$/i, (config) => {
    const id = (config.url.match(/\/service-requests\/([^/?]+)$/) ?? [])[1];
    if (config.method?.toLowerCase() === 'put') {
      const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
      const row = visualRequests.find((r) => r.id === id);
      if (row) { row.status = body?.status ?? row.status; row.resolutionNote = body?.resolutionNote ?? row.resolutionNote; row.resolvedBy = 'visual-user'; row.resolvedAt = new Date().toISOString(); }
      return row ?? { id, status: 'resolved', resolutionNote: body?.resolutionNote };
    }
    return visualRequests.find((r) => r.id === id) ?? { id, status: 'received' };
  }],
];

/** Adaptador de axios que resuelve toda peticion en memoria, siempre con 200. */
const visualAdapter: AxiosAdapter = async (config) => {
  const url = config.url ?? '';
  const route = ROUTES.find(([pattern]) => pattern.test(url));
  return {
    data: route ? route[1](config) : emptyPayload(),
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  } as never;
};

if (VISUAL_MODE) {
  /*
   * Se instala por partida doble a proposito. `defaults.adapter` cubre el caso normal, y el
   * envoltorio de `create` garantiza que la instancia de `core/api.ts` lo reciba aunque axios
   * cambie como fusiona los defaults. Este archivo se importa antes que `App` en `main.tsx`,
   * asi que ambos quedan puestos antes de que se construya esa instancia.
   */
  axios.defaults.adapter = visualAdapter;
  const createInstance = axios.create.bind(axios);
  axios.create = ((config = {}) =>
    createInstance({ ...config, adapter: visualAdapter })) as typeof axios.create;

  /*
   * Deja fuera la caché en disco que mantiene `query-persistence.ts`.
   *
   * Esa copia viaja por JSON, y `JSON.stringify` de un array descarta las propiedades que no
   * son índices: el vacío de arriba vuelve del disco convertido en `[]` pelado, sin `data` ni
   * los contenedores anidados, y una vista que lee `data.funnel.views` se cae antes de que la
   * primera peticion alcance a responder.
   *
   * Se apaga haciendo fallar la apertura, no borrando la base: `offline-store.ts` ya trata ese
   * caso como almacen no disponible y vuelve inocuas todas sus operaciones, mientras que
   * borrarla dependeria de ganarle la carrera al primer `restoreQueryCache`.
   */
  indexedDB.open = () => { throw new Error('modo visual: almacen local desactivado'); };
  indexedDB.deleteDatabase('espartanos');

  console.info(
    '[modo visual] Sin backend. Sesion abierta como admin y %d modulos visibles.',
    MODULE_KEYS.length,
  );
}
