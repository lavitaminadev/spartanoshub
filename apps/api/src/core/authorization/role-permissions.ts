import { UserRole } from '../../modules/organizations/user-role.enum';
import { ORGANIZATION_FEATURE_KEYS, OrganizationFeatureKey } from '../../modules/organizations/organization-features';
import { PermissionLevel } from './permission-level';

/**
 * Acceso que cada cargo tiene a cada módulo.
 *
 * Vive en código y no en base de datos porque es una definición de producto: qué puede
 * hacer un community manager es una decisión que se revisa en un cambio de código, no un
 * dato operativo. Las desviaciones para una persona concreta sí son datos y viven en
 * `user_permission_overrides`.
 *
 * Un módulo ausente en el mapa de un rol equivale a `none`.
 */
type RoleModuleMap = Partial<Record<OrganizationFeatureKey, PermissionLevel>>;

/** Módulos que todo miembro del equipo puede consultar. */
const TEAM_BASELINE: RoleModuleMap = {
  dashboard: 'view',
  settings: 'view',
};

export const ROLE_PERMISSIONS: Record<UserRole, RoleModuleMap> = {
  /**
   * Administración resuelve el uso cotidiano del sistema, no la configuración del producto.
   * La matriz base, módulos y lifecycle quedan reservados para Desarrollo.
   */
  [UserRole.ADMIN]: {
    dashboard: 'view',
    users: 'manage',
    settings: 'manage',
    integrations: 'manage',
    governance: 'view',
  },

  /**
   * Cargo de desarrollo: una sola persona por organización. Es la única que ve y opera los
   * módulos en desarrollo, para poder levantarlos, probarlos y pasarlos a producción sin
   * abrirle la fase a todo el equipo. Maneja todos los módulos.
   */
  [UserRole.DEV]: Object.fromEntries(
    ORGANIZATION_FEATURE_KEYS.map((key) => [key, 'manage' as PermissionLevel]),
  ) as RoleModuleMap,

  /**
   * Pipeline, precios, contratos y visión global del negocio.
   *
   * Su tablero pide ocupación del equipo, capacidad frente a demanda, UD consumidas y
   * rentabilidad por cliente, así que necesita lectura sobre operación, producción y
   * presupuesto aunque no los administre.
   *
   * `reservations` en `edit` porque quien vende suele dejar configurada la disponibilidad del
   * local durante el onboarding. Es el candidato más claro a recortar cuando se revise si
   * cada cargo necesita todo lo que hoy alcanza.
   */
  [UserRole.COMMERCIAL_DIRECTOR]: {
    ...TEAM_BASELINE,
    clients: 'manage',
    crm: 'manage',
    commercialPipeline: 'manage',
    catalog: 'manage',
    contracts: 'manage',
    billing: 'manage',
    direction: 'manage',
    settings: 'edit',
    reports: 'view',
    reservations: 'edit',
    surveys: 'manage',
    operations: 'view',
    production: 'view',
    intake: 'view',
    udBudget: 'view',
    governance: 'manage',
    integrations: 'edit',
    clientMetricsPanel: 'view',
  },

  [UserRole.OPERATIONS_DIRECTOR]: {
    ...TEAM_BASELINE,
    clients: 'manage',
    users: 'manage',
    crm: 'edit',
    reservations: 'manage',
    surveys: 'manage',
    production: 'manage',
    intake: 'manage',
    content: 'view',
    briefs: 'manage',
    meetings: 'manage',
    documents: 'manage',
    approvals: 'manage',
    onboarding: 'manage',
    operations: 'manage',
    // Responde por el cumplimiento de la operación, así que administra gobierno en vez de
    // solo mirarlo. Ajusta presupuestos y emite reportes, de ahí el `edit` en ambos.
    governance: 'manage',
    direction: 'edit',
    settings: 'edit',
    udBudget: 'edit',
    reports: 'edit',
    audiovisual: 'edit',
    gamification: 'edit',
    billing: 'edit',
    contracts: 'edit',
    integrations: 'edit',
    clientMetricsPanel: 'view',
    multiClientOnboarding: 'manage',
  },

  /**
   * Estrategia de cuentas, aprobación creativa y moodboards.
   *
   * `audiovisual` en `edit` no es opcional: el flujo de moodboards es "la community manager
   * lo crea, la dirección creativa lo verifica, la dirección audiovisual asigna equipo". Sin
   * ese nivel, el segundo paso no se puede ejecutar.
   */
  [UserRole.CREATIVE_DIRECTOR]: {
    ...TEAM_BASELINE,
    content: 'manage',
    briefs: 'manage',
    approvals: 'manage',
    audiovisual: 'edit',
    meetings: 'edit',
    clients: 'edit',
    documents: 'view',
    production: 'view',
    intake: 'view',
    udBudget: 'view',
    reports: 'edit',
    direction: 'view',
  },

  /** Estándar gráfico y asignación de diseño. Asigna las piezas que consumen presupuesto. */
  [UserRole.ART_DIRECTOR]: {
    ...TEAM_BASELINE,
    production: 'manage',
    intake: 'manage',
    approvals: 'manage',
    gamification: 'manage',
    udBudget: 'edit',
    clients: 'view',
    content: 'view',
    direction: 'view',
    reports: 'view',
  },

  /**
   * Sesiones, equipo y edición de video y foto. Crea las piezas audiovisuales que produce.
   *
   * `production` en `manage` por lo mismo que Dirección de Arte: asigna el trabajo de su área y
   * decide qué solicitudes entran. Con `edit` quedaría al mismo nivel que quien ejecuta la
   * pieza, y asignar y ejecutar no son la misma responsabilidad.
   */
  [UserRole.AV_DIRECTOR]: {
    ...TEAM_BASELINE,
    audiovisual: 'manage',
    production: 'manage',
    intake: 'manage',
    // Queda listo para el puntaje del área audiovisual, que aún no está definido.
    gamification: 'edit',
    clients: 'view',
    content: 'view',
    udBudget: 'view',
    direction: 'view',
    reports: 'view',
  },

  /** Flujos de inteligencia artificial transversales y su validación. */
  [UserRole.AI_LEAD]: {
    ...TEAM_BASELINE,
    knowledge: 'manage',
    operations: 'view',
    production: 'view',
    intake: 'view',
    reports: 'view',
  },

  /**
   * Grillas, reuniones de seguimiento y validación con el cliente.
   *
   * Crea los moodboards que la dirección creativa verifica, de ahí `audiovisual`. Y planifica
   * la grilla que consume el presupuesto de diseño, así que necesita verlo: sin eso planifica
   * a ciegas contra un tope que sí se le aplica.
   */
  [UserRole.COMMUNITY_MANAGER]: {
    ...TEAM_BASELINE,
    content: 'manage',
    crm: 'edit',
    reservations: 'edit',
    surveys: 'edit',
    meetings: 'edit',
    approvals: 'edit',
    audiovisual: 'edit',
    briefs: 'edit',
    clients: 'edit',
    documents: 'view',
    production: 'view',
    intake: 'view',
    udBudget: 'view',
    reports: 'edit',
    direction: 'view',
  },

  /**
   * `gamification` en `edit` porque el puntaje admite revisión dentro de las 24 horas
   * siguientes: con solo lectura no podría reclamarlo. Ve el presupuesto que consume su pieza.
   */
  [UserRole.DESIGNER]: {
    ...TEAM_BASELINE,
    production: 'edit',
    intake: 'edit',
    gamification: 'edit',
    content: 'view',
    udBudget: 'view',
    direction: 'view',
  },

  [UserRole.AUDIOVISUAL]: {
    ...TEAM_BASELINE,
    production: 'edit',
    intake: 'edit',
    audiovisual: 'edit',
    gamification: 'edit',
    content: 'view',
    udBudget: 'view',
    direction: 'view',
  },

  /**
   * El cliente entra por su portal, no por la aplicación interna: su acceso se limita a
   * consultar lo suyo y a validar piezas.
   */
  [UserRole.CLIENT]: {
    // `edit` y no `view`: el cliente configura su propio horario semanal, bloquea días y
    // franjas y fija su tope diario desde el portal. Es un requisito explícito del alcance de
    // reservas —"lo maneja el propio cliente"— y dos de sus criterios de aceptación dependen
    // de ello. Con `view` esas pantallas responden 403 aunque el menú las muestre.
    reservations: 'edit',
    content: 'view',
    approvals: 'edit',
    // Lee los documentos que la agencia le comparte y marca como cumplidos los compromisos
    // que le tocan de una reunión. Ambas cosas son suyas; no alcanza las de otras cuentas.
    documents: 'view',
    meetings: 'edit',
    // Ve su propia ficha en el portal. El alcance por cuenta lo limita a la suya: `view` acá
    // no le abre la cartera de clientes de la agencia.
    clients: 'view',
    reports: 'view',
    clientMetricsPanel: 'view',
  },
};

/**
 * Nivel que el rol otorga sobre un módulo, sin considerar excepciones por usuario.
 *
 * @returns El nivel definido para el rol, o `'none'` si el módulo no está en su mapa.
 */
export function roleLevel(role: UserRole, module: OrganizationFeatureKey): PermissionLevel {
  return ROLE_PERMISSIONS[role]?.[module] ?? 'none';
}
