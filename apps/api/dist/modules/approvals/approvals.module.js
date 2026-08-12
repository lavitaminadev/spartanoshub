"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const approval_request_entity_1 = require("./approval-request.entity");
const approvals_controller_1 = require("./approvals.controller");
const list_approvals_use_case_1 = require("./list-approvals.use-case");
const update_approval_status_use_case_1 = require("./update-approval-status.use-case");
const piece_entity_1 = require("../production/piece.entity");
const piece_version_entity_1 = require("../production/piece-version.entity");
const correction_entity_1 = require("../production/correction.entity");
const piece_rules_service_1 = require("../production/piece-rules.service");
const client_entity_1 = require("../clients/client.entity");
const parameters_module_1 = require("../../core/parameters/parameters.module");
let ApprovalsModule = class ApprovalsModule {
};
exports.ApprovalsModule = ApprovalsModule;
exports.ApprovalsModule = ApprovalsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([approval_request_entity_1.ApprovalRequest, piece_entity_1.Piece, piece_version_entity_1.PieceVersion, correction_entity_1.Correction, client_entity_1.Client]), parameters_module_1.ParametersModule],
        controllers: [approvals_controller_1.ApprovalsController],
        providers: [list_approvals_use_case_1.ListApprovalsUseCase, update_approval_status_use_case_1.UpdateApprovalStatusUseCase, piece_rules_service_1.PieceRulesService],
    })
], ApprovalsModule);
