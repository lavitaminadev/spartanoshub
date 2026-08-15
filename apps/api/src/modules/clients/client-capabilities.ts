export const CLIENT_CAPABILITY_KEYS = [
  'reservations',
  'crm',
  'metaConversions',
  'googleConversions',
  'budgetVisibility',
] as const;

export type ClientCapabilityKey = (typeof CLIENT_CAPABILITY_KEYS)[number];
export type ClientCapabilities = Record<ClientCapabilityKey, boolean>;

export const DEFAULT_CLIENT_CAPABILITIES: ClientCapabilities = {
  reservations: true,
  crm: true,
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
