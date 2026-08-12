/**
 * @fileoverview Barra de progreso para wizards de varios pasos (ej. `RequestWizard` del
 * prototipo). Muestra el paso actual, el total y el porcentaje avanzado.
 */

import type { JSX } from 'react';
import './WizardProgress.css';

/**
 * Props de la barra de progreso de un wizard.
 */
export interface WizardProgressProps {
  /** Paso actual, en base 1 (ej. 2 de 3). */
  currentStep: number;
  /** Cantidad total de pasos del wizard. */
  totalSteps: number;
  /** Texto accesible del paso, ej. "Contexto del trabajo". Si falta, se usa "Paso X de Y". */
  stepLabel?: string;
}

/**
 * Renderiza el porcentaje avanzado de un wizard como barra horizontal con `role="progressbar"`.
 */
export function WizardProgress({ currentStep, totalSteps, stepLabel }: WizardProgressProps): JSX.Element {
  const safeTotal = Math.max(totalSteps, 1);
  const safeStep = Math.min(Math.max(currentStep, 1), safeTotal);
  const percent = Math.round((safeStep / safeTotal) * 100);
  const label = stepLabel ?? `Paso ${safeStep} de ${safeTotal}`;

  return (
    <div className="wizard-progress-wrap">
      <div
        className="wizard-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label}
      >
        <span className="wizard-progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="wizard-progress-meta">
        <span>{label}</span>
        <b>{percent}%</b>
      </div>
    </div>
  );
}
