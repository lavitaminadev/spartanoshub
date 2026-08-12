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
exports.MetaIntegrationAccessor = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const integration_entity_1 = require("../integration.entity");
const integration_provider_enum_1 = require("../integration-provider.enum");
const integration_secrets_1 = require("../../../shared/security/integration-secrets");
let MetaIntegrationAccessor = class MetaIntegrationAccessor {
    constructor(integrations) {
        this.integrations = integrations;
    }
    async requireIntegration(id, organizationId) {
        const integration = await this.integrations.findOne({
            where: { id, organizationId, provider: integration_provider_enum_1.IntegrationProvider.META },
        });
        if (!integration)
            throw new common_1.BadRequestException('Meta integration not found');
        return integration;
    }
    getAccessToken(integration) {
        const stored = typeof integration.config?.accessToken === 'string' ? integration.config.accessToken : '';
        const accessToken = (0, integration_secrets_1.revealSecret)(stored) ?? '';
        if (!accessToken)
            throw new common_1.BadRequestException('Meta access token is missing');
        return accessToken;
    }
};
exports.MetaIntegrationAccessor = MetaIntegrationAccessor;
exports.MetaIntegrationAccessor = MetaIntegrationAccessor = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(integration_entity_1.Integration)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], MetaIntegrationAccessor);
//# sourceMappingURL=meta-integration-accessor.service.js.map