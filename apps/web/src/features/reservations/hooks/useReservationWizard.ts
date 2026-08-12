/**
 * @fileoverview Estado y orquestación del asistente de creación de reservas: los tipos del
 * dominio, la navegación entre los 4 pasos, la integración con el borrador automático
 * (`useDraftAutoSave`) y el envío final a la API.
 *
 * Este archivo es la fuente única de los tipos del wizard (`ReservationWizardData` y afines);
 * `CreateReservationWizard.tsx` y los componentes de `components/` los importan desde aquí en
 * vez de declararlos por su cuenta.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../../core/api';
import { buildAuditDetail } from '../utils/reservation-formatters';
import { useDraftAutoSave } from './useDraftAutoSave';
import { useReservationValidation } from './useReservationValidation';

/** Paso actual del asistente, en base 1. */
export type ReservationWizardStep = 1 | 2 | 3 | 4;

/** Tipo de servicio que se reserva. Determina el copy del paso 1 y el resumen del paso 4. */
export type ReservationServiceType = 'audiovisual' | 'diseno' | 'contenido' | 'estrategia' | 'otro';

/** A quién se le muestra la reserva: solo al cliente, solo al equipo interno, o a ambos. */
export type ReservationAudience = 'client' | 'team' | 'both';

/** Un entregable concreto de la reserva, con su propia duración estimada. */
export interface ReservationDeliverable {
  id: string;
  label: string;
  durationMinutes: number;
}

/**
 * Datos que junta el asistente de creación de reservas.
 *
 * Es un tipo propio de este wizard, deliberadamente distinto de `Reservation` en `../types.ts`:
 * ese tipo modela la respuesta pública de un formulario de agenda (huésped, horario,
 * respuestas), mientras que este modela una reserva interna de trabajo -para qué cliente, qué
 * se entrega, quién puede verla- antes de que exista una reserva de agenda pública de por
 * medio. Reutilizar el mismo nombre de tipo para dos formas de dato distintas habría sido más
 * confuso que tener dos tipos con nombres distintos.
 */
export interface ReservationWizardData {
  /** Id del registro ya guardado. Ausente mientras la reserva solo existe en el wizard. */
  id?: string;
  clientId: string;
  /** Nombre del cliente, guardado junto al id para no tener que volver a resolverlo al revisar o editar. */
  clientName: string;
  serviceType: ReservationServiceType;
  objective: string;
  /** Fecha en formato `yyyy-mm-dd`, tal como la entrega un `<input type="date">`. */
  scheduledDate: string;
  /** Hora en formato `HH:mm`, opcional. */
  scheduledTime: string;
  deliverables: ReservationDeliverable[];
  specialDetails: string;
  /** Cadena vacía mientras no se elige ninguna audiencia todavía; el paso 3 exige una de las tres. */
  audience: ReservationAudience | '';
  /** Destinatarios puntuales, en texto libre separado por coma; se suman a `audience`, no la reemplazan. */
  recipients: string;
  /** `scheduled` cuando los pasos 1 a 3 pasan su validación al momento de guardar; `draft` en cualquier otro caso. */
  status: 'draft' | 'scheduled';
}

/** Construye un entregable vacío con id propio, listo para agregarse a la lista del paso 2. */
export function blankDeliverable(): ReservationDeliverable {
  return { id: crypto.randomUUID(), label: '', durationMinutes: 60 };
}

/** Estado inicial de una reserva nueva, sin cliente ni fecha, con un entregable vacío para empezar. */
export function blankReservationData(): ReservationWizardData {
  return {
    clientId: '',
    clientName: '',
    serviceType: 'audiovisual',
    objective: '',
    scheduledDate: '',
    scheduledTime: '',
    deliverables: [blankDeliverable()],
    specialDetails: '',
    audience: '',
    recipients: '',
    status: 'draft',
  };
}

/** Combina lo recibido en `initialData` (modo edición, o un borrador recuperado) con los valores por defecto. */
function withDefaults(initialData?: Partial<ReservationWizardData>): ReservationWizardData {
  const base = blankReservationData();
  if (!initialData) return base;
  return {
    ...base,
    ...initialData,
    deliverables: initialData.deliverables?.length ? initialData.deliverables : base.deliverables,
  };
}

export interface UseReservationWizardOptions {
  mode: 'create' | 'edit';
  initialData?: Partial<ReservationWizardData>;
}

