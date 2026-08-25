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
exports.InteractionsController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const interactions_service_1 = require("./interactions.service");
const create_interaction_dto_1 = require("./dto/create-interaction.dto");
const update_interaction_dto_1 = require("./dto/update-interaction.dto");
const list_interactions_dto_1 = require("./dto/list-interactions.dto");
const module_scope_decorator_1 = require("../../../core/authorization/module-scope.decorator");
const account_access_service_1 = require("../../../core/client-scope/account-access.service");
const client_capability_service_1 = require("../../../core/client-scope/client-capability.service");
let InteractionsController = class InteractionsController {
    constructor(service, accountAccess, capabilities) {
        this.service = service;
        this.accountAccess = accountAccess;
        this.capabilities = capabilities;
    }
    async create(dto, req) {
        await this.assertClientScope(req, await this.service.referenceClientId(dto, req.organizationId));
        return this.service.create(dto, req.organizationId, req.user.id);
    }
    async findAll(query, req) {
        const clientId = req.user.role === 'client' ? req.user.clientId : query.clientId;
        await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
        await this.capabilities.assert(req.organizationId, clientId, 'crm');
        if (query.leadId) {
            await this.assertClientScope(req, await this.service.referenceClientId({ leadId: query.leadId }, req.organizationId));
        }
        const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        return this.service.findAll(req.organizationId, query.limit, query.offset, query.leadId, allowed, clientId);
    }
    async findOne(id, req) {
        const interaction = await this.service.findOne(id, req.organizationId);
        await this.assertClientScope(req, await this.service.effectiveClientId(interaction, {}, req.organizationId));
        return interaction;
    }
    async update(id, dto, req) {
        const interaction = await this.service.findOne(id, req.organizationId);
        await this.assertClientScope(req, await this.service.effectiveClientId(interaction, {}, req.organizationId));
        await this.assertClientScope(req, await this.service.effectiveClientId(interaction, dto, req.organizationId));
        return this.service.update(id, dto, req.organizationId);
    }
    async remove(id, req) {
        const interaction = await this.service.findOne(id, req.organizationId);
        await this.assertClientScope(req, await this.service.effectiveClientId(interaction, {}, req.organizationId));
        return this.service.remove(id, req.organizationId);
    }
    async assertClientScope(req, clientId) {
        const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        if (!clientId && allowed !== undefined)
            throw new common_1.NotFoundException('Interaction not found');
        await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
        await this.capabilities.assert(req.organizationId, clientId, 'crm');
    }
};
exports.InteractionsController = InteractionsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_interaction_dto_1.CreateInteractionDto, Object]),
    __metadata("design:returntype", Promise)
], InteractionsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_interactions_dto_1.ListInteractionsDto, Object]),
    __metadata("design:returntype", Promise)
], InteractionsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], InteractionsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_interaction_dto_1.UpdateInteractionDto, Object]),
    __metadata("design:returntype", Promise)
], InteractionsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], InteractionsController.prototype, "remove", null);
exports.InteractionsController = InteractionsController = __decorate([
    (0, common_1.Controller)('crm/interactions'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, module_scope_decorator_1.ModuleScope)('crm'),
    __metadata("design:paramtypes", [interactions_service_1.InteractionsService,
        account_access_service_1.AccountAccessService,
        client_capability_service_1.ClientCapabilityService])
], InteractionsController);
