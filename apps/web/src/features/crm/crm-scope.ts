/**
 * @fileoverview Alcance de cuenta compartido por las secciones del CRM.
 *
 * Vive aparte de `CrmLayout` porque el contexto y su hook no son componentes, y un archivo que
 * exporta las dos cosas rompe el refresco en caliente: cada cambio en la barra recargaba la
 * pantalla entera en vez de reemplazar solo el componente.
 */

import { createContext, useContext } from 'react';

export interface CrmScopeValue {
  /** Cuenta elegida en la barra, o `''` cuando se están mirando todas. */
  clientId: string;
  setClientId: (value: string) => void;
  /** Cuentas que esta persona alcanza, ya resueltas por el servidor. */
  clients: Array<{ id: string; name: string }>;
  /** Nombre de una cuenta, para no repetir el mapa en cada pantalla. */
  nombreDe: (clientId?: string | null) => string;
}

export const CrmScopeContext = createContext<CrmScopeValue | null>(null);

/**
 * Alcance de cuenta vigente en el CRM.
 *
 * La cuenta se elige en la barra y no en cada pantalla a propósito: elegirla una vez y que se
 * mantenga al pasar de los contactos al tablero es lo que hace que el CRM se sienta «por
 * empresa». Con el filtro dentro de cada pantalla había que volver a elegirla en cada una.
 *
 * @throws Si se usa fuera del CRM, que sería un error de montaje y no un caso a tolerar.
 */
export function useCrmScope(): CrmScopeValue {
  const scope = useContext(CrmScopeContext);
  if (!scope) throw new Error('useCrmScope solo puede usarse dentro de CrmLayout');
  return scope;
}
