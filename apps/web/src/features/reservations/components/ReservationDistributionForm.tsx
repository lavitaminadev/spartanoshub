/**
 * @fileoverview Paso 3 del asistente: quién puede ver la reserva (cliente, equipo o ambos) y,
 * de forma opcional, destinatarios puntuales adicionales.
 */

import type { JSX } from 'react';
import type { ReservationAudience, ReservationWizardData } from '../hooks/useReservationWizard';
import { AUDIENCE_OPTIONS } from '../utils/reservation-formatters';
import { ReservationFormSection } from './ReservationFormSection';

export interface ReservationDistributionFormProps {
  data: ReservationWizardData;
  onChange: (patch: Partial<ReservationWizardData>) => void;
}

/** Paso 3: audiencia de la reserva (obligatoria) y destinatarios puntuales (opcionales). */
export function ReservationDistributionForm({ data, onChange }: ReservationDistributionFormProps): JSX.Element {
  return (
    <ReservationFormSection
      eyebrow="DISTRIBUCIÓN"
      title="¿Quién puede ver esta reserva?"
      description="Elige una audiencia. Los destinatarios puntuales se suman a esa audiencia, no la reemplazan."
    >
      <div className="reservation-audience-options" role="radiogroup" aria-label="Audiencia de la reserva">
        {AUDIENCE_OPTIONS.map((option) => (
          <button
            type="button"
            key={option.value}
            role="radio"
            aria-checked={data.audience === option.value}
            className={data.audience === option.value ? 'active' : ''}
            onClick={() => onChange({ audience: option.value as ReservationAudience })}
          >
            <strong>{option.label}</strong>
            <span>{option.description}</span>
          </button>
        ))}
      </div>
      {!data.audience && <p className="required-hint">* Elige una opción para continuar.</p>}

      <label>Destinatarios puntuales (opcional)
        <textarea
          className="input"
          rows={3}
          value={data.recipients}
          onChange={(event) => onChange({ recipients: event.target.value })}
          placeholder="Nombres o correos separados por coma, ej. ana@cliente.cl, Equipo de Producción"
        />
      </label>
    </ReservationFormSection>
  );
}
