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
exports.AccountCyclesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const account_cycle_entity_1 = require("./account-cycle.entity");
let AccountCyclesService = class AccountCyclesService {
    constructor(cycles) {
        this.cycles = cycles;
    }
    async ensure(organizationId, clientId, year, month) {
        const existing = await this.cycles.findOne({ where: { organizationId, clientId, year, month } });
        if (existing)
            return existing;
        const startedAt = new Date(year, month - 1, 1);
        const endsAt = new Date(year, month, 0);
        return this.cycles.save(this.cycles.create({ organizationId, clientId, year, month, startedAt, endsAt }));
    }
    list(organizationId, year, month, clientIds) {
        const where = {
            organizationId,
            ...(year ? { year } : {}),
            ...(month ? { month } : {}),
            ...(clientIds !== undefined ? { clientId: (0, typeorm_2.In)(clientIds) } : {}),
        };
        return this.cycles.find({
            where,
            order: { year: 'DESC', month: 'DESC', createdAt: 'DESC' },
            relations: { client: true },
        });
    }
    async update(id, organizationId, patch, clientIds) {
        if (clientIds?.length === 0)
            throw new common_1.NotFoundException('Account cycle not found');
        const cycle = await this.cycles.findOne({
            where: { id, organizationId, ...(clientIds !== undefined ? { clientId: (0, typeorm_2.In)(clientIds) } : {}) },
        });
        if (!cycle)
            throw new common_1.NotFoundException('Account cycle not found');
        const allowed = ['status', 'gridStatus', 'productionStatus', 'weeklyMeetingsCompleted', 'strategyMeetingStatus', 'reportStatus'];
        for (const key of allowed)
            if (patch[key] !== undefined)
                cycle[key] = patch[key];
        if (cycle.status === 'closed' && !cycle.closedAt)
            cycle.closedAt = new Date();
        return this.cycles.save(cycle);
    }
};
exports.AccountCyclesService = AccountCyclesService;
exports.AccountCyclesService = AccountCyclesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(account_cycle_entity_1.AccountCycle)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], AccountCyclesService);
