"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTOMATION_ACTION_KEYS = exports.AUTOMATION_TRIGGER_KEYS = exports.AUTOMATION_ACTIONS = exports.AUTOMATION_TRIGGERS = void 0;
exports.findTrigger = findTrigger;
exports.findAction = findAction;
exports.delayToMs = delayToMs;
exports.AUTOMATION_TRIGGERS = [
    { key: 'deal.created', label: 'Trato creado', entityType: 'opportunity', event: 'deal.created' },
    { key: 'deal.stage_changed', label: 'Cambio de etapa', entityType: 'opportunity', event: 'deal.stage_changed' },
    { key: 'deal.won', label: 'Trato ganado', entityType: 'opportunity', event: 'deal.won' },
    { key: 'deal.lost', label: 'Trato perdido', entityType: 'opportunity', event: 'deal.lost' },
    { key: 'lead.converted', label: 'Prospecto convertido', entityType: 'lead', event: 'lead.converted' },
    { key: 'task.overdue', label: 'Tarea vencida', entityType: 'approval', event: 'task.overdue' },
    { key: 'deal.stale', label: 'Trato sin seguimiento', entityType: 'opportunity', event: 'deal.stale' },
];
exports.AUTOMATION_ACTIONS = [
    { key: 'notify_user', label: 'Enviar notificación', requiredConfig: ['userId', 'title', 'message'] },
    { key: 'notify_assignee', label: 'Notificar al responsable', requiredConfig: ['title', 'message'] },
    { key: 'send_email', label: 'Enviar correo', requiredConfig: ['to', 'subject', 'body'] },
    { key: 'assign_user', label: 'Asignar responsable', requiredConfig: ['userId'] },
    { key: 'add_comment', label: 'Agregar nota al hilo', requiredConfig: ['body'] },
    { key: 'send_webhook', label: 'Enviar webhook', requiredConfig: ['url'] },
    { key: 'create_contract', label: 'Abrir contrato del trato ganado', requiredConfig: [] },
    { key: 'create_task', label: 'Crear tarea', requiredConfig: ['title'] },
];
exports.AUTOMATION_TRIGGER_KEYS = exports.AUTOMATION_TRIGGERS.map((trigger) => trigger.key);
exports.AUTOMATION_ACTION_KEYS = exports.AUTOMATION_ACTIONS.map((action) => action.key);
function findTrigger(key) {
    return exports.AUTOMATION_TRIGGERS.find((trigger) => trigger.key === key);
}
function findAction(key) {
    return exports.AUTOMATION_ACTIONS.find((action) => action.key === key);
}
function delayToMs(config) {
    const unitMs = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 }[config.unit];
    return Math.max(0, config.amount) * unitMs;
}
