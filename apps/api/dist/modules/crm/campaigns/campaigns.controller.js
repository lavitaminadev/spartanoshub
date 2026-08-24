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
exports.CampaignsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const passport_1 = require("@nestjs/passport");
const module_scope_decorator_1 = require("../../../core/authorization/module-scope.decorator");
const account_access_service_1 = require("../../../core/client-scope/account-access.service");
const campaigns_service_1 = require("./campaigns.service");
const save_campaign_dto_1 = require("./dto/save-campaign.dto");
let CampaignsController = class CampaignsController {
    constructor(campaigns, accountAccess) {
        this.campaigns = campaigns;
        this.accountAccess = accountAccess;
    }
    async list(req, clientId) {
        const scope = await this.resolveScope(req, clientId);
        return this.campaigns.list(req.organizationId, scope);
    }
    async create(dto, req) {
        const scope = await this.resolveScope(req, dto.clientId ?? undefined);
        const { campaign, token } = await this.campaigns.create(req.organizationId, { ...dto, clientId: scope ?? null }, req.user.id);
        return {
            campaign,
            integracion: {
                url: '/api/public/ingest/leads',
                method: 'POST',
                header: `Authorization: Bearer ${token}`,
                token,
            },
        };
    }
    async update(id, dto, req) {
        const current = await this.campaigns.findOne(id, req.organizationId);
        await this.resolveScope(req, current.clientId ?? undefined);
        const destination = dto.clientId === undefined
            ? current.clientId ?? undefined
            : await this.resolveScope(req, dto.clientId ?? undefined);
        return this.campaigns.update(id, req.organizationId, { ...dto, clientId: destination ?? null });
    }
    async remove(id, req) {
        const current = await this.campaigns.findOne(id, req.organizationId);
        await this.resolveScope(req, current.clientId ?? undefined);
        await this.campaigns.remove(id, req.organizationId);
        return { success: true };
    }
    async resolveScope(req, requested) {
        if (req.user.clientId) {
            await this.accountAccess.assertClient(req.organizationId, req.user, req.user.clientId);
            return req.user.clientId;
        }
        const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        if (!requested && allowed !== undefined) {
            throw new common_1.NotFoundException('Client not found');
        }
        await this.accountAccess.assertClient(req.organizationId, req.user, requested);
        return requested;
    }
};
exports.CampaignsController = CampaignsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Campañas con su inversión y costo por lead' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CampaignsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Registrar una campaña y emitir su llave de entrada' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_campaign_dto_1.SaveCampaignDto, Object]),
    __metadata("design:returntype", Promise)
], CampaignsController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Actualizar una campaña' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, save_campaign_dto_1.SaveCampaignDto, Object]),
    __metadata("design:returntype", Promise)
], CampaignsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Eliminar una campaña' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CampaignsController.prototype, "remove", null);
exports.CampaignsController = CampaignsController = __decorate([
    (0, swagger_1.ApiTags)('CRM - Campañas'),
    (0, common_1.Controller)('crm/campaigns'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleScope)('crm'),
    __metadata("design:paramtypes", [campaigns_service_1.CampaignsService,
        account_access_service_1.AccountAccessService])
], CampaignsController);
