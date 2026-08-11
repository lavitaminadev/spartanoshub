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
exports.ListOpportunitiesUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const opportunity_entity_1 = require("../opportunity.entity");
let ListOpportunitiesUseCase = class ListOpportunitiesUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(organizationId, limit = 20, offset = 0, leadId, allowedClientIds) {
        const base = { organizationId };
        if (leadId)
            base.leadId = leadId;
        const where = allowedClientIds === undefined
            ? base
            : [
                { ...base, clientId: (0, typeorm_2.IsNull)() },
                ...(allowedClientIds.length ? [{ ...base, clientId: (0, typeorm_2.In)(allowedClientIds) }] : []),
            ];
        const [data, total] = await this.repo.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            take: limit,
            skip: offset,
        });
        return { data, total, limit, offset };
    }
};
exports.ListOpportunitiesUseCase = ListOpportunitiesUseCase;
exports.ListOpportunitiesUseCase = ListOpportunitiesUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(opportunity_entity_1.Opportunity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ListOpportunitiesUseCase);
//# sourceMappingURL=list-opportunities.use-case.js.map