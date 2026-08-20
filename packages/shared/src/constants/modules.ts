/**
 * @fileoverview Catalogo unico de modulos del producto.
 *
 * Centraliza dos decisiones que antes estaban duplicadas:
 * - si el modulo forma parte de la oferta visible del producto hoy;
 * - si, cuando una organizacion nueva se crea, ese modulo nace encendido o apagado.
 *
 * El backend usa este catalogo para resolver permisos efectivos y valores por defecto.
 * El frontend lo usa para decidir si un modulo puede mostrarse siquiera.
 */

export const MODULE_LIFECYCLE_STATUSES = ['development', 'pilot', 'active', 'maintenance', 'disabled'] as const;
export type ModuleLifecycleStatus = (typeof MODULE_LIFECYCLE_STATUSES)[number];

/** Etiqueta en español de cada estado de ciclo de vida, para mostrarla al usuario. */
export const MODULE_LIFECYCLE_LABELS: Record<ModuleLifecycleStatus, string> = {
  development: 'En desarrollo',
  pilot: 'Piloto',
  active: 'Activo',
  maintenance: 'En mantenimiento',
  disabled: 'Deshabilitado',
};

export interface ProductModuleDefinition<Key extends string = string> {
  key: Key;
  lifecycle: ModuleLifecycleStatus;
  defaultEnabled: boolean;
}

/**
 * Modulos gobernados por la organizacion.
 *
 * `lifecycle` responde "el producto lo ofrece hoy".
 * `defaultEnabled` responde "si creo una organizacion nueva, este modulo parte encendido".
 */
export const ORGANIZATION_MODULE_CATALOG = [
  // Base minima: sin estos modulos la aplicacion no se puede usar. No es una preferencia
  // comercial, es lo que sostienen los guardias del backend:
  // - `dashboard` es la pantalla de aterrizaje de todo cargo que no sea cliente.
  // - `settings` gobierna `/settings` y `/organizations` (de ahi salen los interruptores).
  // - `users` gobierna `/users` y `/roles/permissions` (la matriz del panel de administracion).
  // - `clients` gobierna `GET /clients`, que consultan las cinco pantallas de reservas para
  //   poblar el selector de cuenta; sin el, no se puede crear un formulario de reserva.
  // - `reports` gobierna `/reporting/*`, de donde el dashboard y el pulso toman sus datos.
  // - `integrations` gobierna `/integrations/meta/*`, que es como una reserva se convierte en
  //   conversion enviada a Meta: apagarlo deja la captacion sin su ultimo tramo.
  { key: 'dashboard', lifecycle: 'active', defaultEnabled: true },
  { key: 'settings', lifecycle: 'active', defaultEnabled: true },
  { key: 'users', lifecycle: 'active', defaultEnabled: true },
  { key: 'clients', lifecycle: 'active', defaultEnabled: true },
  { key: 'reports', lifecycle: 'active', defaultEnabled: true },
  { key: 'integrations', lifecycle: 'active', defaultEnabled: true },

  // Operacion en produccion hoy: reservas y su circuito de captacion.
  { key: 'reservations', lifecycle: 'active', defaultEnabled: true },

  // Encendidos de fabrica, como todo el catalogo.
  //
  // Antes venian apagados y habia que buscarlos en el panel de administracion para poder
  // usarlos, de modo que una instalacion nueva se veia incompleta sin que nada lo explicara:
  // 22 de los 31 modulos no aparecian por ningun lado. Quien no quiera uno lo apaga en el
  // panel, que es una decision mas facil de tomar viendo lo que hay que adivinando lo que
  // falta. El interruptor por organizacion sigue existiendo; lo que cambia es de que lado
  // arranca.
  { key: 'crm', lifecycle: 'active', defaultEnabled: true },
  { key: 'commercialPipeline', lifecycle: 'active', defaultEnabled: true },
  { key: 'production', lifecycle: 'active', defaultEnabled: true },

  /**
   * Puerta de entrada del trabajo: recibir una solicitud, revisarla y asignarla.
   *
   * Se separa de `production` porque son dos decisiones de liberacion distintas. Recibir y
   * coordinar solicitudes esta listo para usarse; el tablero de piezas con su presupuesto y su
   * XP todavia no. Con una sola clave, liberar lo primero obligaba a exponer lo segundo.
   *
   * No se separa la logica de dominio: una solicitud sigue convirtiendose en piezas. Lo que se
   * separa es cuando cada parte queda disponible.
   */
  { key: 'intake', lifecycle: 'active', defaultEnabled: true },

  /*
   * Disponibles en el codigo y apagados de fabrica.
   *
   * El ciclo de vida y el interruptor responden preguntas distintas: el primero dice si el
   * codigo ofrece el modulo, el segundo si la agencia lo esta usando. Mientras estuvieron en
   * `development`, abrir uno exigia tocar este archivo y desplegar; ahora se cambia desde el
   * panel de Desarrollo, que es donde corresponde y donde es reversible.
   *
   * Que esten activos no los hace aparecer: sin encender su interruptor y sin permiso en la
   * matriz de cargos, nadie los ve.
   *
   * Varios tienen la pantalla a medio hacer —conocimiento, gamificacion, aprobaciones,
   * facturacion y direccion son los mas pobres, con backend completo y muy poca interfaz—. Se
   * dejan disponibles igualmente porque encenderlos y apagarlos ya no cuesta un despliegue.
   */
  { key: 'clientMetricsPanel', lifecycle: 'active', defaultEnabled: true },
  { key: 'multiClientOnboarding', lifecycle: 'active', defaultEnabled: true },
  { key: 'udBudget', lifecycle: 'active', defaultEnabled: true },
  { key: 'gamification', lifecycle: 'active', defaultEnabled: true },
  { key: 'billing', lifecycle: 'active', defaultEnabled: true },
  { key: 'contracts', lifecycle: 'active', defaultEnabled: true },
  { key: 'catalog', lifecycle: 'active', defaultEnabled: true },
  { key: 'content', lifecycle: 'active', defaultEnabled: true },
  { key: 'briefs', lifecycle: 'active', defaultEnabled: true },
  { key: 'meetings', lifecycle: 'active', defaultEnabled: true },
  { key: 'documents', lifecycle: 'active', defaultEnabled: true },
  { key: 'approvals', lifecycle: 'active', defaultEnabled: true },
  /*
   * Audiovisual no puede apagarse mientras el intake acepte solicitudes de su area.
   *
   * Agendar una sesion exige un moodboard aprobado, y los moodboards se crean y se aprueban
   * unicamente en esta pantalla. Apagarla deja a la direccion audiovisual sin donde aprobarlo
   * y, con ello, sin poder convertir ninguna solicitud de su area.
   */
  { key: 'audiovisual', lifecycle: 'active', defaultEnabled: true },
  { key: 'knowledge', lifecycle: 'active', defaultEnabled: true },
  { key: 'onboarding', lifecycle: 'active', defaultEnabled: true },
  { key: 'operations', lifecycle: 'active', defaultEnabled: true },
  // Sostiene la auditoría y el acceso técnico de Desarrollo. No se muestra como navegación
  // para Administración, pero no puede nacer apagado sin dejar la revisión diaria sin datos.
  { key: 'governance', lifecycle: 'active', defaultEnabled: true },
  { key: 'direction', lifecycle: 'active', defaultEnabled: true },
  // Encuestas propias, distintas de la encuesta post-visita que ya vive dentro de reservas.
  // Su API existe (`SurveysController`), asi que el producto ya la ofrece; nace apagada
  // porque distribuir una encuesta es una decision de cada organizacion, no un valor por
  // defecto, y queda a un interruptor de distancia en el panel de administracion.
  { key: 'surveys', lifecycle: 'active', defaultEnabled: true },
] as const satisfies readonly ProductModuleDefinition[];

