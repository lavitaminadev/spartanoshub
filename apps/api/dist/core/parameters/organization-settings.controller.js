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
exports.OrganizationSettingsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../authorization/roles.decorator");
const throttler_1 = require("@nestjs/throttler");
const account_access_service_1 = require("../client-scope/account-access.service");
const email_service_1 = require("../notifications/email.service");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../../modules/users/user.entity");
const plantilla_de_correo_1 = require("../notifications/plantilla-de-correo");
const muestra_de_correo_1 = require("./muestra-de-correo");
const user_role_enum_1 = require("../../modules/organizations/user-role.enum");
const update_organization_settings_dto_1 = require("./dto/update-organization-settings.dto");
const organization_settings_service_1 = require("./organization-settings.service");
const module_scope_decorator_1 = require("../authorization/module-scope.decorator");
const organization_features_1 = require("../../modules/organizations/organization-features");
const shared_1 = require("@espartanos/shared");
let OrganizationSettingsController = class OrganizationSettingsController {
    constructor(settings, accountAccess, correo, usuarios) {
        this.settings = settings;
        this.accountAccess = accountAccess;
        this.correo = correo;
        this.usuarios = usuarios;
    }
    async list(request, clientId) {
        const organizationId = request.organizationId || request.user.organizationId;
        await this.accountAccess.assertClient(organizationId, request.user, clientId);
        return this.settings.list(organizationId, clientId ?? null);
    }
    async update(request, dto, clientId) {
        const valores = dto.values ?? {};
        const touchesModuleLifecycle = Object.keys(valores).some((key) => key.startsWith('modules.lifecycle.'));
        if (touchesModuleLifecycle && request.user.role !== user_role_enum_1.UserRole.DEV) {
            throw new common_1.ForbiddenException('Solo desarrollo puede cambiar el ciclo de vida de módulos.');
        }
        const sinSalida = organization_features_1.REQUIRED_LIFECYCLE_KEYS
            .filter((module) => {
            const valor = valores[(0, shared_1.moduleLifecycleSettingKey)(module)];
            return typeof valor === 'string' && !(0, shared_1.isModuleLifecycleVisible)(valor);
        });
        if (sinSalida.length) {
            throw new common_1.BadRequestException(`No se puede esconder ${sinSalida.join(' ni ')}: son la puerta de entrada y el sitio donde se deshace este cambio. ` +
                'Déjalos en activo, piloto o mantenimiento.');
        }
        const organizationId = request.organizationId || request.user.organizationId;
        await this.accountAccess.assertClient(organizationId, request.user, clientId);
        return this.settings.update(organizationId, request.user.id, dto.values, clientId ?? null);
    }
    async destinatariosDePrueba(request) {
        const organizationId = request.organizationId || request.user.organizationId;
        const equipo = await this.usuarios.find({
            where: { organizationId, isActive: true },
            select: { id: true, name: true, email: true },
            order: { name: 'ASC' },
        });
        return equipo.filter((persona) => persona.email?.trim());
    }
    async probar(request, dto) {
        const destino = await this.direccionDelDestinatario(request, dto?.destinatarioId);
        const { subject, html } = (0, plantilla_de_correo_1.componerCorreo)(String(dto?.asunto ?? 'Prueba'), String(dto?.cuerpo ?? ''), muestra_de_correo_1.MUESTRA);
        const enviado = await this.correo.send(destino, `[Prueba] ${subject}`, html);
        return {
            enviado,
            destino,
            motivo: enviado ? null : 'El envío de correo está apagado en el servidor (SMTP_ENABLED)',
        };
    }
    async direccionDelDestinatario(request, destinatarioId) {
        if (!destinatarioId) {
            const propio = request.user.email;
            if (!propio)
                throw new common_1.BadRequestException('Tu usuario no tiene correo, así que no hay dónde enviarlo');
            return propio;
        }
        const organizationId = request.organizationId || request.user.organizationId;
        const persona = await this.usuarios.findOne({
            where: { id: destinatarioId, organizationId, isActive: true },
            select: { id: true, email: true },
        });
        if (!persona)
            throw new common_1.BadRequestException('Esa persona no está en tu equipo');
        if (!persona.email?.trim())
            throw new common_1.BadRequestException('Esa persona no tiene correo registrado');
        return persona.email;
    }
};
exports.OrganizationSettingsController = OrganizationSettingsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener configuración efectiva, opcionalmente de una empresa' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OrganizationSettingsController.prototype, "list", null);
__decorate([
    (0, common_1.Put)(),
    (0, swagger_1.ApiOperation)({ summary: 'Actualizar y auditar configuración de la organización' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_organization_settings_dto_1.UpdateOrganizationSettingsDto, String]),
    __metadata("design:returntype", Promise)
], OrganizationSettingsController.prototype, "update", null);
__decorate([
    (0, common_1.Get)('destinatarios-de-prueba'),
    (0, swagger_1.ApiOperation)({ summary: 'Personas del equipo a las que se puede enviar una prueba' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrganizationSettingsController.prototype, "destinatariosDePrueba", null);
__decorate([
    (0, common_1.Post)('probar'),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60000 } }),
    (0, swagger_1.ApiOperation)({ summary: 'Enviar una plantilla de correo a alguien del equipo' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OrganizationSettingsController.prototype, "probar", null);
exports.OrganizationSettingsController = OrganizationSettingsController = __decorate([
    (0, swagger_1.ApiTags)('Configuración'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('settings'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.DEV),
    (0, module_scope_decorator_1.ModuleScope)('settings'),
    __param(3, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [organization_settings_service_1.OrganizationSettingsService,
        account_access_service_1.AccountAccessService,
        email_service_1.EmailService,
        typeorm_2.Repository])
], OrganizationSettingsController);
