"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductionModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const piece_entity_1 = require("./piece.entity");
const piece_version_entity_1 = require("./piece-version.entity");
const correction_entity_1 = require("./correction.entity");
const production_controller_1 = require("./production.controller");
const assign_piece_use_case_1 = require("./assign-piece.use-case");
const cancel_piece_use_case_1 = require("./cancel-piece.use-case");
const piece_type_definition_entity_1 = require("./piece-type-definition.entity");
const piece_types_service_1 = require("./piece-types.service");
const audit_module_1 = require("../../core/audit/audit.module");
const piece_types_controller_1 = require("./piece-types.controller");
const submit_version_use_case_1 = require("./submit-version.use-case");
const reject_piece_use_case_1 = require("./reject-piece.use-case");
const deliver_piece_use_case_1 = require("./deliver-piece.use-case");
const list_pieces_use_case_1 = require("./list-pieces.use-case");
const piece_rules_service_1 = require("./piece-rules.service");
const production_workflow_service_1 = require("./production-workflow.service");
const design_budget_module_1 = require("../design-budget/design-budget.module");
const gamification_module_1 = require("../gamification/gamification.module");
const approval_request_entity_1 = require("../approvals/approval-request.entity");
const billing_module_1 = require("../billing/billing.module");
const user_entity_1 = require("../users/user.entity");
const client_entity_1 = require("../clients/client.entity");
const parameters_module_1 = require("../../core/parameters/parameters.module");
let ProductionModule = class ProductionModule {
};
exports.ProductionModule = ProductionModule;
exports.ProductionModule = ProductionModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([piece_entity_1.Piece, piece_version_entity_1.PieceVersion, correction_entity_1.Correction, approval_request_entity_1.ApprovalRequest, user_entity_1.User, client_entity_1.Client, piece_type_definition_entity_1.PieceTypeDefinition]), design_budget_module_1.DesignBudgetModule, gamification_module_1.GamificationModule, billing_module_1.BillingModule, parameters_module_1.ParametersModule, audit_module_1.AuditModule],
        controllers: [production_controller_1.ProductionController, piece_types_controller_1.PieceTypesController],
        providers: [piece_types_service_1.PieceTypesService, assign_piece_use_case_1.AssignPieceUseCase, cancel_piece_use_case_1.CancelPieceUseCase, submit_version_use_case_1.SubmitVersionUseCase, reject_piece_use_case_1.RejectPieceUseCase, deliver_piece_use_case_1.DeliverPieceUseCase, list_pieces_use_case_1.ListPiecesUseCase, production_workflow_service_1.ProductionWorkflowService, piece_rules_service_1.PieceRulesService],
        exports: [typeorm_1.TypeOrmModule, piece_types_service_1.PieceTypesService],
    })
], ProductionModule);
