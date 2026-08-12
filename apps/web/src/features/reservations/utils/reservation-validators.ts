/**
 * @fileoverview Validaciones puras del asistente de creación de reservas.
 *
 * Cada `validate*Step` revisa un paso del wizard y devuelve qué falta, en español y listo
 * para mostrarse tal cual. `computeReadinessChecklist` no bloquea nada: mide qué tan completa
 * está la reserva en general (para el medidor del paso 4), mientras que las funciones por paso
 * son las que deciden si se puede avanzar al siguiente.
 */

import type { ReservationWizardData } from '../hooks/useReservationWizard';

/** Resultado de validar un paso: si puede avanzar y, si no, por qué. */
export interface StepValidationResult {
  valid: boolean;
  /** Motivos por los que el paso no está listo, en español, para mostrar directo en pantalla. */
  missing: string[];
}

const OK: StepValidationResult = { valid: true, missing: [] };

/**
 * Paso 1 (Contexto del trabajo): exige cliente y fecha válida.
 *
 * El tipo de servicio y el objetivo quedan fuera de este bloqueo a propósito -tienen un valor
 * por defecto o son recomendables, no imprescindibles para seguir- pero sí cuentan en el
 * medidor de completitud del paso 4.
 */
export function validateContextStep(data: ReservationWizardData): StepValidationResult {
  const missing: string[] = [];
  if (!data.clientId) missing.push('Selecciona un cliente');
  if (!data.scheduledDate || Number.isNaN(new Date(data.scheduledDate).getTime())) {
    missing.push('Define una fecha válida');
  }
  return missing.length === 0 ? OK : { valid: false, missing };
}

/**
 * Paso 2 (Requerimientos): exige al menos un entregable con nombre y duración mayor a cero.
 * Una duración en cero o vacía no bloquea la agenda de nadie, así que se trata igual que un
 * entregable sin completar.
 */
export function validateRequirementsStep(data: ReservationWizardData): StepValidationResult {
  const missing: string[] = [];
  const named = data.deliverables.filter((item) => item.label.trim());
  if (named.length === 0) missing.push('Agrega al menos un entregable con nombre');
  const withoutDuration = named.some((item) => !item.durationMinutes || item.durationMinutes <= 0);
  if (named.length > 0 && withoutDuration) missing.push('Cada entregable necesita una duración mayor a 0');
  return missing.length === 0 ? OK : { valid: false, missing };
}

/**
 * Paso 3 (Distribución): exige elegir a quién se le muestra la reserva. Los destinatarios
 * puntuales son un complemento opcional de esa audiencia, no un reemplazo.
 */
export function validateDistributionStep(data: ReservationWizardData): StepValidationResult {
  if (!data.audience) return { valid: false, missing: ['Elige quién puede ver esta reserva'] };
  return OK;
}

/** Un criterio del medidor de completitud del paso 4, con su estado actual. */
export interface ReadinessChecklistItem {
  label: string;
  done: boolean;
}

/**
 * Mide qué tan completa está la reserva en ocho criterios, combinando lo obligatorio (cliente,
 * fecha, entregables con duración, audiencia) con lo recomendable (objetivo, tipo de servicio,
 * detalles especiales, destinatarios puntuales). El porcentaje es informativo: quien decide si
 * la reserva queda "agendada" o "borrador" es `validateContextStep`/`validateRequirementsStep`/
 * `validateDistributionStep`, no este número.
 */
export function computeReadinessChecklist(data: ReservationWizardData): { percent: number; items: ReadinessChecklistItem[] } {
  const namedDeliverables = data.deliverables.filter((item) => item.label.trim());
  const items: ReadinessChecklistItem[] = [
    { label: 'Cliente seleccionado', done: Boolean(data.clientId) },
    { label: 'Objetivo descrito', done: Boolean(data.objective.trim()) },
    { label: 'Fecha definida', done: Boolean(data.scheduledDate) && !Number.isNaN(new Date(data.scheduledDate).getTime()) },
    { label: 'Tipo de servicio elegido', done: Boolean(data.serviceType) },
    { label: 'Al menos un entregable', done: namedDeliverables.length > 0 },
    { label: 'Duraciones válidas en los entregables', done: namedDeliverables.length > 0 && namedDeliverables.every((item) => item.durationMinutes > 0) },
    { label: 'Detalles especiales revisados', done: Boolean(data.specialDetails.trim()) },
    { label: 'Audiencia de distribución elegida', done: Boolean(data.audience) },
  ];
  const done = items.filter((item) => item.done).length;
  return { percent: Math.round((done / items.length) * 100), items };
}
