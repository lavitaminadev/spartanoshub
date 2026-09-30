export const CLIENT_CAPABILITY_KEYS = [
  'reservations',
  'crm',
  'surveys',
  'marketing',
  'metaConversions',
  'googleConversions',
  'budgetVisibility',
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
};

export function normalizeClientCapabilities(value?: Partial<ClientCapabilities> | null): ClientCapabilities {
  return {
    ...DEFAULT_CLIENT_CAPABILITIES,
    ...(value || {}),
  };
}
