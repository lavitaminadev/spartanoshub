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

/** Perfil con acceso total, usado para responder `/auth/me`. */
const VISUAL_USER = {
  id: 'visual-user',
  name: 'Modo Visual',
  email: 'visual@espartanos.local',
  role: 'admin',
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
const ROUTES: Array<[RegExp, () => unknown]> = [
  [/\/auth\/session$/, () => ({ authenticated: true, accessToken: syntheticJwt() })],
  [/\/auth\/refresh$/, () => ({ accessToken: syntheticJwt() })],
  [/\/auth\/login$/, () => ({ accessToken: syntheticJwt(), user: VISUAL_USER })],
  [/\/auth\/me$/, () => VISUAL_USER],
  [/\/me\/permissions$/, () => ({ permissions: forEveryModule('manage') })],
  [/\/auth\/logout$/, () => ({})],
  [/\/notifications\/unread/, () => ({ unread: 0 })],
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
  [/\/role-access\/exceptions$/, () => ({
    items: [
      { id:'exc-001', userId:'user-cm', userName:'Valentina Rojas', userRole:'community_manager', module:'production', level:'edit', reason:'Campaña Q1 — necesita ver el tablero de producción por dos semanas', expiresAt: new Date(Date.now() + 14*864e5).toISOString(), status:'active', createdAt: new Date(Date.now() - 2*864e5).toISOString() },
      { id:'exc-002', userId:'user-designer', userName:'Joaquín Muñoz', userRole:'designer', module:'crm', level:'view', reason:'Cobertura de vacaciones — puede ver contactos pero no editar', expiresAt: new Date(Date.now() + 3*864e5).toISOString(), status:'active', createdAt: new Date(Date.now() - 864e5).toISOString() },
      { id:'exc-003', userId:'user-av', userName:'Diego Venegas', userRole:'audiovisual', module:'reports', level:'edit', reason:'Reporte trimestral del equipo AV', expiresAt: null, status:'active', createdAt: new Date(Date.now() - 5*864e5).toISOString() },
    ],
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
];

/** Adaptador de axios que resuelve toda peticion en memoria, siempre con 200. */
const visualAdapter: AxiosAdapter = async (config) => {
  const url = config.url ?? '';
  const route = ROUTES.find(([pattern]) => pattern.test(url));
  return {
    data: route ? route[1]() : emptyPayload(),
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
