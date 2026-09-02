/**
 * @fileoverview Alcance de cuenta compartido por las secciones del CRM.
 *
 * Vive aparte de `CrmLayout` porque el contexto y su hook no son componentes, y un archivo que
 * exporta las dos cosas rompe el refresco en caliente: cada cambio en la barra recargaba la
 * pantalla entera en vez de reemplazar solo el componente.
 */

import { createContext, useContext } from 'react';
import type { PermissionLevel } from '../../core/auth';

/** La interfaz de escritura debe coincidir exactamente con el nivel que exige la API. */
export function canEditCrm(level: PermissionLevel | undefined): boolean {
  return level === 'edit' || level === 'manage';
}

export interface CrmScopeValue {
  /**
   * Cuenta cuyo CRM se está mirando. Vacío cuando es el de la agencia, que no tiene cuenta:
   * sus prospectos **son** las empresas, no personas que pertenezcan a una.
   */
  clientId: string;
  setClientId: (value: string) => void;
  /** Cuentas que esta persona alcanza, ya resueltas por el servidor. */
  clients: Array<{ id: string; name: string }>;
  /** Nombre de una cuenta, para no repetir el mapa en cada pantalla. */
  nombreDe: (clientId?: string | null) => string;
  /**
   * Embudo que toca consultar, derivado de la empresa elegida.
   *
   * Ninguna pantalla debería decidirlo por su cuenta: es lo que hacía que el CRM pareciera dos.
   */
  domain: 'audience' | 'commercial';
  /** Si lo que se mira es el embudo propio de Espartanos. */
  esAgencia: boolean;
  /** El CRM se está usando desde el portal de una empresa cliente. */
  esPortalCliente: boolean;
  /** Nombre de la empresa en pantalla, para los encabezados. */
  empresa: string;
  /**
   * Si quien mira puede además escribir.
   *
   * Sale del permiso efectivo `crm`: una excepción configurada por web puede habilitar o quitar
   * escritura sin desplegar código. La pantalla tiene que respetarlo escondiendo los controles,
   * no ofreciéndolos para que el servidor los rechace: un botón que siempre falla se lee como
   * que la pantalla está rota, no como que no corresponde.
   *
   * Vive en el contexto y no en cada pantalla para que la regla sea una sola. Repetirla en seis
   * sitios garantiza que el séptimo se olvide.
   */
  puedeEditar: boolean;
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
