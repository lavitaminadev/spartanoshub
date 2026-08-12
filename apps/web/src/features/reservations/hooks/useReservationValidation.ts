/**
 * @fileoverview Envuelve los validadores puros de `utils/reservation-validators.ts` en un
 * `useMemo` atado a `data`, para que los 4 pasos del wizard y el medidor de completitud del
 * paso 4 se recalculen juntos y solo cuando los datos realmente cambian.
 */

import { useMemo } from 'react';
import {
  computeReadinessChecklist,
  validateContextStep,
  validateDistributionStep,
  validateRequirementsStep,
  type ReadinessChecklistItem,
  type StepValidationResult,
} from '../utils/reservation-validators';
import type { ReservationWizardData, ReservationWizardStep } from './useReservationWizard';

export interface UseReservationValidationResult {
  /** Validación de cada paso, indexada por su número (1 a 4). El paso 4 siempre es válido: es revisión, no captura. */
  stepValidity: Record<ReservationWizardStep, StepValidationResult>;
  /** Porcentaje de completitud general (0-100), informativo, usado por el medidor del paso 4. */
  readinessPercent: number;
  /** Detalle criterio por criterio del porcentaje anterior. */
  checklist: ReadinessChecklistItem[];
  /** `true` cuando los tres pasos con validación obligatoria (1, 2 y 3) están completos. */
  isReadyToSchedule: boolean;
}

const REVIEW_STEP_RESULT: StepValidationResult = { valid: true, missing: [] };

/** Deriva el estado de validación de los 4 pasos y el medidor de completitud a partir de `data`. */
export function useReservationValidation(data: ReservationWizardData): UseReservationValidationResult {
  return useMemo(() => {
    const context = validateContextStep(data);
    const requirements = validateRequirementsStep(data);
    const distribution = validateDistributionStep(data);
    const { percent, items } = computeReadinessChecklist(data);

    return {
      stepValidity: { 1: context, 2: requirements, 3: distribution, 4: REVIEW_STEP_RESULT },
      readinessPercent: percent,
      checklist: items,
      isReadyToSchedule: context.valid && requirements.valid && distribution.valid,
    };
  }, [data]);
}
