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
var AutomationActionsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationActionsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const notification_service_1 = require("../../core/notifications/notification.service");
const email_service_1 = require("../../core/notifications/email.service");
const process_comments_service_1 = require("../collaboration/process-comments.service");
const webhook_delivery_service_1 = require("./webhook-delivery.service");
const contracts_service_1 = require("../contracts/contracts.service");
const tasks_service_1 = require("../approvals/tasks.service");
const process_comment_entity_1 = require("../collaboration/process-comment.entity");
const opportunity_entity_1 = require("../crm/opportunities/opportunity.entity");
const lead_entity_1 = require("../crm/leads/lead.entity");
const user_entity_1 = require("../users/user.entity");
const user_role_enum_1 = require("../organizations/user-role.enum");
let AutomationActionsService = AutomationActionsService_1 = class AutomationActionsService {
    constructor(notifications, emails, comments, webhooks, contracts, tasks, opportunities, leads, users) {
        this.notifications = notifications;
        this.emails = emails;
        this.comments = comments;
        this.webhooks = webhooks;
        this.contracts = contracts;
        this.tasks = tasks;
        this.opportunities = opportunities;
        this.leads = leads;
        this.users = users;
        this.logger = new common_1.Logger(AutomationActionsService_1.name);
    }
    async execute(key, config, ctx) {
        switch (key) {
            case 'notify_user': return this.notifyUser(config, ctx);
            case 'notify_assignee': return this.notifyAssignee(config, ctx);
            case 'send_email': return this.sendEmail(config, ctx);
            case 'assign_user': return this.assignUser(config, ctx);
            case 'add_comment': return this.addComment(config, ctx);
            case 'send_webhook': return this.sendWebhook(config, ctx);
            case 'create_contract': return this.createContract(config, ctx);
            case 'create_task': return this.createTask(config, ctx);
            default:
                throw new common_1.BadRequestException(`La acción "${key}" no está implementada`);
        }
    }
    async notifyUser(config, ctx) {
        const userId = this.text(config.userId);
        if (!userId)
            throw new common_1.BadRequestException('La notificación necesita un destinatario');
        await this.notifications.notifyUser(ctx.organizationId, userId, 'automation', this.render(this.text(config.title) ?? 'Aviso', ctx.context), this.render(this.text(config.message) ?? '', ctx.context), { entityType: ctx.entityType, entityId: ctx.entityId });
        return { notifiedUserId: userId };
    }
    async notifyAssignee(config, ctx) {
        const assignee = this.text(ctx.context.assignedTo);
        if (!assignee) {
            this.logger.log(`Sin responsable en ${ctx.entityType} ${ctx.entityId}: no hay a quién notificar`);
            return { skipped: 'sin responsable' };
        }
        await this.notifications.notifyUser(ctx.organizationId, assignee, 'automation', this.render(this.text(config.title) ?? 'Aviso', ctx.context), this.render(this.text(config.message) ?? '', ctx.context), { entityType: ctx.entityType, entityId: ctx.entityId });
        return { notifiedUserId: assignee };
    }
    async sendEmail(config, ctx) {
        const to = this.render(this.text(config.to) ?? '', ctx.context);
        if (!to.includes('@'))
            throw new common_1.BadRequestException('El correo necesita un destinatario válido');
        const enviado = await this.emails.send(to, this.render(this.text(config.subject) ?? '', ctx.context), this.escapeHtml(this.render(this.text(config.body) ?? '', ctx.context)));
        return { emailSent: enviado, emailTo: to };
    }
    async assignUser(config, ctx) {
        const userId = this.text(config.userId);
        if (!userId)
            throw new common_1.BadRequestException('La asignación necesita una persona');
        const user = await this.users.findOne({
            where: { id: userId, organizationId: ctx.organizationId, isActive: true },
            select: { id: true },
        });
        if (!user)
            throw new common_1.BadRequestException('La persona indicada no está activa en la organización');
        if (ctx.entityType === 'opportunity') {
            await this.opportunities.update({ id: ctx.entityId, organizationId: ctx.organizationId }, { assignedTo: userId });
        }
        else if (ctx.entityType === 'lead') {
            await this.leads.update({ id: ctx.entityId, organizationId: ctx.organizationId }, { assignedTo: userId });
        }
        else {
            throw new common_1.BadRequestException(`No se puede asignar responsable a un registro de tipo "${ctx.entityType}"`);
        }
        return { assignedTo: userId };
    }
    async addComment(config, ctx) {
        const subject = ctx.entityType === 'opportunity' ? process_comment_entity_1.CommentSubject.OPPORTUNITY
            : ctx.entityType === 'lead' ? process_comment_entity_1.CommentSubject.LEAD
                : null;
        if (!subject)
            throw new common_1.BadRequestException(`No hay hilo para un registro de tipo "${ctx.entityType}"`);
        const comment = await this.comments.add(ctx.organizationId, subject, ctx.entityId, this.render(this.text(config.body) ?? '', ctx.context), process_comment_entity_1.CommentVisibility.INTERNAL, { id: ctx.actingUserId, role: user_role_enum_1.UserRole.ADMIN, name: 'Automatización' });
        return { commentId: comment.id };
    }
    async createContract(config, ctx) {
        if (ctx.entityType !== 'opportunity') {
            throw new common_1.BadRequestException('Solo un trato puede abrir un contrato');
        }
        const opportunity = await this.opportunities.findOne({
            where: { id: ctx.entityId, organizationId: ctx.organizationId },
        });
        if (!opportunity)
            throw new common_1.BadRequestException('El trato ya no existe');
        if (!opportunity.clientId) {
            this.logger.log(`Trato ${opportunity.id} sin cliente: el contrato se abrirá cuando exista la ficha`);
            return { skipped: 'el trato aún no tiene cliente' };
        }
        const contract = await this.contracts.create({
            clientId: opportunity.clientId,
            name: this.render(this.text(config.name) ?? opportunity.name, ctx.context),
            startDate: new Date().toISOString().slice(0, 10),
            monthlyPrice: opportunity.amount ? Number(opportunity.amount) : undefined,
            status: 'paused',
        }, ctx.organizationId);
        return { contractId: contract.id, contractStatus: contract.status };
    }
    async createTask(config, ctx) {
        const dueInDays = Number(config.dueInDays ?? 0);
        const dueAt = Number.isFinite(dueInDays) && dueInDays > 0
            ? new Date(Date.now() + dueInDays * 86_400_000).toISOString()
            : undefined;
        const task = await this.tasks.create(ctx.organizationId, ctx.actingUserId, {
            title: this.render(this.text(config.title) ?? '', ctx.context),
            description: this.render(this.text(config.description) ?? '', ctx.context) || undefined,
            entityType: ctx.entityType,
            entityId: ctx.entityId,
            clientId: this.text(ctx.context.clientId),
            assignedTo: this.text(config.assignedTo) ?? this.text(ctx.context.assignedTo),
            dueAt,
        });
        return { taskId: task.id };
    }
    async sendWebhook(config, ctx) {
        const url = this.text(config.url);
        if (!url)
            throw new common_1.BadRequestException('El webhook necesita una dirección');
        const delivery = await this.webhooks.enqueue(ctx.organizationId, url, {
            entityType: ctx.entityType,
            entityId: ctx.entityId,
            context: ctx.context,
            sentAt: new Date().toISOString(),
        });
        return { webhookDeliveryId: delivery.id };
    }
    render(template, context) {
        return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key) => {
            const value = context[key];
            return value === null || value === undefined ? '' : String(value);
        });
    }
    escapeHtml(value) {
        return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
    }
    text(value) {
        return typeof value === 'string' && value.trim() ? value.trim() : undefined;
    }
};
exports.AutomationActionsService = AutomationActionsService;
exports.AutomationActionsService = AutomationActionsService = AutomationActionsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(6, (0, typeorm_1.InjectRepository)(opportunity_entity_1.Opportunity)),
    __param(7, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __param(8, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [notification_service_1.NotificationService,
        email_service_1.EmailService,
        process_comments_service_1.ProcessCommentsService,
        webhook_delivery_service_1.WebhookDeliveryService,
        contracts_service_1.ContractsService,
        tasks_service_1.TasksService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], AutomationActionsService);
