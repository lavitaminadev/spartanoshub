/**
 * Módulos cuyo sujeto es una empresa atendida por la agencia, y que por eso se contratan por
 * empresa: Producción, Audiovisual, Contenido, Aprobaciones, Reuniones, Documentos, Briefs,
 * Facturación, Contratos, Intake, Informes y Embudo comercial.
 *
 * Cada clave coincide con la clave del módulo en el catálogo de la organización, porque el
 * guard de permisos comprueba la capacidad con el mismo nombre del módulo que protege la ruta.
 * Los módulos de la agencia misma —Ajustes, Gamificación, Catálogo, Conocimiento, Onboarding,
 * Dirección, Operaciones, Gobierno, Automatizaciones— no figuran: no hay «empresa» de la que
 * contratarlos y se gobiernan sólo con cargo y permiso.
 */
export const CAPACIDADES_DE_MODULO = [
  'production',
  'audiovisual',
  'content',
  'approvals',
  'meetings',
  'documents',
  'briefs',
  'billing',
  'contracts',
  'intake',
  'reports',
  'commercialPipeline',
] as const;

export const CLIENT_CAPABILITY_KEYS = [
  'reservations',
  'crm',
  'surveys',
  'marketing',
  'metaConversions',
  'googleConversions',
  'budgetVisibility',
  'detalleDeContactoEnAvisos',
  ...CAPACIDADES_DE_MODULO,
] as const;

export type ClientCapabilityKey = (typeof CLIENT_CAPABILITY_KEYS)[number];
export type ClientCapabilities = Record<ClientCapabilityKey, boolean>;

export const DEFAULT_CLIENT_CAPABILITIES: ClientCapabilities = {
  reservations: true,
  crm: true,
  /**
   * Encuestas de clientes de esta empresa. Encendida como CRM y Reservas: las empresas que ya
   * usaban encuestas siguen igual, y se apaga cuenta por cuenta.
   */
  surveys: true,
  /**
   * Si esta empresa ve en el portal su lista de quienes aceptaron recibir correo.
   *
   * Nace apagada, al revés que Reservas, CRM y Encuestas: aquéllas se encendieron para no
   * quitarle nada a quien ya las usaba, y aquí no hay nada que conservar —ninguna empresa la
   * tiene hoy—. Encenderla entrega una lista de direcciones con el respaldo de cada permiso,
   * que es una decisión comercial de una cuenta concreta y no el efecto secundario de un
   * despliegue.
   */
  marketing: false,
  // Las capacidades que envían datos personales a terceros van desactivadas
  // por defecto: deben habilitarse de forma explícita por empresa.
  metaConversions: false,
  googleConversions: false,
  /**
   * Si esta empresa ve su saldo de presupuesto en el portal.
   *
   * Va por empresa y no por organización porque liberar el saldo es una decisión comercial
   * que se toma cuenta por cuenta: un plan puede exponerlo y otro no, y el parámetro global
   * `ud.client_visibility` no permite esa diferencia.
   *
   * Nace apagada. La política declarada es que ningún costo quede oculto, pero abrirla debe
   * ser un acto explícito sobre una cuenta concreta y no un efecto secundario de crearla.
   */
  budgetVisibility: false,
  /**
   * Si el aviso de solicitud de grupo de esta empresa lleva el teléfono y el correo de quien
   * pidió el evento, para los destinatarios que son cuentas con nivel `directo`.
   *
   * Nace apagada, con el mismo criterio que `marketing` y `budgetVisibility`: encenderla es una
   * decisión comercial sobre una cuenta concreta y no el efecto de un despliegue. La enciende
   * la agencia y no la empresa, porque es la agencia quien responde como encargada del
   * tratamiento; queda auditada y ligada a la aceptación de un texto con versión.
   *
   * Sólo mueve teléfono y correo, y sólo en ese aviso. Las alergias y las respuestas del
   * formulario no salen por correo estén encendidas o no.
   */
  detalleDeContactoEnAvisos: false,
  /*
   * Los doce módulos por empresa nacen apagados. No hay nada que conservar —hoy ninguna cuenta
   * los abre—, y encender uno es una decisión comercial sobre una empresa concreta, no el efecto
   * de crearla ni de un despliegue. Una empresa guardada sin estas claves cuenta como apagada.
   */
  production: false,
  audiovisual: false,
  content: false,
  approvals: false,
  meetings: false,
  documents: false,
  briefs: false,
  billing: false,
  contracts: false,
  intake: false,
  reports: false,
  commercialPipeline: false,
};

export function normalizeClientCapabilities(value?: Partial<ClientCapabilities> | null): ClientCapabilities {
  return {
    ...DEFAULT_CLIENT_CAPABILITIES,
    ...(value || {}),
  };
}
