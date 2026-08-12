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
exports.ReserveUdUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ud_budget_entity_1 = require("./ud-budget.entity");
const ud_movement_entity_1 = require("./ud-movement.entity");
const ud_movement_type_enum_1 = require("./ud-movement-type.enum");
const piece_entity_1 = require("../production/piece.entity");
let ReserveUdUseCase = class ReserveUdUseCase {
    constructor(budgetRepo, movementRepo) {
        this.budgetRepo = budgetRepo;
        this.movementRepo = movementRepo;
    }
    async execute(organizationId, clientId, pieceId, amount, year, month) {
        return this.budgetRepo.manager.transaction(async (manager) => {
            const piece = await manager.findOne(piece_entity_1.Piece, {
                where: { id: pieceId, organizationId, clientId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!piece)
                throw new common_1.NotFoundException('Pieza no encontrada');
            if (Math.abs(Number(piece.udAmount) - amount) > 0.001) {
                throw new common_1.BadRequestException('La cantidad UD debe coincidir con el costo calculado de la pieza');
            }
            const budget = await manager.findOne(ud_budget_entity_1.UDBudget, {
                where: { clientId, year, month },
                lock: { mode: 'pessimistic_write' },
            });
            if (!budget)
                throw new common_1.NotFoundException('Presupuesto UD no encontrado. Cree el presupuesto primero.');
            const existing = await manager.findOne(ud_movement_entity_1.UDMovement, {
                where: { pieceId, type: ud_movement_type_enum_1.UDMovementType.RESERVATION },
            });
            if (existing) {
                if (existing.udBudgetId !== budget.id)
                    throw new common_1.BadRequestException('La pieza ya tiene una reserva en otro período');
                return budget;
            }
            const available = Number(budget.contracted) - Number(budget.reserved) - Number(budget.consumed);
            if (amount > available)
                throw new common_1.BadRequestException(`UD insuficientes. Disponibles: ${available}, requeridas: ${amount}`);
            budget.reserved = Number(budget.reserved) + amount;
            await manager.save(ud_budget_entity_1.UDBudget, budget);
            const movement = manager.create(ud_movement_entity_1.UDMovement, {
                udBudgetId: budget.id,
                pieceId,
                type: ud_movement_type_enum_1.UDMovementType.RESERVATION,
                amount,
            });
            await manager.save(ud_movement_entity_1.UDMovement, movement);
            return budget;
        });
    }
};
exports.ReserveUdUseCase = ReserveUdUseCase;
exports.ReserveUdUseCase = ReserveUdUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ud_budget_entity_1.UDBudget)),
    __param(1, (0, typeorm_1.InjectRepository)(ud_movement_entity_1.UDMovement)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], ReserveUdUseCase);
