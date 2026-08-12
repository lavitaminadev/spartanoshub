"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const integration_entity_1 = require("./integration.entity");
const integration_account_entity_1 = require("./integration-account.entity");
const integrations_controller_1 = require("./integrations.controller");
const create_integration_use_case_1 = require("./create-integration.use-case");
const list_integrations_use_case_1 = require("./list-integrations.use-case");
const update_integration_use_case_1 = require("./update-integration.use-case");
const integration_metric_entity_1 = require("./integration-metric.entity");
const client_entity_1 = require("../clients/client.entity");
const integration_accounts_service_1 = require("./integration-accounts.service");
let IntegrationsModule = class IntegrationsModule {
};
exports.IntegrationsModule = IntegrationsModule;
exports.IntegrationsModule = IntegrationsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([integration_entity_1.Integration, integration_account_entity_1.IntegrationAccount, integration_metric_entity_1.IntegrationMetric, client_entity_1.Client])],
        controllers: [integrations_controller_1.IntegrationsController],
        providers: [create_integration_use_case_1.CreateIntegrationUseCase, list_integrations_use_case_1.ListIntegrationsUseCase, update_integration_use_case_1.UpdateIntegrationUseCase, integration_accounts_service_1.IntegrationAccountsService],
        exports: [typeorm_1.TypeOrmModule, integration_accounts_service_1.IntegrationAccountsService],
    })
], IntegrationsModule);
//# sourceMappingURL=integrations.module.js.map