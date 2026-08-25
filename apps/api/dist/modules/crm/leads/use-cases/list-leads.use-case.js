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
exports.ListLeadsUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const lead_entity_1 = require("../lead.entity");
const shared_1 = require("@espartanos/shared");
let ListLeadsUseCase = class ListLeadsUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(organizationId, limit = 20, offset = 0, filters = {}) {
        const where = { organizationId };
        if (filters.status)
            where.status = filters.status;
        if (filters.fitStatus)
            where.fitStatus = filters.fitStatus;
        if (filters.source)
            where.source = expandSourceFilter(filters.source);
        if (filters.campaignName)
            where.campaignName = filters.campaignName;
        if (filters.assignedTo)
            where.assignedTo = filters.assignedTo;
        const domain = filters.domain ?? 'commercial';
        if (domain !== 'all')
            where.domain = domain;
        const scope = this.resolveClientScope(filters);
        if (scope === EMPTY_SCOPE)
            return { data: [], total: 0, limit, offset };
        if (scope !== undefined)
            where.clientId = scope;
        const alcancePersona = filters.onlyAssignedTo
            ? [
                { ...where, assignedTo: filters.onlyAssignedTo },
                { ...where, assignedTo: (0, typeorm_2.IsNull)() },
            ]
            : [where];
        const termino = filters.search?.trim();
        const campos = [
            'name', 'email', 'phone', 'company', 'source', 'sourceDetail', 'campaignName',
        ];
        const criterio = termino
            ? alcancePersona.flatMap((base) => campos.map((campo) => ({ ...base, [campo]: (0, typeorm_2.Like)(`%${termino}%`) })))
            : alcancePersona.length === 1 ? alcancePersona[0] : alcancePersona;
        const [data, total] = await this.repo.findAndCount({
            where: criterio,
            order: { createdAt: 'DESC' },
            skip: offset,
            take: limit,
        });
        return { data, total, limit, offset };
    }
    resolveClientScope(filters) {
        const { clientId, allowedClientIds, agencyOnly } = filters;
        if (agencyOnly)
            return allowedClientIds === undefined ? (0, typeorm_2.IsNull)() : EMPTY_SCOPE;
        if (allowedClientIds === undefined)
            return clientId;
        if (allowedClientIds.length === 0)
            return EMPTY_SCOPE;
        if (clientId)
            return allowedClientIds.includes(clientId) ? clientId : EMPTY_SCOPE;
        return (0, typeorm_2.In)(allowedClientIds);
    }
};
exports.ListLeadsUseCase = ListLeadsUseCase;
exports.ListLeadsUseCase = ListLeadsUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ListLeadsUseCase);
const EMPTY_SCOPE = Symbol('empty-client-scope');
function expandSourceFilter(source) {
    return (0, shared_1.isReservationLeadSource)(source) ? (0, typeorm_2.In)([...shared_1.RESERVATION_LEAD_SOURCES]) : source;
}
