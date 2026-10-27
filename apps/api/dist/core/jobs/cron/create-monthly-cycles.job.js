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
var CreateMonthlyCyclesJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateMonthlyCyclesJob = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const client_entity_1 = require("../../../modules/clients/client.entity");
const client_status_enum_1 = require("../../../modules/clients/client-status.enum");
const design_budget_service_1 = require("../../../modules/design-budget/design-budget.service");
const account_cycles_service_1 = require("../../../modules/account-cycles/account-cycles.service");
let CreateMonthlyCyclesJob = CreateMonthlyCyclesJob_1 = class CreateMonthlyCyclesJob {
    constructor(clientRepo, budgets, cycles) {
        this.clientRepo = clientRepo;
        this.budgets = budgets;
        this.cycles = cycles;
        this.logger = new common_1.Logger(CreateMonthlyCyclesJob_1.name);
    }
    async handle() {
        this.logger.log('Creating monthly account cycles...');
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const activeClients = await this.clientRepo.find({
            where: { status: client_status_enum_1.ClientStatus.ACTIVE },
        });
        let created = 0;
        for (const client of activeClients) {
            try {
                await this.cycles.ensure(client.organizationId, client.id, year, month);
                const before = await this.budgets.findMonthlyBudget(client.id, year, month);
                if (before)
                    continue;
                await this.budgets.ensureMonthlyBudget(client.id, year, month);
                created++;
            }
            catch (error) {
                this.logger.error(`Failed to create monthly cycle for client ${client.id}: ${error instanceof Error ? error.message : error}`);
            }
        }
        this.logger.log(`Created ${created} UD budgets for ${year}-${month}`);
    }
};
exports.CreateMonthlyCyclesJob = CreateMonthlyCyclesJob;
exports.CreateMonthlyCyclesJob = CreateMonthlyCyclesJob = CreateMonthlyCyclesJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        design_budget_service_1.DesignBudgetService,
        account_cycles_service_1.AccountCyclesService])
], CreateMonthlyCyclesJob);
