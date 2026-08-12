/**
 * @fileoverview Formateo de despliegue para el asistente de creación de reservas: catálogos de
 * opciones (tipo de servicio, audiencia) y funciones puras que convierten los datos crudos del
 * wizard en texto legible (duraciones, fechas, resumen de auditoría).
 *
 * Nada de aquí depende de React ni hace I/O: son funciones puras sobre
 * `ReservationWizardData`, fáciles de probar y de reutilizar desde otras vistas (ej. una lista
 * de reservas que quiera mostrar la misma duración total con el mismo formato).
 */

import type {
  ReservationAudience,
  ReservationDeliverable,
  ReservationServiceType,
  ReservationWizardData,
} from '../hooks/useReservationWizard';

/** Etiqueta visible de cada tipo de servicio que puede reservarse. */
export const SERVICE_TYPE_LABELS: Record<ReservationServiceType, string> = {
  audiovisual: 'Producción audiovisual',
  diseno: 'Diseño',
  contenido: 'Contenido y copy',
  estrategia: 'Estrategia y planificación',
  otro: 'Otro servicio',
};

/** Catálogo de audiencias con su descripción, en el orden en que se muestran en el paso 3. */
export const AUDIENCE_OPTIONS: Array<{ value: ReservationAudience; label: string; description: string }> = [
  { value: 'client', label: 'Solo cliente', description: 'Visible para el cliente en su portal.' },
  { value: 'team', label: 'Solo equipo', description: 'Visible únicamente para el equipo interno.' },
  { value: 'both', label: 'Cliente y equipo', description: 'Visible en el portal del cliente y en el panel interno.' },
];

/** Suma la duración de todos los entregables, en minutos. */
export function totalDeliverableMinutes(deliverables: ReservationDeliverable[]): number {
  return deliverables.reduce((sum, item) => sum + (Number(item.durationMinutes) || 0), 0);
}

/**
 * Convierte minutos totales en un texto corto ("1 h 30 min", "45 min").
 *
 * @param totalMinutes - Minutos totales, normalmente la suma de `totalDeliverableMinutes`.
 */
export function formatDurationMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return 'Sin duración definida';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

/**
 * Formatea la fecha (y hora, si se definió) de la reserva en español, para el resumen y la
 * vista previa de auditoría. Devuelve un texto explicativo en vez de lanzar cuando la fecha
 * está vacía o mal formada, porque este formateador se usa mientras el formulario todavía se
 * está completando.
 */
export function formatScheduledDateTime(date: string, time: string): string {
  if (!date) return 'Sin fecha definida';
  const parsed = new Date(time ? `${date}T${time}` : `${date}T00:00`);
  if (Number.isNaN(parsed.getTime())) return 'Fecha inválida';
  return parsed.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(time ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

/** Etiqueta de la audiencia elegida, o un texto neutro mientras no se haya elegido ninguna. */
export function audienceLabel(audience: ReservationAudience | ''): string {
  return AUDIENCE_OPTIONS.find((option) => option.value === audience)?.label ?? 'Sin definir';
}

/**
 * Línea de resumen usada como `detail` de la entrada de auditoría ("Reserva creada") y como
 * `auditSummary` enviado al backend, de modo que el registro trazable no dependa de que el
 * servidor vuelva a reconstruir el contexto a partir de columnas sueltas.
 */
export function buildAuditDetail(data: ReservationWizardData): string {
  const deliverableCount = data.deliverables.filter((item) => item.label.trim()).length;
  const duration = formatDurationMinutes(totalDeliverableMinutes(data.deliverables));
  return `${data.clientName || 'Cliente sin nombre'} · ${SERVICE_TYPE_LABELS[data.serviceType]} · `
    + `${deliverableCount} entregable(s) · ${duration} · Visible para: ${audienceLabel(data.audience)}`;
}
