"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var OperationalAlertsJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationalAlertsJob = exports.DIAS_DE_AVISO_ANTES_DE_VENCER = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const notification_entity_1 = require("../../notifications/notification.entity");
const parameter_resolver_service_1 = require("../../parameters/parameter-resolver.service");
const plazo_de_aviso_1 = require("../../../modules/vulneraciones/plazo-de-aviso");
const shared_1 = require("@espartanos/shared");
exports.DIAS_DE_AVISO_ANTES_DE_VENCER = 3;
let OperationalAlertsJob = OperationalAlertsJob_1 = class OperationalAlertsJob {
    constructor(dataSource, notifications, parameters) {
        this.dataSource = dataSource;
        this.notifications = notifications;
        this.parameters = parameters;
        this.logger = new common_1.Logger(OperationalAlertsJob_1.name);
    }
    async handle() {
        const organizations = await this.dataSource.query('SELECT id FROM organizations');
        let created = 0;
        for (const organization of organizations) {
            try {
                created += await this.deadlineAlerts(organization.id);
                created += await this.actionItemAlerts(organization.id);
                created += await this.budgetAlerts(organization.id);
                created += await this.cycleAlerts(organization.id);
                created += await this.vulneracionAlerts(organization.id);
                created += await this.solicitudesDeDerechos(organization.id);
                created += await this.prestamosPorVencer(organization.id);
            }
            catch (error) {
                this.logger.error(`Failed to scan alerts for organization ${organization.id}: ${error instanceof Error ? error.message : error}`);
            }
        }
        this.logger.log(`Operational alert scan completed: ${created} notifications created`);
    }
    async deadlineAlerts(organizationId) {
        const hours = Number(await this.parameters.get('alerts.deadline_notice_hours', null, null, organizationId) ?? 24);
        const pieces = await this.dataSource.query("SELECT id, title, assigned_to assignedTo, deadline_at deadlineAt, client_id clientId FROM pieces WHERE organization_id = ? AND status <> 'delivered' AND deadline_at IS NOT NULL AND deadline_at <= DATE_ADD(NOW(), INTERVAL ? HOUR)", [organizationId, hours]);
        let total = 0;
        const fallback = await this.directors(organizationId);
        for (const piece of pieces) {
            const overdue = new Date(piece.deadlineAt).getTime() < Date.now();
            const recipients = piece.assignedTo ? [piece.assignedTo, ...fallback] : fallback;
            total += await this.notifyOnce(organizationId, [...new Set(recipients)], overdue ? 'deadline.overdue' : 'deadline.upcoming', `${piece.id}:${overdue ? 'overdue' : 'upcoming'}`, overdue ? 'Entrega vencida' : 'Entrega próxima', `La pieza "${piece.title}" ${overdue ? 'superó su fecha de entrega' : `vence dentro de ${hours} horas`}.`, { pieceId: piece.id, clientId: piece.clientId, deadlineAt: piece.deadlineAt });
        }
        return total;
    }
    async solicitudesDeDerechos(organizationId) {
        const abiertas = await this.dataSource.query('SELECT id, type, created_at createdAt, extended_until extendedUntil FROM service_requests WHERE organization_id = ? AND resolved_at IS NULL ORDER BY created_at ASC LIMIT 200', [organizationId]);
        if (!abiertas.length)
            return 0;
        const destinatarios = await this.directors(organizationId);
        if (!destinatarios.length)
            return 0;
        let total = 0;
        for (const fila of abiertas) {
            const plazo = (0, shared_1.plazoDeSolicitud)(fila.createdAt, { prorrogadaHasta: fila.extendedUntil });
            if (plazo.estado !== 'vencida' && plazo.estado !== 'por vencer')
                continue;
            const vencida = plazo.estado === 'vencida';
            total += await this.notifyOnce(organizationId, destinatarios, vencida ? 'derechos.vencida' : 'derechos.por_vencer', `${fila.id}:${plazo.estado}`, vencida ? 'Solicitud de derechos vencida' : 'Solicitud de derechos por vencer', vencida
                ? `Una solicitud de ${fila.type} superó el plazo legal de respuesta hace ${Math.abs(plazo.diasRestantes)} día(s). Respóndela cuanto antes y deja constancia del retraso.`
                : `Una solicitud de ${fila.type} vence en ${plazo.diasRestantes} día(s)${plazo.prorrogada ? ' (plazo ya prorrogado, no se puede prorrogar otra vez)' : ''}.`, { serviceRequestId: fila.id, vence: plazo.vence });
        }
        return total;
    }
    async prestamosPorVencer(organizationId) {
        const dias = exports.DIAS_DE_AVISO_ANTES_DE_VENCER;
        const cuentas = await this.dataSource.query('SELECT a.id, a.granted_by grantedBy, a.expires_at expiresAt, u.name persona, c.name empresa FROM user_client_access a JOIN users u ON u.id = a.user_id JOIN clients c ON c.id = a.client_id WHERE a.organization_id = ? AND a.retired_at IS NULL AND a.expiry_notified_at IS NULL AND a.expires_at > NOW() AND a.expires_at <= DATE_ADD(NOW(), INTERVAL ? DAY) LIMIT 200', [organizationId, dias]);
        const acciones = await this.dataSource.query('SELECT a.id, a.granted_by grantedBy, a.expires_at expiresAt, u.name persona, a.action accion FROM user_action_overrides a JOIN users u ON u.id = a.user_id WHERE a.organization_id = ? AND a.expiry_notified_at IS NULL AND a.expires_at > NOW() AND a.expires_at <= DATE_ADD(NOW(), INTERVAL ? DAY) LIMIT 200', [organizationId, dias]);
        if (!cuentas.length && !acciones.length)
            return 0;
        const direccion = await this.directors(organizationId);
        const activos = new Set((await this.dataSource.query('SELECT id FROM users WHERE organization_id = ? AND is_active = 1', [organizationId])).map((fila) => fila.id));
        const destinatarios = (grantedBy) => (grantedBy && activos.has(grantedBy) ? [grantedBy] : direccion);
        let total = 0;
        for (const fila of cuentas) {
            total += await this.notifyOnce(organizationId, destinatarios(fila.grantedBy), 'acceso.por_vencer', `${fila.id}:${new Date(fila.expiresAt).getTime()}`, 'Acceso prestado por vencer', `${fila.persona} deja de ver la cuenta ${fila.empresa} el ${new Date(fila.expiresAt).toLocaleDateString('es-CL')}. Renuévalo si todavía lo necesita; si no, se cierra solo.`, { userClientAccessId: fila.id });
            await this.dataSource.query('UPDATE user_client_access SET expiry_notified_at = NOW() WHERE id = ?', [fila.id]);
        }
        for (const fila of acciones) {
            total += await this.notifyOnce(organizationId, destinatarios(fila.grantedBy), 'accion.por_vencer', `${fila.id}:${new Date(fila.expiresAt).getTime()}`, 'Ajuste de acción por vencer', `El ajuste de «${fila.accion}» para ${fila.persona} vence el ${new Date(fila.expiresAt).toLocaleDateString('es-CL')}. Renuévalo si todavía lo necesita; si no, la acción vuelve al nivel de su módulo.`, { userActionOverrideId: fila.id });
            await this.dataSource.query('UPDATE user_action_overrides SET expiry_notified_at = NOW() WHERE id = ?', [fila.id]);
        }
        return total;
    }
    async actionItemAlerts(organizationId) {
        const items = await this.dataSource.query("SELECT ai.id, ai.description, ai.assigned_to assignedTo, ai.meeting_id meetingId FROM action_items ai JOIN meetings m ON m.id = ai.meeting_id WHERE m.organization_id = ? AND ai.status <> 'completed' AND ai.due_at IS NOT NULL AND ai.due_at < NOW()", [organizationId]);
        let total = 0;
        const fallback = await this.directors(organizationId);
        for (const item of items)
            total += await this.notifyOnce(organizationId, item.assignedTo ? [item.assignedTo] : fallback, 'meeting.action_overdue', item.id, 'Compromiso vencido', item.description, { actionItemId: item.id, meetingId: item.meetingId });
        return total;
    }
    async budgetAlerts(organizationId) {
        const threshold = Number(await this.parameters.get('ud.warning_threshold_percent', null, null, organizationId) ?? 80);
        const budgets = await this.dataSource.query('SELECT b.id, b.client_id clientId, c.name clientName, c.community_manager_id communityManagerId, b.contracted, b.reserved, b.consumed FROM ud_budgets b JOIN clients c ON c.id = b.client_id WHERE c.organization_id = ? AND b.year = YEAR(CURDATE()) AND b.month = MONTH(CURDATE()) AND b.contracted > 0 AND ((b.reserved + b.consumed) * 100 / b.contracted) >= ?', [organizationId, threshold]);
        let total = 0;
        const fallback = await this.directors(organizationId);
        for (const budget of budgets) {
            const percent = Math.round((Number(budget.reserved) + Number(budget.consumed)) * 100 / Number(budget.contracted));
            const recipients = budget.communityManagerId ? [budget.communityManagerId, ...fallback] : fallback;
            total += await this.notifyOnce(organizationId, [...new Set(recipients)], 'ud.threshold', `${budget.id}:${percent >= 100 ? 'limit' : 'warning'}`, percent >= 100 ? 'Presupuesto UD agotado' : 'Consumo UD preventivo', `${budget.clientName} alcanzó ${percent}% de su presupuesto mensual.`, { budgetId: budget.id, clientId: budget.clientId, percent });
        }
        return total;
    }
    async cycleAlerts(organizationId) {
        if (new Date().getDate() < 8)
            return 0;
        const cycles = await this.dataSource.query('SELECT ac.id, ac.client_id clientId, c.name clientName, c.community_manager_id communityManagerId, ac.grid_status gridStatus, ac.report_status reportStatus, ac.weekly_meetings_completed weeklyDone, ac.weekly_meetings_due weeklyDue, ac.strategy_meeting_status strategyStatus FROM account_cycles ac JOIN clients c ON c.id = ac.client_id WHERE ac.organization_id = ? AND ac.year = YEAR(CURDATE()) AND ac.month = MONTH(CURDATE()) AND ac.status <> \'closed\'', [organizationId]);
        let total = 0;
        const fallback = await this.directors(organizationId);
        for (const cycle of cycles) {
            const pending = [cycle.gridStatus !== 'completed' ? 'parrilla' : '', Number(cycle.weeklyDone) < Number(cycle.weeklyDue) ? 'reuniones semanales' : '', cycle.strategyStatus !== 'completed' ? 'reunión estratégica' : '', cycle.reportStatus !== 'completed' ? 'informe' : ''].filter(Boolean);
            if (!pending.length)
                continue;
            const recipients = cycle.communityManagerId ? [cycle.communityManagerId, ...fallback] : fallback;
            total += await this.notifyOnce(organizationId, [...new Set(recipients)], 'cycle.pending', `${cycle.id}:${pending.join('|')}`, 'Ciclo mensual con pendientes', `${cycle.clientName}: falta completar ${pending.join(', ')}.`, { cycleId: cycle.id, clientId: cycle.clientId, pending });
        }
        return total;
    }
    async vulneracionAlerts(organizationId) {
        const incidentes = await this.dataSource.query('SELECT id, descripcion, detected_at detectedAt FROM security_incidents WHERE organization_id = ? AND aviso_local_at IS NULL', [organizationId]);
        let total = 0;
        const destinatarios = await this.directors(organizationId);
        for (const incidente of incidentes) {
            const plazo = (0, plazo_de_aviso_1.plazoDeAviso)(new Date(incidente.detectedAt), null);
            if (plazo.estado !== 'por vencer' && plazo.estado !== 'vencido')
                continue;
            const vencido = plazo.estado === 'vencido';
            const resumen = incidente.descripcion.length > 120 ? `${incidente.descripcion.slice(0, 117)}...` : incidente.descripcion;
            total += await this.notifyOnce(organizationId, destinatarios, vencido ? 'security.incident_notice_overdue' : 'security.incident_notice_due', `${incidente.id}:${vencido ? 'overdue' : 'due'}`, vencido ? 'Aviso de vulneración vencido' : 'Aviso de vulneración por vencer', vencido
                ? `Venció el plazo para avisar al local de la vulneración «${resumen}». Avisa y registra la fecha.`
                : `Quedan ${Math.max(0, Math.floor(plazo.horasRestantes))} horas para avisar al local de la vulneración «${resumen}».`, { incidentId: incidente.id, vence: plazo.vence });
        }
        return total;
    }
    directors(organizationId) {
        return this.dataSource.query("SELECT id FROM users WHERE organization_id = ? AND is_active = 1 AND role IN ('admin','operations_director')", [organizationId]);
    }
    async notifyOnce(organizationId, recipients, type, fingerprint, title, message, data) {
        let created = 0;
        for (const recipient of recipients) {
            const userId = typeof recipient === 'string' ? recipient : recipient.id;
            if (!userId)
                continue;
            const existing = await this.dataSource.query('SELECT id FROM notifications WHERE organization_id = ? AND user_id = ? AND type = ? AND JSON_UNQUOTE(JSON_EXTRACT(data, \'$.fingerprint\')) = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 20 HOUR) LIMIT 1', [organizationId, userId, type, fingerprint]);
            if (existing.length)
                continue;
            await this.notifications.save(this.notifications.create({ organizationId, userId, type, title, message, data: { ...data, fingerprint } }));
            created += 1;
        }
        return created;
    }
};
exports.OperationalAlertsJob = OperationalAlertsJob;
exports.OperationalAlertsJob = OperationalAlertsJob = OperationalAlertsJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __param(1, (0, typeorm_1.InjectRepository)(notification_entity_1.Notification)),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        typeorm_2.Repository,
        parameter_resolver_service_1.ParameterResolver])
], OperationalAlertsJob);
