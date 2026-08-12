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
exports.OperationalAlertsJob = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const notification_entity_1 = require("../../notifications/notification.entity");
const parameter_resolver_service_1 = require("../../parameters/parameter-resolver.service");
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
//# sourceMappingURL=operational-alerts.job.js.map