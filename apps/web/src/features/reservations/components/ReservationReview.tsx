/**
 * @fileoverview Paso 4 del asistente: resumen de la reserva, medidor de completitud, checklist
 * de lo que falta y una vista previa de la entrada de auditoría que se registrará al guardar.
 */

import type { JSX } from 'react';
import { AuditLog, type AuditEntry } from '../../../shared/components/AuditLog';
import type { ReadinessChecklistItem } from '../utils/reservation-validators';
import {
  AUDIENCE_OPTIONS,
  SERVICE_TYPE_LABELS,
  buildAuditDetail,
  formatDurationMinutes,
  formatScheduledDateTime,
  totalDeliverableMinutes,
} from '../utils/reservation-formatters';
import type { ReservationWizardData } from '../hooks/useReservationWizard';
import { ReservationFormSection } from './ReservationFormSection';

export interface ReservationReviewProps {
  data: ReservationWizardData;
  checklist: ReadinessChecklistItem[];
  readinessPercent: number;
  /** `true` cuando los pasos 1 a 3 están completos y la reserva puede guardarse como agendada. */
  isReadyToSchedule: boolean;
}

/** Paso 4: nada se captura aquí, solo se revisa y se decide si se guarda agendada o como borrador. */
export function ReservationReview({ data, checklist, readinessPercent, isReadyToSchedule }: ReservationReviewProps): JSX.Element {
  const previewEntry: AuditEntry = {
    id: 'preview',
    title: isReadyToSchedule ? 'Reserva creada' : 'Reserva guardada como borrador',
    detail: buildAuditDetail(data),
    actor: 'Se registra al guardar',
    time: 'Ahora',
    tone: isReadyToSchedule ? 'cyan' : 'amber',
  };

  return (
    <ReservationFormSection
      eyebrow="REVISIÓN"
      title="Revisa antes de guardar"
      description={isReadyToSchedule
        ? 'Todo lo necesario está completo: se guardará como reserva agendada.'
        : 'Puedes guardar como borrador ahora y completar el resto más tarde.'}
    >
      <div className="readiness-meter">
        <div className="readiness-track"><span className="readiness-fill" style={{ width: `${readinessPercent}%` }} /></div>
        <div className="readiness-meta"><span>Completitud de la reserva</span><b>{readinessPercent}%</b></div>
      </div>

      <div className="review-summary">
        <div><span>Cliente</span><strong>{data.clientName || 'Sin cliente'}</strong></div>
        <div><span>Tipo de servicio</span><strong>{SERVICE_TYPE_LABELS[data.serviceType]}</strong></div>
        <div><span>Fecha</span><strong>{formatScheduledDateTime(data.scheduledDate, data.scheduledTime)}</strong></div>
        <div><span>Entregables</span><strong>{data.deliverables.filter((item) => item.label.trim()).length}</strong></div>
        <div><span>Duración total</span><strong>{formatDurationMinutes(totalDeliverableMinutes(data.deliverables))}</strong></div>
        <div><span>Visible para</span><strong>{AUDIENCE_OPTIONS.find((option) => option.value === data.audience)?.label ?? 'Sin definir'}</strong></div>
      </div>

      {data.objective.trim() && <p className="review-objective"><span>Objetivo</span>{data.objective}</p>}
      {data.specialDetails.trim() && <p className="review-objective"><span>Detalles especiales</span>{data.specialDetails}</p>}

      <ul className="review-checklist">
        {checklist.map((item) => (
          <li key={item.label} className={item.done ? 'is-done' : 'is-pending'}>
            <span aria-hidden="true">{item.done ? '✓' : '○'}</span>{item.label}
          </li>
        ))}
      </ul>

      {!isReadyToSchedule && (
        <div className="alert alert-warning">
          Faltan datos obligatorios para dejar la reserva agendada. Puedes guardarla como borrador y completarla después.
        </div>
      )}

      <div>
        <span className="page-eyebrow">SE REGISTRARÁ EN AUDITORÍA</span>
        <AuditLog entries={[previewEntry]} />
      </div>
    </ReservationFormSection>
  );
}
