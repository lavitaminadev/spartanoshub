/**
 * @fileoverview Asistente de 4 pasos para crear o editar una reserva interna de trabajo:
 * contexto, requerimientos, distribución y revisión.
 *
 * Se monta como overlay (el padre decide cuándo renderizarlo, ej. `{open && <CreateReservationWizard .../>}`)
 * y usa `SimpleModal` como contenedor. `SimpleModal` solo expone un botón de acción y uno de
 * cancelar en su pie, así que la navegación "Continuar/Guardar" vive en ese botón de acción
 * -su etiqueta y su efecto cambian según el paso- y el botón "Atrás" se agrega dentro del
 * cuerpo del modal, justo antes del pie fijo.
 *
 * Toda la lógica (estado, validación, borrador automático, envío) vive en
 * `hooks/useReservationWizard`; este archivo solo arma la UI y decide qué mostrar en cada paso.
 *
 * @example
 * {wizardOpen && (
 *   <CreateReservationWizard
 *     mode="create"
 *     onClose={() => setWizardOpen(false)}
 *     onSuccess={(id) => navigate(`/reservations/bookings/${id}`)}
 *   />
 * )}
 */

import { useState, type JSX } from 'react';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { SimpleModal } from '../../shared/components/SimpleModal';
import { Toast, type ToastType } from '../../shared/components/Toast';
import { WizardProgress } from '../../shared/components/WizardProgress';
import type { FormField } from './types';
import { ReservationContextForm } from './components/ReservationContextForm';
import { ReservationDistributionForm } from './components/ReservationDistributionForm';
import { ReservationRequirementsForm } from './components/ReservationRequirementsForm';
import { ReservationReview } from './components/ReservationReview';
import { useReservationWizard, type ReservationWizardData, type ReservationWizardStep } from './hooks/useReservationWizard';
import './reservation-wizard.css';

export interface ReservationWizardProps {
  /** Cierra el asistente. No garantiza que los datos quedaron guardados: el borrador local sigue disponible para la próxima apertura. */
  onClose: () => void;
  /** Se invoca después de un guardado exitoso (agendada o borrador), con el id resultante. */
  onSuccess?: (reservationId: string) => void;
  /**
   * Datos iniciales para editar una reserva existente.
   *
   * Usa `ReservationWizardData` -propio de este asistente- y no `Reservation` de `./types.ts`:
   * ese tipo describe la respuesta pública de un formulario de agenda, no una reserva interna
   * de trabajo. Ver el comentario de `ReservationWizardData` en `hooks/useReservationWizard.ts`.
   */
  initialData?: Partial<ReservationWizardData>;
  mode: 'create' | 'edit';
}

/**
 * Metadatos de cada paso: título y descripción para el encabezado del modal, y los campos que
 * ese paso captura (reutiliza `FormField` de `./types.ts` en vez de declarar una forma nueva
 * solo para documentación). `ReservationReview` no captura nada, así que su lista va vacía.
 */
const STEP_CONFIG: Record<ReservationWizardStep, { title: string; description: string; fields: FormField[] }> = {
  1: {
    title: 'Contexto del trabajo',
    description: 'Cliente, tipo de servicio, objetivo y fecha.',
    fields: [
      { id: 'clientId', type: 'select', label: 'Cliente', required: true },
      { id: 'serviceType', type: 'select', label: 'Tipo de servicio', required: false },
      { id: 'objective', type: 'textarea', label: 'Objetivo', required: false },
      { id: 'scheduledDate', type: 'date', label: 'Fecha', required: true },
    ],
  },
  2: {
    title: 'Requerimientos',
    description: 'Entregables, duraciones y detalles especiales.',
    fields: [
      { id: 'deliverables', type: 'text', label: 'Entregables', required: true },
      { id: 'specialDetails', type: 'textarea', label: 'Detalles especiales', required: false },
    ],
  },
  3: {
    title: 'Distribución',
    description: 'Quién puede ver esta reserva: cliente, equipo o ambos.',
    fields: [
      { id: 'audience', type: 'select', label: 'Audiencia', required: true },
      { id: 'recipients', type: 'text', label: 'Destinatarios puntuales', required: false },
    ],
  },
  4: {
    title: 'Revisión',
    description: 'Resumen de completitud antes de guardar.',
    fields: [],
  },
};

