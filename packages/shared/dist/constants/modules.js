"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRODUCT_VISIBLE_LIFECYCLES = exports.WEB_ONLY_MODULE_CATALOG = exports.AGENCY_CORE_MODULE_KEYS = exports.ORGANIZATION_MODULE_CATALOG = exports.MODULE_LIFECYCLE_LABELS = exports.MODULE_LIFECYCLE_STATUSES = void 0;
exports.buildAgencyCoreOrganizationFeatures = buildAgencyCoreOrganizationFeatures;
exports.isModuleLifecycleVisible = isModuleLifecycleVisible;
exports.getOrganizationModuleLifecycle = getOrganizationModuleLifecycle;
exports.isOrganizationModuleVisible = isOrganizationModuleVisible;
exports.buildDefaultOrganizationModuleLifecycleMap = buildDefaultOrganizationModuleLifecycleMap;
exports.moduleLifecycleSettingKey = moduleLifecycleSettingKey;
exports.MODULE_LIFECYCLE_STATUSES = ['development', 'pilot', 'active', 'maintenance', 'disabled'];
/** Etiqueta en español de cada estado de ciclo de vida, para mostrarla al usuario. */
exports.MODULE_LIFECYCLE_LABELS = {
    development: 'En desarrollo',
    pilot: 'Piloto',
    active: 'Activo',
    maintenance: 'En mantenimiento',
    disabled: 'Deshabilitado',
};
/**
 * Modulos gobernados por la organizacion.
 *
 * `lifecycle` responde "el producto lo ofrece hoy".
 * `defaultEnabled` responde "si creo una organizacion nueva, este modulo parte encendido".
 */
exports.ORGANIZATION_MODULE_CATALOG = [
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
    // Ofrecidos por el producto y listos para usarse, pero apagados de fabrica: quedan a un
    // interruptor de distancia en el panel de administracion, sin tocar codigo.
    { key: 'crm', lifecycle: 'active', defaultEnabled: false },
    { key: 'commercialPipeline', lifecycle: 'active', defaultEnabled: false },
    { key: 'production', lifecycle: 'active', defaultEnabled: false },
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
    { key: 'intake', lifecycle: 'active', defaultEnabled: false },
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
    { key: 'clientMetricsPanel', lifecycle: 'active', defaultEnabled: false },
    { key: 'multiClientOnboarding', lifecycle: 'active', defaultEnabled: false },
    { key: 'udBudget', lifecycle: 'active', defaultEnabled: false },
    { key: 'gamification', lifecycle: 'active', defaultEnabled: false },
    { key: 'billing', lifecycle: 'active', defaultEnabled: false },
    { key: 'contracts', lifecycle: 'active', defaultEnabled: false },
    { key: 'catalog', lifecycle: 'active', defaultEnabled: false },
    { key: 'content', lifecycle: 'active', defaultEnabled: false },
    { key: 'briefs', lifecycle: 'active', defaultEnabled: false },
    { key: 'meetings', lifecycle: 'active', defaultEnabled: false },
    { key: 'documents', lifecycle: 'active', defaultEnabled: false },
    { key: 'approvals', lifecycle: 'active', defaultEnabled: false },
    /*
     * Audiovisual no puede apagarse mientras el intake acepte solicitudes de su area.
     *
     * Agendar una sesion exige un moodboard aprobado, y los moodboards se crean y se aprueban
     * unicamente en esta pantalla. Apagarla deja a la direccion audiovisual sin donde aprobarlo
     * y, con ello, sin poder convertir ninguna solicitud de su area.
     */
    { key: 'audiovisual', lifecycle: 'active', defaultEnabled: false },
    { key: 'knowledge', lifecycle: 'active', defaultEnabled: false },
    { key: 'onboarding', lifecycle: 'active', defaultEnabled: false },
    { key: 'operations', lifecycle: 'active', defaultEnabled: false },
    // Sostiene la auditoría y el acceso técnico de Desarrollo. No se muestra como navegación
    // para Administración, pero no puede nacer apagado sin dejar la revisión diaria sin datos.
    { key: 'governance', lifecycle: 'active', defaultEnabled: true },
    { key: 'direction', lifecycle: 'active', defaultEnabled: false },
    // Encuestas propias, distintas de la encuesta post-visita que ya vive dentro de reservas.
    // Su API existe (`SurveysController`), asi que el producto ya la ofrece; nace apagada
    // porque distribuir una encuesta es una decision de cada organizacion, no un valor por
    // defecto, y queda a un interruptor de distancia en el panel de administracion.
    { key: 'surveys', lifecycle: 'active', defaultEnabled: false },
];
exports.AGENCY_CORE_MODULE_KEYS = [
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
];
const AGENCY_CORE_MODULE_SET = new Set(exports.AGENCY_CORE_MODULE_KEYS);
function buildAgencyCoreOrganizationFeatures() {
    return Object.fromEntries(exports.ORGANIZATION_MODULE_CATALOG.map((item) => [item.key, AGENCY_CORE_MODULE_SET.has(item.key)]));
}
/**
 * Modulos de UI sin interruptor por organizacion.
 *
 * Se mantienen en el mismo catalogo conceptual porque el frontend tambien necesita saber
 * si siguen en desarrollo o si ya pueden mostrarse.
 */
exports.WEB_ONLY_MODULE_CATALOG = [
    { key: 'adsInsights', lifecycle: 'active' },
];
exports.PRODUCT_VISIBLE_LIFECYCLES = new Set(['active', 'pilot', 'maintenance']);
function isModuleLifecycleVisible(lifecycle) {
    return exports.PRODUCT_VISIBLE_LIFECYCLES.has(lifecycle);
}
const ORGANIZATION_MODULE_LIFECYCLE_MAP = Object.fromEntries(exports.ORGANIZATION_MODULE_CATALOG.map((item) => [item.key, item.lifecycle]));
function getOrganizationModuleLifecycle(module) {
    return ORGANIZATION_MODULE_LIFECYCLE_MAP[module];
}
function isOrganizationModuleVisible(module) {
    return isModuleLifecycleVisible(getOrganizationModuleLifecycle(module));
}
function buildDefaultOrganizationModuleLifecycleMap() {
    return Object.fromEntries(exports.ORGANIZATION_MODULE_CATALOG.map((item) => [item.key, item.lifecycle]));
}
function moduleLifecycleSettingKey(module) {
    return `modules.lifecycle.${module}`;
}
//# sourceMappingURL=modules.js.map