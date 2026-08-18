import type { ProcessTemplateStep } from './process-template.entity';

/**
 * Código de la plantilla que define las etapas del pipeline comercial.
 *
 * Se exporta para que el CRM lo pida por nombre en vez de repetir la cadena, y para que
 * renombrarlo rompa la compilación en lugar de dejar el pipeline sin etapas en silencio.
 */
export const COMMERCIAL_PIPELINE_TEMPLATE = 'commercial_pipeline';

export const PROCESS_TEMPLATE_DEFAULTS: Record<string, { name: string; description: string; steps: ProcessTemplateStep[] }> = {
  /**
   * Etapas del pipeline comercial.
   *
   * Estaban fijas en el frontend (`CrmRecordsPage`), así que cambiar una exigía desplegar y
   * el tablero, la tabla y el informe podían discrepar entre sí. Ahora salen de acá, que es
   * donde ya viven las etapas de los demás procesos.
   *
   * Las `key` **son los valores guardados** en `crm_opportunities.stage` y en el historial de
   * transiciones: cambiar una deja huérfanos los tratos que ya la tienen. La etiqueta sí se
   * puede cambiar cuando se quiera.
   *
   * `won` y `lost` cierran el trato y el resto del sistema los trata distinto —el motivo de
   * pérdida es obligatorio, la automatización de contrato escucha `won`—, así que su `key` es
   * parte del contrato y no solo una etapa más de la lista.
   */
  [COMMERCIAL_PIPELINE_TEMPLATE]: {
    name: 'Pipeline comercial',
    description: 'Etapas por las que avanza una oportunidad hasta ganarse o perderse.',
    steps: [
      ['new', 'Nuevo', 'commercial_director', 48],
      ['qualified', 'Calificado', 'commercial_director', 72],
      ['proposal', 'Propuesta', 'commercial_director', 120],
      ['negotiation', 'Negociación', 'commercial_director', 168],
      ['won', 'Ganado', 'commercial_director', 0],
      ['lost', 'Perdido', 'commercial_director', 0],
    ].map(([key, label, responsibleRole, slaHours]) => ({
      key: String(key),
      label: String(label),
      responsibleRole: String(responsibleRole),
      slaHours: Number(slaHours),
      required: true,
    })),
  },
  onboarding: {
    name: 'Activación de cliente',
    description: 'Desde el cierre comercial hasta la primera operación mensual activa.',
    steps: [
      ['brief_sent', 'Brief enviado', 'operations_director', 24],
      ['brief_received', 'Brief recibido', 'community_manager', 72],
      ['whatsapp_group', 'Grupo WhatsApp creado', 'community_manager', 8],
      ['cm_assigned', 'CM asignada', 'operations_director', 8],
      ['strategy', 'Estrategia en desarrollo', 'creative_director', 72],
      ['strategy_approved', 'Estrategia aprobada', 'creative_director', 24],
      ['handoff', 'Traspaso a CM', 'operations_director', 8],
      ['client_presentation', 'Presentación al cliente', 'community_manager', 48],
      ['month_one', 'Parrilla mes 1 y moodboard', 'community_manager', 72],
      ['active', 'Operación activa', 'operations_director', 8],
    ].map(([key, label, responsibleRole, slaHours]) => ({ key: String(key), label: String(label), responsibleRole: String(responsibleRole), slaHours: Number(slaHours), required: true })),
  },
  production: {
    name: 'Producción de piezas',
    description: 'Estados protegidos desde backlog hasta publicación.',
    steps: ['Backlog', 'Asignada', 'En progreso', 'Revisión interna', 'Validación del cliente', 'Corrección', 'Aprobada', 'Entregada o publicada'].map((label) => ({ key: label.toLowerCase().replaceAll(' ', '_'), label, required: true })),
  },
  audiovisual: {
    name: 'Producción audiovisual',
    description: 'Preparación creativa, sesión, edición y entrega final.',
    steps: ['Moodboard CM', 'Verificación creativa', 'Revisión dirección AV', 'Equipo asignado', 'Sesión realizada', 'Edición y revisión', 'Entrega final'].map((label) => ({ key: label.toLowerCase().replaceAll(' ', '_'), label, required: true })),
  },
  monthly_cycle: {
    name: 'Ciclo mensual de cuenta',
    description: 'Planificación, producción, publicación, reunión y resultados.',
    steps: ['Planificación de parrilla', 'Revisión creativa', 'Producción y publicación', 'Reunión estratégica', 'Reporte de resultados'].map((label) => ({ key: label.toLowerCase().replaceAll(' ', '_'), label, required: true })),
  },
};
