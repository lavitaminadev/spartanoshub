/**
 * @fileoverview Visualiza y avanza el flujo operativo de una reserva (borrador → entregada).
 *
 * Combina `WorkflowTimeline` (las 6 etapas) con `AuditLog` (el registro de avances) y delega
 * las reglas de negocio — etapa actual, requisitos pendientes, permisos por rol — al hook
 * `useReservationWorkflow`. El componente solo decide qué mostrar y cuándo abrir el modal de
 * confirmación; no valida nada por su cuenta.
 */

import { useState, type JSX } from 'react';
import type { UserRole } from '@espartanos/shared';
import { Modal } from '../../shared/Modal';
import { AuditLog } from '../../shared/components/AuditLog';
import { WorkflowTimeline } from '../../shared/components/WorkflowTimeline';
import type { Reservation, ReservationState } from './types';
import { RESERVATION_STATES, WORKFLOW_OWNER_LABELS } from './reservation-workflow';
import { useReservationWorkflow } from './useReservationWorkflow';
import './ReservationWorkflow.css';

/** Props del panel de flujo de una reserva. */
export interface ReservationWorkflowProps {
  /** Reserva cuyo flujo se muestra y se puede avanzar. */
  reservation: Reservation;
  /** Persiste el nuevo estado en el backend. Debe rechazar si falla, para dejar el error visible. */
  onStateChange: (newState: ReservationState) => Promise<void>;
  /** Bloquea las acciones del panel mientras una operación externa a este componente está en vuelo. */
  isLoading?: boolean;
  /** Rol de quien ve la pantalla; determina si puede avanzar o forzar un avance. */
  userRole: UserRole;
}

/** Qué modal de confirmación está abierto: ninguno, un avance normal, o uno forzado. */
type ConfirmKind = null | 'advance' | 'force';

/**
 * Panel de flujo operativo: línea de tiempo de 6 etapas, acción para avanzar con su
 * confirmación, y auditoría de los avances hechos en esta sesión.
 */
export function ReservationWorkflow({
  reservation,
  onStateChange,
  isLoading = false,
  userRole,
}: ReservationWorkflowProps): JSX.Element {
  const workflow = useReservationWorkflow({ reservation, userRole, onStateChange });
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);

  const current = RESERVATION_STATES[workflow.currentState];
  const next = workflow.nextState ? RESERVATION_STATES[workflow.nextState] : null;
  const busy = workflow.isSubmitting || isLoading;
  const hasPending = workflow.pendingRequirements.length > 0;

  const openConfirm = (kind: Exclude<ConfirmKind, null>) => {
    workflow.clearError();
    setConfirmKind(kind);
  };
  const closeConfirm = () => {
    if (!busy) setConfirmKind(null);
  };

  const handleConfirm = async () => {
    await workflow.advance({ force: confirmKind === 'force' });
    // El hook deja `error` puesto si la confirmación no procedió; el modal sigue abierto
    // mostrándolo en ese caso, y solo se cierra tras un avance efectivamente guardado.
    setConfirmKind((kind) => (workflow.error ? kind : null));
  };

  return (
    <section className="reservation-workflow" aria-label="Flujo operativo de la reserva">
      <header className="reservation-workflow-head">
        <div>
          <span className="page-eyebrow">FLUJO OPERATIVO</span>
          <h3>{current.label}</h3>
          <p>
            {current.description} · Responsable actual: <b>{WORKFLOW_OWNER_LABELS[current.owner]}</b>
          </p>
        </div>
        <div
          className="reservation-workflow-progress"
          role="progressbar"
          aria-valuenow={workflow.progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progreso del flujo"
        >
          <div className="reservation-workflow-progress-bar">
            <span style={{ width: `${workflow.progressPercent}%` }} />
          </div>
          <strong>{workflow.progressPercent}%</strong>
        </div>
      </header>

      <WorkflowTimeline stages={workflow.stages} currentStage={workflow.currentIndex} />

      {next ? (
        <div className="reservation-workflow-actions">
          {hasPending && (
            <div className="alert alert-warning reservation-workflow-pending">
              <b>Falta esto para llegar a &quot;{next.label}&quot;</b>
              <ul>
                {workflow.pendingRequirements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {workflow.error && confirmKind === null && <div className="alert alert-error">{workflow.error}</div>}
          <div className="reservation-workflow-buttons">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy || !workflow.canAttemptAdvance || hasPending}
              title={!workflow.canAttemptAdvance ? 'Solo dirección de operaciones puede avanzar este flujo.' : undefined}
              onClick={() => openConfirm('advance')}
            >
              Avanzar a {next.label}
            </button>
            {hasPending && workflow.canForceAdvance && (
              <button
                type="button"
                className="btn btn-outline btn-sm reservation-workflow-force"
                disabled={busy}
                onClick={() => openConfirm('force')}
              >
                Forzar avance
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="reservation-workflow-complete">Flujo completado: el servicio ya fue entregado.</p>
      )}

      <div className="reservation-workflow-audit">
        <h4>Auditoría del flujo</h4>
        <AuditLog entries={workflow.auditEntries} emptyMessage="Sin cambios de estado registrados en esta sesión." />
      </div>

      <Modal
        open={confirmKind !== null}
        onClose={closeConfirm}
        title={confirmKind === 'force' ? `Forzar avance a "${next?.label ?? ''}"` : `Avanzar a "${next?.label ?? ''}"`}
      >
        <div className="reservation-workflow-confirm">
          <p>
            {confirmKind === 'force'
              ? `La reserva pasará a "${next?.label}" aunque falten los requisitos de abajo. Quedará registrada en la auditoría con marca de avance forzado.`
              : `La reserva pasará de "${current.label}" a "${next?.label}". El responsable siguiente será ${next ? WORKFLOW_OWNER_LABELS[next.owner] : ''}.`}
          </p>
          {confirmKind === 'force' && (
            <ul className="reservation-workflow-confirm-list">
              {workflow.pendingRequirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {workflow.error && <div className="alert alert-error">{workflow.error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={closeConfirm} disabled={busy}>
              Cancelar
            </button>
            <button
              type="button"
              className={confirmKind === 'force' ? 'btn btn-danger' : 'btn btn-primary'}
              onClick={handleConfirm}
              disabled={busy}
            >
              {busy ? 'Guardando...' : confirmKind === 'force' ? 'Forzar avance' : 'Confirmar avance'}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
