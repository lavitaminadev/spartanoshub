"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAZOS_POR_DEFECTO = exports.CLAVE_ABANDONO = exports.CLAVE_ALERTA = exports.CLAVE_AVISO = void 0;
exports.inactividadDe = inactividadDe;
exports.CLAVE_AVISO = 'crm.lead_idle_days_notice';
exports.CLAVE_ALERTA = 'crm.lead_idle_days_warning';
exports.CLAVE_ABANDONO = 'crm.lead_idle_days_critical';
exports.PLAZOS_POR_DEFECTO = { notice: 3, warning: 5, critical: 7 };
const UN_DIA = 86_400_000;
const CERRADAS = new Set(['won', 'lost', 'attended', 'no_show']);
function inactividadDe(lead, plazos = exports.PLAZOS_POR_DEFECTO, ahora = new Date()) {
    const referencia = lead.stageChangedAt ?? lead.createdAt;
    if (!referencia || CERRADAS.has(lead.status))
        return { idleDays: 0, idleLevel: null };
    const desde = referencia instanceof Date ? referencia : new Date(referencia);
    if (Number.isNaN(desde.getTime()))
        return { idleDays: 0, idleLevel: null };
    const idleDays = Math.floor((ahora.getTime() - desde.getTime()) / UN_DIA);
    if (idleDays < 0)
        return { idleDays: 0, idleLevel: null };
    if (idleDays >= plazos.critical)
        return { idleDays, idleLevel: 'critical' };
    if (idleDays >= plazos.warning)
        return { idleDays, idleLevel: 'warning' };
    if (idleDays >= plazos.notice)
        return { idleDays, idleLevel: 'notice' };
    return { idleDays, idleLevel: null };
}
