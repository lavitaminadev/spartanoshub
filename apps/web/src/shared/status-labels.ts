/**
 * Nombre visible de cada estado interno.
 *
 * Es la única tabla de la que salen los estados que ve el usuario: insignias, filtros,
 * selectores y timelines. Toda pantalla que muestre un estado lo pide acá, de modo que un
 * mismo valor se lea igual en todas y no queden restos en inglés o con guiones bajos.
 */
const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  disabled: 'Desactivado',
  disconnected: 'Desconectado',
  archived: 'Archivado',
  pending: 'Pendiente',
  completed: 'Completado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  scheduled: 'Programado',
  planning: 'Planificación',
  strategic: 'Estratégica',
  weekly: 'Semanal',
  onboarding: 'Incorporación',
  paused: 'Pausado',
  error: 'Error',
  review: 'En revisión',
  draft: 'Borrador',
  closed: 'Cerrada',
  new: 'Nuevo',
  contacted: 'Contactado',
  qualified: 'Calificado',
  discarded: 'Descartado',
  converted: 'Convertido',
  won: 'Ganado',
  lost: 'Perdido',
  in_progress: 'En progreso',
  internal_review: 'Revisión interna',
  client_validation: 'Validación del cliente',
  on_hold: 'En espera',
  blocked: 'Bloqueado',
  cancelled: 'Cancelado',
  meeting_scheduled: 'Reunión agendada',
  quote_sent: 'Cotización enviada',
  proposal: 'Propuesta',
  negotiation: 'Negociación',
  backlog: 'Por asignar',
  assigned: 'Asignado',
  correction: 'Corrección',
  delivered: 'Entregado',
  requested: 'Solicitado',
  sent: 'Enviado',
  submitted: 'Enviado a revisión',
  received: 'Recibido',
  viewed: 'Visto',
  ended: 'Finalizado',
  published: 'Publicado',
  pending_pricing: 'Pendiente de valorización',
  ready_to_invoice: 'Listo para facturar',
  confirmed: 'Confirmada',
  reserved: 'Reservó',
  attended: 'Asistió',
  no_show: 'No asistió',
  rescheduled: 'Reagendada',
  cancelled_client: 'Cancelada por cliente',
  cancelled_business: 'Cancelada por empresa',
  waitlist: 'Lista de espera',
  open: 'Pendiente',
  done: 'Completado',
  // Tipos de interacción comercial (crm_interactions.type). Se muestran con `statusLabel`
  // en la línea de tiempo del lead y en la actividad comercial.
  call: 'Llamada',
  email: 'Correo',
  meeting: 'Reunión',
  whatsapp: 'WhatsApp',
  note: 'Nota',
  // Estados de la cola de envío a Meta CAPI (meta_conversion_outbox.status).
  processed: 'Enviado',
  processing: 'Enviando',
  retry: 'Reintentando',
  failed: 'Falló',
  expired: 'Expirado',
};

/**
 * Etiqueta visible de un estado.
 *
 * Devuelve cadena vacía si no hay estado. Para valores que no están en la tabla —por
 * ejemplo categorías que escribe el equipo— garantiza que nunca se muestre snake_case:
 * cambia los guiones bajos por espacios y capitaliza la primera letra.
 */
export function statusLabel(status: string | null | undefined): string {
  if (!status) return '';
  return STATUS_LABELS[status] ?? status
    .replace(/_/g, ' ')
    .replace(/^./, (character) => character.toUpperCase());
}
