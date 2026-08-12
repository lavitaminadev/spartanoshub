/**
 * @fileoverview Configuración y reglas del flujo operativo de una reserva (`ReservationState`):
 * el orden de las 6 etapas, quién es responsable de cada una, y qué falta para poder avanzar.
 *
 * Vive separado de `ReservationWorkflow.tsx` para que la lógica sea reutilizable desde otras
 * vistas (ej. un resumen en el dashboard) sin arrastrar JSX, y para que agregar una etapa nueva
 * sea editar un solo lugar: `RESERVATION_STATE_ORDER` y `RESERVATION_STATES`.
 */

import type { UserRole } from '@espartanos/shared';
import type { Reservation, ReservationState } from './types';

/** Quién tiene la pelota en una etapa del flujo. */
export type WorkflowOwner = 'agency' | 'team' | 'client';

/** Metadatos visuales y de negocio de una etapa del flujo. */
export interface ReservationStateConfig {
  /** Nombre corto mostrado en la línea de tiempo y en las tarjetas. */
  label: string;
  /** Responsable de mover la reserva a la siguiente etapa. */
  owner: WorkflowOwner;
  /** Variable CSS de marca asociada al estado (ej. `--primary`), sin el `var()`. */
  color: string;
  /** Qué significa estar en esta etapa, en una frase. */
  description: string;
}

/**
 * Las 6 etapas del flujo, en el orden en que ocurren. Única fuente de verdad del orden: todo
 * lo demás (índice actual, siguiente etapa, progreso) se deriva de esta lista.
 */
export const RESERVATION_STATE_ORDER: ReservationState[] = [
  'draft',
  'sent',
  'confirmed',
  'preparation',
  'execution',
  'delivered',
];

/** Metadatos de cada etapa. Agregar una etapa nueva es sumar una clave aquí y en el orden. */
export const RESERVATION_STATES: Record<ReservationState, ReservationStateConfig> = {
  draft: { label: 'Borrador', owner: 'agency', color: '--text-light', description: 'Propuesta en preparación' },
  sent: { label: 'Enviada', owner: 'client', color: '--info', description: 'Esperando confirmación' },
  confirmed: { label: 'Confirmada', owner: 'agency', color: '--primary', description: 'Fecha bloqueada' },
  preparation: { label: 'Preparación', owner: 'team', color: '--warning', description: 'Logística en marcha' },
  execution: { label: 'Ejecución', owner: 'team', color: '--accent', description: 'Día del servicio' },
  delivered: { label: 'Entregada', owner: 'client', color: '--success', description: 'Servicio completado' },
};

/** Texto legible por responsable, para chips y tooltips. */
export const WORKFLOW_OWNER_LABELS: Record<WorkflowOwner, string> = {
  agency: 'Agencia',
  team: 'Equipo',
  client: 'Cliente',
};

/** Roles con permiso para mover una reserva a la siguiente etapa del flujo. */
const ADVANCE_ROLES: UserRole[] = ['admin', 'operations_director'];

/** Único rol que puede forzar un avance con requisitos pendientes todavía sin cumplir. */
const FORCE_ADVANCE_ROLE: UserRole = 'admin';

/** Etapa actual de una reserva; sin `workflowState` registrado, se asume que sigue en borrador. */
export function resolveWorkflowState(reservation: Pick<Reservation, 'workflowState'>): ReservationState {
  return reservation.workflowState ?? 'draft';
}

/** Etapa siguiente a `state`, o `null` si ya es la última (`delivered`). */
export function nextWorkflowState(state: ReservationState): ReservationState | null {
  const index = RESERVATION_STATE_ORDER.indexOf(state);
  return index >= 0 && index < RESERVATION_STATE_ORDER.length - 1 ? RESERVATION_STATE_ORDER[index + 1] : null;
}

/** Verdadero si `role` puede iniciar un avance de etapa (con o sin requisitos pendientes). */
export function canRoleAdvanceWorkflow(role: UserRole): boolean {
  return ADVANCE_ROLES.includes(role);
}

/** Verdadero si `role` puede avanzar aun con requisitos pendientes, dejando ambar en la auditoría. */
export function canRoleForceWorkflow(role: UserRole): boolean {
  return role === FORCE_ADVANCE_ROLE;
}

/**
 * Datos obligatorios que deben estar completos antes de mover una reserva a `target`.
 *
 * Cada etapa valida lo que necesita el responsable siguiente para hacer su parte: el cliente
 * necesita un contacto para recibir la propuesta, el equipo necesita notas de logística para
 * preparar el servicio, y el cierre necesita evidencia de que el servicio se completó. Devuelve
 * la lista de lo que falta; vacío significa que la reserva está lista para avanzar.
 */
export function getPendingWorkflowRequirements(target: ReservationState, reservation: Reservation): string[] {
  const missing: string[] = [];

  if (target === 'sent' || target === 'confirmed') {
    if (!reservation.guestEmail && !reservation.guestPhone) {
      missing.push('Falta un correo o teléfono para notificar al cliente.');
    }
  }
  if (target === 'confirmed' && (!reservation.partySize || reservation.partySize < 1)) {
    missing.push('Falta definir la cantidad de personas o unidades del servicio.');
  }
  if ((target === 'preparation' || target === 'execution') && !reservation.internalNotes?.trim()) {
    missing.push('Falta cargar las notas de logística para el equipo.');
  }
  if (target === 'delivered' && (!reservation.answers || Object.keys(reservation.answers).length === 0)) {
    missing.push('Falta registrar los datos de cierre del servicio.');
  }

  return missing;
}
