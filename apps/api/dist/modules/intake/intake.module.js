"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntakeModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const work_request_entity_1 = require("./work-request.entity");
const client_entity_1 = require("../clients/client.entity");
const user_entity_1 = require("../users/user.entity");
const piece_entity_1 = require("../production/piece.entity");
const session_entity_1 = require("../audiovisual/session.entity");
const moodboard_entity_1 = require("../audiovisual/moodboard.entity");
const intake_controller_1 = require("./intake.controller");
const intake_service_1 = require("./intake.service");
const design_budget_module_1 = require("../design-budget/design-budget.module");
const production_module_1 = require("../production/production.module");
const account_access_module_1 = require("../../core/client-scope/account-access.module");
let IntakeModule = class IntakeModule {
};
exports.IntakeModule = IntakeModule;
exports.IntakeModule = IntakeModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([work_request_entity_1.WorkRequest, client_entity_1.Client, user_entity_1.User, piece_entity_1.Piece, session_entity_1.Session, moodboard_entity_1.Moodboard]), account_access_module_1.AccountAccessModule, design_budget_module_1.DesignBudgetModule, production_module_1.ProductionModule],
        controllers: [intake_controller_1.IntakeController],
        providers: [intake_service_1.IntakeService],
        exports: [intake_service_1.IntakeService],
    })
], IntakeModule);
