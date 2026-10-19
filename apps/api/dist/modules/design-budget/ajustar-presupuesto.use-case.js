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
exports.AjustarPresupuestoUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ud_budget_entity_1 = require("./ud-budget.entity");
const ud_movement_entity_1 = require("./ud-movement.entity");
const ud_movement_type_enum_1 = require("./ud-movement-type.enum");
const client_entity_1 = require("../clients/client.entity");
let AjustarPresupuestoUseCase = class AjustarPresupuestoUseCase {
    constructor(presupuestos, clientes) {
        this.presupuestos = presupuestos;
        this.clientes = clientes;
    }
    async execute(organizationId, clientId, year, month, contratadas, motivo, actorId) {
        return this.presupuestos.manager.transaction(async (manager) => {
            const cliente = await manager.findOne(client_entity_1.Client, { where: { id: clientId, organizationId } });
            if (!cliente)
                throw new common_1.NotFoundException('Cliente no encontrado');
            const presupuesto = await manager.findOne(ud_budget_entity_1.UDBudget, {
                where: { clientId, year, month },
                lock: { mode: 'pessimistic_write' },
            });
            if (!presupuesto)
                throw new common_1.NotFoundException('Ese mes todavía no tiene presupuesto abierto');
            const comprometido = Number(presupuesto.reserved) + Number(presupuesto.consumed);
            if (contratadas < comprometido) {
                throw new common_1.BadRequestException(`Este mes ya tiene ${comprometido} UD entre reservadas y consumidas: no se puede dejar el contrato en ${contratadas}. Suelta antes las piezas reservadas que no se vayan a hacer.`);
            }
            const antes = Number(presupuesto.contracted);
            if (antes === contratadas)
                return presupuesto;
            presupuesto.contracted = contratadas;
            const guardado = await manager.save(ud_budget_entity_1.UDBudget, presupuesto);
            await manager.save(ud_movement_entity_1.UDMovement, manager.create(ud_movement_entity_1.UDMovement, {
                udBudgetId: guardado.id,
                type: contratadas > antes ? ud_movement_type_enum_1.UDMovementType.EXTRA : ud_movement_type_enum_1.UDMovementType.ADJUSTMENT,
                amount: contratadas - antes,
                reason: motivo,
                actorId,
            }));
            return guardado;
        });
    }
};
exports.AjustarPresupuestoUseCase = AjustarPresupuestoUseCase;
exports.AjustarPresupuestoUseCase = AjustarPresupuestoUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ud_budget_entity_1.UDBudget)),
    __param(1, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], AjustarPresupuestoUseCase);
