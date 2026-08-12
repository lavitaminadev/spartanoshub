/**
 * @fileoverview Indicador de pasos para asistentes de varios pasos (wizards).
 *
 * Generaliza el patrón que ya vivía duplicado dentro de `ReservationsPage` (creación de
 * formularios de reserva) para que un asistente nuevo no tenga que reinventar la fila de
 * pasos numerados, cuál está activo y cuáles ya se completaron.
 */

import type { JSX } from 'react';
import './WizardProgress.css';

/** Un paso del asistente, en el orden en que se muestra. */
export interface WizardStepDescriptor {
  /** Identificador estable del paso, usado como `key`. */
  id: string;
  /** Etiqueta corta mostrada bajo el número. */
  label: string;
}

export interface WizardProgressProps {
  /** Pasos del asistente, en orden de aparición. */
  steps: WizardStepDescriptor[];
  /** Índice (base 0) del paso visible actualmente. */
  currentIndex: number;
  /**
   * Callback al elegir un paso distinto. Sin esta prop, los pasos no son clickeables: el
   * asistente solo avanza con los botones de Continuar/Volver del propio formulario.
   */
  onStepSelect?: (index: number) => void;
  /**
   * Determina si un paso puntual no puede seleccionarse todavía, p. ej. porque el paso
   * anterior no pasó su propia validación. Por defecto, solo el paso actual y los ya
   * completados son seleccionables.
   */
  isStepDisabled?: (index: number) => boolean;
}

/**
 * Renderiza la fila de pasos de un asistente.
 *
 * @example
 * <WizardProgress
 *   steps={[{ id: 'type', label: 'Tipo' }, { id: 'questions', label: 'Preguntas' }]}
 *   currentIndex={step}
 * />
 */
export function WizardProgress({ steps, currentIndex, onStepSelect, isStepDisabled }: WizardProgressProps): JSX.Element {
  return (
    <ol className="wizard-progress" role="list" aria-label="Progreso del asistente">
      {steps.map((step, index) => {
        const state = index === currentIndex ? 'active' : index < currentIndex ? 'done' : 'pending';
        const disabled = isStepDisabled ? isStepDisabled(index) : index > currentIndex;
        return (
          <li key={step.id} className={`wizard-progress-step is-${state}`}>
            <button
              type="button"
              className="wizard-progress-marker"
              disabled={!onStepSelect || disabled}
              aria-current={index === currentIndex ? 'step' : undefined}
              onClick={() => onStepSelect?.(index)}
            >
              <span className="wizard-progress-index" aria-hidden="true">{state === 'done' ? '✓' : index + 1}</span>
            </button>
            <span className="wizard-progress-label">{step.label}</span>
            {index < steps.length - 1 && <span className="wizard-progress-connector" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
