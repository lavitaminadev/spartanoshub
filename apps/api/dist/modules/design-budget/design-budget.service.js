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
exports.DesignBudgetService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ud_budget_entity_1 = require("./ud-budget.entity");
const ud_movement_entity_1 = require("./ud-movement.entity");
const ud_movement_type_enum_1 = require("./ud-movement-type.enum");
const piece_entity_1 = require("../production/piece.entity");
const client_entity_1 = require("../clients/client.entity");
const parameter_resolver_service_1 = require("../../core/parameters/parameter-resolver.service");
const ud_calculator_1 = require("./ud-calculator");
let DesignBudgetService = class DesignBudgetService {
    constructor(budgetRepo, movementRepo, clientRepo, parameterResolver) {
        this.budgetRepo = budgetRepo;
        this.movementRepo = movementRepo;
        this.clientRepo = clientRepo;
        this.parameterResolver = parameterResolver;
    }
    async ensureMonthlyBudget(clientId, year, month, manager) {
        const repo = manager?.getRepository(ud_budget_entity_1.UDBudget) ?? this.budgetRepo;
        const existing = await repo.findOne({ where: { clientId, year, month } });
        if (existing)
            return existing;
        const contracted = await this.resolveMonthlyBudget(clientId);
        const budget = repo.create({
            clientId, year, month,
            contracted,
            reserved: 0,
            consumed: 0,
            status: 'open',
        });
        return repo.save(budget);
    }
    calculateForPiece(pieceType, carouselSlides = 0) {
        return (0, ud_calculator_1.calculatePieceUd)(pieceType, carouselSlides);
    }
    async reserveForPiece(piece, actorId, transactionManager) {
        const execute = async (manager) => {
            await manager.findOne(piece_entity_1.Piece, { where: { id: piece.id }, lock: { mode: 'pessimistic_write' } });
            await manager.findOne(client_entity_1.Client, { where: { id: piece.clientId }, lock: { mode: 'pessimistic_write' } });
            const movementRepo = manager.getRepository(ud_movement_entity_1.UDMovement);
            const existingMovement = await movementRepo.findOne({
                where: { pieceId: piece.id, type: ud_movement_type_enum_1.UDMovementType.RESERVATION },
            });
            if (existingMovement)
                return existingMovement;
            const date = piece.createdAt;
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const ensuredBudget = await this.ensureMonthlyBudget(piece.clientId, year, month, manager);
            const budget = await manager.findOneOrFail(ud_budget_entity_1.UDBudget, {
                where: { id: ensuredBudget.id },
                lock: { mode: 'pessimistic_write' },
            });
            const amount = piece.udAmount;
            const used = Number(budget.reserved) + Number(budget.consumed);
            const available = Number(budget.contracted) - used;
            if (amount > available) {
                const limitAction = await this.parameterResolver.get('ud.limit_action', piece.clientId, null, piece.organizationId);
                if ((limitAction ?? 'block') === 'block') {
                    throw new common_1.BadRequestException(`UD insuficientes. Disponibles: ${available}, requeridas: ${amount}`);
                }
            }
            budget.reserved = Number(budget.reserved) + amount;
            await manager.save(ud_budget_entity_1.UDBudget, budget);
            const movement = manager.create(ud_movement_entity_1.UDMovement, {
                udBudgetId: budget.id,
                pieceId: piece.id,
                type: ud_movement_type_enum_1.UDMovementType.RESERVATION,
                amount,
                reason: `Reserva por asignación de pieza ${piece.title}`,
                actorId,
            });
            return manager.save(ud_movement_entity_1.UDMovement, movement);
        };
        return transactionManager ? execute(transactionManager) : this.budgetRepo.manager.transaction(execute);
    }
    async confirmConsumption(piece, actorId, transactionManager) {
        const execute = async (manager) => {
            await manager.findOne(piece_entity_1.Piece, { where: { id: piece.id }, lock: { mode: 'pessimistic_write' } });
            const movementRepo = manager.getRepository(ud_movement_entity_1.UDMovement);
            const existingMovement = await movementRepo.findOne({
                where: { pieceId: piece.id, type: ud_movement_type_enum_1.UDMovementType.CONSUMPTION },
            });
            if (existingMovement)
                return existingMovement;
            const reservation = await movementRepo.findOne({
                where: { pieceId: piece.id, type: ud_movement_type_enum_1.UDMovementType.RESERVATION },
            });
            const budget = reservation
                ? await manager.findOne(ud_budget_entity_1.UDBudget, { where: { id: reservation.udBudgetId } })
                : null;
            if (!reservation || !budget) {
                throw new common_1.BadRequestException('La pieza no tiene una reserva de UD vigente. Vuelve a asignarla antes de entregar.');
            }
            await manager.findOne(ud_budget_entity_1.UDBudget, { where: { id: budget.id }, lock: { mode: 'pessimistic_write' } });
            const amount = piece.udAmount;
            if (amount > Number(budget.reserved)) {
                throw new common_1.BadRequestException(`UD reservadas insuficientes para confirmar. Reservadas: ${budget.reserved}, a consumir: ${amount}`);
            }
            budget.reserved = Number(budget.reserved) - amount;
            budget.consumed = Number(budget.consumed) + amount;
            await manager.save(ud_budget_entity_1.UDBudget, budget);
            const movement = manager.create(ud_movement_entity_1.UDMovement, {
                udBudgetId: budget.id,
                pieceId: piece.id,
                type: ud_movement_type_enum_1.UDMovementType.CONSUMPTION,
                amount,
                reason: `Consumo confirmado por entrega de pieza ${piece.title}`,
                actorId,
            });
            return manager.save(ud_movement_entity_1.UDMovement, movement);
        };
        return transactionManager ? execute(transactionManager) : this.budgetRepo.manager.transaction(execute);
    }
    async isNearLimit(budget, thresholdPercent) {
        const organizationId = await this.resolveOrganizationId(budget.clientId);
        const threshold = thresholdPercent ?? (await this.parameterResolver.get('ud.warning_threshold_percent', budget.clientId, null, organizationId)) ?? 80;
        const used = Number(budget.reserved) + Number(budget.consumed);
        const total = Number(budget.contracted);
        if (total <= 0)
            return false;
        return (used / total) >= (threshold / 100);
    }
    async checkBudgetAlert(clientId, clientName) {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const budget = await this.ensureMonthlyBudget(clientId, year, month);
        const used = Number(budget.reserved) + Number(budget.consumed);
        const total = Number(budget.contracted);
        const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
        const organizationId = await this.resolveOrganizationId(clientId);
        const warningThreshold = Number(await this.parameterResolver.get('ud.warning_threshold_percent', clientId, null, organizationId) ?? 80);
        let status = 'ok';
        if (used >= total) {
            status = 'blocked';
        }
        else if (percentage >= warningThreshold) {
            status = 'warning';
        }
        return { clientId, clientName, used, total, percentage, status };
    }
    async resolveMonthlyBudget(clientId) {
        const fromParam = await this.parameterResolver.get('ud.default_monthly_budget', clientId);
        return Number(fromParam ?? 20);
    }
    async resolveOrganizationId(clientId) {
        const client = await this.clientRepo.findOne({ where: { id: clientId }, select: { organizationId: true } });
        return client?.organizationId ?? null;
    }
};
exports.DesignBudgetService = DesignBudgetService;
exports.DesignBudgetService = DesignBudgetService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ud_budget_entity_1.UDBudget)),
    __param(1, (0, typeorm_1.InjectRepository)(ud_movement_entity_1.UDMovement)),
    __param(2, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        parameter_resolver_service_1.ParameterResolver])
], DesignBudgetService);