export type OrganizationModuleKey = (typeof ORGANIZATION_MODULE_CATALOG)[number]['key'];

export const AGENCY_CORE_MODULE_KEYS = [
  'dashboard',
  'settings',
  'users',
  'clients',
  'reports',
  'integrations',
  'reservations',
  'governance',
  'crm',
  'surveys',
] as const satisfies readonly OrganizationModuleKey[];

const AGENCY_CORE_MODULE_SET = new Set<OrganizationModuleKey>(AGENCY_CORE_MODULE_KEYS);

export type OrganizationFeaturesMap = Record<OrganizationModuleKey, boolean>;

export function buildAgencyCoreOrganizationFeatures(): OrganizationFeaturesMap {
  return Object.fromEntries(
    ORGANIZATION_MODULE_CATALOG.map((item) => [item.key, AGENCY_CORE_MODULE_SET.has(item.key)]),
  ) as OrganizationFeaturesMap;
}

/**
 * Modulos de UI sin interruptor por organizacion.
 *
 * Se mantienen en el mismo catalogo conceptual porque el frontend tambien necesita saber
 * si siguen en desarrollo o si ya pueden mostrarse.
 */
export const WEB_ONLY_MODULE_CATALOG = [
  { key: 'adsInsights', lifecycle: 'active' },
] as const;

export type WebOnlyModuleKey = (typeof WEB_ONLY_MODULE_CATALOG)[number]['key'];
export type ProductModuleKey = OrganizationModuleKey | WebOnlyModuleKey;

export const PRODUCT_VISIBLE_LIFECYCLES = new Set<ModuleLifecycleStatus>(['active', 'pilot', 'maintenance']);

export function isModuleLifecycleVisible(lifecycle: ModuleLifecycleStatus): boolean {
  return PRODUCT_VISIBLE_LIFECYCLES.has(lifecycle);
}

const ORGANIZATION_MODULE_LIFECYCLE_MAP = Object.fromEntries(
  ORGANIZATION_MODULE_CATALOG.map((item) => [item.key, item.lifecycle]),
) as Record<OrganizationModuleKey, ModuleLifecycleStatus>;

export function getOrganizationModuleLifecycle(module: OrganizationModuleKey): ModuleLifecycleStatus {
  return ORGANIZATION_MODULE_LIFECYCLE_MAP[module];
}

export function isOrganizationModuleVisible(module: OrganizationModuleKey): boolean {
  return isModuleLifecycleVisible(getOrganizationModuleLifecycle(module));
}

export type OrganizationModuleLifecycleMap = Record<OrganizationModuleKey, ModuleLifecycleStatus>;

export function buildDefaultOrganizationModuleLifecycleMap(): OrganizationModuleLifecycleMap {
  return Object.fromEntries(
    ORGANIZATION_MODULE_CATALOG.map((item) => [item.key, item.lifecycle]),
  ) as OrganizationModuleLifecycleMap;
}

export function moduleLifecycleSettingKey(module: OrganizationModuleKey): `modules.lifecycle.${OrganizationModuleKey}` {
  return `modules.lifecycle.${module}`;
}
