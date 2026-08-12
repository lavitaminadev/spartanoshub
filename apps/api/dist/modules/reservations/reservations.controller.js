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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationsController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const node_events_1 = require("node:events");
const account_access_service_1 = require("../../core/client-scope/account-access.service");
const audit_service_1 = require("../../core/audit/audit.service");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const requires_permission_decorator_1 = require("../../core/authorization/requires-permission.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const reservations_service_1 = require("./application/reservations.service");
const bulk_import_service_1 = require("./application/bulk-import.service");
const reservation_dto_1 = require("./dto/reservation.dto");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
let ReservationsController = class ReservationsController {
    constructor(service, accountAccess, bulkImport, audit) {
        this.service = service;
        this.accountAccess = accountAccess;
        this.bulkImport = bulkImport;
        this.audit = audit;
    }
    publicOrigin() {
        return (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '') || undefined;
    }
    async decorateForm(organizationId, clientId, form) {
        const context = await this.service.formContext(organizationId, clientId);
        const publicOrigin = this.publicOrigin();
        return { ...form, ...context, publicUrl: publicOrigin ? `${publicOrigin}/book/${form.publicSlug}` : undefined };
    }
    client(req) {
        if (req.user.role !== user_role_enum_1.UserRole.CLIENT)
            return undefined;
        if (!req.user.clientId)
            throw new common_1.ForbiddenException('La cuenta cliente no está asociada a una empresa');
        return req.user.clientId;
    }
    async scope(req) {
        return {
            clientId: this.client(req),
            clientIds: await this.accountAccess.allowedClientIds(req.organizationId, req.user),
        };
    }
    async requestedScope(req, requestedClientId) {
        const scope = await this.scope(req);
        if (!requestedClientId)
            return scope;
        await this.accountAccess.assertClient(req.organizationId, req.user, requestedClientId);
        return { clientId: requestedClientId, clientIds: undefined };
    }
    async forms(req, query) {
        const scope = await this.requestedScope(req, query.clientId);
        const forms = await this.service.listForms(req.organizationId, scope.clientId, scope.clientIds);
        const publicOrigin = this.publicOrigin();
        return forms.map((form) => ({ ...form, publicUrl: publicOrigin ? `${publicOrigin}/book/${form.publicSlug}` : undefined }));
    }
    async create(req, dto) {
        await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
        const form = await this.service.createForm(req.organizationId, req.user.id, dto);
        return this.decorateForm(req.organizationId, form.clientId, form);
    }
    async form(req, id) {
        const scope = await this.scope(req);
        const form = await this.service.getForm(req.organizationId, id, scope.clientId, scope.clientIds);
        return this.decorateForm(req.organizationId, form.clientId, form);
    }
    async update(req, id, dto) {
        const scope = await this.scope(req);
        if (req.user.role === user_role_enum_1.UserRole.CLIENT) {
            const allowed = {
                timezone: dto.timezone,
                durationMinutes: dto.durationMinutes,
                bufferMinutes: dto.bufferMinutes,
                capacityPerSlot: dto.capacityPerSlot,
                dailyCapacity: dto.dailyCapacity,
                minimumNoticeHours: dto.minimumNoticeHours,
                maximumAdvanceDays: dto.maximumAdvanceDays,
                confirmationMode: dto.confirmationMode,
                scheduleConfig: dto.scheduleConfig,
                teamNotifications: dto.teamNotifications,
            };
            const form = await this.service.updateForm(req.organizationId, id, allowed, scope.clientId, scope.clientIds);
            return this.decorateForm(req.organizationId, form.clientId, form);
        }
        const form = await this.service.updateForm(req.organizationId, id, dto, scope.clientId, scope.clientIds);
        return this.decorateForm(req.organizationId, form.clientId, form);
    }
    async duplicate(req, id) {
        const scope = await this.scope(req);
        const form = await this.service.duplicateForm(req.organizationId, id, req.user.id, scope.clientIds);
        return this.decorateForm(req.organizationId, form.clientId, form);
    }
    async blocks(req, id) {
        const scope = await this.scope(req);
        return this.service.listBlocks(req.organizationId, id, scope.clientId, scope.clientIds);
    }
    async block(req, id, dto) {
        const scope = await this.scope(req);
        return this.service.addBlock(req.organizationId, id, req.user.id, dto, scope.clientId, scope.clientIds);
    }
    async batchBlock(req, id, dtos) {
        if (dtos.length > 365)
            throw new common_1.BadRequestException('No puedes crear mÃ¡s de 365 bloqueos por lote');
        const scope = await this.scope(req);
        const errors = [];
        const results = await Promise.all(dtos.map((dto) => this.service.addBlock(req.organizationId, id, req.user.id, dto, scope.clientId, scope.clientIds).catch((err) => { errors.push(err.message); return null; })));
        if (errors.length && results.filter(Boolean).length === 0)
            throw new common_1.BadRequestException(errors.join('; '));
        return { created: results.filter(Boolean).length, total: dtos.length, errors: errors.length ? errors : undefined };
    }
    async deleteBlock(req, id) {
        const scope = await this.scope(req);
        return this.service.removeBlock(req.organizationId, id, scope.clientId, scope.clientIds, req.user.id);
    }
    async createManual(req, dto) {
        const scope = await this.scope(req);
        return this.service.createManual(req.organizationId, req.user.id, dto, scope.clientId, scope.clientIds);
    }
    async importReservations(req, dto) {
        const scope = await this.scope(req);
        if (dto.dryRun)
            return this.bulkImport.parse(dto.csvContent, dto.formId);
        return this.bulkImport.import(req.organizationId, req.user.id, dto.csvContent, dto.formId, {
            skipAvailability: dto.skipAvailability,
            clientId: scope.clientId,
            clientIds: scope.clientIds,
        });
    }
    async list(req, query) {
        const scope = await this.requestedScope(req, query.clientId);
        return this.service.listReservations(req.organizationId, query, scope.clientId, scope.clientIds, req.user.role !== user_role_enum_1.UserRole.CLIENT);
    }
    async updateReservation(req, id, dto) {
        const scope = await this.scope(req);
        if (req.user.role === user_role_enum_1.UserRole.CLIENT && (dto.internalNotes !== undefined || dto.startsAt !== undefined || (dto.status && dto.status !== 'cancelled_client'))) {
            throw new common_1.ForbiddenException('El portal cliente solo permite cancelar una reserva');
        }
        return this.service.updateReservation(req.organizationId, id, dto, req.user.id, req.user.role === user_role_enum_1.UserRole.CLIENT ? 'client' : 'team', scope.clientId, scope.clientIds);
    }
    async history(req, id) {
        const scope = await this.scope(req);
        return this.service.history(req.organizationId, id, scope.clientId, scope.clientIds);
    }
    async listCoupons(req) {
        const scope = await this.scope(req);
        return this.service.listCoupons(req.organizationId, scope.clientId, scope.clientIds);
    }
    async createCoupon(req, dto) {
        return this.service.createCoupon(req.organizationId, req.user.id, dto, this.client(req));
    }
    async updateCoupon(req, id, dto) {
        const scope = await this.scope(req);
        return this.service.updateCoupon(req.organizationId, id, dto, scope.clientIds);
    }
    async exportCsv(req, query, res) {
        const scope = await this.requestedScope(req, query.clientId);
        void this.audit.log({
            organizationId: req.organizationId, actorId: req.user.id, entityType: 'reservations',
            action: 'export_csv', reason: `clientId=${scope.clientId ?? 'all'} from=${query.from ?? ''} to=${query.to ?? ''}`,
            ipAddress: req.ip,
        }).catch(() => { });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="reservas-${new Date().toISOString().slice(0, 10)}.csv"`);
        res.write('\uFEFF');
        for await (const chunk of this.service.streamCsv(req.organizationId, scope.clientId, scope.clientIds, query.from, query.to, query.limit)) {
            if (!res.write(chunk))
                await (0, node_events_1.once)(res, 'drain');
        }
        res.end();
    }
    async exportForm(req, formId, body, res) {
        const scope = await this.scope(req);
        const result = await this.service.exportFormReservations(req.organizationId, formId, scope.clientId, scope.clientIds, body.format, body.dateFrom, body.dateTo, body.fields);
        if (body.format === 'json') {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="reservas-${new Date().toISOString().slice(0, 10)}.json"`);
            res.send(JSON.stringify(result, null, 2));
        }
        else if (body.format === 'csv') {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="reservas-${new Date().toISOString().slice(0, 10)}.csv"`);
            res.send(`\uFEFF${result}`);
        }
    }
    async operationalHome(req, query) {
        const scope = await this.requestedScope(req, query.clientId);
        return this.service.operationalHome(req.organizationId, scope.clientId, scope.clientIds);
    }
    async metrics(req, query) {
        const scope = await this.requestedScope(req, query.clientId);
        return this.service.metrics(req.organizationId, scope.clientId, scope.clientIds, query.days ? String(query.days) : '30');
    }
    async occupancy(req, query) {
        const scope = await this.requestedScope(req, query.clientId);
        return this.service.occupancyCalendar(req.organizationId, query.month, scope.clientId, scope.clientIds);
    }
};
exports.ReservationsController = ReservationsController;
__decorate([
    (0, common_1.Get)('forms'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.ReservationScopeDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "forms", null);
__decorate([
    (0, common_1.Post)('forms'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.CreateReservationFormDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('forms/:id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "form", null);
__decorate([
    (0, common_1.Patch)('forms/:id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reservation_dto_1.UpdateReservationFormDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "update", null);
__decorate([
    (0, common_1.Post)('forms/:id/duplicate'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "duplicate", null);
__decorate([
    (0, common_1.Get)('forms/:id/blocks'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "blocks", null);
__decorate([
    (0, common_1.Post)('forms/:id/blocks'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reservation_dto_1.CreateBlockDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "block", null);
__decorate([
    (0, common_1.Post)('forms/:id/blocks/batch'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)(new common_1.ParseArrayPipe({ items: reservation_dto_1.CreateBlockDto, whitelist: true, forbidNonWhitelisted: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Array]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "batchBlock", null);
__decorate([
    (0, common_1.Delete)('blocks/:id'),
    (0, requires_permission_decorator_1.RequiresPermission)('reservations', 'edit'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "deleteBlock", null);
__decorate([
    (0, common_1.Post)('manual'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.CreateManualReservationDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "createManual", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60000 } }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.ImportReservationsDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "importReservations", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.ListReservationsDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "list", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reservation_dto_1.UpdateReservationDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "updateReservation", null);
__decorate([
    (0, common_1.Get)(':id/history'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "history", null);
__decorate([
    (0, common_1.Get)('coupons'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "listCoupons", null);
__decorate([
    (0, common_1.Post)('coupons'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.CreateCouponDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "createCoupon", null);
__decorate([
    (0, common_1.Patch)('coupons/:id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reservation_dto_1.UpdateCouponDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "updateCoupon", null);
__decorate([
    (0, common_1.Get)('export/csv'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.ReservationScopeDto, Object]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "exportCsv", null);
__decorate([
    (0, common_1.Post)('forms/:formId/export'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('formId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reservation_dto_1.ExportFormReservationsDto, Object]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "exportForm", null);
__decorate([
    (0, common_1.Get)('analytics/operational-home'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.ReservationScopeDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "operationalHome", null);
__decorate([
    (0, common_1.Get)('analytics/metrics'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.ReservationScopeDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "metrics", null);
__decorate([
    (0, common_1.Get)('analytics/occupancy'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, reservation_dto_1.OccupancyQueryDto]),
    __metadata("design:returntype", Promise)
], ReservationsController.prototype, "occupancy", null);
exports.ReservationsController = ReservationsController = __decorate([
    (0, swagger_1.ApiTags)('Reservas'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Controller)('reservations'),
    (0, module_scope_decorator_1.ModuleScope)('reservations'),
    __metadata("design:paramtypes", [reservations_service_1.ReservationsService,
        account_access_service_1.AccountAccessService,
        bulk_import_service_1.ReservationsBulkImportService,
        audit_service_1.AuditService])
], ReservationsController);
