/**
 * @fileoverview Acciones sensibles dentro de un módulo.
 *
 * El nivel del módulo (ver, editar, administrar) sigue mandando; una acción es algo más fino
 * que se puede abrir o cerrar a una persona sin cambiarle el nivel entero: que alguien edite el
 * CRM pero no importe cientos de contactos, o que opere Reservas pero no saque la base completa.
 *
 * Sin ajuste, cada acción se permite a quien tiene `nivelPorDefecto` en su módulo, que es
 * exactamente lo que ocurría antes de existir este control.
 */

import type { OrganizationFeatureKey } from '../../modules/organizations/organization-features';
import type { PermissionLevel } from './permission-level';

export interface DefinicionDeAccion {
  clave: string;
  modulo: OrganizationFeatureKey;
  nombre: string;
  ayuda: string;
  nivelPorDefecto: PermissionLevel;
}

export const ACCIONES: readonly DefinicionDeAccion[] = [
  { clave: 'crm.importar', modulo: 'crm', nombre: 'Importar leads', ayuda: 'Subir contactos desde un archivo.', nivelPorDefecto: 'edit' },
  { clave: 'crm.borrar', modulo: 'crm', nombre: 'Borrar oportunidades', ayuda: 'Eliminar una oportunidad del embudo.', nivelPorDefecto: 'manage' },
  { clave: 'reservations.exportar', modulo: 'reservations', nombre: 'Exportar reservas', ayuda: 'Descargar reservas con datos de contacto.', nivelPorDefecto: 'edit' },
  { clave: 'reservations.importar', modulo: 'reservations', nombre: 'Importar reservas', ayuda: 'Cargar reservas desde un archivo.', nivelPorDefecto: 'edit' },
  { clave: 'surveys.enviar', modulo: 'surveys', nombre: 'Enviar encuestas por correo', ayuda: 'Mandar la encuesta a sus destinatarios.', nivelPorDefecto: 'edit' },
  { clave: 'surveys.borrar', modulo: 'surveys', nombre: 'Eliminar encuestas', ayuda: 'Borrar una encuesta con todas sus respuestas.', nivelPorDefecto: 'manage' },
] as const;

const POR_CLAVE = new Map(ACCIONES.map((accion) => [accion.clave, accion]));

export function definicionDeAccion(clave: string): DefinicionDeAccion | undefined {
  return POR_CLAVE.get(clave);
}