/** Asistente de creación/edición de reservas internas de trabajo, en 4 pasos. */
export function CreateReservationWizard({ onClose, onSuccess, initialData, mode }: ReservationWizardProps): JSX.Element {
  const wizard = useReservationWizard({ mode, initialData });
  const { step, data, update, goNext, goBack, stepValidity, checklist, readinessPercent, isReadyToSchedule, submit, isSubmitting, submitError, draft } = wizard;

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  const stepConfig = STEP_CONFIG[step];
  const currentValidity = stepValidity[step];
  const savedOrSaving = isSubmitting || pendingCloseId !== null;

  /**
   * Botón de acción principal de `SimpleModal`. En los pasos 1-3 avanza si el paso es válido;
   * en el paso 4 guarda -agendada o como borrador, según `isReadyToSchedule`- y deja que el
   * `Toast` confirme antes de cerrar el asistente.
   */
  const handlePrimaryAction = async (): Promise<void> => {
    if (step < 4) {
      goNext();
      return;
    }
    try {
      const reservationId = await submit();
      setPendingCloseId(reservationId);
      setToast({
        message: isReadyToSchedule ? 'Reserva creada' : 'Reserva guardada como borrador',
        type: isReadyToSchedule ? 'success' : 'warning',
      });
    } catch {
      // El hook ya deja `submitError` visible en el formulario; no hay nada más que hacer aquí.
    }
  };

  /** Cierra el asistente después de que el aviso de éxito termina de mostrarse. */
  const handleToastDismiss = (): void => {
    setToast(null);
    if (pendingCloseId) {
      onSuccess?.(pendingCloseId);
      onClose();
    }
  };

  const primaryLabel = isSubmitting
    ? 'Guardando...'
    : step < 4
      ? 'Continuar'
      : isReadyToSchedule
        ? (mode === 'edit' ? 'Guardar cambios' : 'Crear reserva')
        : 'Guardar como borrador';

  return (
    <>
      <SimpleModal
        eyebrow="RESERVAS"
        title={`${mode === 'edit' ? 'Editar reserva' : 'Nueva reserva'} · ${stepConfig.title}`}
        close={onClose}
        action={primaryLabel}
        submit={handlePrimaryAction}
        submitDisabled={savedOrSaving || (step < 4 && !currentValidity.valid)}
      >
        <WizardProgress currentStep={step} totalSteps={4} stepLabel={stepConfig.title} />
        <p className="page-subtitle">{stepConfig.description}</p>

        {draft.hasRecoveredDraft && (
          <div className="draft-recovered-banner" role="status">
            <span>Recuperamos un borrador sin terminar de esta reserva.</span>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirmDiscardOpen(true)}>
              Descartar borrador
            </button>
          </div>
        )}

        {step === 1 && <ReservationContextForm data={data} onChange={update} />}
        {step === 2 && <ReservationRequirementsForm data={data} onChange={update} />}
        {step === 3 && <ReservationDistributionForm data={data} onChange={update} />}
        {step === 4 && (
          <ReservationReview
            data={data}
            checklist={checklist}
            readinessPercent={readinessPercent}
            isReadyToSchedule={isReadyToSchedule}
          />
        )}

        {step < 4 && !currentValidity.valid && currentValidity.missing.length > 0 && (
          <div className="alert alert-warning">{currentValidity.missing.join(' · ')}</div>
        )}
        {submitError && <div className="alert alert-error">{submitError}</div>}

        {step > 1 && (
          <div className="wizard-back-row">
            <button type="button" className="btn btn-outline btn-sm" onClick={goBack} disabled={savedOrSaving}>
              ← Atrás
            </button>
          </div>
        )}
      </SimpleModal>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={handleToastDismiss} />}

      <ConfirmDialog
        open={confirmDiscardOpen}
        title="Descartar borrador"
        description="Se perderá lo que llevas escrito en esta reserva y el asistente volverá al primer paso."
        confirmLabel="Descartar"
        onClose={() => setConfirmDiscardOpen(false)}
        onConfirm={() => { draft.discard(); setConfirmDiscardOpen(false); }}
      />
    </>
  );
}
