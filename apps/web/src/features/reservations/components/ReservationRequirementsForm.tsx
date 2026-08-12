/**
 * @fileoverview Paso 2 del asistente: entregables (con su duración) y detalles especiales.
 */

import type { JSX } from 'react';
import { blankDeliverable, type ReservationWizardData } from '../hooks/useReservationWizard';
import { formatDurationMinutes, totalDeliverableMinutes } from '../utils/reservation-formatters';
import { ReservationFormSection } from './ReservationFormSection';

export interface ReservationRequirementsFormProps {
  data: ReservationWizardData;
  onChange: (patch: Partial<ReservationWizardData>) => void;
}

/** Paso 2: qué se entrega, cuánto toma cada entregable y qué necesita de especial el trabajo. */
export function ReservationRequirementsForm({ data, onChange }: ReservationRequirementsFormProps): JSX.Element {
  const updateDeliverable = (id: string, patch: Partial<ReservationWizardData['deliverables'][number]>): void => {
    onChange({ deliverables: data.deliverables.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  };
  const removeDeliverable = (id: string): void => {
    onChange({ deliverables: data.deliverables.filter((item) => item.id !== id) });
  };
  const addDeliverable = (): void => {
    onChange({ deliverables: [...data.deliverables, blankDeliverable()] });
  };

  return (
    <ReservationFormSection
      eyebrow="REQUERIMIENTOS"
      title="¿Qué se entrega y cuánto toma?"
      description="Agrega cada entregable con su duración estimada; la suma bloquea la agenda del equipo."
    >
      <div className="deliverables-editor">
        {data.deliverables.map((deliverable, index) => (
          <div className="deliverable-row" key={deliverable.id}>
            <span className="deliverable-index" aria-hidden="true">{index + 1}</span>
            <input
              className="input"
              required
              aria-label={`Nombre del entregable ${index + 1}`}
              value={deliverable.label}
              onChange={(event) => updateDeliverable(deliverable.id, { label: event.target.value })}
              placeholder="Ej. Video corto para Reels"
            />
            <label className="deliverable-duration">
              <input
                className="input"
                type="number"
                min={5}
                step={5}
                required
                aria-label={`Duración en minutos del entregable ${index + 1}`}
                value={deliverable.durationMinutes}
                onChange={(event) => updateDeliverable(deliverable.id, { durationMinutes: Number(event.target.value) })}
              />
              <small>min</small>
            </label>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={data.deliverables.length <= 1}
              onClick={() => removeDeliverable(deliverable.id)}
            >
              Quitar
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-outline btn-sm" onClick={addDeliverable}>+ Agregar entregable</button>

      <div className="deliverables-total">
        <span>Duración total estimada</span>
        <strong>{formatDurationMinutes(totalDeliverableMinutes(data.deliverables))}</strong>
      </div>

      <label>Detalles especiales
        <textarea
          className="input"
          rows={3}
          value={data.specialDetails}
          onChange={(event) => onChange({ specialDetails: event.target.value })}
          placeholder="Ej. Requiere acceso al local antes de las 9:00, traer set de luces adicional..."
        />
      </label>
    </ReservationFormSection>
  );
}
