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
exports.CloudinaryController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const passport_1 = require("@nestjs/passport");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const cloudinary_config_dto_1 = require("./dto/cloudinary-config.dto");
const cloudinary_service_1 = require("./cloudinary.service");
const integration_entity_1 = require("../../modules/integrations/integration.entity");
const integration_provider_enum_1 = require("../../modules/integrations/integration-provider.enum");
const integration_status_enum_1 = require("../../modules/integrations/integration-status.enum");
const integration_secrets_1 = require("../../shared/security/integration-secrets");
const roles_decorator_1 = require("../authorization/roles.decorator");
const user_role_enum_1 = require("../../modules/organizations/user-role.enum");
const module_scope_decorator_1 = require("../authorization/module-scope.decorator");
let CloudinaryController = class CloudinaryController {
    constructor(integrations, cloudinary) {
        this.integrations = integrations;
        this.cloudinary = cloudinary;
    }
    async getConfig(req) {
        const integration = await this.integrations.findOne({
            where: { organizationId: req.organizationId, provider: integration_provider_enum_1.IntegrationProvider.CLOUDINARY },
        });
        const cloudName = integration?.config?.cloudName || process.env.CLOUDINARY_CLOUD_NAME || '';
        const apiKey = integration?.config?.apiKey || process.env.CLOUDINARY_API_KEY || '';
        const hasEnvironmentConfig = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
        const connected = await this.cloudinary.isEnabled(req.organizationId);
        return {
            connected,
            cloudName,
            apiKey: apiKey ? `${apiKey.slice(0, 4)}${'*'.repeat(Math.max(apiKey.length - 4, 4))}` : '',
            hasApiKey: Boolean(apiKey),
            hasApiSecret: connected,
            source: integration ? 'integration' : hasEnvironmentConfig ? 'environment' : 'none',
        };
    }
    async saveConfig(req, dto) {
        const current = await this.cloudinary.getCredentials(req.organizationId);
        const cloudName = dto.cloudName?.trim() || current?.cloudName || '';
        const apiKey = dto.apiKey?.trim() || current?.apiKey || '';
        const apiSecret = dto.apiSecret?.trim() || current?.apiSecret || '';
        if (!cloudName || !apiKey || !apiSecret) {
            throw new common_1.BadRequestException('Cloud name, API key y API secret son obligatorios');
        }
        await this.cloudinary.validateCredentials({ cloudName, apiKey, apiSecret });
        const existing = await this.integrations.findOne({
            where: { organizationId: req.organizationId, provider: integration_provider_enum_1.IntegrationProvider.CLOUDINARY },
        });
        const config = {
            cloudName,
            apiKey,
            apiSecret: (0, integration_secrets_1.protectSecret)(apiSecret),
        };
        if (existing) {
            existing.config = config;
            existing.status = integration_status_enum_1.IntegrationStatus.ACTIVE;
            await this.integrations.save(existing);
        }
        else {
            await this.integrations.save(this.integrations.create({
                organizationId: req.organizationId,
                provider: integration_provider_enum_1.IntegrationProvider.CLOUDINARY,
                name: 'Cloudinary',
                status: integration_status_enum_1.IntegrationStatus.ACTIVE,
                config,
            }));
        }
        return { connected: true, cloudName: config.cloudName, apiKey: `${config.apiKey.slice(0, 4)}****`, source: 'integration' };
    }
    async deleteConfig(req) {
        const integration = await this.integrations.findOne({
            where: { organizationId: req.organizationId, provider: integration_provider_enum_1.IntegrationProvider.CLOUDINARY },
        });
        if (integration) {
            await this.integrations.remove(integration);
        }
        return { connected: false };
    }
    async listResources(req, next, limit, clientId) {
        return this.cloudinary.listResources(req.organizationId, {
            maxResults: limit ? Math.min(Number(limit) || 30, 100) : 30,
            nextCursor: next,
            clientId,
        });
    }
};
exports.CloudinaryController = CloudinaryController;
__decorate([
    (0, common_1.Get)('config'),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener configuración de Cloudinary' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CloudinaryController.prototype, "getConfig", null);
__decorate([
    (0, common_1.Put)('config'),
    (0, swagger_1.ApiOperation)({ summary: 'Guardar configuración de Cloudinary' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, cloudinary_config_dto_1.CloudinaryConfigDto]),
    __metadata("design:returntype", Promise)
], CloudinaryController.prototype, "saveConfig", null);
__decorate([
    (0, common_1.Delete)('config'),
    (0, swagger_1.ApiOperation)({ summary: 'Eliminar configuración de Cloudinary' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CloudinaryController.prototype, "deleteConfig", null);
__decorate([
    (0, common_1.Get)('resources'),
    (0, swagger_1.ApiOperation)({ summary: 'Listar recursos de Cloudinary' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('next')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], CloudinaryController.prototype, "listResources", null);
exports.CloudinaryController = CloudinaryController = __decorate([
    (0, swagger_1.ApiTags)('Cloudinary'),
    (0, common_1.Controller)('cloudinary'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, module_scope_decorator_1.ModuleExempt)('Firma de subida transversal, sin datos de negocio propios'),
    __param(0, (0, typeorm_1.InjectRepository)(integration_entity_1.Integration)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        cloudinary_service_1.CloudinaryService])
], CloudinaryController);
//# sourceMappingURL=cloudinary.controller.js.map