export interface UseReservationWizardResult {
  step: ReservationWizardStep;
  data: ReservationWizardData;
  /** Aplica un parche parcial sobre `data`, igual que `setState` con un objeto. */
  update: (patch: Partial<ReservationWizardData>) => void;
  /** Avanza un paso, solo si el paso actual pasa su propia validación. No hace nada en el paso 4. */
  goNext: () => void;
  /** Retrocede un paso. No hace nada en el paso 1. */
  goBack: () => void;
  stepValidity: ReturnType<typeof useReservationValidation>['stepValidity'];
  readinessPercent: number;
  checklist: ReturnType<typeof useReservationValidation>['checklist'];
  isReadyToSchedule: boolean;
  /** Envía la reserva a la API y devuelve su id. Lanza si el request falla; revisa `submitError` para el mensaje ya traducido. */
  submit: () => Promise<string>;
  isSubmitting: boolean;
  submitError: string | null;
  draft: {
    /** `true` mientras siga habiendo un borrador recuperado sin descartar explícitamente. */
    hasRecoveredDraft: boolean;
    /** Borra el borrador guardado y reinicia el formulario a `initialData` (o a un formulario vacío). */
    discard: () => void;
  };
}

const TOTAL_STEPS = 4;

/**
 * Orquesta los 4 pasos del asistente de creación/edición de reservas: estado del formulario,
 * validación por paso, borrador automático y envío final.
 *
 * @example
 * const wizard = useReservationWizard({ mode: 'create' });
 * wizard.update({ clientId: 'cli_123', clientName: 'Café Volcán' });
 * wizard.goNext();
 */
export function useReservationWizard({ mode, initialData }: UseReservationWizardOptions): UseReservationWizardResult {
  const [step, setStep] = useState<ReservationWizardStep>(1);
  const [data, setData] = useState<ReservationWizardData>(() => withDefaults(initialData));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasRecoveredDraft, setHasRecoveredDraft] = useState(false);

  const validation = useReservationValidation(data);

  // Un borrador por combinación de modo + id: editar la reserva #42 no debe pisar ni recuperar
  // el borrador de una reserva nueva que quedó a medias, y viceversa.
  const draftKey = `reservation-wizard:${mode}:${initialData?.id ?? 'new'}`;
  const { loadDraft, discardDraft: discardStoredDraft } = useDraftAutoSave<ReservationWizardData>({
    key: draftKey,
    data,
    enabled: !isSubmitting,
  });

  const appliedDraftRef = useRef(false);
  useEffect(() => {
    if (appliedDraftRef.current) return;
    appliedDraftRef.current = true;
    const stored = loadDraft();
    if (stored) {
      setData(stored);
      setHasRecoveredDraft(true);
    }
    // Se recupera una sola vez, al montar: si se aplicara en cada render el borrador guardado
    // pisaría cualquier cambio que la persona hiciera después de descartarlo.
  }, [loadDraft]);

  const update = useCallback((patch: Partial<ReservationWizardData>): void => {
    setData((current) => ({ ...current, ...patch }));
  }, []);

  const goNext = useCallback((): void => {
    setStep((current) => {
      if (current >= TOTAL_STEPS) return current;
      return validation.stepValidity[current].valid ? ((current + 1) as ReservationWizardStep) : current;
    });
  }, [validation]);

  const goBack = useCallback((): void => {
    setStep((current) => (current > 1 ? ((current - 1) as ReservationWizardStep) : current));
  }, []);

  const discardDraft = useCallback((): void => {
    discardStoredDraft();
    setData(withDefaults(initialData));
    setHasRecoveredDraft(false);
    setStep(1);
  }, [discardStoredDraft, initialData]);

  const submit = useCallback(async (): Promise<string> => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const status: ReservationWizardData['status'] = validation.isReadyToSchedule ? 'scheduled' : 'draft';
      const payload = { ...data, status, auditSummary: buildAuditDetail({ ...data, status }) };
      // Endpoint provisional: el backend todavía no declara esta ruta. En modo visual
      // (`npm run dev:visual`) toda petición se resuelve en memoria con 200 OK, así que el
      // asistente puede probarse de punta a punta sin backend; contra el backend real esta
      // llamada debe apuntar al recurso que finalmente exponga las reservas internas de trabajo.
      const response = mode === 'edit' && data.id
        ? await api.patch<{ id?: string }>(`/reservations/bookings/${data.id}`, payload)
        : await api.post<{ id?: string }>('/reservations/bookings', payload);
      const reservationId = response && typeof response === 'object' && response.id ? String(response.id) : data.id ?? crypto.randomUUID();
      setData((current) => ({ ...current, id: reservationId, status }));
      discardStoredDraft();
      return reservationId;
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : 'No se pudo guardar la reserva. Intenta nuevamente.');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [data, discardStoredDraft, mode, validation.isReadyToSchedule]);

  return {
    step,
    data,
    update,
    goNext,
    goBack,
    stepValidity: validation.stepValidity,
    readinessPercent: validation.readinessPercent,
    checklist: validation.checklist,
    isReadyToSchedule: validation.isReadyToSchedule,
    submit,
    isSubmitting,
    submitError,
    draft: { hasRecoveredDraft, discard: discardDraft },
  };
}
