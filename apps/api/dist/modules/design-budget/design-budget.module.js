"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DesignBudgetModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const ud_budget_entity_1 = require("./ud-budget.entity");
const ud_movement_entity_1 = require("./ud-movement.entity");
const design_budget_controller_1 = require("./design-budget.controller");
const get_or_create_budget_use_case_1 = require("./get-or-create-budget.use-case");
const reserve_ud_use_case_1 = require("./reserve-ud.use-case");
const confirm_ud_consumption_use_case_1 = require("./confirm-ud-consumption.use-case");
const design_budget_service_1 = require("./design-budget.service");
const ud_values_service_1 = require("./ud-values.service");
const parameters_module_1 = require("../../core/parameters/parameters.module");
const piece_entity_1 = require("../production/piece.entity");
const piece_type_definition_entity_1 = require("../production/piece-type-definition.entity");
const client_entity_1 = require("../clients/client.entity");
let DesignBudgetModule = class DesignBudgetModule {
};
exports.DesignBudgetModule = DesignBudgetModule;
exports.DesignBudgetModule = DesignBudgetModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([ud_budget_entity_1.UDBudget, ud_movement_entity_1.UDMovement, piece_entity_1.Piece, client_entity_1.Client, piece_type_definition_entity_1.PieceTypeDefinition]), parameters_module_1.ParametersModule],
        controllers: [design_budget_controller_1.DesignBudgetController],
        providers: [get_or_create_budget_use_case_1.GetOrCreateBudgetUseCase, reserve_ud_use_case_1.ReserveUdUseCase, confirm_ud_consumption_use_case_1.ConfirmUdConsumptionUseCase, design_budget_service_1.DesignBudgetService, ud_values_service_1.UdValuesService],
        exports: [design_budget_service_1.DesignBudgetService, ud_values_service_1.UdValuesService],
    })
], DesignBudgetModule);
