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
exports.IntegrationAccountsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const client_entity_1 = require("../clients/client.entity");
const integration_account_entity_1 = require("./integration-account.entity");
const integration_response_1 = require("./integration-response");
let IntegrationAccountsService = class IntegrationAccountsService {
    constructor(accounts, clients) {
        this.accounts = accounts;
        this.clients = clients;
    }
    async assignClient(accountId, clientId, organizationId) {
        const account = await this.accounts.findOne({ where: { id: accountId }, relations: { integration: true } });
        if (!account || account.integration.organizationId !== organizationId)
            throw new common_1.NotFoundException('Account not found');
        if (!clientId) {
            const { clientId: _removed, ...metadata } = account.metadata ?? {};
            account.metadata = { ...metadata, selected: false };
            return (0, integration_response_1.toIntegrationAccountResponse)(await this.accounts.save(account));
        }
        const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
        if (!client)
            throw new common_1.NotFoundException('Client not found');
        account.metadata = { ...account.metadata, clientId: client.id, selected: true };
        return (0, integration_response_1.toIntegrationAccountResponse)(await this.accounts.save(account));
    }
};
exports.IntegrationAccountsService = IntegrationAccountsService;
exports.IntegrationAccountsService = IntegrationAccountsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(integration_account_entity_1.IntegrationAccount)),
    __param(1, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], IntegrationAccountsService);
//# sourceMappingURL=integration-accounts.service.js.map