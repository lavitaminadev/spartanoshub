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
exports.NotificationsController = void 0;
const common_1 = require("@nestjs/common");
const account_access_service_1 = require("../client-scope/account-access.service");
const client_capability_service_1 = require("../client-scope/client-capability.service");
const notificaciones_visibles_1 = require("./notificaciones-visibles");
const swagger_1 = require("@nestjs/swagger");
const notification_service_1 = require("./notification.service");
const roles_decorator_1 = require("../authorization/roles.decorator");
const user_role_enum_1 = require("../../modules/organizations/user-role.enum");
const module_scope_decorator_1 = require("../authorization/module-scope.decorator");
let NotificationsController = class NotificationsController {
    constructor(service, accesos, servicios) {
        this.service = service;
        this.accesos = accesos;
        this.servicios = servicios;
    }
    canReadSystemNotifications(req) {
        return req.user.role === user_role_enum_1.UserRole.ADMIN;
    }
    async findAll(req) {
        const organizationId = req.organizationId || req.user.organizationId;
        const avisos = await this.service.findByUser(organizationId, req.user.id, this.canReadSystemNotifications(req));
        return (0, notificaciones_visibles_1.avisosVisibles)(avisos, organizationId, req.user, this.accesos, this.servicios);
    }
    async unreadCount(req) {
        const organizationId = req.organizationId || req.user.organizationId;
        const noLeidas = await this.service.unreadByUser(organizationId, req.user.id, this.canReadSystemNotifications(req));
        return { unread: (await (0, notificaciones_visibles_1.avisosVisibles)(noLeidas, organizationId, req.user, this.accesos, this.servicios)).length };
    }
    markAllAsRead(req) {
        return this.service.markAllAsRead(req.organizationId || req.user.organizationId, req.user.id, this.canReadSystemNotifications(req));
    }
    async markAsRead(id, req) {
        const notif = await this.service.markAsRead(req.organizationId || req.user.organizationId, id, req.user.id, this.canReadSystemNotifications(req));
        if (!notif)
            throw new common_1.NotFoundException('Notification not found');
        return notif;
    }
    removeRead(req) {
        return this.service.removeRead(req.organizationId || req.user.organizationId, req.user.id);
    }
    async remove(id, req) {
        const borrada = await this.service.remove(req.organizationId || req.user.organizationId, id, req.user.id);
        if (!borrada)
            throw new common_1.NotFoundException('Notification not found');
        return { deleted: true };
    }
};
exports.NotificationsController = NotificationsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar notificaciones del usuario' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('unread-count'),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener cantidad de notificaciones no leídas' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "unreadCount", null);
__decorate([
    (0, common_1.Put)('read-all'),
    (0, swagger_1.ApiOperation)({ summary: 'Marcar todas las notificaciones como leidas' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "markAllAsRead", null);
__decorate([
    (0, common_1.Put)(':id/read'),
    (0, swagger_1.ApiOperation)({ summary: 'Marcar notificación como leída' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "markAsRead", null);
__decorate([
    (0, common_1.Delete)('read'),
    (0, swagger_1.ApiOperation)({ summary: 'Borrar las notificaciones ya leidas' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "removeRead", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Borrar una notificacion' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "remove", null);
exports.NotificationsController = NotificationsController = __decorate([
    (0, swagger_1.ApiTags)('Notificaciones'),
    (0, common_1.Controller)('notifications'),
    (0, roles_decorator_1.Roles)(...Object.values(user_role_enum_1.UserRole)),
    (0, module_scope_decorator_1.ModuleExempt)('Autoservicio: cada persona ve y marca sus propios avisos'),
    __param(1, (0, common_1.Optional)()),
    __param(2, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [notification_service_1.NotificationService,
        account_access_service_1.AccountAccessService,
        client_capability_service_1.ClientCapabilityService])
], NotificationsController);
