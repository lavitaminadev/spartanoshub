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
exports.CreateInvoiceUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const invoice_entity_1 = require("../invoice.entity");
const account_access_service_1 = require("../../../core/client-scope/account-access.service");
let CreateInvoiceUseCase = class CreateInvoiceUseCase {
    constructor(repo, accountAccess) {
        this.repo = repo;
        this.accountAccess = accountAccess;
    }
    async execute(dto, organizationId, user) {
        await this.accountAccess.assertClient(organizationId, user, dto.clientId);
        return this.repo.save(this.repo.create({ ...dto, organizationId }));
    }
};
exports.CreateInvoiceUseCase = CreateInvoiceUseCase;
exports.CreateInvoiceUseCase = CreateInvoiceUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(invoice_entity_1.Invoice)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        account_access_service_1.AccountAccessService])
], CreateInvoiceUseCase);
//# sourceMappingURL=create-invoice.use-case.js.map