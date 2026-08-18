/**
 * Qué puede escuchar, preguntar y hacer una automatización.
 *
 * El catálogo vive en código y no en base por la misma razón que la matriz de permisos: qué
 * disparadores existen es una definición de producto que se revisa en un cambio de código, no
 * un dato que alguien edite en caliente. La base guarda qué automatización usa qué clave; qué
 * claves existen se declara acá.
 *
 * El editor visual se construye leyendo esto, así que agregar una acción es agregar una
 * entrada y su manejador — sin migración y sin tocar el frontend.
 */

/** Qué tipo de registro acompaña a un disparador, para saber qué condiciones ofrecerle. */
export type AutomationEntityType = 'lead' | 'opportunity' | 'contact' | 'reservation' | 'service_request';

export interface TriggerDefinition {
  key: string;
  label: string;
  entityType: AutomationEntityType;
  /** Evento del bus interno que lo produce. */
  event: string;
}

/**
 * Disparadores disponibles.
 *
 * Solo se listan los que hoy tienen un evento emitido de verdad. Declarar acá un disparador
 * que nadie emite produce automatizaciones que se guardan, se activan y no corren nunca:
 * peor que no ofrecerlo, porque parece que funciona.
 */
export const AUTOMATION_TRIGGERS: readonly TriggerDefinition[] = [
  { key: 'deal.created', label: 'Trato creado', entityType: 'opportunity', event: 'deal.created' },
  { key: 'deal.stage_changed', label: 'Cambio de etapa', entityType: 'opportunity', event: 'deal.stage_changed' },
  { key: 'deal.won', label: 'Trato ganado', entityType: 'opportunity', event: 'deal.won' },
  { key: 'deal.lost', label: 'Trato perdido', entityType: 'opportunity', event: 'deal.lost' },
  { key: 'lead.converted', label: 'Prospecto convertido', entityType: 'lead', event: 'lead.converted' },
] as const;

/** Operadores de comparación. Deliberadamente pocos: cubren el caso real sin volverse un lenguaje. */
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'is_empty'
  | 'is_not_empty'
  | 'greater_than'
  | 'less_than';

export interface ConditionConfig {
  /** Campo del contexto: `stage`, `amount`, `assignedTo`… */
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export interface ActionDefinition {
  key: string;
  label: string;
  /** Campos que su configuración debe traer. El validador los exige antes de guardar. */
  requiredConfig: readonly string[];
}

/**
 * Acciones disponibles.
 *
 * Todas se apoyan en servicios que ya existen. Ninguna llama a un tercero en línea: lo que
 * sale a la red lo hace por su bandeja de salida, como Meta y Google, para que una caída
 * ajena no deje una ejecución colgada.
 */
export const AUTOMATION_ACTIONS: readonly ActionDefinition[] = [
  { key: 'notify_user', label: 'Enviar notificación', requiredConfig: ['userId', 'title', 'message'] },
  { key: 'notify_assignee', label: 'Notificar al responsable', requiredConfig: ['title', 'message'] },
  { key: 'send_email', label: 'Enviar correo', requiredConfig: ['to', 'subject', 'body'] },
  { key: 'assign_user', label: 'Asignar responsable', requiredConfig: ['userId'] },
  { key: 'add_comment', label: 'Agregar nota al hilo', requiredConfig: ['body'] },
] as const;

/** Espera antes de continuar. Es el nodo que hace útil el resto. */
export interface DelayConfig {
  amount: number;
  unit: 'minutes' | 'hours' | 'days';
}

export const AUTOMATION_TRIGGER_KEYS = AUTOMATION_TRIGGERS.map((trigger) => trigger.key);
export const AUTOMATION_ACTION_KEYS = AUTOMATION_ACTIONS.map((action) => action.key);

export function findTrigger(key: string): TriggerDefinition | undefined {
  return AUTOMATION_TRIGGERS.find((trigger) => trigger.key === key);
}

export function findAction(key: string): ActionDefinition | undefined {
  return AUTOMATION_ACTIONS.find((action) => action.key === key);
}

/** Convierte una espera a milisegundos. */
export function delayToMs(config: DelayConfig): number {
  const unitMs = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 }[config.unit];
  return Math.max(0, config.amount) * unitMs;
}
