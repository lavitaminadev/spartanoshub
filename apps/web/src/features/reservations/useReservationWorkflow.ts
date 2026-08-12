/**
 * @fileoverview Estado y transiciones del flujo operativo de una reserva.
 *
 * Encapsula la parte que no es visual de `ReservationWorkflow.tsx`: qué etapa es la actual, qué
 * falta para pasar a la siguiente, quién puede hacerlo, y el registro de auditoría local de los
 * avances. El componente solo renderiza lo que este hook calcula.
 */

import { useCallback, useMemo, useState } from 'react';
import type { UserRole } from '@espartanos/shared';
import { formatRelativeTime, type AuditEntry } from '../../shared/components/AuditLog';
import type { WorkflowStage } from '../../shared/components/WorkflowTimeline';
import type { Reservation, ReservationState } from './types';
import {
  RESERVATION_STATE_ORDER,
  RESERVATION_STATES,
  WORKFLOW_OWNER_LABELS,
  canRoleAdvanceWorkflow,
  canRoleForceWorkflow,
  getPendingWorkflowRequirements,
  nextWorkflowState,
  resolveWorkflowState,
} from './reservation-workflow';

/** Parámetros del hook de flujo de una reserva. */
export interface UseReservationWorkflowOptions {
  /** Reserva cuyo flujo se está mostrando. */
  reservation: Reservation;
  /** Rol de quien está viendo la pantalla, para decidir qué puede hacer. */
  userRole: UserRole;
  /** Persiste el nuevo estado (ej. `PATCH /reservations/:id`). Rechaza para dejar el error visible. */
  onStateChange: (newState: ReservationState) => Promise<void>;
}

/** Resultado del hook: todo lo que `ReservationWorkflow` necesita para renderizarse. */
export interface UseReservationWorkflowResult {
  /** Etapa actual de la reserva. */
  currentState: ReservationState;
  /** Índice (base 0) de la etapa actual dentro de `RESERVATION_STATE_ORDER`. */
  currentIndex: number;
  /** Etapa siguiente, o `null` si la reserva ya está `delivered`. */
  nextState: ReservationState | null;
  /** Progreso del flujo, de 0 a 100. */
  progressPercent: number;
  /** Etapas listas para `WorkflowTimeline`. */
  stages: WorkflowStage[];
  /** Verdadero si el rol actual puede iniciar un avance (sin importar si hay pendientes). */
  canAttemptAdvance: boolean;
  /** Verdadero si el rol actual puede forzar un avance con requisitos pendientes. */
  canForceAdvance: boolean;
  /** Requisitos sin cumplir para llegar a `nextState`. Vacío si ya se puede avanzar. */
  pendingRequirements: string[];
  /** Auditoría local de avances de esta sesión (más reciente primero). */
  auditEntries: AuditEntry[];
  /** Verdadero mientras `onStateChange` está en vuelo. */
  isSubmitting: boolean;
  /** Último error de validación o de guardado, o `null`. */
  error: string | null;
  /** Limpia el error, ej. al reabrir el modal de confirmación. */
  clearError: () => void;
  /**
   * Ejecuta el avance a `nextState`.
   *
   * Con requisitos pendientes y `force` en falso, no llama a `onStateChange`: deja el error
   * puesto y retorna. Quien llama debe haber validado con `canForceAdvance` que el rol puede
   * pasar `force: true`; el hook igual revalida el rol como última defensa.
   */
  advance: (options?: { force?: boolean }) => Promise<void>;
}

/**
 * Deriva el estado del flujo de una reserva y expone la acción para avanzarlo.
 */
export function useReservationWorkflow({
  reservation,
  userRole,
  onStateChange,
}: UseReservationWorkflowOptions): UseReservationWorkflowResult {
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentState = resolveWorkflowState(reservation);
  const currentIndex = RESERVATION_STATE_ORDER.indexOf(currentState);
  const nextState = nextWorkflowState(currentState);
  const progressPercent = Math.round(((currentIndex + 1) / RESERVATION_STATE_ORDER.length) * 100);

  const pendingRequirements = useMemo(
    () => (nextState ? getPendingWorkflowRequirements(nextState, reservation) : []),
    [nextState, reservation],
  );

  const roleCanAdvance = canRoleAdvanceWorkflow(userRole);
  const canForceAdvance = roleCanAdvance && canRoleForceWorkflow(userRole);

  const stages: WorkflowStage[] = useMemo(
    () =>
      RESERVATION_STATE_ORDER.map((state, index) => ({
        name: RESERVATION_STATES[state].label,
        owner: WORKFLOW_OWNER_LABELS[RESERVATION_STATES[state].owner],
        status: index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'pending',
      })),
    [currentIndex],
  );

  const clearError = useCallback(() => setError(null), []);

  const advance = useCallback(
    async (options?: { force?: boolean }) => {
      if (!nextState) return;
      if (!roleCanAdvance) {
        setError('Solo dirección de operaciones puede avanzar el flujo de una reserva.');
        return;
      }
      const forced = options?.force === true;
      if (pendingRequirements.length > 0 && !(forced && canForceAdvance)) {
        setError('Hay requisitos pendientes: complétalos o pide a un administrador que fuerce el avance.');
        return;
      }

      setIsSubmitting(true);
      setError(null);
      const target = nextState;
      try {
        await onStateChange(target);
        const targetConfig = RESERVATION_STATES[target];
        setAuditEntries((entries) => [
          {
            id: `${target}-${Date.now()}`,
            title: forced ? `Avance forzado a "${targetConfig.label}"` : `Avance a "${targetConfig.label}"`,
            detail: forced
              ? `Se avanzó pese a requisitos pendientes: ${pendingRequirements.join(' ')}`
              : targetConfig.description,
            actor: userRole,
            time: formatRelativeTime(new Date()),
            tone: forced ? 'amber' : 'cyan',
          },
          ...entries,
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado de la reserva.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [nextState, roleCanAdvance, pendingRequirements, canForceAdvance, onStateChange, userRole],
  );

  return {
    currentState,
    currentIndex,
    nextState,
    progressPercent,
    stages,
    canAttemptAdvance: roleCanAdvance && Boolean(nextState),
    canForceAdvance,
    pendingRequirements,
    auditEntries,
    isSubmitting,
    error,
    clearError,
    advance,
  };
}
